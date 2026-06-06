
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

const client = new MongoClient(process.env.SPORTNEST_DB_URL);
async function getDB() {
    // If the client isn't connected, connect it
    if (!client.topology || !client.topology.isConnected()) {
        await client.connect();
    }
    return client.db('sportnest');
}
// REGISTER ROUTE
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        const db = await getDB();
        const existing = await db.collection('users').findOne({ email });
        
        if (existing) return res.status(400).json({ success: false, message: "User exists" });
        
        await db.collection('users').insertOne({ email, password });
        res.json({ success: true, message: "Registered" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// LOGIN ROUTE
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const db = await getDB(); // Ensure this function is correctly defined
        const user = await db.collection('users').findOne({ email });

        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        // Compare plain password with the hashed password in DB
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }
        
        res.json({ success: true, user: { email: user.email } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// Booking GET Route (Public for now)
// Example of how your routes must look now:
app.get('/api/bookings', async (req, res) => {
    try {
        const { userEmail } = req.query;
        const db = await getDB(); // Make sure this is getDB()
        const bookings = await db.collection('bookings').find({ userEmail }).toArray();
        res.json({ success: true, data: bookings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Facility GET Route
app.get('/api/facilities/:id', async (req, res) => {
    try {
        const database = await getDB();
        const facility = await database.collection('facilities').findOne({ _id: new ObjectId(req.params.id) });
        res.json({ success: true, data: facility });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
app.get('/api/facilities', async (req, res) => {
    try {
        const database = await getDB();
        const facilities = await database.collection('facilities').find({}).toArray();
        res.json({ success: true, data: facilities });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error fetching facilities" });
    }
});

app.listen(5000, () => console.log('🚀 Server running on port 5000'));