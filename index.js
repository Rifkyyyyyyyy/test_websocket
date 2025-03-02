const WebSocket = require('ws')
const http = require('http')
const server = http.createServer();

const PORT = 3000;
const wss = new WebSocket.Server({ server })

wss.on('connection', ws => {
    ws.on('message', message => {
        console.log(`Received message => ${message}`)
    })
    setInterval(function () { ws.send('Hello! Message From Server!!') }, 1000);

})

server.listen(PORT, () => {
    console.log(`WebSocket server running on ${PORT}`);
});
