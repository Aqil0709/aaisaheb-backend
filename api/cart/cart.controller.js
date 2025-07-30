const db = require('../../config/db');

// --- Helper function to fetch full cart details (including product images and originalPrice) ---
const fetchUserCartDetails = async (userId) => {
    const [cartItems] = await db.query(
        `SELECT ci.id, ci.user_id, ci.product_id, ci.name, ci.price, ci.quantity,
                p.images as product_images_json, p.description as product_description,
                p.category as product_category, p.originalPrice as product_original_price
           FROM cart_items ci
           JOIN products p ON ci.product_id = p.id
           WHERE ci.user_id = ?`,
        [userId]
    );

    const parsedCartItems = cartItems.map(item => ({
        id: item.id, // This is the cart_item's ID, which is important for updates/removals
        user_id: item.user_id,
        product_id: item.product_id,
        name: item.name,
        price: item.price,
        // Add originalPrice to the cart item details
        originalPrice: item.product_original_price, // <--- ADDED THIS LINE
        quantity: item.quantity,
        images: JSON.parse(item.product_images_json || '[]'),
        category: item.product_category,
        description: item.product_description
    }));
    return parsedCartItems;
};


const getCart = async (req, res) => {
    const { userId } = req.params;
    try {
        const cartItems = await fetchUserCartDetails(userId); // Use the helper
        res.status(200).json(cartItems);
    } catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({ message: 'Server error while fetching cart.' });
    }
};

const addToCart = async (req, res) => {
    const { userId } = req.params;
    const { id: productId } = req.body; // ONLY send productId from frontend for security

    try {
        // Fetch product details from the products table for security and consistency
        // Now also fetch originalPrice
        const [products] = await db.query('SELECT name, price, originalPrice, images FROM products WHERE id = ?', [productId]); // <--- ADDED originalPrice here
        if (products.length === 0) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        const { name, price, originalPrice, images } = products[0]; // Get actual product name, price, originalPrice, images from DB

        // Using INSERT ... ON DUPLICATE KEY UPDATE to handle both adding and incrementing
        // Note: cart_items table currently doesn't store originalPrice directly,
        // it fetches it dynamically for calculations. If you want to snapshot
        // original price at the time of adding to cart, you'd need to add a column
        // to cart_items for it. For now, we'll continue to fetch from products.
        const sql = `
            INSERT INTO cart_items (user_id, product_id, name, price, quantity)
            VALUES (?, ?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE quantity = quantity + 1
        `;
        await db.query(sql, [userId, productId, name, price]); // Use DB's name and price

        // Fetch the updated cart to send back
        const updatedCart = await fetchUserCartDetails(userId); // Use the helper
        res.status(200).json(updatedCart);

    } catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).json({ message: 'Server error while adding to cart.' });
    }
};

const updateCartItem = async (req, res) => {
    const { userId } = req.params;
    // Rename productId to cartItemId to reflect what it truly is in the context of this function
    const { productId: cartItemId } = req.params; // It receives the cart_item's 'id' from frontend

    const numericUserId = Number(userId);
    const numericCartItemId = Number(cartItemId); // This is the cart_item's PK 'id'
    const numericQuantity = Number(req.body.quantity); // Get quantity from body

    if (numericQuantity <= 0) {
        try {
            // Delete by cart item ID (id of the cart_items table), not product_id
            const sql = 'DELETE FROM cart_items WHERE user_id = ? AND id = ?';
            console.log('Executing DELETE SQL (from updateCartItem):', sql, [numericUserId, numericCartItemId]);
            await db.query(sql, [numericUserId, numericCartItemId]);
            const updatedCart = await fetchUserCartDetails(numericUserId);
            return res.status(200).json(updatedCart);
        } catch (error) {
            console.error('Remove cart item during update error:', error);
            return res.status(500).json({ message: 'Server error while removing cart item.' });
        }
    }

    try {
        // Update by cart item ID (id of the cart_items table), not product_id
        const sql = 'UPDATE cart_items SET quantity = ? WHERE user_id = ? AND id = ?';
        console.log('Executing UPDATE SQL:', sql, [numericQuantity, numericUserId, numericCartItemId]);
        const [result] = await db.query(sql, [numericQuantity, numericUserId, numericCartItemId]);
        console.log('Update result affectedRows:', result.affectedRows); // Check affected rows

        const updatedCart = await fetchUserCartDetails(numericUserId);
        res.status(200).json(updatedCart);

    } catch (error) {
        console.error('Update cart item error:', error);
        res.status(500).json({ message: 'Server error while updating cart item.' });
    }
};

const removeCartItem = async (req, res) => {
    const { userId } = req.params;
    // Rename productId to cartItemId for clarity, as it's the cart_item's ID
    const { productId: cartItemId } = req.params;

    const numericUserId = Number(userId);
    const numericCartItemId = Number(cartItemId); // This is the cart_item's PK 'id'

    try {
        // Delete by cart item ID (id of the cart_items table), not product_id
        const sql = 'DELETE FROM cart_items WHERE user_id = ? AND id = ?';
        console.log('Executing DELETE SQL:', sql, [numericUserId, numericCartItemId]);
        const [result] = await db.query(sql, [numericUserId, numericCartItemId]);
        console.log('Delete result affectedRows:', result.affectedRows); // Check affected rows

        const updatedCart = await fetchUserCartDetails(numericUserId);
        res.status(200).json(updatedCart);

    } catch (error) {
        console.error('Remove cart item error:', error);
        res.status(500).json({ message: 'Server error while removing cart item.' });
    }
};

module.exports = {
    getCart,
    addToCart,
    updateCartItem,
    removeCartItem,
    fetchUserCartDetails
};