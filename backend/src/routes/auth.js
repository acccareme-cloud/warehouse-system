const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'warehouse-secret-key-2024';

// Helper: جلب أسماء أعمدة الجدول
async function getTableColumns(tableName) {
  const result = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = $1 AND table_schema = 'public'
  `, [tableName]);
  return result.rows.map(r => r.column_name);
}

// ============================================
// Login
// ============================================
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    console.log('Login attempt:', username);
    
    const columns = await getTableColumns('users');
    console.log('Users columns:', columns);
    
    // البحث عن username column
    const usernameCol = columns.find(c => c.toLowerCase() === 'username') || 'username';
    
    // البحث عن password column
    const passCol = columns.find(c => c.toLowerCase().includes('password')) || 
                   columns.find(c => c.toLowerCase().includes('pass')) ||
                   columns.find(c => c.toLowerCase().includes('hash'));
    
    console.log('Password column:', passCol);
    
    // جلب المستخدم
    const result = await pool.query(`SELECT * FROM users WHERE ${usernameCol} = $1`, [username]);
    console.log('User found:', result.rows.length > 0);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    }
    
    const user = result.rows[0];
    
    // التحقق من كلمة المرور
    const validPassword = await bcrypt.compare(password, user[passCol]);
    console.log('Password valid:', validPassword);
    
    if (!validPassword) {
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    }
    
    // التحقق من is_active
    if (user.is_active === false) {
      return res.status(401).json({ message: 'الحساب غير مفعل' });
    }
    
    // إنشاء token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // تحديث last_login
    if (columns.includes('last_login')) {
      await pool.query(`UPDATE users SET last_login = NOW() WHERE id = $1`, [user.id]);
    }
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ============================================
// Register (للـ admin بس)
// ============================================
router.post('/register', async (req, res) => {
  const { username, password, role, full_name } = req.body;
  
  try {
    const columns = await getTableColumns('users');
    
    // التحقق من وجود username
    const usernameCol = columns.find(c => c.toLowerCase() === 'username') || 'username';
    const checkResult = await pool.query(`SELECT ${usernameCol} FROM users WHERE ${usernameCol} = $1`, [username]);
    if (checkResult.rows.length > 0) {
      return res.status(400).json({ message: 'اسم المستخدم موجود بالفعل' });
    }
    
    // بناء البيانات
    const userData = {};
    
    if (columns.includes('username')) userData.username = username;
    if (columns.includes('user_name')) userData.user_name = username;
    
    const passCol = columns.find(c => c.toLowerCase().includes('password')) || 
                   columns.find(c => c.toLowerCase().includes('pass')) ||
                   columns.find(c => c.toLowerCase().includes('hash'));
    
    if (passCol) {
      userData[passCol] = await bcrypt.hash(password, 10);
    }
    
    if (columns.includes('role')) userData.role = role || 'storekeeper';
    if (columns.includes('full_name')) userData.full_name = full_name || username;
    if (columns.includes('is_active')) userData.is_active = true;
    if (columns.includes('created_at')) userData.created_at = new Date();
    
    // employee_id
    if (columns.includes('employee_id')) {
      const empResult = await pool.query('SELECT id FROM employees LIMIT 1');
      if (empResult.rows.length > 0) {
        userData.employee_id = empResult.rows[0].id;
      } else {
        const newEmp = await pool.query(
          'INSERT INTO employees (name, code, department, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id',
          [full_name || username, 'EMP-' + Date.now(), role || 'storekeeper']
        );
        userData.employee_id = newEmp.rows[0].id;
      }
    }
    
    const validColumns = Object.keys(userData);
    const placeholders = validColumns.map((_, i) => `$${i + 1}`).join(', ');
    const values = Object.values(userData);
    
    const query = `INSERT INTO users (${validColumns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await pool.query(query, values);
    
    res.status(201).json({
      message: 'تم إنشاء المستخدم بنجاح',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Failed to create user', error: err.message });
  }
});

module.exports = router;