const db = require('../../config/db');

// --- User Profile ---
const updateUserProfile = async (req, res) => {
    const { userId } = req.params;
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ message: 'Name is required for profile update.' });
    }

    try {
        // Crucial security check to ensure users can only update their own profile
        if (!req.userData || req.userData.userId !== Number(userId)) {
            console.error("Security check failed in updateUserProfile. req.userData:", req.userData, "userId from params:", userId);
            return res.status(403).json({ message: 'Forbidden: You can only update your own profile.' });
        }

        const [result] = await db.query(
            'UPDATE users SET name = ? WHERE id = ?',
            [name, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const [updatedUser] = await db.query('SELECT id, name, mobileNumber, role FROM users WHERE id = ?', [userId]);

        // REFINED: Nesting user data in the response for API consistency
        res.status(200).json({
            message: 'Profile updated successfully!',
            user: updatedUser[0] 
        });

    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ message: 'Server error while updating profile.' });
    }
};

// --- User Addresses ---
const getUserAddresses = async (req, res) => {
    const { userId } = req.params;

    try {
        // FIXED: Added security check to prevent unauthorized access to addresses
        if (!req.userData || req.userData.userId !== Number(userId)) {
            return res.status(403).json({ message: 'Forbidden: You can only view your own addresses.' });
        }

        const [addresses] = await db.query('SELECT * FROM addresses WHERE user_id = ?', [userId]);
        res.status(200).json(addresses);

    } catch (error) {
        console.error('Get addresses error:', error);
        res.status(500).json({ message: 'Server error while fetching addresses.' });
    }
};

const addUserAddress = async (req, res) => {
    const { userId } = req.params;
    const { name, mobile, pincode, locality, address, city, state, address_type } = req.body;

    // Validation for required fields
    if (!name || !mobile || !pincode || !locality || !address || !city || !state || !address_type) {
        return res.status(400).json({ message: `All address fields are required.` });
    }

    try {
        // FIXED: Added security check to prevent adding addresses to other users' profiles
        if (!req.userData || req.userData.userId !== Number(userId)) {
            return res.status(403).json({ message: 'Forbidden: You can only add an address to your own profile.' });
        }
        
        const sql = `
            INSERT INTO addresses (user_id, name, mobile, pincode, locality, address, city, state, address_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const [result] = await db.query(sql, [userId, name, mobile, pincode, locality, address, city, state, address_type]);
        const newAddressId = result.insertId;

        // REFINED: Fetching and returning only the newly created address for efficiency
        const [newAddress] = await db.query('SELECT * FROM addresses WHERE id = ?', [newAddressId]);

        res.status(201).json({
            message: 'Address added successfully!',
            address: newAddress[0]
        });

    } catch (error) {
        console.error('Add address error:', error);
        res.status(500).json({ message: 'Server error while adding address.' });
    }
};

module.exports = {
    updateUserProfile,
    getUserAddresses,
    addUserAddress
};