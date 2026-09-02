// backend/src/routes/partnerPayments.js
const express = require('express');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// Get all partner payments
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pp.*, p.name as partner_name, u.full_name as created_by_name
      FROM partner_payments pp
      LEFT JOIN partners p ON pp.partner_id = p.id
      LEFT JOIN users u ON pp.created_by = u.id
      ORDER BY pp.payment_date DESC, pp.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /partner-payments] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create partner payment
router.post('/', verifyToken, async (req, res) => {
  const { partner_id, amount, payment_date, payment_method, notes } = req.body;
  
  try {
    const result = await pool.query(`
      INSERT INTO partner_payments (partner_id, amount, payment_date, payment_method, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [partner_id, amount, payment_date, payment_method, notes, req.user.id]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[POST /partner-payments] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;