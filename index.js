require('dotenv').config();
const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const { MongoClient } = require('mongodb');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const DB_PASSWORD = process.env.DB_PASSWORD;

if (!DB_PASSWORD) {
  console.error('❌ DB_PASSWORD tidak ditemukan di .env');
  process.exit(1);
}

const cloudURI = `mongodb+srv://rifkywebsocket:${encodeURIComponent(DB_PASSWORD)}@cluster0.1o4oz.mongodb.net/api?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(cloudURI);

let paymentsCollection;

const wss = new WebSocket.Server({ server });

// 🔗 Koneksi ke MongoDB
const connectToMongoDB = async () => {
  try {
    await client.connect();
    console.log('✅ Terhubung ke MongoDB');
    const db = client.db('api');
    paymentsCollection = db.collection('payments');
  } catch (error) {
    console.error('❌ Gagal terhubung ke MongoDB:', error);
    process.exit(1);
  }
};
connectToMongoDB();

// 🛠 Fungsi untuk memantau status pembayaran menggunakan `watch` (real-time)
const getPaymentStatusService = (ws, uid, orderId) => {
  try {
    const changeStream = paymentsCollection.watch([
      {
        $match: {
          'fullDocument.user.uid': uid,
          'fullDocument.order_id': orderId
        }
      }
    ]);

    console.log(`👀 Memantau perubahan status untuk OrderID: ${orderId}`);

    changeStream.on('change', (change) => {
      const updatedDoc = change.fullDocument;
      if (updatedDoc) {
        const { transaction_status } = updatedDoc;
        ws.send(JSON.stringify({ status: transaction_status }));
        console.log(`✅ Status transaksi diperbarui: ${transaction_status}`);

        // 🛑 Tutup stream jika status "paid" atau "cancelled"
        if (transaction_status === 'paid' || transaction_status === 'cancelled') {
          console.log(`🛑 Pembayaran ${transaction_status}, hentikan pemantauan.`);
          changeStream.close();  // Hentikan stream
          ws.close();  // Tutup WebSocket
        }
      }
    });

    ws.on('close', () => {
      console.log('🔌 Client terputus dari WebSocket.');
      changeStream.close();  // Bersihkan stream saat WebSocket ditutup
    });

  } catch (error) {
    console.error(`❌ Error MongoDB: ${error.message}`);
    ws.send(JSON.stringify({ error: 'Terjadi kesalahan pada server.' }));
  }
};

// 🌐 WebSocket untuk terima permintaan client
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

// 🚀 Jalankan server
server.listen(PORT, () => {
  console.log(`🚀 WebSocket server berjalan di http://localhost:${PORT}`);
});
