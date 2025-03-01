const http = require('http');
const WebSocket = require('ws');

const PORT = 3000;
const server = http.createServer(); // Buat server HTTP

// Buat WebSocket server menggunakan HTTP server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message) => {
        console.log(`Received message => ${message}`);
    });

    // Kirim pesan ke client setiap 1 detik
    const interval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send('Hello! Message From Server!!');
        }
    }, 1000);

    // Hentikan interval jika koneksi ditutup
    ws.on('close', () => {
        console.log('Client disconnected');
        clearInterval(interval);
    });
});

// Jalankan server di port 3000
server.listen(PORT, () => {
    console.log(`WebSocket server running on ws://localhost:${PORT}`);
});
