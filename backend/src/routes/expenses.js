const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Get next expense number
router.get('/next-number', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`SELECT expense_number FROM expenses WHERE expense_number LIKE 'EXP-%' ORDER BY id DESC LIMIT 1`);
    let nextNumber = 'EXP-0001';
    if (result.rows.length > 0) {
      const last = parseInt(result.rows[0].expense_number.split('-')[1]);
      nextNumber = `EXP-${String(last + 1).padStart(4, '0')}`;
    }
    res.json({ nextNumber });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create expense
router.post('/', verifyToken, requireRole('admin', 'finance'), async (req, res) => {
  const { expense_type_id, expense_number, amount, description, receipt_number, supplier_name } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO expenses (expense_type_id, expense_number, amount, description, receipt_number, supplier_name, done_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [expense_type_id, expense_number, amount, description, receipt_number, supplier_name, req.user.id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all expenses
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, et.name as expense_type_name, u.full_name as done_by_name
      FROM expenses e
      JOIN expense_types et ON e.expense_type_id = et.id
      LEFT JOIN users u ON e.done_by = u.id
      ORDER BY e.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get expense types
router.get('/types', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM expense_types WHERE status = 'active' ORDER BY name`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;