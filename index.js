
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { MongoClient, ObjectId } = require('mongodb');

require('dotenv').config();

const app = express();
app.use(cors({
  origin: ['https://your-frontend-url.vercel.app'], // Replace with your actual Vercel URL
  credentials: true
}));
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
// REGISTER ROUTE (UPDATED & FIXED)
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        const db = await getDB();
        
        // 1. Check if user already exists
        const existing = await db.collection('users').findOne({ email });
        if (existing) {
            return res.status(400).json({ success: false, message: "User exists" });
        }
        
        // 2. CRITICAL FIX: Hash the plain-text password before saving it
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // 3. Save the user document with the encrypted hashed password
        await db.collection('users').insertOne({ 
            email, 
            password: hashedPassword,
            createdAt: new Date()
        });
        
        res.json({ success: true, message: "Registered successfully" });
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
// Add this route to your index.js, outside of other functions
app.post('/api/bookings', async (req, res) => {
    try {
        const db = await getDB();
        const bookingData = req.body;
        const result = await db.collection('bookings').insertOne(bookingData);
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
app.get('/api/bookings', async (req, res) => {
  try {
    // 1. Get userEmail from the incoming URL query parameters
    const { userEmail } = req.query; 

    if (!userEmail) {
      return res.status(400).json({ success: false, message: "Email parameter is required" });
    }

    // 2. Get the database instance using your helper function
    const db = await getDB();

    // 3. Query native MongoDB using 'userEmail' and convert the cursor to an Array
    const bookings = await db.collection('bookings').find({ userEmail: userEmail }).toArray(); 

    // 4. Return the array data back to the client
    return res.status(200).json(bookings); 
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});
// Add this to your index.js
app.delete('/api/bookings/:id', async (req, res) => {
    try {
        const db = await getDB();
        const { id } = req.params;

        // CRITICAL: Ensure you pass 'new ObjectId(id)' to look up native hex IDs
        const result = await db.collection('bookings').deleteOne({ _id: new ObjectId(id) });

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
        const db = await getDB(); // <--- THIS IS REQUIRED IN EVERY ROUTE
        const { ownerEmail } = req.query;
        const query = ownerEmail ? { ownerEmail } : {}; 
        const facilities = await db.collection('facilities').find(query).toArray();
        res.json({ success: true, data: facilities });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
app.delete('/api/facilities/:id', async (req, res) => {
    try {
        const db = await getDB();
        const { id } = req.params;

        // CORRECTED: Use 'new' here
        const result = await db.collection('facilities').deleteOne({ _id: new ObjectId(id) });

        res.json({ success: true, result });
    } catch (err) {
        console.error("Delete error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});
app.patch('/api/facilities/:id', async (req, res) => {
    try {
        const db = await getDB(); // <--- THIS IS REQUIRED IN EVERY ROUTE
        const { id } = req.params;
        const updatedData = req.body;
        
        const result = await db.collection('facilities').updateOne(
            { _id: new ObjectId(id) },
            { $set: updatedData }
        );
        
        res.json({ success: true, message: "Updated successfully", result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
app.post('/api/facilities', async (req, res) => {
    try {
        const db = await getDB();
        const newFacility = req.body;
        // Ensure ownerEmail is included from the body
        const result = await db.collection('facilities').insertOne(newFacility);
        res.json({ success: true, insertedId: result.insertedId });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.listen(5000, () => console.log('🚀 Server running on port 5000'));