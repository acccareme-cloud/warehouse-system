// backend/src/routes/partnerFinancing.js
const express = require('express');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// Get all partner financing records
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pf.*, p.name as partner_name, u.full_name as created_by_name
      FROM partner_financing pf
      LEFT JOIN partners p ON pf.partner_id = p.id
      LEFT JOIN users u ON pf.created_by = u.id
      ORDER BY pf.financing_date DESC, pf.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /partner-financing] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create partner financing
router.post('/', verifyToken, async (req, res) => {
  const { partner_id, amount, financing_date, notes } = req.body;
  
  try {
    const result = await pool.query(`
      INSERT INTO partner_financing (partner_id, amount, financing_date, notes, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [partner_id, amount, financing_date, notes, req.user.id]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[POST /partner-financing] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get partner financing balance
router.get('/balance/:partner_id', verifyToken, async (req, res) => {
  try {
    const { partner_id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_financing,
        COALESCE(SUM(CASE WHEN payment_id IS NOT NULL THEN amount ELSE 0 END), 0) as total_paid
      FROM partner_financing pf
      LEFT JOIN partner_payments pp ON pp.partner_id = pf.partner_id
      WHERE pf.partner_id = $1
    `, [partner_id]);
    
    const totalFinancing = parseFloat(result.rows[0].total_financing || 0);
    const totalPaid = parseFloat(result.rows[0].total_paid || 0);
    const balance = totalFinancing - totalPaid;
    
    res.json({
      partner_id,
      total_financing: totalFinancing,
      total_paid: totalPaid,
      balance: balance,
    });
  } catch (err) {
    console.error('[GET /partner-financing/balance] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;