const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const { MongoClient } = require('mongodb');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT;
const wss = new WebSocket.Server({ server });

const cloudURI = `mongodb+srv://rfkyzr1:${encodeURIComponent(process.env.DB_PASSWORD)}@cluster0.1o4oz.mongodb.net/api?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(cloudURI);
let paymentsCollection;

// Koneksi ke MongoDB
const connectToMongoDB = async () => {
  try {
    await client.connect();
    console.log('✅ Terhubung ke MongoDB');

    const db = client.db('muslimifyDb');
    paymentsCollection = db.collection('payments');

  } catch (error) {
    console.error('❌ Gagal terhubung ke MongoDB:', error);
  }
};
connectToMongoDB();

// Cek status pembayaran setiap 5 detik
const getPaymentStatusService = (ws, uid, orderId) => {
  let previousStatus = null;

  const intervalId = setInterval(async () => {
    try {
      const payment = await paymentsCollection.findOne(
        { 'user.uid': uid, 'order_id': orderId },
        { projection: { 'transaction_status': 1 } }
      );

      if (payment && payment.transaction_status !== previousStatus) {
        previousStatus = payment.transaction_status;
        ws.send(JSON.stringify({ status: payment.transaction_status }));
        console.log(`✅ Status transaksi diperbarui: ${payment.transaction_status}`);
      }

    } catch (error) {
      console.error(`❌ Error mengambil status pembayaran: ${error.message}`);
      clearInterval(intervalId);
    }
  }, 5000); // Interval pengecekan 5 detik

  ws.on('close', () => {
    console.log(`🔌 User ${uid} terputus dari WebSocket.`);
    clearInterval(intervalId);  // Hentikan pengecekan saat WebSocket ditutup
  });
};

// WebSocket untuk terima permintaan client
wss.on('connection', (ws) => {
  console.log('🔗 Client terhubung ke WebSocket.');

  ws.on('message', (message) => {
    try {
      const { uid, orderId } = JSON.parse(message);
      if (uid && orderId) {
        getPaymentStatusService(ws, uid, orderId);
      } else {
        ws.send(JSON.stringify({ error: 'UID atau OrderID tidak valid.' }));
      }
    } catch (err) {
      console.error(`❌ Error parsing message: ${err.message}`);
      ws.send(JSON.stringify({ error: 'Format pesan tidak valid.' }));
    }
  });

  ws.on('close', () => {
    console.log('🔌 Client terputus dari WebSocket.');
  });
});

// Jalankan server
server.listen(PORT, () => {
  console.log(`🚀 WebSocket server berjalan di http://localhost:${PORT}`);
});
