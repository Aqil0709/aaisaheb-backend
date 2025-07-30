const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('./auth.controller');

// Route for user registration: POST /api/auth/register
router.post('/register', registerUser);

// Route for user login: POST /api/auth/login
router.post('/login', loginUser);

module.exports = router;