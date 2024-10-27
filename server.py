#!/usr/bin/env python3

import asyncio, websockets, json, ssl
from websockets.server import WebSocketServerProtocol as WSServer
from websockets.frames import CloseCode
from pathlib import Path
from typing import Any

"""
from random import randint, choice

sol: int = randint(1, 3)

i: int = int(input('Choose a gate (1,2,3): '))

elim: int = choice([x for x in range(1, 4) if x not in [sol, i]])

print(f'Gate {elim} was eliminated')

choice: str = input('Do you want to change your selection? (y,n): ')

if choice == 'y':
    i = [x for x in range(1, 4) if x not in [elim, i]][0]

print(f'Your choice (gate {i}) was {"correct" if i == sol else "wrong"}!')
"""



admin_handles: list[WSServer] = []
user_handles: dict[str, WSServer] = {}

async def broadcast(wss: list[WSServer], msg: Any) -> None:
    for ws in wss:
        try:
            await ws.send(json.dumps(msg))
        except:
            pass

async def handle_admin(ws: WSServer) -> None:
    admin_handles.append(ws)

    async for msg in ws:
        pass
    
    admin_handles.remove(ws)


async def handle_user(ws: WSServer, id: str) -> None:
    user_handles[id] = ws

    async for msg in ws:
        pass
    
    del user_handles[id]

async def handle_ws(ws: WSServer, path: str) -> None:
    if path[0] == '/':
        path = path[1:]
    path_parts = path.split('/')

    if len(path_parts) != 1:
        await ws.send('{"error": "invalid path"}')
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
