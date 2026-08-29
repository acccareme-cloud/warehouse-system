const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

// Get all bank accounts
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM bank_accounts WHERE status = 'active' ORDER BY bank_code`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get bank account by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM bank_accounts WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'الحساب غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create bank account
router.post('/', verifyToken, requireRole('admin', 'finance'), async (req, res) => {
  const { bank_code, bank_name, account_number, branch, opening_balance } = req.body;

  try {
    // Check duplicate code
    const check = await pool.query(
      `SELECT id FROM bank_accounts WHERE bank_code = $1`,
      [bank_code]
    );
    if (check.rows.length > 0) {
      return res.status(400).json({ message: 'كود البنك موجود مسبقاً' });
    }

    const result = await pool.query(
      `INSERT INTO bank_accounts (bank_code, bank_name, account_number, branch, opening_balance, current_balance, status)
       VALUES ($1, $2, $3, $4, $5, $5, 'active') RETURNING *`,
      [bank_code, bank_name, account_number, branch, opening_balance || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update bank account
router.put('/:id', verifyToken, requireRole('admin', 'finance'), async (req, res) => {
  const { bank_code, bank_name, account_number, branch, opening_balance } = req.body;
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE bank_accounts 
       SET bank_code = $1, bank_name = $2, account_number = $3, branch = $4, opening_balance = $5, updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [bank_code, bank_name, account_number, branch, opening_balance, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'الحساب غير موجود' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Soft delete bank account
router.delete('/:id', verifyToken, requireRole('admin', 'finance'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE bank_accounts SET status = 'inactive', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'الحساب غير موجود' });
    }

    res.json({ message: 'تم الحذف بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
