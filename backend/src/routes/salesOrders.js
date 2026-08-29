// 02_salesOrders_backend.js
// Backend معدل لأوامر البيع + بيان التسليم المسعر + البنوك

const express = require('express');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// GET /api/sales-orders - قائمة أوامر البيع
router.get('/', verifyToken, async (req, res) => {
  try {
    const { search, status, from_date, to_date } = req.query;
    let query = `SELECT so.*, c.name as customer_name, ba.bank_name, ba.account_number, ba.iban
                 FROM sales_orders so
                 LEFT JOIN customers c ON so.customer_id = c.id
                 LEFT JOIN bank_accounts ba ON so.bank_id = ba.id
                 WHERE so.deleted_at IS NULL`;
    const params = [];
    let idx = 1;
    if (search) { query += ` AND (so.order_number ILIKE $${idx} OR c.name ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
    if (status) { query += ` AND so.status = $${idx}`; params.push(status); idx++; }
    if (from_date) { query += ` AND so.order_date >= $${idx}`; params.push(from_date); idx++; }
    if (to_date) { query += ` AND so.order_date <= $${idx}`; params.push(to_date); idx++; }
    query += ` ORDER BY so.created_at DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/sales-orders/:id - تفاصيل أمر البيع مع بيان التسليم
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const order = await pool.query(
      `SELECT so.*, c.name as customer_name, c.phone, c.address,
              ba.bank_name, ba.account_number, ba.iban, ba.branch_name
       FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id = c.id
       LEFT JOIN bank_accounts ba ON so.bank_id = ba.id
       WHERE so.id = $1 AND so.deleted_at IS NULL`, [id]);

    const items = await pool.query(
      `SELECT soi.*, i.code as item_code, i.name as item_name, i.unit
       FROM sales_order_items soi
       JOIN items i ON soi.item_id = i.id
       WHERE soi.sales_order_id = $1`, [id]);

    const deliveryQuotes = await pool.query(
      `SELECT dq.*, ba.bank_name, ba.account_number, ba.iban
       FROM delivery_quotes dq
       LEFT JOIN bank_accounts ba ON dq.bank_id = ba.id
       WHERE dq.sales_order_id = $1 AND dq.deleted_at IS NULL`, [id]);

    res.json({ ...order.rows[0], items: items.rows, delivery_quotes: deliveryQuotes.rows });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/sales-orders - إنشاء أمر بيع جديد
router.post('/', verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { customer_id, order_date, items, notes, bank_id } = req.body;

    const orderNum = await client.query(`SELECT COALESCE(MAX(CAST(order_number AS INTEGER)), 0) + 1 as next FROM sales_orders`);
    const order_number = orderNum.rows[0].next.toString();

    const order = await client.query(
      `INSERT INTO sales_orders (order_number, customer_id, order_date, status, notes, bank_id, created_by)
       VALUES ($1, $2, $3, 'draft', $4, $5, $6) RETURNING *`,
      [order_number, customer_id, order_date, notes, bank_id, req.user.id]);

    for (const item of items) {
      await client.query(
        `INSERT INTO sales_order_items (sales_order_id, item_id, quantity, unit_price, discount, total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.rows[0].id, item.item_id, item.quantity, item.unit_price, item.discount || 0, 
         item.quantity * item.unit_price - (item.discount || 0)]);
    }

    await client.query('COMMIT');
    res.status(201).json(order.rows[0]);
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ message: err.message }); }
  finally { client.release(); }
});

// POST /api/sales-orders/:id/delivery-quote - إنشاء بيان تسليم مسعر
router.post('/:id/delivery-quote', verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { items, bank_id, month, year } = req.body;

    const dqNum = await client.query(
      `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(dq_number, '[^0-9]', '', 'g') AS INTEGER)), 0) + 1 as next
       FROM delivery_quotes WHERE month = $1 AND year = $2`, [month, year]);
    const dq_number = `${dqNum.rows[0].next}/${month}/${year}`;

    const dq = await client.query(
      `INSERT INTO delivery_quotes (dq_number, sales_order_id, month, year, bank_id, status, created_by)
       VALUES ($1, $2, $3, $4, $5, 'draft', $6) RETURNING *`,
      [dq_number, id, month, year, bank_id, req.user.id]);

    for (const item of items) {
      await client.query(
        `INSERT INTO delivery_quote_items (delivery_quote_id, item_id, quantity, unit_price, total)
         VALUES ($1, $2, $3, $4, $5)`,
        [dq.rows[0].id, item.item_id, item.quantity, item.unit_price, item.quantity * item.unit_price]);
    }

    await client.query('COMMIT');
    res.status(201).json(dq.rows[0]);
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ message: err.message }); }
  finally { client.release(); }
});

// DELETE /api/sales-orders/:id - حذف آمن (soft delete)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await pool.query(`UPDATE sales_orders SET deleted_at = NOW() WHERE id = $1`, [req.params.id]);
    res.json({ message: 'تم الحذف بنجاح' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
