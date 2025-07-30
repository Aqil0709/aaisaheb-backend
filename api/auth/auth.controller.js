
const db = require('../../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // Import jwt for token generation

const registerUser = async (req, res) => {
    const { mobileNumber, password, name } = req.body; // Added 'name' to destructuring

    console.log('Register Request Body:', req.body); // Debugging log

    if (!mobileNumber || !password) {
        return res.status(400).json({ message: 'Mobile number and password are required.' });
    }

    try {
        const [existingUsers] = await db.query('SELECT mobileNumber FROM users WHERE mobileNumber = ?', [mobileNumber]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ message: 'User with this mobile number already exists.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userName = name || mobileNumber; // Use provided name, or default to mobile number
        const [result] = await db.query(
            'INSERT INTO users (name, mobileNumber, password, role) VALUES (?, ?, ?, ?)',
            [userName, mobileNumber, hashedPassword, 'user'] // Default role to 'user'
        );

        const newUserId = result.insertId;

        // --- IMPORTANT: Check for JWT_SECRET ---
        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET is not defined in environment variables!');
            return res.status(500).json({ message: 'Server configuration error: JWT secret missing.' });
        }

        // Generate JWT token for the new user
        const token = jwt.sign(
            
            { userId: newUserId, role: 'user' }, // Payload
            process.env.JWT_SECRET,             // Secret key from .env
            { expiresIn: '1h' }                 // Token expiration
        );

        res.status(201).json({
            id: newUserId,
            name: userName, // Send the name used for registration
            mobileNumber: mobileNumber,
            role: 'user',
            token: token,
            message: 'Registration successful.'
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
};

const loginUser = async (req, res) => {
    const { mobileNumber, password } = req.body;

    console.log('Login Request Body:', req.body); // Debugging log

    if (!mobileNumber || !password) {
        return res.status(400).json({ message: 'Mobile number and password are required.' });
    }

    try {
        const [users] = await db.query('SELECT * FROM users WHERE mobileNumber = ?', [mobileNumber]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const user = users[0];

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // --- IMPORTANT: Check for JWT_SECRET ---
        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET is not defined in environment variables!');
            return res.status(500).json({ message: 'Server configuration error: JWT secret missing.' });
        }
console.log('--- User data from DB for token ---:', user);
        // Generate JWT token for the logged-in user
        const token = jwt.sign(
            { userId: user.id, role: user.role }, // Payload
            process.env.JWT_SECRET,             // Secret key from .env
            { expiresIn: '1h' }                 // Token expiration
        );

        res.status(200).json({
            id: user.id,
            name: user.name,
            mobileNumber: user.mobileNumber,
            role: user.role,
            token: token,
            message: 'Login successful.'
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
};

module.exports = {
    registerUser,
    loginUser
};