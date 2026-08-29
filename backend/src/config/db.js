const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: false, // مهم جداً: ssl: false يحل مشكلة SSL
});

pool.connect()
  .then(() => console.log('DB connected OK'))
  .catch(err => console.error('DB error:', err));

module.exports = pool;