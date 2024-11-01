const $ = q => document.querySelector(q);
const wsUrl = path => `ws://localhost:8137/${path}`

let uid = crypto.randomUUID();

let socket = new WebSocket(wsUrl(uid));
let state = 0; // 0 -> initial, 1 -> selected, 2 -> switched, 3 -> revealed

const selectGate = gate => {
    if (state != 0)
        return;
    state = 1;

    $(`#gate-${gate}>.gate`).classList.add('selected');
    for (let i = 1; i <= 3; i++)
        $(`#gate-${i}`).classList.add('no-hover');
    
    socket?.send(`{"action": "select", "selection": ${gate}}`)
}

const switchSelection = () => {
    if (state != 1)
        return;
    state = 2;

    $('#selection-change').disabled = true;
    $('#selection-keep').disabled = true;

    socket?.send('{"action": "switch"}')
}

const reveal = () => {
    if (state != 1 && state != 2)
        return;
    state = 3;

    $('#selection-change').disabled = true;
    $('#selection-keep').disabled = true;

    socket?.send('{"action": "reveal"}')
}


let testPending = true;
const testActive = () => {
    testPending = false;
    socket?.send(`{"action": "is_active"}`);
}

socket.addEventListener('message', e => {
    let data = JSON.parse(e.data);

    if (data.error) {
        console.log(data.error);
        return;
    }

    if (!data.active) {
        if (!testPending) {
            testPending = true;
            setTimeout(testActive, 5000);
        }
        return;
    }

    $('#wait-inactive').close();

    switch (state) {
        case 1:
            $(`#gate-${data.eliminated}>.overlay`).classList.remove('d-none');
            $(`#gate-${data.eliminated}>.overlay`).classList.remove('hidden');
            $('#selection-buttons').classList.remove('hidden');
            $('#msgbox').classList.remove('hidden');
            $('#msgbox').innerText = `Tor ${data.eliminated} wurde ausgeschlossen`;
            break;
        case 2:
            let selected = 0;
            let old = data.selection;
            switch (old) {
                case 1:
                    selected = data.eliminated == 3 ? 2 : 3;
                    break;
                case 2:
                    selected = data.eliminated == 1 ? 3 : 1;
                    break;
                case 3:
                    selected = data.eliminated == 2 ? 1 : 2;
                    break;
            }
            $(`#gate-${old}>.gate`).classList.remove('selected');
            $(`#gate-${selected}>.gate`).classList.add('selected');
            $('#msgbox').innerText = `Auswahl von Tor ${old} auf Tor ${selected} geändert`;
            setTimeout(reveal, 500);
            break;
        case 3:
            $('#msgbox').innerText = data.won ? `Du hast gewonnen!` : `Du hast nicht gewonnen. Tor ${data.winning} wäre korrekt gewesen.`;
            $(`#gate-${data.winning}`).classList.add('winning');
            for (let i = 1; i <= 3; i++)
                if (i != data.winning)
                    $(`#gate-${i}`).classList.add('no-hover');
            $('#reset').classList.remove('hidden')
            break;
    }
});

socket.addEventListener('open', testActive);

socket.addEventListener('close', e => {
    socket = undefined;
    uid = crypto.randomUUID();
    setTimeout(() => socket = new WebSocket(wsUrl(uid)), 1000);
});

const reset = () => {
    state = 0;

    for (let i = 1; i <= 3; i++) {
        $(`#gate-${i}`).classList.remove('winning');
        $(`#gate-${i}`).classList.remove('no-hover');
        $(`#gate-${i}>.gate`).classList.remove('selected');
        $(`#gate-${i}>.overlay`).classList.add('hidden');
        $(`#gate-${i}>.overlay`).classList.add('d-none');
    }
    $('#reset').classList.add('hidden')
    $('#selection-buttons').classList.add('hidden');
    $('#msgbox').classList.add('hidden');
    $('#msgbox').innerText = '';
    $('#msgbox').innerHTML = '&nbsp;';

    $('#selection-change').disabled = false;
    $('#selection-keep').disabled = false;

    socket?.send('{"action": "reset"}');
}

document.addEventListener('DOMContentLoaded', () => {
    $('#wait-inactive').showModal();
});
