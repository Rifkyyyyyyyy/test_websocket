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

// Cek perubahan status pembayaran
const getPaymentStatusService = async (ws, uid, orderId) => {
  try {
    console.log(`📡 Memantau pembayaran UID: ${uid}, OrderID: ${orderId}`);

    const changeStream = paymentsCollection.watch([
      {
        $match: {
          $and: [
            { 'fullDocument.user.uid': uid },
            { 'fullDocument.order_id': orderId },
            { 'updateDescription.updatedFields.transaction_status': { $exists: true } }
          ]
        }
      }
    ], { fullDocument: 'updateLookup' });
    

    console.log("🔄 Change stream aktif...");

    changeStream.on('change', (change) => {
      try {
        console.log("📥 Ada perubahan di MongoDB:", JSON.stringify(change, null, 2));  // Log tambahan
        
        if (change.operationType === 'update') {
          const updatedFields = change.updateDescription.updatedFields;
          console.log("🔄 Field yang diupdate:", updatedFields);  // Log tambahan
          
          if (updatedFields.transaction_status) {  // Akses langsung, karena bukan nested
            const newStatus = updatedFields.transaction_status;
            ws.send(JSON.stringify({ status: newStatus }));
            console.log(`✅ Status transaksi diperbarui: ${newStatus}`);
          } else {
            console.log("❌ Field 'transaction_status' nggak ada di update.");
          }
        } else {
          console.log("🔄 Operasi bukan update, diabaikan.");
        }
      } catch (err) {
        console.error(`❌ Error processing change event: ${err.message}`);
        changeStream.close();
      }
    });
    

    ws.on('close', () => {
      console.log(`🔌 User ${uid} terputus dari WebSocket.`);
      changeStream.close();  // Tutup stream kalau user terputus
    });

  } catch (error) {
    console.error(`❌ Error monitoring payment status: ${error.message}`);
  }
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
