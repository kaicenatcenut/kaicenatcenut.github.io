// server.js
require('dotenv').config();
const express = require('express');
const midtransClient = require('midtrans-client');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static('public'));

// Midtrans Snap client (clientKey tidak perlu di sini)
let snap = new midtransClient.Snap({
    isProduction: true,
    serverKey: process.env.MIDTRANS_SERVER_KEY
});

// Midtrans CoreApi client untuk notifikasi
let coreApi = new midtransClient.CoreApi({
    isProduction: true,
    serverKey: process.env.MIDTRANS_SERVER_KEY
});

// Endpoint untuk membuat transaksi Midtrans
app.post('/create-transaction', async (req, res) => {
    try {
        const orderId = `ORDER-${uuidv4()}`;
        const amount = parseInt(req.body.amount) || 10000;
        const customerName = req.body.customerName || "John Doe";
        const customerEmail = req.body.customerEmail || "john.doe@example.com";

        let parameter = {
            transaction_details: {
                order_id: orderId,
                gross_amount: amount
            },
            item_details: [{
                id: "ITEM01",
                price: amount,
                quantity: 1,
                name: "Pembelian Layanan Kaistore"
            }],
            customer_details: {
                first_name: customerName.split(' ')[0],
                last_name: customerName.split(' ').slice(1).join(' ') || "",
                email: customerEmail
            },
            callbacks: {
                finish: `${process.env.APP_BASE_URL}/payment-finish.html?order_id=${orderId}`,
                unfinish: `${process.env.APP_BASE_URL}/payment-unfinish.html?order_id=${orderId}`,
                error: `${process.env.APP_BASE_URL}/payment-error.html?order_id=${orderId}`
            }
        };

        console.log("Request parameter to Midtrans:", JSON.stringify(parameter, null, 2));

        const transaction = await snap.createTransaction(parameter);
        console.log("Midtrans transaction created:", transaction);

        res.json({
            token: transaction.token,
            redirect_url: transaction.redirect_url,
            orderId: orderId
        });

    } catch (error) {
        console.error("Error creating Midtrans transaction:", error.message || error);
        if (error.ApiResponse && error.ApiResponse.error_messages) {
            console.error("Midtrans API Error Details:", error.ApiResponse.error_messages);
            res.status(error.httpStatusCode || 500).json({ message: "Failed to create transaction", details: error.ApiResponse.error_messages });
        } else {
            res.status(500).json({ message: "Internal Server Error", error: error.message });
        }
    }
});

// Endpoint notifikasi Midtrans
app.post('/midtrans-notification', async (req, res) => {
    try {
        const notificationJson = req.body;
        const statusResponse = await coreApi.transaction.notification(notificationJson);
        const orderId = statusResponse.order_id;
        const transactionStatus = statusResponse.transaction_status;
        const fraudStatus = statusResponse.fraud_status;
        const paymentType = statusResponse.payment_type;

        // Logika penanganan status pembayaran
        console.log(`Notifikasi diterima. Order ID: ${orderId}, Status: ${transactionStatus}, Fraud: ${fraudStatus}, Payment: ${paymentType}`);

        // TODO: Update status order di database sesuai orderId

        res.status(200).json({ message: "Notification received successfully." });
    } catch (error) {
        console.error("Error processing notification:", error.message || error);
        res.status(500).json({ message: "Error processing notification." });
    }
});

app.get('/', (req, res) => {
    res.redirect('/kaicenat.html');
});

app.listen(port, () => {
    console.log(`Server Kaistore listening at http://localhost:${port}`);
    console.log(`Pastikan URL Notifikasi di Midtrans Dashboard (Sandbox) adalah: ${process.env.APP_BASE_URL}/midtrans-notification`);
});
