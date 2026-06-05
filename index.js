const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

// Configure strict cross-origin resource sharing
app.use(cors({
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    credentials: true
}));

app.use(express.json());
app.use(cookieParser()); // 👈 Necessary to read cookies from incoming requests

// Singleton MongoDB Connection Utility
const client = new MongoClient(process.env.MONGODB_URI);
let db;

async function connectDB() {
    if (!db) {
        await client.connect();
        db = client.db('sportnest');
    }
    return db;
}

// Middleware to verify JWT cookie for protected routes
async function verifyToken(req, res, next) {
    const token = req.cookies.sportnest_sid;
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        req.user = decoded; // Contains id and email
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: 'Invalid token signature.' });
    }
}

// Base Testing Route
app.get('/api/health', async (req, res) => {
    try {
        const database = await connectDB();
        res.json({ status: 'healthy', database: database.databaseName });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// USER REGISTRATION ENDPOINT
app.post('/api/auth/register', async (req, res) => {
    try {
        const database = await connectDB();
        const usersCollection = database.collection('users');
        const { name, email, password, photoUrl } = req.body;

        // Check if user already exists
        const userExists = await usersCollection.findOne({ email: email.toLowerCase() });
        if (userExists) {
            return res.status(400).json({ success: false, message: 'Email already registered.' });
        }

        // Hash the password manually using bcryptjs
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = {
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            photoUrl: photoUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde',
            role: 'user',
            createdAt: new Date()
        };

        const result = await usersCollection.insertOne(newUser);

        // Generate JWT
        const token = jwt.sign(
            { id: result.insertedId, email: newUser.email },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '7d' }
        );

        // Set secure cookie
        res.cookie('sportnest_sid', token, {
            httpOnly: true,
            secure: true, // required for cross-site cookie in modern browsers / hosting
            sameSite: 'none', // allows cross-origin cookies
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.status(201).json({
            success: true,
            user: { id: result.insertedId, name, email, photoUrl: newUser.photoUrl }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// USER LOGIN ENDPOINT
app.post('/api/auth/login', async (req, res) => {
    try {
        const database = await connectDB();
        const usersCollection = database.collection('users');
        const { email, password } = req.body;

        const user = await usersCollection.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '7d' }
        );

        // Set secure cookie
        res.cookie('sportnest_sid', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.status(200).json({
            success: true,
            user: { id: user._id, name: user.name, email: user.email, photoUrl: user.photoUrl, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// USER LOGOUT ENDPOINT
app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('sportnest_sid', {
        httpOnly: true,
        secure: true,
        sameSite: 'none'
    });
    res.status(200).json({ success: true, message: 'Logged out cleanly.' });
});

//CHECK AUTH STATUS / GET PROFILE (Protected Route)
app.get('/api/auth/me', verifyToken, async (req, res) => {
    try {
        const database = await connectDB();
        const usersCollection = database.collection('users');
        
        const user = await usersCollection.findOne(
            { _id: new ObjectId(req.user.id) },
            { projection: { password: 0 } } // Exclude the password field
        );

        if (!user) {
            return res.status(404).json({ success: false, message: 'User profile not found.' });
        }

        res.status(200).json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 SportNest single-file server running on port ${PORT}`);
});