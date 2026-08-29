const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Create work warranty
router.post('/', verifyToken, requireRole('sales', 'admin'), async (req, res) => {
  const {
    customer_id, invoice_id, warranty_type, warranty_amount,
    warranty_date, expiry_date, bank_name, bank_account, reference_number, notes
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO work_warranties (
        customer_id, invoice_id, warranty_type, warranty_amount,
        warranty_date, expiry_date, bank_name, bank_account, reference_number,
        status, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        customer_id, invoice_id || null, warranty_type, warranty_amount,
        warranty_date, expiry_date, bank_name, bank_account, reference_number,
        'active', notes, req.user.id
      ]
    );

    res.status(201).json({
      message: 'تم إنشاء خطاب الضمان بنجاح',
      data: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all work warranties
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ww.*, c.name as customer_name, c.code as customer_code,
        ti.invoice_number as tax_invoice_number
       FROM work_warranties ww
       LEFT JOIN customers c ON ww.customer_id = c.id
       LEFT JOIN tax_invoices ti ON ww.invoice_id = ti.id
       ORDER BY ww.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get warranties by customer
router.get('/by-customer/:customerId', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ww.*, ti.invoice_number, ti.invoice_date
       FROM work_warranties ww
       LEFT JOIN tax_invoices ti ON ww.invoice_id = ti.id
       WHERE ww.customer_id = $1
       ORDER BY ww.warranty_date DESC`,
      [req.params.customerId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Release warranty
router.put('/:id/release', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { released_amount, released_date, notes } = req.body;

  try {
    const result = await pool.query(
      `UPDATE work_warranties 
       SET released_amount = $1, released_date = $2, status = 'released', notes = COALESCE(notes, '') || ' | ' || $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [released_amount, released_date, notes, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'خطاب الضمان غير موجود' });
    }

    res.json({ message: 'تم إخلاء خطاب الضمان بنجاح', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
