const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Create refundable deposit
router.post('/', verifyToken, requireRole('sales', 'admin'), async (req, res) => {
  const {
    customer_id, invoice_id, deposit_type, deposit_amount,
    deposit_date, bank_name, bank_account, reference_number, notes
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO refundable_deposits (
        customer_id, invoice_id, deposit_type, deposit_amount,
        deposit_date, bank_name, bank_account, reference_number,
        status, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        customer_id, invoice_id || null, deposit_type, deposit_amount,
        deposit_date, bank_name, bank_account, reference_number,
        'active', notes, req.user.id
      ]
    );

    res.status(201).json({
      message: 'تم إنشاء التأمين بنجاح',
      data: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all refundable deposits
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT rd.*, c.name as customer_name, c.code as customer_code,
        ti.invoice_number as tax_invoice_number
       FROM refundable_deposits rd
       LEFT JOIN customers c ON rd.customer_id = c.id
       LEFT JOIN tax_invoices ti ON rd.invoice_id = ti.id
       ORDER BY rd.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get deposits by customer
router.get('/by-customer/:customerId', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT rd.*, ti.invoice_number, ti.invoice_date
       FROM refundable_deposits rd
       LEFT JOIN tax_invoices ti ON rd.invoice_id = ti.id
       WHERE rd.customer_id = $1
       ORDER BY rd.deposit_date DESC`,
      [req.params.customerId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Refund deposit
router.put('/:id/refund', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { refunded_amount, refunded_date, notes } = req.body;

  try {
    const result = await pool.query(
      `UPDATE refundable_deposits 
       SET refunded_amount = $1, refunded_date = $2, status = 'refunded', notes = COALESCE(notes, '') || ' | ' || $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [refunded_amount, refunded_date, notes, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'التأمين غير موجود' });
    }

    res.json({ message: 'تم استرداد التأمين بنجاح', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
