const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Generate next PO number
router.get('/next-number', verifyToken, async (req, res) => {
  try {
    const { type } = req.query;
    const prefix = type === 'import' ? 'PO-IMP' : 'PO-LOC';

    const result = await pool.query(
      `SELECT order_number FROM purchase_orders WHERE order_number LIKE $1 ORDER BY id DESC LIMIT 1`,
      [`${prefix}-%`]
    );

    let nextNumber = `${prefix}-0001`;
    if (result.rows.length > 0) {
      const last = result.rows[0].order_number;
      const match = last.match(/\d+/);
      if (match) {
        const num = parseInt(match[0]) + 1;
        nextNumber = `${prefix}-${String(num).padStart(4, '0')}`;
      }
    }
    res.json({ nextNumber });
  } catch (err) {
    console.error('Error in next-number:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create purchase order (multi-item + currencies)
router.post('/', verifyToken, requireRole('admin', 'purchasing'), async (req, res) => {
  const {
    order_type,
    order_number,
    supplier,
    warehouse_id,
    currency,
    exchange_rate,
    notes,
    items,
    total_usd,
    total_egp,
    purchase_request_id
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // نحسب الإجمالي لو مش موجود
    let finalTotalUsd = parseFloat(total_usd) || 0;
    let finalTotalEgp = parseFloat(total_egp) || 0;

    if ((!finalTotalUsd || !finalTotalEgp) && items && items.length > 0) {
      items.forEach(item => {
        const qty = parseFloat(item.quantity) || 0;
        finalTotalUsd += qty * (parseFloat(item.unit_price_usd) || 0);
        finalTotalEgp += qty * (parseFloat(item.unit_price_egp) || 0);
      });
    }

    // 1. نحفظ الطلب الرئيسي (مع total_amount و net_amount)
    const result = await client.query(
      `INSERT INTO purchase_orders (
        order_type, order_number, supplier, warehouse_id,
        currency, exchange_rate, total_usd, total_egp,
        total_amount, net_amount, tax_14_percent,
        notes, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft', $13)
      RETURNING *`,
      [
        order_type,
        order_number,
        supplier,
        warehouse_id || null,
        currency || 'USD',
        parseFloat(exchange_rate) || 1,
        finalTotalUsd,
        finalTotalEgp,
        finalTotalEgp, // total_amount = total_egp
        finalTotalEgp, // net_amount = total_egp
        finalTotalEgp * 0.14, // tax_14_percent
        notes || '',
        req.user.id
      ]
    );
    const orderId = result.rows[0].id;

    // 2. نحفظ الأصناف في الجدول الفرعي
    if (items && items.length > 0) {
      for (const item of items) {
        if (!item.item_id) continue;

        const qty = parseFloat(item.quantity) || 0;
        const unitPriceUsd = parseFloat(item.unit_price_usd) || 0;
        const unitPriceEgp = parseFloat(item.unit_price_egp) || 0;
        const itemTotalUsd = qty * unitPriceUsd;
        const itemTotalEgp = qty * unitPriceEgp;

        await client.query(
          `INSERT INTO purchase_order_items (
            purchase_order_id, item_id, quantity, unit,
            unit_price_usd, unit_price_egp, total_usd, total_egp, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            orderId,
            item.item_id,
            qty,
            item.unit || 'عدد',
            unitPriceUsd,
            unitPriceEgp,
            itemTotalUsd,
            itemTotalEgp,
            item.notes || ''
          ]
        );
      }
    }

    // 3. لو فيه purchase_request_id، نحدث status لـ completed
    if (purchase_request_id) {
      await client.query(
        `UPDATE purchase_requests SET status = 'completed' WHERE id = $1`,
        [purchase_request_id]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'تم إنشاء امر الشراء بنجاح',
      data: result.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating PO:', err);

    if (err.code === '23505') {
      return res.status(400).json({ message: 'رقم الأمر موجود مسبقاً' });
    }

    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// DUPLICATE — تكرار أمر شراء
router.post('/:id/duplicate', verifyToken, requireRole('admin', 'purchasing'), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const original = await client.query('SELECT * FROM purchase_orders WHERE id = $1', [id]);
    if (original.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'امر الشراء غير موجود' });
    }

    const p = original.rows[0];

    // توليد رقم جديد
    const prefix = p.order_type === 'import' ? 'PO-IMP' : 'PO-LOC';
    const lastResult = await client.query(
      `SELECT order_number FROM purchase_orders WHERE order_number LIKE $1 ORDER BY id DESC LIMIT 1`,
      [`${prefix}-%`]
    );
    let nextNumber = `${prefix}-0001`;
    if (lastResult.rows.length > 0) {
      const last = lastResult.rows[0].order_number;
      const match = last.match(/\d+/);
      if (match) {
        const num = parseInt(match[0]) + 1;
        nextNumber = `${prefix}-${String(num).padStart(4, '0')}`;
      }
    }

    // إنشاء أمر جديد
    const result = await client.query(
      `INSERT INTO purchase_orders (
        order_type, order_number, supplier, warehouse_id,
        currency, exchange_rate, total_usd, total_egp,
        total_amount, net_amount, tax_14_percent,
        notes, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft', $13)
      RETURNING *`,
      [
        p.order_type,
        nextNumber,
        p.supplier,
        p.warehouse_id,
        p.currency || 'USD',
        parseFloat(p.exchange_rate) || 1,
        parseFloat(p.total_usd) || 0,
        parseFloat(p.total_egp) || 0,
        parseFloat(p.total_egp) || 0,
        parseFloat(p.total_egp) || 0,
        (parseFloat(p.total_egp) || 0) * 0.14,
        `نسخة من ${p.order_number}`,
        req.user.id
      ]
    );

    const newId = result.rows[0].id;

    // نسخ الأصناف
    const itemsResult = await client.query(
      'SELECT * FROM purchase_order_items WHERE purchase_order_id = $1',
      [id]
    );
    for (const item of itemsResult.rows) {
      await client.query(
        `INSERT INTO purchase_order_items (
          purchase_order_id, item_id, quantity, unit,
          unit_price_usd, unit_price_egp, total_usd, total_egp, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          newId,
          item.item_id,
          item.quantity,
          item.unit || 'عدد',
          item.unit_price_usd,
          item.unit_price_egp,
          item.total_usd,
          item.total_egp,
          item.notes
        ]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: `تم تكرار امر الشراء بنجاح برقم ${nextNumber}`,
      data: result.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Duplicate error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Update purchase order
router.put('/:id', verifyToken, requireRole('admin', 'purchasing'), async (req, res) => {
  const { id } = req.params;
  const {
    order_number,
    supplier,
    warehouse_id,
    currency,
    exchange_rate,
    notes,
    items,
    total_usd,
    total_egp
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // نتأكد إن الأمر موجود وفي حالة draft
    const checkResult = await client.query(
      `SELECT status FROM purchase_orders WHERE id = $1`,
      [id]
    );

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'امر الشراء غير موجود' });
    }

    if (checkResult.rows[0].status !== 'draft') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'لا يمكن تعديل امر الشراء المعتمد' });
    }

    // 1. نحدث الطلب الرئيسي
    const result = await client.query(
      `UPDATE purchase_orders SET
        order_number = $1, supplier = $2, warehouse_id = $3,
        currency = $4, exchange_rate = $5, total_usd = $6, total_egp = $7,
        notes = $8, updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        order_number,
        supplier,
        warehouse_id || null,
        currency || 'USD',
        parseFloat(exchange_rate) || 1,
        parseFloat(total_usd) || 0,
        parseFloat(total_egp) || 0,
        notes || '',
        id
      ]
    );

    // 2. نحذف الأصناف القديمة
    await client.query(
      'DELETE FROM purchase_order_items WHERE purchase_order_id = $1',
      [id]
    );

    // 3. نضيف الأصناف الجديدة
    if (items && items.length > 0) {
      for (const item of items) {
        if (!item.item_id) continue;

        const qty = parseFloat(item.quantity) || 0;
        const unitPriceUsd = parseFloat(item.unit_price_usd) || 0;
        const unitPriceEgp = parseFloat(item.unit_price_egp) || 0;
        const itemTotalUsd = qty * unitPriceUsd;
        const itemTotalEgp = qty * unitPriceEgp;

        await client.query(
          `INSERT INTO purchase_order_items (
            purchase_order_id, item_id, quantity, unit,
            unit_price_usd, unit_price_egp, total_usd, total_egp, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            id,
            item.item_id,
            qty,
            item.unit || 'عدد',
            unitPriceUsd,
            unitPriceEgp,
            itemTotalUsd,
            itemTotalEgp,
            item.notes || ''
          ]
        );
      }
    }

    await client.query('COMMIT');

    res.json({
      message: 'تم تعديل امر الشراء بنجاح',
      data: result.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating PO:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Delete purchase order
router.delete('/:id', verifyToken, requireRole('admin', 'purchasing'), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const checkResult = await client.query(
      `SELECT status, purchase_request_id FROM purchase_orders WHERE id = $1`,
      [id]
    );

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'امر الشراء غير موجود' });
    }

    if (checkResult.rows[0].status !== 'draft') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'لا يمكن حذف امر الشراء المعتمد' });
    }

    // Delete items first (foreign key)
    await client.query('DELETE FROM purchase_order_items WHERE purchase_order_id = $1', [id]);

    await client.query('DELETE FROM purchase_orders WHERE id = $1', [id]);

    // If linked to purchase request, revert request back to approved
    const purchaseRequestId = checkResult.rows[0].purchase_request_id;
    if (purchaseRequestId) {
      await client.query(
        `UPDATE purchase_requests SET status = 'approved', updated_at = NOW() WHERE id = $1`,
        [purchaseRequestId]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'تم حذف امر الشراء بنجاح' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting PO:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Get all purchase orders (with items)
router.get('/', verifyToken, async (req, res) => {
  try {
    const ordersResult = await pool.query(
      `SELECT po.*, w.name as warehouse_name,
        u.full_name as created_by_name, au.full_name as approved_by_name
       FROM purchase_orders po
       LEFT JOIN warehouses w ON po.warehouse_id = w.id
       LEFT JOIN users u ON po.created_by = u.id
       LEFT JOIN users au ON po.approved_by = au.id
       ORDER BY po.created_at DESC`
    );

    const itemsResult = await pool.query(
      `SELECT poi.*, i.name as item_name, i.code as item_code
       FROM purchase_order_items poi
       LEFT JOIN items i ON poi.item_id = i.id
       ORDER BY poi.id`
    );

    const orders = ordersResult.rows.map(o => ({
      ...o,
      items: itemsResult.rows.filter(i => i.purchase_order_id === o.id)
    }));

    res.json(orders);
  } catch (err) {
    console.error('Error fetching POs:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get approved orders for invoices (with items)
router.get('/approved-orders', verifyToken, async (req, res) => {
  try {
    const ordersResult = await pool.query(
      `SELECT po.*, w.name as warehouse_name
       FROM purchase_orders po
       LEFT JOIN warehouses w ON po.warehouse_id = w.id
       WHERE po.status = 'approved'
       AND NOT EXISTS (
         SELECT 1 FROM purchases p 
         WHERE p.purchase_order_id = po.id
       )
       ORDER BY po.created_at DESC`
    );

    const itemsResult = await pool.query(
      `SELECT poi.*, i.name as item_name, i.code as item_code
       FROM purchase_order_items poi
       LEFT JOIN items i ON poi.item_id = i.id
       WHERE poi.purchase_order_id = ANY($1::int[])`,
      [ordersResult.rows.map(o => o.id)]
    );

    const orders = ordersResult.rows.map(o => ({
      ...o,
      items: itemsResult.rows.filter(i => i.purchase_order_id === o.id)
    }));

    res.json(orders);
  } catch (err) {
    console.error('Error fetching approved orders:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get approved requests for PO creation (with items) - أي طلب مش completed
router.get('/approved-requests', verifyToken, async (req, res) => {
  try {
    const requestsResult = await pool.query(
      `SELECT pr.*, w.name as warehouse_name,
        u.full_name as requested_by_name
       FROM purchase_requests pr
       LEFT JOIN warehouses w ON pr.warehouse_id = w.id
       LEFT JOIN users u ON pr.requested_by = u.id
       WHERE pr.status IN ('pending', 'approved')
       AND pr.id NOT IN (
         SELECT DISTINCT purchase_request_id FROM purchase_orders 
         WHERE purchase_request_id IS NOT NULL
       )
       ORDER BY pr.created_at DESC`
    );

    const itemsResult = await pool.query(
      `SELECT pri.*, i.name as item_name, i.code as item_code
       FROM purchase_request_items pri
       LEFT JOIN items i ON pri.item_id = i.id
       ORDER BY pri.id`
    );

    const requests = requestsResult.rows.map(r => ({
      ...r,
      items: itemsResult.rows.filter(i => i.purchase_request_id === r.id)
    }));

    res.json(requests);
  } catch (err) {
    console.error('Error fetching approved requests:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Cancel approval — إلغاء اعتماد أمر الشراء وإرجاعه لمسودة
router.put('/:id/cancel', verifyToken, requireRole('admin', 'purchasing'), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT * FROM purchase_orders WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'امر الشراء غير موجود' });
    }

    const order = existing.rows[0];

    if (order.status !== 'approved') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'امر الشراء ليس في حالة معتمد' });
    }

    // Check if already linked to a purchase invoice
    const purchaseCheck = await client.query(
      'SELECT id FROM purchases WHERE purchase_order_id = $1 LIMIT 1',
      [id]
    );

    if (purchaseCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'لا يمكن إلغاء الاعتماد — أمر الشراء مربوط بفاتورة. استخدم إلغاء الفاتورة أولاً' });
    }

    // Revert PO to draft
    await client.query(
      `UPDATE purchase_orders SET status = 'draft', approved_by = NULL, approved_at = NULL, updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // If linked to purchase request, revert request back to approved
    if (order.purchase_request_id) {
      await client.query(
        `UPDATE purchase_requests SET status = 'approved', updated_at = NOW() WHERE id = $1`,
        [order.purchase_request_id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'تم إلغاء اعتماد أمر الشراء وإرجاعه لحالة مسودة' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error canceling PO:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Approve or reject purchase order
router.put('/:id/approve', verifyToken, requireRole('admin', 'purchasing', 'finance'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'الحالة يجب ان تكون معتمد او مرفوض' });
  }

  try {
    const result = await pool.query(
      `UPDATE purchase_orders 
       SET status = $1, approved_by = $2, approved_at = NOW() 
       WHERE id = $3 
       RETURNING *`,
      [status, req.user.id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'امر الشراء غير موجود' });
    }

    res.json({
      message: status === 'approved' ? 'تم اعتماد امر الشراء' : 'تم رفض امر الشراء',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error approving PO:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get single purchase order (with items)
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const orderResult = await pool.query(
      `SELECT po.*, w.name as warehouse_name,
        u.full_name as created_by_name, au.full_name as approved_by_name
       FROM purchase_orders po
       LEFT JOIN warehouses w ON po.warehouse_id = w.id
       LEFT JOIN users u ON po.created_by = u.id
       LEFT JOIN users au ON po.approved_by = au.id
       WHERE po.id = $1`,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'امر الشراء غير موجود' });
    }

    const itemsResult = await pool.query(
      `SELECT poi.*, i.name as item_name, i.code as item_code
       FROM purchase_order_items poi
       LEFT JOIN items i ON poi.item_id = i.id
       WHERE poi.purchase_order_id = $1
       ORDER BY poi.id`,
      [id]
    );

    res.json({
      ...orderResult.rows[0],
      items: itemsResult.rows
    });
  } catch (err) {
    console.error('Error fetching PO:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
