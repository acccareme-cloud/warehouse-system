const pool = require('../config/db');
const bcrypt = require('bcryptjs');

async function seedAdmin() {
  try {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const result = await pool.query(
      `INSERT INTO users (username, password, full_name, role, is_active) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (username) DO UPDATE 
       SET password = $2, full_name = $3, role = $4, is_active = $5
       RETURNING *`,
      ['admin', hashedPassword, 'مدير النظام', 'admin', true]
    );
    
    console.log('Admin created/updated:', result.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

seedAdmin();