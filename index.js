require('dotenv').config();
const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const { MongoClient } = require('mongodb');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ server });

const cloudURI = `mongodb+srv://rifkywebsocket:${encodeURIComponent(process.env.DB_PASSWORD)}@cluster0.1o4oz.mongodb.net/api?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(cloudURI);

let paymentsCollection;
const activeIntervals = new Set();  // Cache buat ngehindarin memory leak

// 🔗 Koneksi ke MongoDB
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

// 🔄 Cek Status Pembayaran (Polling)
const getPaymentStatusService = (ws, uid, orderId) => {
  let previousStatus = null;

  const intervalId = setInterval(async () => {
    try {
      const payment = await paymentsCollection.findOne(
        { 'user.uid': uid, 'order_id': orderId },
        { projection: { transaction_status: 1 } }
      );

      if (payment && payment.transaction_status !== previousStatus) {
        previousStatus = payment.transaction_status;

        // 🟢 Cek status WebSocket sebelum kirim data
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ status: payment.transaction_status }));
        }

        console.log(`✅ Status transaksi diperbarui: ${payment.transaction_status}`);

        // 🛑 Stop interval kalau statusnya "paid" atau "cancelled"
        if (['paid', 'cancelled'].includes(payment.transaction_status)) {
          clearInterval(intervalId);
          activeIntervals.delete(intervalId);  // Hapus dari cache
          if (ws.readyState === WebSocket.OPEN) ws.terminate();  // Tutup WebSocket
        }
      }
    } catch (error) {
      console.error(`❌ Error MongoDB: ${error.message}`);
    } finally {
      // Bersihin interval biar nggak memory leak
      if (ws.readyState !== WebSocket.OPEN) {
        clearInterval(intervalId);
        activeIntervals.delete(intervalId);
      }
    }
  }, 10000); // ⏱️ Cek tiap 10 detik

  activeIntervals.add(intervalId);  // Simpan interval buat kontrol
};

// 📡 WebSocket untuk Terima Permintaan Client
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
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ error: 'Format pesan tidak valid.' }));
      }
    }
  });

  ws.on('close', () => {
    console.log('🔌 Client terputus dari WebSocket.');
    activeIntervals.forEach(clearInterval);  // Bersihin semua interval aktif
    activeIntervals.clear();  // Reset cache
  });
});

// 🚀 Jalankan Server
server.listen(PORT, () => {
  console.log(`🚀 WebSocket server berjalan di http://localhost:${PORT}`);
});
