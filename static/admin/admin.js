const $ = q => document.querySelector(q);
const wsUrl = 'ws://localhost:8137/admin'

let socket = new WebSocket(wsUrl);

const login = () => {
    socket?.send(`{"action": "query", "auth": "${$('#password-prompt').value}"}`);
}

let queryPending = false;
const query = () => {
    queryPending = false;
    socket?.send(`{"action": "query"}`);
}

const start = () => {
    socket?.send(`{"action": "start"}`);
    if (!queryPending)
        query();
}

socket.addEventListener('message', e => {
    let data = JSON.parse(e.data);
    console.log(data);

    if (data.error) {
        $('#password-prompt').classList.add('error')
        console.log(data.error);
        return;
    }

    $('#auth-prompt').close();

    if (data.active) {
        $('#start-button').classList.add('d-none');
        $('#content-row-1').classList.remove('d-none');
        $('#content-row-2').classList.remove('d-none');
    } else {
        $('#start-button').classList.remove('d-none');
        $('#content-row-1').classList.add('d-none');
        $('#content-row-2').classList.add('d-none');
    }

    // TODO update charts

    if (!queryPending) {
        queryPending = true;
        setTimeout(query, 500);
    }
});

socket.addEventListener('open', e => {

});

socket.addEventListener('close', e => {
    socket = undefined;
    setTimeout(() => socket = new WebSocket(wsUrl), 1000);
});

document.addEventListener('DOMContentLoaded', () => {
    $('#auth-prompt').showModal();
});
