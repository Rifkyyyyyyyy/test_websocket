require('dotenv').config();

const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const { MongoClient } = require('mongodb');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT ;
const wss = new WebSocket.Server({ server });

const cloudURI = `mongodb+srv://rifkywebsocket:${encodeURIComponent(process.env.DB_PASSWORD)}@cluster0.1o4oz.mongodb.net/api?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(cloudURI);
let paymentsCollection;

// Koneksi ke MongoDB
const connectToMongoDB = async () => {
  try {
    await client.connect();
    console.log('✅ Terhubung ke MongoDB');

    const db = client.db('api');

    paymentsCollection = db.collection('payments');


  } catch (error) {
    console.error('❌ Gagal terhubung ke MongoDB:', error);
  }
};
connectToMongoDB();

// Cek status pembayaran setiap 5 detik
// Cek status pembayaran setiap 10 detik
const getPaymentStatusService = (ws, uid, orderId) => {
  let previousStatus = null;

  const intervalId = setInterval(async () => {
    try {
      const payment = await paymentsCollection.findOne(
        { 'user.uid': uid, 'order_id': orderId },
        { projection: { 'transaction_status': 1 } }
      );

      console.log(`🔍 Data pembayaran: ${JSON.stringify(payment)}`); 

      if (payment && payment.transaction_status !== previousStatus) {
        previousStatus = payment.transaction_status;
        ws.send(JSON.stringify({ status: payment.transaction_status }));
        console.log(`✅ Status transaksi diperbarui: ${payment.transaction_status}`);

        // 🛑 Hentikan pengecekan kalau statusnya "paid" atau "cancelled"
        if (payment.transaction_status === 'paid' || payment.transaction_status === 'cancelled') {
          console.log(`🛑 Pembayaran ${payment.transaction_status}, hentikan pengecekan.`);
          clearInterval(intervalId);  // Hentikan interval
        }
      }

    } catch (error) {
      console.error(`❌ Error MongoDB: ${error.message}`);
      clearInterval(intervalId);
    }
  }, 10000); // Ganti jadi 10 detik buat cek
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
