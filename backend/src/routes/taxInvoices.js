// 08_taxInvoices_backend.js
// Backend الفواتير الضريبية المتقدمة

const express = require('express');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// GET /api/tax-invoices - قائمة الفواتير الضريبية
router.get('/', verifyToken, async (req, res) => {
  try {
    const { type, is_virtual, status, search } = req.query;
    let query = `SELECT si.*, c.name as customer_name
                 FROM sales_invoices si
                 LEFT JOIN customers c ON si.customer_id = c.id
                 WHERE si.deleted_at IS NULL`;
    const params = [];
    let idx = 1;

    if (type === 'service') { query += ` AND si.is_service_invoice = TRUE`; }
    if (is_virtual) { query += ` AND si.is_virtual = $${idx}`; params.push(is_virtual === 'true'); idx++; }
    if (status) { query += ` AND si.status = $${idx}`; params.push(status); idx++; }
    if (search) { query += ` AND (si.invoice_number ILIKE $${idx} OR c.name ILIKE $${idx})`; params.push(`%${search}%`); idx++; }

    query += ` ORDER BY si.created_at DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/tax-invoices - إنشاء فاتورة ضريبية
router.post('/', verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { customer_id, invoice_date, items, is_virtual, is_service_invoice, service_period_from, service_period_to, delivery_quote_ids, use_serial } = req.body;

    // توليد السريال الداخلي
    let internalSerial = null;
    if (use_serial) {
      const serialRes = await client.query(`SELECT * FROM generate_tax_serial($1) as serial`, [use_serial]);
      internalSerial = serialRes.rows[0].serial;
    }

    // رقم الفاتورة
    const invNum = await client.query(`SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(invoice_number, '[^0-9]', '', 'g') AS INTEGER)), 0) + 1 as next FROM sales_invoices`);
    const invoice_number = invNum.rows[0].next.toString();

    const invoice = await client.query(
      `INSERT INTO sales_invoices (invoice_number, customer_id, invoice_date, status, is_virtual, is_service_invoice, 
       service_period_from, service_period_to, delivery_quote_ids, internal_serial_number, created_by)
       VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [invoice_number, customer_id, invoice_date, is_virtual || false, is_service_invoice || false, 
       service_period_from, service_period_to, delivery_quote_ids || '{}', internalSerial, req.user.id]);

    // إضافة البنود
    for (const item of items) {
      await client.query(
        `INSERT INTO sales_invoice_items (sales_invoice_id, item_id, quantity, unit_price, item_type, total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [invoice.rows[0].id, item.item_id, item.quantity, item.unit_price, item.item_type || 'product', 
         item.quantity * item.unit_price]);

      // لو بضاعة حقيقية - حركة مخزن
      if (!is_service_invoice && item.item_type !== 'service' && !is_virtual) {
        await client.query(
          `INSERT INTO stock_movements (item_id, quantity, movement_type, reference_type, reference_id, is_tax_virtual)
           VALUES ($1, $2, 'sale', 'sales_invoice', $3, $4)`,
          [item.item_id, -item.quantity, invoice.rows[0].id, is_virtual || false]);
      }
      // لو وهمية - حركة مخزن ضريبي
      else if (is_virtual && item.item_type !== 'service') {
        await client.query(
          `INSERT INTO stock_movements (item_id, quantity, movement_type, reference_type, reference_id, is_tax_virtual)
           VALUES ($1, $2, 'tax_sale', 'sales_invoice', $3, TRUE)`,
          [item.item_id, -item.quantity, invoice.rows[0].id]);
      }
    }

    // تحديث السريال
    if (internalSerial) {
      await client.query(`SELECT use_tax_serial($1, $2)`, [internalSerial, invoice.rows[0].id]);
    }

    await client.query('COMMIT');
    res.status(201).json(invoice.rows[0]);
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ message: err.message }); }
  finally { client.release(); }
});

// POST /api/tax-invoices/reserve-serial - حجز رقم
router.post('/reserve-serial', verifyToken, async (req, res) => {
  try {
    const { serial_number } = req.body;
    const result = await pool.query(`SELECT reserve_tax_serial($1, $2) as success`, [serial_number, req.user.id]);
    if (result.rows[0].success) res.json({ message: 'تم الحجز بنجاح' });
    else res.status(400).json({ message: 'الرقم غير متاح' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/tax-invoices/skip-serial - تخطي رقم
router.post('/skip-serial', verifyToken, async (req, res) => {
  try {
    const { serial_number } = req.body;
    await pool.query(`SELECT skip_tax_serial($1)`, [serial_number]);
    res.json({ message: 'تم التخطي بنجاح' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/tax-invoices/serials - قائمة السريالات
router.get('/serials', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM tax_invoice_serials WHERE deleted_at IS NULL ORDER BY serial_number DESC LIMIT 100`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
