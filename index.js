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
const client = new MongoClient(process.env.SPORTNEST_DB_URL);
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
// ==========================================
// BOOKING ENDPOINTS
// ==========================================

// 1. Create a new booking request
app.post('/api/bookings', async (req, res) => {
  try {
    const { facilityId, facilityTitle, userEmail, date, slot } = req.body;

    // Simple validation
    if (!facilityId || !userEmail || !date || !slot) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required booking details (facilityId, userEmail, date, slot)." 
      });
    }

    const database = await connectDB();
    const bookingsCollection = database.collection('bookings');

    // Optional: Check if the exact same slot is already booked for that date
    const existingBooking = await bookingsCollection.findOne({ facilityId, date, slot, status: "confirmed" });
    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: "Sorry, this slot has already been taken by someone else!"
      });
    }

    const newBooking = {
      facilityId,
      facilityTitle, // Storing the title makes it easier to show on the user dashboard
      userEmail,
      date,
      slot,
      status: 'pending', // Default status when requested
      createdAt: new Date()
    };

    const result = await bookingsCollection.insertOne(newBooking);
    
    res.status(201).json({
      success: true,
      message: "Booking request submitted successfully!",
      bookingId: result.insertedId
    });

  } catch (error) {
    console.error("Booking creation error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// 2. Get bookings for a specific user (Dashboard)
app.get('/api/bookings', async (req, res) => {
  try {
    const { email } = req.query; // Pass email as a query parameter: /api/bookings?email=user@example.com
    
    if (!email) {
      return res.status(400).json({ success: false, message: "User email query parameter is required." });
    }

    const database = await connectDB();
    const bookingsCollection = database.collection('bookings');
    
    // Fetch bookings matching this user's email, sorted by newest first
    const userBookings = await bookingsCollection
      .find({ userEmail: email })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      bookings: userBookings
    });

  } catch (error) {
    console.error("Fetch bookings error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
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
// GET ALL FACILITIES (With optional search and category filter)
// URL Example: /api/facilities OR /api/facilities?category=Badminton
app.get('/api/facilities', async (req, res) => {
    try {
        const database = await connectDB();
        const facilitiesCollection = database.collection('facilities');
        
        const { category, search } = req.query;
        let query = {};

        // Filter by sport category if provided
        if (category) {
            query.category = category;
        }

        // Search by title or location keyword if provided (case-insensitive)
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { location: { $regex: search, $options: 'i' } }
            ];
        }

        const facilities = await facilitiesCollection.find(query).toArray();
        res.status(200).json({ success: true, count: facilities.length, data: facilities });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

//  GET SINGLE FACILITY DETAILS BY ID
// URL Example: /api/facilities/64f1234567890abcdef12345
// GET SINGLE FACILITY DETAILS BY ID
app.get('/api/facilities/:id', async (req, res) => {
    try {
        const database = await connectDB();
        const facilitiesCollection = database.collection('facilities');
        const { id } = req.params;

        // Validate ObjectId format
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid facility ID format.' 
            });
        }

        const facility = await facilitiesCollection.findOne({ _id: new ObjectId(id) });
        
        if (!facility) {
            return res.status(404).json({ 
                success: false, 
                message: 'Facility arena not found.' 
            });
        }

        // ✅ This is the key - make sure you're returning the data property
        res.status(200).json({ 
            success: true, 
            data: facility  // ← Important: facility is inside 'data'
        });
    } catch (error) {
        console.error('Error fetching facility:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

//  ADMIN ONLY: ADD NEW FACILITY (Protected Route)
app.post('/api/facilities', verifyToken, async (req, res) => {
    try {
        const database = await connectDB();
        const usersCollection = database.collection('users');
        const facilitiesCollection = database.collection('facilities');

        // Confirm the logged-in user has admin privileges
        const actingUser = await usersCollection.findOne({ _id: new ObjectId(req.user.id) });
        if (!actingUser || actingUser.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Forbidden. Admin privileges required.' });
        }

        const { title, image, pricePerHour, location, category, description, availableSlots } = req.body;

        const newFacility = {
            title,
            image,
            pricePerHour: Number(pricePerHour),
            location,
            category, // e.g., "Football", "Badminton", "Cricket"
            description,
            availableSlots: availableSlots || ["06:00 AM - 08:00 AM", "04:00 PM - 06:00 PM", "06:00 PM - 08:00 PM"],
            createdAt: new Date()
        };

        const result = await facilitiesCollection.insertOne(newFacility);
        res.status(201).json({ success: true, data: { _id: result.insertedId, ...newFacility } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
app.listen(PORT, () => {
    console.log(`🚀 SportNest single-file server running on port ${PORT}`);
});