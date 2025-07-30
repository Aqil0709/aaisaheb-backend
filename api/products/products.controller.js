// backend/controllers/productController.js
const db = require('../../config/db');
const fs = require('fs');
const path = require('path');

// Helper function to extract filename from URL
const getFilenameFromUrl = (url) => {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        return path.basename(pathname);
    } catch (error) {
        console.warn('Invalid URL provided to getFilenameFromUrl:', url, error);
        return null;
    }
};

// Helper function to delete a file from the uploads directory
const deleteFile = (filename) => {
    if (!filename) return;

    const filePath = path.join(__dirname, '../public/uploads', filename);
    fs.unlink(filePath, (err) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.warn(`File not found, could not delete: ${filePath}`);
            } else {
                console.error(`Error deleting file ${filePath}:`, err);
            }
        } else {
            console.log(`Successfully deleted file: ${filePath}`);
        }
    });
};

// --- PUBLIC ---
const getAllProducts = async (req, res) => {
    try {
        // --- MODIFIED: JOIN with stock table to get quantity ---
        const [products] = await db.query(`
            SELECT p.*, s.quantity
            FROM products p
            JOIN stock s ON p.id = s.product_id
            ORDER BY p.created_at DESC
        `);
        
        const parsedProducts = products.map(p => ({
            ...p,
            images: JSON.parse(p.images),
            quantity: parseInt(p.quantity, 10) // Ensure quantity is parsed as integer
        }));

        // --- DIAGNOSTIC LOG: Check the quantity before sending to frontend ---
        console.log('Products data sent to frontend (ID, Name, Quantity):');
        parsedProducts.forEach(p => {
            console.log(`    ID: ${p.id}, Name: ${p.name}, Quantity: ${p.quantity}`);
        });
        // --- END DIAGNOSTIC LOG ---

        res.status(200).json(parsedProducts);
    } catch (error) {
        console.error('Get all products error:', error);
        res.status(500).json({ message: 'Server error while fetching products.' });
    }
};

const getProductById = async (req, res) => {
    const { productId } = req.params;
    try {
        // --- MODIFIED: JOIN with stock table to get quantity ---
        const [product] = await db.query(`
            SELECT p.*, s.quantity
            FROM products p
            JOIN stock s ON p.id = s.product_id
            WHERE p.id = ?
        `, [productId]);

        if (product.length === 0) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        
        const parsedProduct = {
            ...product[0],
            images: JSON.parse(product[0].images),
            quantity: parseInt(product[0].quantity, 10)
        };
        parsedProduct.imageUrl = parsedProduct.images[0] || ''; // For frontend convenience
        res.status(200).json(parsedProduct);
    } catch (error) {
        console.error('Get product by ID error:', error);
        res.status(500).json({ message: 'Server error while fetching product by ID.' });
    }
};

const addProduct = async (req, res) => {
    const { name, category, price, originalPrice, description, quantity } = req.body;
    
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'Product images are required.' });
    }

    const imageURLs = req.files.map(file => 
        `${req.protocol}://${req.get('host')}/public/uploads/${file.filename}`
    );
    const imagesJson = JSON.stringify(imageURLs);

    let newProductId; // To store the ID of the newly inserted product

    try {
        // Insert into products table
        const productSql = `
            INSERT INTO products (name, category, price, description, images, originalPrice)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const [productResult] = await db.query(productSql, [name, category, price, description, imagesJson, originalPrice]);
        newProductId = productResult.insertId;

        // --- MODIFIED: Insert into stock table, now including product_name ---
        const stockSql = `
            INSERT INTO stock (product_id, quantity, product_name)
            VALUES (?, ?, ?)
        `;
        await db.query(stockSql, [newProductId, quantity, name]); // 'name' is the product_name

        const newProduct = {
            id: newProductId,
            name,
            category,
            price: parseFloat(price),
            originalPrice: parseFloat(originalPrice),
            description,
            images: imageURLs,
            imageUrl: imageURLs[0] || '',
            quantity: parseInt(quantity, 10) // Include quantity in response
        };

        res.status(201).json(newProduct);

    } catch (error) {
        console.error('Add product error:', error);
        // If product or stock insertion fails, attempt to clean up:
        // 1. Delete uploaded files
        if (req.files) {
            req.files.forEach(file => deleteFile(file.filename));
        }
        // 2. If product was inserted but stock failed, delete the product entry
        if (newProductId) {
             console.warn(`Attempting to clean up product ID ${newProductId} due to stock insert error.`);
             await db.query('DELETE FROM products WHERE id = ?', [newProductId]).catch(console.error);
        }
        res.status(500).json({ message: 'Server error while adding product.' });
    }
};

// --- ADMIN ONLY ---
const updateProduct = async (req, res) => {
    const { productId } = req.params;
    const { name, category, price, originalPrice, description, quantity, currentImageUrlsToRetain } = req.body;

    if (!productId) {
        return res.status(400).json({ message: 'Product ID is required for update.' });
    }

    let finalImageURLs = [];
    let oldImageURLs = []; // To store image URLs from DB before update for deletion

    try {
        // Fetch current product data to get existing image URLs
        const [currentProductRows] = await db.query('SELECT images FROM products WHERE id = ?', [productId]);
        if (currentProductRows.length === 0) {
            return res.status(404).json({ message: 'Product not found for update.' });
        }
        oldImageURLs = JSON.parse(currentProductRows[0].images || '[]');

        // Case 1: New files are uploaded
        if (req.files && req.files.length > 0) {
            finalImageURLs = req.files.map(file => 
                `${req.protocol}://${req.get('host')}/public/uploads/${file.filename}`
            );
            // Delete old images from the server's file system
            oldImageURLs.forEach(url => deleteFile(getFilenameFromUrl(url)));
        } 
        // Case 2: No new files, but client sent currentImageUrlsToRetain (meaning existing images are to be kept)
        else if (currentImageUrlsToRetain) {
            const retainedUrls = JSON.parse(currentImageUrlsToRetain);
            finalImageURLs = retainedUrls;

            // Identify which old images are NOT retained and delete them
            const urlsToDelete = oldImageURLs.filter(url => !retainedUrls.includes(url));
            urlsToDelete.forEach(url => deleteFile(getFilenameFromUrl(url)));

        } else { // Case 3: No new files and no retention list - implicitly keep all old images
            finalImageURLs = oldImageURLs;
        }

        // Validate that at least one image exists after all logic
        if (finalImageURLs.length === 0) {
            return res.status(400).json({ message: 'At least one product image is required.' });
        }

        const imagesJson = JSON.stringify(finalImageURLs);

        // Update products table
        const productSql = `
            UPDATE products
            SET name = ?, category = ?, price = ?, description = ?, images = ?, originalPrice = ?
            WHERE id = ?
        `;
        const [productUpdateResult] = await db.query(productSql, [name, category, price, description, imagesJson, originalPrice, productId]);

        // --- MODIFIED: Update stock table for quantity AND product_name ---
        const stockSql = `
            UPDATE stock
            SET quantity = ?, product_name = ?
            WHERE product_id = ?
        `;
        const [stockUpdateResult] = await db.query(stockSql, [quantity, name, productId]); // 'name' is the product_name

        if (productUpdateResult.affectedRows === 0 && stockUpdateResult.affectedRows === 0) {
            return res.status(404).json({ message: 'Product or stock entry not found for update.' });
        }

        const updatedProduct = {
            id: productId,
            name,
            category,
            price: parseFloat(price),
            originalPrice: parseFloat(originalPrice),
            description,
            images: finalImageURLs,
            imageUrl: finalImageURLs[0] || '',
            quantity: parseInt(quantity, 10)
        };

        res.status(200).json(updatedProduct);

    } catch (error) {
        console.error('Update product error:', error);
        // Optional: Clean up newly uploaded files if DB update fails
        if (req.files) {
            req.files.forEach(file => deleteFile(file.filename));
        }
        res.status(500).json({ message: 'Server error while updating product.' });
    }
};

const deleteProduct = async (req, res) => {
    const { productId } = req.params;

    if (!productId) {
        return res.status(400).json({ message: 'Product ID is required.' });
    }

    try {
        // --- NEW: Delete from stock table first due to foreign key constraint ---
        const [stockDeleteResult] = await db.query('DELETE FROM stock WHERE product_id = ?', [productId]);
        if (stockDeleteResult.affectedRows === 0) {
            // This might happen if stock entry was already missing or product ID is invalid
            console.warn(`No stock entry found for product ID ${productId} during deletion.`);
        }

        // Get the image URLs to delete the files from storage
        const [productRows] = await db.query('SELECT images FROM products WHERE id = ?', [productId]);
        if (productRows.length > 0) {
            const imagesToDelete = JSON.parse(productRows[0].images || '[]');
            imagesToDelete.forEach(url => deleteFile(getFilenameFromUrl(url)));
        }

        // Then, delete the product from the products table
        const [productDeleteResult] = await db.query('DELETE FROM products WHERE id = ?', [productId]);

        if (productDeleteResult.affectedRows === 0) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        res.status(200).json({ message: 'Product deleted successfully.' });

    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ message: 'Server error while deleting product.' });
    }
};

module.exports = {
    getAllProducts,
    getProductById,
    addProduct,
    updateProduct,
    deleteProduct
};