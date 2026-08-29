const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Generate next quote number
router.get('/next-number', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT quote_number FROM price_quotes 
       WHERE quote_number LIKE 'PQ-%' 
       ORDER BY id DESC LIMIT 1`
    );

    let nextNumber = 'PQ-0001';
    if (result.rows.length > 0) {
      const last = parseInt(result.rows[0].quote_number.split('-')[1]);
      nextNumber = `PQ-${String(last + 1).padStart(4, '0')}`;
    }

    res.json({ nextNumber });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create price quote
router.post('/', verifyToken, requireRole('sales', 'admin'), async (req, res) => {
  const {
    quote_number, quote_date, customer_id, customer_name,
    items, discount_amount, notes
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let subtotal = 0;
    for (const item of items) {
      subtotal += parseFloat(item.quantity) * parseFloat(item.unit_price);
    }

    const totalAmount = subtotal - parseFloat(discount_amount || 0);

    const quoteResult = await client.query(
      `INSERT INTO price_quotes (
        quote_number, quote_date, customer_id, customer_name,
        subtotal, discount_amount, total_amount, status, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        quote_number, quote_date, customer_id, customer_name,
        subtotal, discount_amount || 0, totalAmount, 'draft', notes, req.user.id
      ]
    );

    const quoteId = quoteResult.rows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO price_quote_items (
          quote_id, item_id, item_name, quantity, unit_price, total_price, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          quoteId, item.item_id, item.item_name,
          item.quantity, item.unit_price,
          item.quantity * item.unit_price, item.notes
        ]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({
      message: 'تم إنشاء بيان السعر بنجاح',
      data: quoteResult.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Get all price quotes
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pq.*, c.name as customer_name_display, c.code as customer_code,
        u.full_name as created_by_name,
        (SELECT COUNT(*) FROM price_quote_items WHERE quote_id = pq.id) as items_count
       FROM price_quotes pq
       LEFT JOIN customers c ON pq.customer_id = c.id
       LEFT JOIN users u ON pq.created_by = u.id
       ORDER BY pq.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get price quote by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const quoteResult = await pool.query(
      `SELECT pq.*, c.name as customer_name_display
       FROM price_quotes pq
       LEFT JOIN customers c ON pq.customer_id = c.id
       WHERE pq.id = $1`,
      [req.params.id]
    );

    if (quoteResult.rows.length === 0) {
      return res.status(404).json({ message: 'بيان السعر غير موجود' });
    }

    const itemsResult = await pool.query(
      `SELECT * FROM price_quote_items WHERE quote_id = $1 ORDER BY id`,
      [req.params.id]
    );

    res.json({
      ...quoteResult.rows[0],
      items: itemsResult.rows
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update price quote (draft only)
router.put('/:id', verifyToken, requireRole('sales', 'admin'), async (req, res) => {
  const { id } = req.params;
  const { quote_date, customer_id, customer_name, items, discount_amount, notes } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let subtotal = 0;
    for (const item of items) {
      subtotal += parseFloat(item.quantity) * parseFloat(item.unit_price);
    }

    const totalAmount = subtotal - parseFloat(discount_amount || 0);

    const result = await client.query(
      `UPDATE price_quotes 
       SET quote_date = $1, customer_id = $2, customer_name = $3,
           subtotal = $4, discount_amount = $5, total_amount = $6,
           notes = $7, updated_at = NOW()
       WHERE id = $8 AND status = 'draft'
       RETURNING *`,
      [
        quote_date, customer_id, customer_name,
        subtotal, discount_amount || 0, totalAmount,
        notes, id
      ]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'بيان السعر غير موجود أو تم اعتماده' });
    }

    await client.query('DELETE FROM price_quote_items WHERE quote_id = $1', [id]);

    for (const item of items) {
      await client.query(
        `INSERT INTO price_quote_items (
          quote_id, item_id, item_name, quantity, unit_price, total_price, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id, item.item_id, item.item_name,
          item.quantity, item.unit_price,
          item.quantity * item.unit_price, item.notes
        ]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'تم تحديث بيان السعر بنجاح', data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Approve price quote
router.put('/:id/approve', verifyToken, requireRole('admin', 'sales'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE price_quotes 
       SET status = 'approved', updated_at = NOW()
       WHERE id = $1 AND status = 'draft'
       RETURNING *`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'بيان السعر غير موجود أو تم اعتماده' });
    }

    res.json({ message: 'تم اعتماد بيان السعر بنجاح', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete price quote (draft only)
router.delete('/:id', verifyToken, requireRole('sales', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM price_quotes WHERE id = $1 AND status = 'draft' RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'لا يمكن حذف بيان السعر المعتمد' });
    }

    res.json({ message: 'تم الحذف بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
