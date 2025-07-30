const mysql = require('mysql2');
require('dotenv').config();

// Create a connection pool for better performance
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT, // Added DB_PORT from environment variables
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test the connection
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to MySQL database:', err);
        // Do not return here, as we still want to export the pool.promise()
        // The application will fail on subsequent queries if the connection is truly broken.
    } else {
        console.log('Successfully connected to the MySQL database.');
        connection.release(); // Release the connection
    }
});

// Export the pool promise-based interface
module.exports = pool.promise();
