#!/usr/bin/env python3

import asyncio, websockets, json, ssl
from websockets.server import WebSocketServerProtocol as WSServer
from websockets.frames import CloseCode
from pathlib import Path
from typing import Any
from enum import Enum
from random import randint, choice
from argon2 import PasswordHasher

# just realized i don't even need websockets.... could've done all this using plain old http, too

# client compare order: check if error, check if active, check values according to local state

class GameState(Enum):
    INIT = 1 # connection initiated, no action taken yet
    SELECTED = 2 # user selected a gate
    ELIMINATED = 3 # a non-selected and non-winning gate was eliminated
    SWITCHED = 4 # the user chose to (or not to) switch their selection
    REVEALED = 5 # the winning gate is revealed and the game is finished

class UserState:
    def __init__(self):
        self.game_state: GameState = GameState.INIT
        self.winning: int = randint(1, 3)
        self.selection: int = 0
        self.eliminated: int = 0
        self.switched: bool = False


admin_key = '$argon2id$v=19$m=65536,t=11,p=4$TPzUE4+txKA7x0nf8mxLyQ$gzMRz8+CNnAxasW7rsnBQbSRwDX2XR5Ll9ZfWcwg36w'
argon = PasswordHasher(time_cost=11)

active: bool = False
admin_handles: list[WSServer] = []
user_handles: dict[str, WSServer] = {}
user_states = dict[str, UserState] = {}
game_stats = { 'total': 0, 'won': 0, 'lost': 0, 'switched': 0, 'won_switched': 0, 'lost_switched': 0, 'stayed': 0, 'won_stayed': 0, 'lost_stayed': 0 }

def decorate(data: dict[str, Any]) -> dict[str, Any]:
    data['active'] = active
    return data

async def send(ws: WSServer, msg: Any) -> None:
    await ws.send(json.dumps(msg))


async def handle_admin(ws: WSServer) -> None:
    global active
    admin_handles.append(ws)
    auth = False
    auth_tries = 0

    async for msg in ws:
        try:
            data = json.loads(msg)

            if not auth:
                if not 'auth' in data:
                    await send(ws, { 'error': 'authentication required' })
                    continue

                key = data['auth']
                try:
                    argon.verify(admin_key, key)
                    auth = True
                    if not 'action' in data:
                        continue # support bundling auth and auth + action
                except:
                    auth_tries += 1
                    await send(ws, { 'error': 'authentication failure' })
                    if auth_tries >= 3:
                        break
                    continue

            action = data['action']
            match action:
                case 'start':
                    active = True
                case 'query':
                    await send(ws, decorate(game_stats))
                case _:
                    await send(ws, { 'error': f'invalid action: {action}'})
        except:
            await send(ws, { 'error': 'malformed data' })
    
    admin_handles.remove(ws)


async def handle_user(ws: WSServer, id: str) -> None:
    user_handles[id] = ws
    user_states[id] = state = UserState()

    async for msg in ws:
        try:
            data = json.loads(msg)
            action = data['action']

            if not active:
                await send(ws, decorate({}))
                continue
            
            match action:
                case 'is_active':
                    await send(ws, decorate({}))

                case 'select':
                    if state.game_state not in [ GameState.INIT ]:
                        await send(ws, { 'error': 'incorrect action order, follow: select, (then switch,) then reveal' })
                        continue

                    selection = data.get('selection', None)
                    if not selection or 1 > selection or 3 < selection:
                        await send(ws, { 'error': f'invalid "selection": {selection}, must be one of: [1, 2, 3]' })
                        continue

                    state.selection = selection
                    state.game_state = GameState.SELECTED

                    state.eliminated = choice([x for x in range(1, 4) if x not in [state.selection, state.winning]])
                    state.game_state = GameState.ELIMINATED
                    await send(ws, decorate({
                        'selection': state.selection,
                        'eliminated': state.eliminated
                    }))

                case 'switch':
                    if state.game_state not in [ GameState.ELIMINATED ]:
                        await send(ws, { 'error': 'incorrect action order, follow: select, (then switch,) then reveal' })
                        continue
                    state.switched = True
                    state.game_state = GameState.SWITCHED

                case 'reveal':
                    if state.game_state not in [ GameState.SWITCHED, GameState.ELIMINATED ]:
                        await send(ws, { 'error': 'incorrect action order, follow: select, (then switch,) then reveal' })
                        continue

                    won: bool = (state.selection == state.winning) ^ state.switched
                    game_stats['total'] += 1
                    game_stats['won' if won else 'lost'] += 1
                    game_stats['switched' if state.switched else 'stayed'] += 1
                    game_stats[('won' if won else 'lost') + ('_switched' if state.switched else '_stayed')] += 1

                    state.game_state = GameState.REVEALED
                    await send(ws, decorate({
                        'selection': state.selection,
                        'eliminated': state.eliminated,
                        'switched': state.switched,
                        'winning': state.winning,
                        'won': (state.selection == state.winning) ^ state.switched # neq if switched, else eq
                    }))

                case 'reset':
                    user_states[id] = state = UserState()
                    await send(ws, decorate({}))

                case 'stop':
                    await send(ws, { 'action': 'stop' })
                    break

                case _:
                    await send(ws, { 'error': f'invalid action: {action}'})
        except:
            await send(ws, { 'error': 'malformed data' })
    
    del user_states[id]
    del user_handles[id]

async def handle_ws(ws: WSServer, path: str) -> None:
    if path[0] == '/':
        path = path[1:]
    path_parts = path.split('/')

    if len(path_parts) != 1:
        await send(ws, { 'error': 'invalid path' })
        await ws.close(CloseCode.GOING_AWAY, "invalid path")
        return

    if path_parts[0] == 'admin':
        await handle_admin(ws)
    else:
        await handle_user(ws, path_parts[0])


if __name__ == '__main__':
    basepath = Path(__file__).parent
    sslconfig = basepath.joinpath('ssl.json')
    if sslconfig.exists() and sslconfig.is_file():
        ssl_info = json.loads(sslconfig.read_text())
        ssl_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ssl_ctx.load_cert_chain(ssl_info['fullchain'], ssl_info['privkey'])
        ssl_ctx.set_servername_callback()

    start_server = websockets.serve(handle_ws, 'localhost', 8137, ssl=ssl_ctx)
    asyncio.get_event_loop().run_until_complete(start_server)
    asyncio.get_event_loop().run_forever()
