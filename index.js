const WebSocket = require('ws')
const PORT = 3000;
const wss = new WebSocket.Server({ port: PORT })
const server = http
wss.on('connection', ws => {
    ws.on('message', message => {
        console.log(`Received message => ${message}`)
    })
    setInterval(function () { ws.send('Hello! Message From Server!!') }, 1000);

})