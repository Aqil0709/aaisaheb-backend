const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Load environment variables from .env file in local development
const path = require('path');

// Import route handlers
const authRoutes = require('./api/auth/auth.routes');
const cartRoutes = require('./api/cart/cart.routes');
const profileRoutes = require('./api/profile/profile.routes');
const productRoutes = require('./api/products/products.routes');
const orderRoutes = require('./api/orders/order.router');
const stockRoutes = require('./api/stock/stock.routes');

const app = express();
// Use the port provided by the deployment environment (like Render), or 5001 for local development
const PORT = process.env.PORT || 5001;

// --- CORS Configuration for Production and Local Development ---
// For production, Render will inject process.env.FRONTEND_URL with your Hostinger domain.
// For local development, it will fall back to 'http://aaisahebvastram.com'.
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://aaisahebvastram.com', // Dynamic origin for production, your Hostinger URL for dev fallback
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true // Important if you're sending cookies or authorization headers
};
app.use(cors(corsOptions));


// --- MIDDLEWARE ---
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Ensure this is present for form data

// --- Global Request Logger for Debugging ---
app.use((req, res, next) => {
    console.log(`[SERVER LOG] Request Received: ${req.method} ${req.originalUrl}`);
    next();
});


// --- API ROUTES ---
// All routes are now directly accessible.
app.use('/auth', authRoutes);
app.use('/cart', cartRoutes);
app.use('/profile', profileRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/stock', stockRoutes);

// Serve static files from the 'public' directory (e.g., for product images)
app.use('/public', express.static(path.join(__dirname, 'public')));

// --- Fallback for any unhandled routes (404) ---
app.use((req, res, next) => {
    res.status(404).json({ message: 'API Route not found' });
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
    console.error(err.stack); // Log the full error stack for debugging
    res.status(500).json({ message: 'Something went wrong on the server!', error: err.message }); // Send error message to client
});


// --- SERVER START ---
app.listen(PORT, () => {
    console.log(`Backend server is running on port ${PORT}`);
});
