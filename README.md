# SportNest - Sports Facility Booking Platform (Backend API)

## Project Name
SportNest Backend API

## Purpose
RESTful API for sports facility booking system providing secure authentication, facility management, and booking operations.

## Live URL
https://sportnest-server.onrender.com

## Features
- JWT Authentication with bcrypt password hashing
- Google OAuth Integration
- User Registration and Login
- Facility CRUD Operations
- Booking Creation and Management
- Filter Facilities by Owner
- CORS Enabled for Security
- MongoDB Database Connection

## NPM Packages Used

| Package | Purpose |
|---------|---------|
| express | Web framework |
| cors | CORS middleware |
| dotenv | Environment variables |
| mongodb | MongoDB driver |
| bcryptjs | Password hashing |
| passport | Authentication |
| passport-google-oauth20 | Google OAuth |
| google-auth-library | Google token verification |

## Installation

```bash
git clone https://github.com/yourusername/sportnest-server.git
cd sportnest-server
npm install
node index.js
## Environment Setup
Create .env file:
PORT=5000
SPORTNEST_DB_URL=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NODE_ENV=production