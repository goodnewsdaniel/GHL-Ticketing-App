const functions = require('@google-cloud/functions-framework');
const admin = require('firebase-admin');

// --- CONFIGURATION ---
const FIREBASE_DATABASE_URL = "https://realpromo-9d702-default-rtdb.firebaseio.com"; 
const SECRET_KEY = "n7k4chgkco5BAWnGl-UOX1dZNBxPk_FKbzbckEShJKIjz2qPRpVXnVN9w8LknTJ6T976u-GfI_rU_BDkvLRgTw=="; // <-- Create your own secret

admin.initializeApp({ databaseURL: FIREBASE_DATABASE_URL });

functions.http('confirmPurchase', async (req, res) => {
    if (req.query.secret !== SECRET_KEY) {
        return res.status(401).send('Unauthorized');
    }

    // Find the product name/ID in the GHL webhook body.
    // You may need to inspect a test webhook to find the exact path.
    // Common paths: req.body.product_name, req.body.products[0].name, etc.
    const productName = req.body.product_name; 
    const seatId = productName;

    if (!seatId) {
        console.error("Webhook did not contain a product name (seat ID).");
        return res.status(400).send('Bad Request: Missing product name.');
    }

    const seatRef = admin.database().ref(`seats/${seatId}`);
    try {
        await seatRef.update({ status: 'unavailable' });
        return res.status(200).send(`Seat ${seatId} marked as unavailable.`);
    } catch (error) {
        console.error(`Failed to update seat ${seatId}:`, error);
        return res.status(500).send('Internal Server Error');
    }
});