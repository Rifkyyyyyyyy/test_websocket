// ✅ Import Packages
const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const { MongoClient } = require('mongodb');  // Pakai Native MongoDB Driver

const app = express();
const server = http.createServer(app);

const PORT = 3000;
const wss = new WebSocket.Server({ server });

// ✅ MongoDB Connection URI
const cloudURI = `mongodb+srv://rfkyzr1:${encodeURIComponent(process.env.DB_PASSWORD)}@cluster0.1o4oz.mongodb.net/api?retryWrites=true&w=majority&appName=Cluster0`;

// ✅ Buat Koneksi MongoDB Native
const client = new MongoClient(cloudURI);
let paymentsCollection;  // Variable untuk collection

const connectToMongoDB = async () => {
  try {
    await client.connect();
    console.log('✅ Terhubung ke MongoDB');

    const db = client.db('muslimifyDb');  // Ganti 'api' sesuai nama database kamu
    paymentsCollection = db.collection('payments');  // Ganti 'payments' sesuai nama collection kamu

  } catch (error) {
    console.error('❌ Gagal terhubung ke MongoDB:', error);
  }
};
connectToMongoDB();

// ✅ Fungsi Monitor Status Pembayaran
const getPaymentStatusService = async (ws, uid, orderId) => {
  try {
    console.log(`📡 Memantau pembayaran UID: ${uid}, OrderID: ${orderId}`);

    // ✅ Native MongoDB Change Stream Langsung dari Collection
    const changeStream = paymentsCollection.watch([
      {
        $match: {
          'fullDocument.user.uid': uid,
          'fullDocument.order_id': orderId
        }
      }
    ]);

    changeStream.on('change', (change) => {
      try {
        if (change.operationType === 'update') {
          const updatedFields = change.updateDescription.updatedFields;
          if (updatedFields.transaction_status) {
            const newStatus = updatedFields.transaction_status;
            ws.send(JSON.stringify({ status: newStatus }));
            console.log(`✅ Status transaksi diperbarui: ${newStatus}`);
          }
        }
      } catch (err) {
        console.error(`❌ Error processing change event: ${err.message}`);
        changeStream.close();
      }
    });

    ws.on('close', () => {
      console.log(`❌ User ${uid} disconnected dari WebSocket.`);
      changeStream.close();
    });

  } catch (error) {
    console.error(`❌ Error monitoring payment status: ${error.message}`);
  }
};

// ✅ WebSocket Connection
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
    console.log('❌ Client terputus dari WebSocket.');
  });

  // ✅ Kirim Pesan Setiap 5 Detik (Bisa Dihapus Kalau Tidak Perlu)
  setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send('👋 Ping dari Server!');
    }
  }, 5000);
});

// ✅ Start Server
server.listen(PORT, () => {
  console.log(`🚀 WebSocket server running on http://localhost:${PORT}`);
});
