const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Create sales commission
router.post('/', verifyToken, requireRole('admin', 'finance'), async (req, res) => {
  const {
    employee_id, invoice_id, quote_id, commission_type,
    commission_rate, base_amount, notes
  } = req.body;

  try {
    let commissionAmount = 0;
    if (commission_type === 'percentage') {
      commissionAmount = parseFloat(base_amount) * (parseFloat(commission_rate) / 100);
    } else {
      commissionAmount = parseFloat(commission_rate);
    }

    const result = await pool.query(
      `INSERT INTO sales_commissions (
        employee_id, invoice_id, quote_id, commission_type,
        commission_rate, commission_amount, base_amount,
        status, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        employee_id, invoice_id || null, quote_id || null, commission_type,
        commission_rate, commissionAmount, base_amount,
        'pending', notes, req.user.id
      ]
    );

    res.status(201).json({
      message: 'تم إنشاء العمولة بنجاح',
      data: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all commissions
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sc.*, e.full_name as employee_name, e.employee_number,
        ti.invoice_number as tax_invoice_number,
        pq.quote_number as price_quote_number
       FROM sales_commissions sc
       LEFT JOIN employees e ON sc.employee_id = e.id
       LEFT JOIN tax_invoices ti ON sc.invoice_id = ti.id
       LEFT JOIN price_quotes pq ON sc.quote_id = pq.id
       ORDER BY sc.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get commissions by employee
router.get('/by-employee/:employeeId', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sc.*, ti.invoice_number, ti.invoice_date, ti.total_amount,
        pq.quote_number, pq.quote_date, pq.total_amount as quote_total
       FROM sales_commissions sc
       LEFT JOIN tax_invoices ti ON sc.invoice_id = ti.id
       LEFT JOIN price_quotes pq ON sc.quote_id = pq.id
       WHERE sc.employee_id = $1
       ORDER BY sc.created_at DESC`,
      [req.params.employeeId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Pay commission
router.put('/:id/pay', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { paid_amount, payment_date } = req.body;

  try {
    const result = await pool.query(
      `UPDATE sales_commissions 
       SET paid_amount = $1, payment_date = $2, status = 'paid', updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [paid_amount, payment_date, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'العمولة غير موجودة' });
    }

    res.json({ message: 'تم دفع العمولة بنجاح', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get commission summary report
router.get('/report/summary', verifyToken, async (req, res) => {
  const { from_date, to_date } = req.query;

  try {
    const result = await pool.query(
      `SELECT 
        e.id as employee_id,
        e.full_name as employee_name,
        e.employee_number,
        COUNT(sc.id) as total_commissions,
        COALESCE(SUM(sc.commission_amount), 0) as total_commission_amount,
        COALESCE(SUM(sc.paid_amount), 0) as total_paid,
        COALESCE(SUM(sc.commission_amount - sc.paid_amount), 0) as total_remaining
       FROM employees e
       LEFT JOIN sales_commissions sc ON e.id = sc.employee_id
         AND sc.created_at BETWEEN $1 AND $2
       WHERE e.job_title ILIKE '%مبيع%' OR e.job_title ILIKE '%sales%'
       GROUP BY e.id, e.full_name, e.employee_number
       ORDER BY total_commission_amount DESC`,
      [from_date, to_date]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
