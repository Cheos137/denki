const $ = q => document.querySelector(q);
const wsUrl = 'ws://localhost:8137/admin'
const foregroundColor = '#eeeaea';
const backgroundColor = '#1f1f22';
const charts = [];

const totalData = [0, 0];
const switchStayData = [0, 0];
const switchData = [0, 0];
const stayData = [0, 0];

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

    if (data['total'])
        $('#total>h2').innerText = `${data['total']} games Total`
    
    if (data['won'])
        totalData[0] = data['won']
    if (data['lost'])
        totalData[1] = data['lost']
    if (data['switched'])
        switchStayData[0] = data['switched']
    if (data['stayed'])
        switchStayData[1] = data['stayed']
    if (data['won_switched'])
        switchData[0] = data['won_switched']
    if (data['lost_switched'])
        switchData[1] = data['lost_switched']
    if (data['won_stayed'])
        stayData[0] = data['won_stayed']
    if (data['lost_stayed'])
        stayData[1] = data['lost_stayed']

    charts.forEach(chart => chart.update());

    if (!queryPending) {
        queryPending = true;
        setTimeout(query, 1000);
    }
});

socket.addEventListener('open', e => {

});

socket.addEventListener('close', e => {
    socket = undefined;
    setTimeout(() => socket = new WebSocket(wsUrl), 1000);
});

const chartOptions = {
    animation: true,
    plugins: {
        legend: {
            display: true,
            position: 'bottom',
            labels: {
                color: foregroundColor,
                font: {
                    size: 18
                }
            }
        },
        tooltip: {
            enabled: false
        },
        datalabels: {
            formatter: (value, ctx) => {
                const datapoints = ctx.chart.data.datasets[0].data;
                const total = datapoints.reduce((total, datapoint) => total + datapoint, 0);
                const percentage = value / total * 100;
                return percentage.toFixed(2) + "%";
            },
            color: backgroundColor,
            font: {
                size: 18
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    $('#auth-prompt').showModal();

    Chart.register(ChartDataLabels);

    charts.push(new Chart(
        document.getElementById('chart-total'),
        {
            type: 'pie',
            options: chartOptions,
            data: {
                labels: [ 'Total Wins', 'Total Losses' ],
                datasets: [
                    {
                        data: totalData,
                        backgroundColor: [
                            '#40be3e',
                            '#f15656'
                        ],
                        borderColor: foregroundColor
                    }
                ]
            }
        }
    ));

    charts.push(new Chart(
        document.getElementById('chart-switched-to-stayed'),
        {
            type: 'pie',
            options: chartOptions,
            data: {
                labels: [ 'Switched', 'Stayed' ],
                datasets: [
                    {
                        data: switchStayData,
                        backgroundColor: [
                            '#97a81b',
                            '#dd5100'
                        ],
                        borderColor: foregroundColor
                    }
                ]
            }
        }
    ));

    charts.push(new Chart(
        document.getElementById('chart-switched'),
        {
            type: 'pie',
            options: chartOptions,
            data: {
                labels: [ 'Switched Wins', 'Switched Losses' ],
                datasets: [
                    {
                        data: switchData,
                        backgroundColor: [
                            '#97a81b',
                            '#2c4fc1'
                        ],
                        borderColor: foregroundColor
                    }
                ]
            }
        }
    ));

    charts.push(new Chart(
        document.getElementById('chart-stayed'),
        {
            type: 'pie',
            options: chartOptions,
            data: {
                labels: [ 'Stayed Wins', 'Stayed Losses' ],
                datasets: [
                    {
                        data: stayData,
                        backgroundColor: [
                            '#d015d0',
                            '#dd5100'
                        ],
                        borderColor: foregroundColor
                    }
                ]
            }
        }
    ));
});
