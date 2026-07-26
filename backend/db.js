const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create tables if they don't exist
const initDb = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS media (
      id SERIAL PRIMARY KEY,
      s3_key VARCHAR(255) NOT NULL,
      s3_url TEXT NOT NULL,
      file_type VARCHAR(50) NOT NULL,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(createTableQuery);
    console.log('Database tables initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  initDb,
};
