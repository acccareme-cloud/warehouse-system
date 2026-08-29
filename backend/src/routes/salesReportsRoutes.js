const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

// ============================================
// SALES REPORTS - تقارير المبيعات
// ============================================

// GET /sales-invoices/reports/sales - مبيعات
router.get('/sales-invoices/reports/sales', verifyToken, async (req, res) => {
  const { start_date, end_date, customer_id, invoice_type, status } = req.query;

  try {
    let query = `
      SELECT 
        si.id,
        si.invoice_number,
        si.invoice_date,
        si.invoice_type,
        si.customer_id,
        si.customer_name,
        si.total_amount,
        si.commission_rate,
        si.commission_amount,
        si.status,
        si.created_at,
        si.item_id,
        i.name as item_name
      FROM sales_invoices si
      LEFT JOIN items i ON si.item_id = i.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (start_date) {
      query += ` AND si.invoice_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    if (end_date) {
      query += ` AND si.invoice_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    if (customer_id) {
      query += ` AND si.customer_id = $${paramIndex}`;
      params.push(customer_id);
      paramIndex++;
    }
    if (invoice_type) {
      query += ` AND si.invoice_type = $${paramIndex}`;
      params.push(invoice_type);
      paramIndex++;
    }
    if (status) {
      query += ` AND si.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY si.invoice_date DESC, si.id DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching sales report:', err);
    res.status(500).json({ error: 'فشل في جلب تقرير المبيعات' });
  }
});

// GET /sales-invoices/reports/commissions - عمولات
router.get('/sales-invoices/reports/commissions', verifyToken, async (req, res) => {
  const { start_date, end_date, customer_id, salesperson_id } = req.query;

  try {
    let query = `
      SELECT 
        si.id,
        si.invoice_number,
        si.invoice_date,
        si.customer_id,
        si.customer_name,
        si.total_amount,
        si.commission_rate,
        si.commission_amount,
        si.salesperson_id,
        si.status,
        si.created_at,
        u.full_name as salesperson_name
      FROM sales_invoices si
      LEFT JOIN users u ON si.salesperson_id = u.id
      WHERE si.commission_amount > 0
    `;
    const params = [];
    let paramIndex = 1;

    if (start_date) {
      query += ` AND si.invoice_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    if (end_date) {
      query += ` AND si.invoice_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    if (customer_id) {
      query += ` AND si.customer_id = $${paramIndex}`;
      params.push(customer_id);
      paramIndex++;
    }
    if (salesperson_id) {
      query += ` AND si.salesperson_id = $${paramIndex}`;
      params.push(salesperson_id);
      paramIndex++;
    }

    query += ` ORDER BY si.invoice_date DESC, si.id DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching commissions report:', err);
    res.status(500).json({ error: 'فشل في جلب تقرير العمولات' });
  }
});

// GET /sales-invoices/reports/pending - معلقة
router.get('/sales-invoices/reports/pending', verifyToken, async (req, res) => {
  const { start_date, end_date, customer_id } = req.query;

  try {
    let query = `
      SELECT 
        si.id,
        si.invoice_number,
        si.invoice_date,
        si.customer_id,
        si.customer_name,
        si.total_amount,
        si.remaining_amount,
        si.status,
        si.created_at,
        si.item_id,
        i.name as item_name
      FROM sales_invoices si
      LEFT JOIN items i ON si.item_id = i.id
      WHERE si.status NOT IN ('posted', 'cancelled')
        AND si.remaining_amount > 0
    `;
    const params = [];
    let paramIndex = 1;

    if (start_date) {
      query += ` AND si.invoice_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    if (end_date) {
      query += ` AND si.invoice_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    if (customer_id) {
      query += ` AND si.customer_id = $${paramIndex}`;
      params.push(customer_id);
      paramIndex++;
    }

    query += ` ORDER BY si.invoice_date DESC, si.id DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching pending report:', err);
    res.status(500).json({ error: 'فشل في جلب تقرير المعلق' });
  }
});

module.exports = router;
