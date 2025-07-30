const mysql = require('mysql2');
require('dotenv').config();

// Create a connection pool for better performance
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true, // Whether to queue requests when no connections are available
    connectionLimit: 10,     // Max number of connections in the pool
    queueLimit: 0,           // Max number of requests in the queue (0 means no limit)
    // connectTimeout: The milliseconds before a timeout occurs during the initial connection.
    // A higher value gives more time for the TCP handshake across different networks.
    // Default is often 10 seconds (10000 ms). Increase if connections are timing out
    // but eventually succeed, indicating high latency.
    connectTimeout: 20000 // Increased to 20 seconds for cross-provider connections
});

// Test the connection and log detailed errors
pool.getConnection((err, connection) => {
    if (err) {
        console.error('--- DATABASE CONNECTION ERROR ---');
        console.error('Failed to connect to MySQL database!');
        console.error('Error details:', err);
        console.error('DB_HOST:', process.env.DB_HOST);
        console.error('DB_PORT:', process.env.DB_PORT);
        console.error('DB_USER:', process.env.DB_USER);
        console.error('DB_NAME:', process.env.DB_NAME);
        console.error('---------------------------------');

        // IMPORTANT: Do not exit the process here in a web service,
        // as Render expects it to stay alive. The app will fail on queries.
    } else {
        console.log('Successfully connected to the MySQL database.');
        // This log indicates the initial pool connection test was successful.
        // Subsequent query performance depends on actual query complexity and network latency.
        connection.release(); // Release the connection immediately after testing
    }
});

// Export the pool promise-based interface
module.exports = pool.promise();
