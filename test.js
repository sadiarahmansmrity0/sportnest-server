const express = require('express');
const app = express();

// Simple route - no dependencies
app.get('/api/auth/google', (req, res) => {
    res.json({ message: "Route is working!" });
});

app.listen(5000, () => {
    console.log('Test server running on port 5000');
    console.log('Try: http://localhost:5000/api/auth/google');
});