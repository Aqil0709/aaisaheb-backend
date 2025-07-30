const mysql = require('mysql2');
require('dotenv').config();

// Create a connection pool for better performance
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Add a connection timeout if not already handled by default,
    // though ETIMEDOUT usually means it's already timing out at a lower level.
    // connectTimeout: 10000 // 10 seconds, adjust as needed
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
        // process.exit(1); // Only for critical, unrecoverable errors in a script
    } else {
        console.log('Successfully connected to the MySQL database.');
        connection.release(); // Release the connection immediately after testing
    }
});

// Export the pool promise-based interface
module.exports = pool.promise();
