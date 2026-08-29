const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// PURCHASE ORDERS API (محدث - مع exchange_rate)
// ═══════════════════════════════════════════════════════════════

// GET /purchase-orders/next-number
router.get('/next-number', verifyToken, async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const gapResult = await pool.query(
      `SELECT t1.order_number + 1 as next_num
       FROM purchase_orders t1
       WHERE t1.order_year = $1
         AND t1.status != 'cancelled'
         AND NOT EXISTS (
           SELECT 1 FROM purchase_orders t2 
           WHERE t2.order_number = t1.order_number + 1 
           AND t2.order_year = $1
           AND t2.status != 'cancelled'
         )
       ORDER BY t1.order_number
       LIMIT 1`,
      [year]
    );
    if (gapResult.rows.length > 0 && gapResult.rows[0].next_num > 0) {
      return res.json({ nextNumber: gapResult.rows[0].next_num });
    }
    const maxResult = await pool.query(
      `SELECT COALESCE(MAX(order_number), 0) + 1 as next_num 
       FROM purchase_orders 
       WHERE order_year = $1 AND status != 'cancelled'`,
      [year]
    );
    res.json({ nextNumber: maxResult.rows[0].next_num });
  } catch (err) {
    console.error('[GET /next-number] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /purchase-orders
router.get('/', verifyToken, async (req, res) => {
  const { year, status, supplier_id, purchase_type } = req.query;
  try {
    let query = `
      SELECT po.*, s.name as supplier_name, s.supplier_code, c.name as currency_name, u.full_name as created_by_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN currencies c ON po.currency_id = c.id
      LEFT JOIN users u ON po.created_by = u.id
      WHERE po.status != 'cancelled'
    `;
    const params = [];
    if (year) { params.push(year); query += ` AND po.order_year = $${params.length}`; }
    if (status) { params.push(status); query += ` AND po.status = $${params.length}`; }
    if (supplier_id) { params.push(supplier_id); query += ` AND po.supplier_id = $${params.length}`; }
    if (purchase_type) { params.push(purchase_type); query += ` AND po.purchase_type = $${params.length}`; }
    query += ` ORDER BY po.order_year DESC, po.order_number DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /purchase-orders] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /purchase-orders/:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const orderResult = await pool.query(
      `SELECT po.*, s.name as supplier_name, s.supplier_code, c.name as currency_name, c.code as currency_code, c.exchange_rate as currency_exchange_rate, u.full_name as created_by_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN currencies c ON po.currency_id = c.id
      LEFT JOIN users u ON po.created_by = u.id
      WHERE po.id = $1`, [req.params.id]
    );
    if (orderResult.rows.length === 0) return res.status(404).json({ message: 'أمر الشراء غير موجود' });
    const order = orderResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT poi.*, i.name as item_name, i.code as item_code, i.unit_of_measure, i.is_vat_exempt, i.is_profit_tax_exempt
      FROM purchase_order_items poi
      LEFT JOIN items i ON poi.item_id = i.id
      WHERE poi.purchase_order_id = $1`, [req.params.id]
    );

    res.json({ ...order, items: itemsResult.rows });
  } catch (err) {
    console.error('[GET /purchase-orders/:id] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /purchase-orders
router.post('/', verifyToken, requireRole('purchasing', 'admin'), async (req, res) => {
  const { order_number, order_year, supplier_id, order_date, delivery_date, purchase_type, currency_id, exchange_rate, notes, items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'يجب إضافة بنود لأمر الشراء' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // جيب معامل التحويل من العملة لو مش مدخل
    let finalExchangeRate = exchange_rate;
    if (!finalExchangeRate && currency_id) {
      const currencyResult = await client.query(`SELECT exchange_rate FROM currencies WHERE id = $1`, [currency_id]);
      if (currencyResult.rows.length > 0) finalExchangeRate = currencyResult.rows[0].exchange_rate;
    }
    if (!finalExchangeRate) finalExchangeRate = 1;

    const orderResult = await client.query(
      `INSERT INTO purchase_orders (order_number, order_year, supplier_id, order_date, delivery_date, purchase_type, status, currency_id, exchange_rate, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9, $10) RETURNING *`,
      [order_number, order_year || new Date().getFullYear(), supplier_id || null, order_date || new Date(), delivery_date || null, purchase_type || 'local', currency_id || null, finalExchangeRate, notes || null, req.user.id]
    );
    const orderId = orderResult.rows[0].id;

    let totalAmount = 0;
    for (const item of items) {
      const itemTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
      totalAmount += itemTotal;
      await client.query(
        `INSERT INTO purchase_order_items (purchase_order_id, item_id, quantity, unit_price, total_price, unit_of_measure, notes, is_vat_exempt, is_profit_tax_exempt)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [orderId, item.item_id, item.quantity, item.unit_price || 0, itemTotal, item.unit_of_measure || null, item.notes || null, item.is_vat_exempt || false, item.is_profit_tax_exempt || false]
      );
    }

    await client.query(`UPDATE purchase_orders SET total_amount = $1 WHERE id = $2`, [totalAmount, orderId]);
    await client.query('COMMIT');
    res.status(201).json({ message: 'تم إنشاء أمر الشراء بنجاح', data: { ...orderResult.rows[0], total_amount: totalAmount } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /purchase-orders] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally { client.release(); }
});

// POST /purchase-orders/from-pr - إنشاء من طلب شراء معتمد
router.post('/from-pr', verifyToken, requireRole('purchasing', 'admin'), async (req, res) => {
  const { purchase_request_id, order_number, order_year, supplier_id, order_date, delivery_date, purchase_type, currency_id, exchange_rate, notes } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // جيب بيانات طلب الشراء
    const prResult = await client.query(
      `SELECT * FROM purchase_requests WHERE id = $1 AND status = 'approved'`,
      [purchase_request_id]
    );
    if (prResult.rows.length === 0) throw new Error('طلب الشراء غير موجود أو غير معتمد');
    const pr = prResult.rows[0];

    // جيب بنود طلب الشراء
    const prItemsResult = await client.query(
      `SELECT * FROM purchase_request_items WHERE purchase_request_id = $1`,
      [purchase_request_id]
    );
    if (prItemsResult.rows.length === 0) throw new Error('طلب الشراء لا يحتوي على بنود');

    // جيب معامل التحويل
    let finalExchangeRate = exchange_rate;
    if (!finalExchangeRate && (currency_id || pr.currency_id)) {
      const currId = currency_id || pr.currency_id;
      const currencyResult = await client.query(`SELECT exchange_rate FROM currencies WHERE id = $1`, [currId]);
      if (currencyResult.rows.length > 0) finalExchangeRate = currencyResult.rows[0].exchange_rate;
    }
    if (!finalExchangeRate) finalExchangeRate = pr.exchange_rate || 1;

    // إنشاء أمر الشراء
    const orderResult = await client.query(
      `INSERT INTO purchase_orders (order_number, order_year, supplier_id, order_date, delivery_date, purchase_type, status, currency_id, exchange_rate, notes, purchase_request_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9, $10, $11) RETURNING *`,
      [order_number, order_year || new Date().getFullYear(), supplier_id || pr.supplier_id, order_date || new Date(), delivery_date || null, purchase_type || 'local', currency_id || pr.currency_id, finalExchangeRate, notes || pr.notes, purchase_request_id, req.user.id]
    );
    const orderId = orderResult.rows[0].id;

    // نقل البنود
    let totalAmount = 0;
    for (const item of prItemsResult.rows) {
      const itemTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.estimated_price) || 0);
      totalAmount += itemTotal;
      await client.query(
        `INSERT INTO purchase_order_items (purchase_order_id, item_id, quantity, unit_price, total_price, unit_of_measure, notes, is_vat_exempt, is_profit_tax_exempt)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [orderId, item.item_id, item.quantity, item.estimated_price || 0, itemTotal, item.unit_of_measure || null, item.notes || null, item.is_vat_exempt || false, item.is_profit_tax_exempt || false]
      );
    }

    await client.query(`UPDATE purchase_orders SET total_amount = $1 WHERE id = $2`, [totalAmount, orderId]);
    await client.query('COMMIT');
    res.status(201).json({ message: 'تم إنشاء أمر الشراء من طلب الشراء بنجاح', data: { ...orderResult.rows[0], total_amount: totalAmount } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /purchase-orders/from-pr] Error:', err);
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally { client.release(); }
});

// PUT /purchase-orders/:id
router.put('/:id', verifyToken, requireRole('purchasing', 'admin'), async (req, res) => {
  const { supplier_id, order_date, delivery_date, purchase_type, currency_id, exchange_rate, notes, items } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderResult = await client.query(`SELECT status FROM purchase_orders WHERE id = $1`, [req.params.id]);
    if (orderResult.rows.length === 0) throw new Error('أمر الشراء غير موجود');
    if (orderResult.rows[0].status === 'posted') throw new Error('لا يمكن تعديل أمر مرحل');

    let finalExchangeRate = exchange_rate;
    if (!finalExchangeRate && currency_id) {
      const currencyResult = await client.query(`SELECT exchange_rate FROM currencies WHERE id = $1`, [currency_id]);
      if (currencyResult.rows.length > 0) finalExchangeRate = currencyResult.rows[0].exchange_rate;
    }

    await client.query(
      `UPDATE purchase_orders SET supplier_id = $1, order_date = $2, delivery_date = $3, purchase_type = $4, currency_id = $5, exchange_rate = $6, notes = $7, updated_at = NOW() WHERE id = $8`,
      [supplier_id || null, order_date || new Date(), delivery_date || null, purchase_type || 'local', currency_id || null, finalExchangeRate || 1, notes || null, req.params.id]
    );

    if (items && Array.isArray(items)) {
      await client.query(`DELETE FROM purchase_order_items WHERE purchase_order_id = $1`, [req.params.id]);
      let totalAmount = 0;
      for (const item of items) {
        const itemTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
        totalAmount += itemTotal;
        await client.query(
          `INSERT INTO purchase_order_items (purchase_order_id, item_id, quantity, unit_price, total_price, unit_of_measure, notes, is_vat_exempt, is_profit_tax_exempt)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [req.params.id, item.item_id, item.quantity, item.unit_price || 0, itemTotal, item.unit_of_measure || null, item.notes || null, item.is_vat_exempt || false, item.is_profit_tax_exempt || false]
        );
      }
      await client.query(`UPDATE purchase_orders SET total_amount = $1 WHERE id = $2`, [totalAmount, req.params.id]);
    }

    await client.query('COMMIT');
    res.json({ message: 'تم تحديث أمر الشراء' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[PUT /purchase-orders/:id] Error:', err);
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally { client.release(); }
});

// PUT /purchase-orders/:id/approve
router.put('/:id/approve', verifyToken, requireRole('admin', 'purchasing_manager'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE purchase_orders SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2 AND status = 'draft' RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (result.rows.length === 0) return res.status(400).json({ message: 'لا يمكن اعتماد أمر الشراء' });
    res.json({ message: 'تم اعتماد أمر الشراء', data: result.rows[0] });
  } catch (err) {
    console.error('[PUT /purchase-orders/:id/approve] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /purchase-orders/:id/cancel
router.put('/:id/cancel', verifyToken, requireRole('admin', 'purchasing_manager'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE purchase_orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND status != 'posted' RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(400).json({ message: 'لا يمكن إلغاء أمر الشراء' });
    res.json({ message: 'تم إلغاء أمر الشراء', data: result.rows[0] });
  } catch (err) {
    console.error('[PUT /purchase-orders/:id/cancel] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /purchase-orders/:id
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const checkResult = await pool.query(`SELECT status FROM purchase_orders WHERE id = $1`, [req.params.id]);
    if (checkResult.rows.length === 0) return res.status(404).json({ message: 'أمر الشراء غير موجود' });
    if (checkResult.rows[0].status === 'posted') return res.status(400).json({ message: 'لا يمكن حذف أمر مرحل' });
    await pool.query(`DELETE FROM purchase_orders WHERE id = $1`, [req.params.id]);
    res.json({ message: 'تم حذف أمر الشراء' });
  } catch (err) {
    console.error('[DELETE /purchase-orders/:id] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /purchase-orders/approved
router.get('/approved', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT po.*, s.name as supplier_name, c.name as currency_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN currencies c ON po.currency_id = c.id
      WHERE po.status = 'approved'
      ORDER BY po.order_year DESC, po.order_number DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /purchase-orders/approved] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
