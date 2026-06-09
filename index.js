const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { MongoClient, ObjectId } = require('mongodb');

require('dotenv').config();

const app = express();

// CORS configuration
app.use(cors({
  origin: [
    'https://sportnest-frontend-phi.vercel.app', 
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003'
  ], 
  credentials: true
}));

app.use(express.json());

// Test route
app.get('/', (req, res) => {
    res.json({ success: true, message: "SportNest API Server is live and operational! 🚀" });
});

// ============ SIMPLE GOOGLE AUTH ROUTES - PUT THEM RIGHT HERE ============
app.get('/api/auth/google', (req, res) => {
    console.log("Google auth route hit!");
    const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=http://localhost:5000/api/auth/google/callback&response_type=code&scope=email%20profile`;
    res.redirect(redirectUrl);
});

app.get('/api/auth/google/callback', async (req, res) => {
    console.log("Google callback hit!");
    const { code } = req.query;
    
    try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code: code,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: 'http://localhost:5000/api/auth/google/callback',
                grant_type: 'authorization_code'
            })
        });
        
        const tokens = await tokenResponse.json();
        
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
        });
        
        const userInfo = await userInfoResponse.json();
        const email = userInfo.email;
        
        // Redirect to frontend dashboard
        res.redirect(`http://localhost:3002/dashboard?email=${encodeURIComponent(email)}`);
        
    } catch (error) {
        console.error('Google callback error:', error);
        res.redirect('http://localhost:3002/login?error=google_auth_failed');
    }
});

// ============ TEST ROUTE TO VERIFY IT WORKS ============
app.get('/api/test', (req, res) => {
    res.json({ message: "API is working!" });
});

// MongoDB Connection
const client = new MongoClient(process.env.SPORTNEST_DB_URL);
let db;

async function connectDB() {
    try {
        if (!db) {
            await client.connect();
            db = client.db('sportnest');
            console.log('✅ MongoDB Connected Successfully!');
        }
        return db;
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        throw error;
    }
}

async function getDB() {
    if (!db) {
        await connectDB();
    }
    return db;
}

// ============ AUTH ROUTES ============
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        const database = await getDB();
        
        const existing = await database.collection('users').findOne({ email });
        if (existing) {
            return res.status(400).json({ success: false, message: "User already exists" });
        }
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        await database.collection('users').insertOne({ 
            email, 
            password: hashedPassword,
            createdAt: new Date()
        });
        
        res.json({ success: true, message: "Registered successfully" });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const database = await getDB();
        const user = await database.collection('users').findOne({ email });

        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }
        
        res.json({ success: true, user: { email: user.email } });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============ BOOKINGS ROUTES ============
app.post('/api/bookings', async (req, res) => {
    try {
        const database = await getDB();
        const bookingData = req.body;
        const result = await database.collection('bookings').insertOne(bookingData);
        res.json({ success: true, result });
    } catch (err) {
        console.error('Booking creation error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/bookings', async (req, res) => {
    try {
        const { userEmail } = req.query; 

        if (!userEmail) {
            return res.status(400).json({ success: false, message: "Email parameter is required" });
        }

        const database = await getDB();
        const bookings = await database.collection('bookings').find({ userEmail: userEmail }).toArray(); 
        return res.status(200).json(bookings); 
    } catch (error) {
        console.error('Get bookings error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/bookings/:id', async (req, res) => {
    try {
        const database = await getDB();
        const { id } = req.params;

        const result = await database.collection('bookings').deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 1) {
            return res.json({ success: true, message: "Booking cancelled successfully" });
        } else {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }
    } catch (err) {
        console.error("Booking delete error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ============ FACILITIES ROUTES ============
app.get('/api/facilities', async (req, res) => {
    try {
        const database = await getDB();
        const { ownerEmail } = req.query;
        const query = ownerEmail ? { ownerEmail } : {}; 
        const facilities = await database.collection('facilities').find(query).toArray();
        
        console.log(`📊 Found ${facilities.length} facilities`);
        
        res.json({ success: true, data: facilities });
    } catch (err) {
        console.error('Get facilities error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/facilities/:id', async (req, res) => {
    try {
        const database = await getDB();
        const facility = await database.collection('facilities').findOne({ _id: new ObjectId(req.params.id) });
        
        if (!facility) {
            return res.status(404).json({ success: false, message: "Facility not found" });
        }
        
        res.json({ success: true, data: facility });
    } catch (err) {
        console.error('Get facility by ID error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/facilities', async (req, res) => {
    try {
        const database = await getDB();
        const newFacility = req.body;
        const result = await database.collection('facilities').insertOne(newFacility);
        res.json({ success: true, insertedId: result.insertedId });
    } catch (err) {
        console.error('Create facility error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.patch('/api/facilities/:id', async (req, res) => {
    try {
        const database = await getDB();
        const { id } = req.params;
        const updatedData = req.body;
        
        const result = await database.collection('facilities').updateOne(
            { _id: new ObjectId(id) },
            { $set: updatedData }
        );
        
        res.json({ success: true, message: "Updated successfully", result });
    } catch (err) {
        console.error('Update facility error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/facilities/:id', async (req, res) => {
    try {
        const database = await getDB();
        const { id } = req.params;

        const result = await database.collection('facilities').deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 1) {
            res.json({ success: true, message: "Facility deleted successfully" });
        } else {
            res.status(404).json({ success: false, message: "Facility not found" });
        }
    } catch (err) {
        console.error("Delete error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============ START SERVER ============
async function startServer() {
    try {
        await connectDB();
        
        app.listen(5000, () => {
            console.log('🚀 Server running on port 5000');
            console.log('📍 API URL: http://localhost:5000');
            console.log('🔑 Google Auth: http://localhost:5000/api/auth/google');
            console.log('🧪 Test route: http://localhost:5000/api/test');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
}

startServer();