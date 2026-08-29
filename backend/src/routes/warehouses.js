const express = require('express');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// Get all warehouses
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT w.*, e.full_name as responsible_name
      FROM warehouses w
      LEFT JOIN employees e ON w.manager = e.full_name
      ORDER BY w.name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});



// Get employees for dropdown
router.get('/employees', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name as name FROM employees WHERE status = $1 ORDER BY full_name',
      ['active']
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get employees error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create warehouse ← مُصلح
router.post('/', verifyToken, async (req, res) => {
  const { code, name, location, manager, type } = req.body;  // ← ضفت type
  try {
    const result = await pool.query(
      'INSERT INTO warehouses (code, name, location, manager, type) VALUES ($1, $2, $3, $4, $5) RETURNING *',  // ← ضفت type
      [code, name, location, manager, type || 'main']  // ← ضفت type
    );
    res.status(201).json({ message: 'تم إضافة المخزن', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update warehouse ← مُصلح
router.put('/:id', verifyToken, async (req, res) => {
  const { code, name, location, manager, type } = req.body;  // ← ضفت type
  try {
    const result = await pool.query(
      'UPDATE warehouses SET code=$1, name=$2, location=$3, manager=$4, type=$5 WHERE id=$6 RETURNING *',  // ← ضفت type
      [code, name, location, manager, type, req.params.id]  // ← ضفت type
    );
    res.json({ message: 'تم تحديث المخزن', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete warehouse
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM warehouses WHERE id=$1', [req.params.id]);
    res.json({ message: 'تم حذف المخزن' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;