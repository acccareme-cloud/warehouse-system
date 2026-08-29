const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// توليد رقم طلب شراء تلقائي
router.get('/next-number', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT request_number FROM purchase_requests 
       WHERE request_number LIKE 'PRQ-%'
       ORDER BY id DESC LIMIT 1`
    );

    let nextNumber = 'PRQ-0001';
    if (result.rows.length > 0) {
      const last = result.rows[0].request_number;
      const match = last.match(/PRQ-(\d+)/);
      if (match) {
        const lastNum = parseInt(match[1]);
        nextNumber = `PRQ-${String(lastNum + 1).padStart(4, '0')}`;
      }
    }

    res.json({ nextNumber });
  } catch (err) {
    console.error('Error generating next number:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// إنشاء طلب شراء جديد (متعدد الأصناف + عملات)
router.post('/', verifyToken, async (req, res) => {
  const { 
    request_number, 
    department, 
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

    // 1. نحفظ الطلب الرئيسي
    const requestResult = await client.query(
      `INSERT INTO purchase_requests 
       (request_number, request_date, department, requested_by, warehouse_id, 
        currency, exchange_rate, total_usd, total_egp, notes, status)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING *`,
      [
        request_number, 
        department, 
        req.user.id, 
        warehouse_id || null,
        currency || 'USD',
        parseFloat(exchange_rate) || 1,
        parseFloat(total_usd) || 0,
        parseFloat(total_egp) || 0,
        notes || '',
        'pending'
      ]
    );

    const requestId = requestResult.rows[0].id;

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
          `INSERT INTO purchase_request_items 
           (purchase_request_id, item_id, quantity, unit, 
            unit_price_usd, unit_price_egp, total_usd, total_egp, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            requestId,
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

    res.status(201).json({
      message: 'تم إنشاء طلب الشراء بنجاح',
      data: requestResult.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating purchase request:', err);

    if (err.code === '23505') {
      return res.status(400).json({ 
        message: 'رقم الطلب موجود مسبقاً، يرجى تحديث الصفحة' 
      });
    }

    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// DUPLICATE — تكرار طلب شراء
router.post('/:id/duplicate', verifyToken, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const original = await client.query('SELECT * FROM purchase_requests WHERE id = $1', [id]);
    if (original.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'طلب الشراء غير موجود' });
    }

    const p = original.rows[0];

    // توليد رقم جديد
    const lastResult = await client.query(
      `SELECT request_number FROM purchase_requests WHERE request_number LIKE 'PRQ-%' ORDER BY id DESC LIMIT 1`
    );
    let nextNumber = 'PRQ-0001';
    if (lastResult.rows.length > 0) {
      const last = lastResult.rows[0].request_number;
      const match = last.match(/PRQ-(\d+)/);
      if (match) {
        const num = parseInt(match[1]) + 1;
        nextNumber = `PRQ-${String(num).padStart(4, '0')}`;
      }
    }

    // إنشاء طلب جديد
    const result = await client.query(
      `INSERT INTO purchase_requests 
       (request_number, request_date, department, requested_by, warehouse_id, 
        currency, exchange_rate, total_usd, total_egp, notes, status)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING *`,
      [
        nextNumber, 
        p.department, 
        req.user.id, 
        p.warehouse_id,
        p.currency || 'USD',
        parseFloat(p.exchange_rate) || 1,
        parseFloat(p.total_usd) || 0,
        parseFloat(p.total_egp) || 0,
        `نسخة من ${p.request_number}`,
        'pending'
      ]
    );

    const newId = result.rows[0].id;

    // نسخ الأصناف
    const itemsResult = await client.query(
      'SELECT * FROM purchase_request_items WHERE purchase_request_id = $1',
      [id]
    );
    for (const item of itemsResult.rows) {
      await client.query(
        `INSERT INTO purchase_request_items 
         (purchase_request_id, item_id, quantity, unit, 
          unit_price_usd, unit_price_egp, total_usd, total_egp, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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
      message: `تم تكرار طلب الشراء بنجاح برقم ${nextNumber}`,
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

// جلب طلبات الشراء المعلقة
router.get('/pending', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pr.*, 
        w.name as warehouse_name,
        u.full_name as requested_by_name
       FROM purchase_requests pr
       LEFT JOIN warehouses w ON pr.warehouse_id = w.id
       LEFT JOIN users u ON pr.requested_by = u.id
       WHERE pr.status = 'pending'
       ORDER BY pr.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching pending requests:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// جلب كل طلبات الشراء (مع الأصناف)
router.get('/all', verifyToken, async (req, res) => {
  try {
    const requestsResult = await pool.query(
      `SELECT pr.*, 
        w.name as warehouse_name,
        u.full_name as requested_by_name,
        au.full_name as approved_by_name
       FROM purchase_requests pr
       LEFT JOIN warehouses w ON pr.warehouse_id = w.id
       LEFT JOIN users u ON pr.requested_by = u.id
       LEFT JOIN users au ON pr.approved_by = au.id
       ORDER BY pr.created_at DESC`
    );

    const itemsResult = await pool.query(
      `SELECT pri.*, 
        i.name as item_name, 
        i.code as item_code
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
    console.error('Error fetching all requests:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// جلب تفاصيل طلب شراء واحد
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const requestResult = await pool.query(
      `SELECT pr.*, 
        w.name as warehouse_name,
        u.full_name as requested_by_name,
        au.full_name as approved_by_name
       FROM purchase_requests pr
       LEFT JOIN warehouses w ON pr.warehouse_id = w.id
       LEFT JOIN users u ON pr.requested_by = u.id
       LEFT JOIN users au ON pr.approved_by = au.id
       WHERE pr.id = $1`,
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ message: 'الطلب غير موجود' });
    }

    const itemsResult = await pool.query(
      `SELECT pri.*, 
        i.name as item_name, 
        i.code as item_code
       FROM purchase_request_items pri
       LEFT JOIN items i ON pri.item_id = i.id
       WHERE pri.purchase_request_id = $1
       ORDER BY pri.id`,
      [id]
    );

    res.json({
      ...requestResult.rows[0],
      items: itemsResult.rows
    });
  } catch (err) {
    console.error('Error fetching request details:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// إلغاء اعتماد طلب الشراء وإرجاعه لحالة معلقة
router.put('/:id/cancel', verifyToken, requireRole('admin', 'purchasing'), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT * FROM purchase_requests WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'طلب الشراء غير موجود' });
    }

    const request = existing.rows[0];

    if (request.status !== 'approved' && request.status !== 'completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'طلب الشراء ليس في حالة معتمدة' });
    }

    // If completed, check if linked to purchase order
    if (request.status === 'completed') {
      const poCheck = await client.query(
        'SELECT id FROM purchase_orders WHERE purchase_request_id = $1 LIMIT 1',
        [id]
      );
      if (poCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: 'لا يمكن إلغاء الطلب — مربوط بأمر شراء. استخدم إلغاء أمر الشراء أولاً'
        });
      }
    }

    await client.query(
      `UPDATE purchase_requests SET status = 'pending', approved_by = NULL, approved_at = NULL, updated_at = NOW() WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');
    res.json({ message: 'تم إلغاء اعتماد طلب الشراء وإرجاعه لحالة معلقة' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error canceling PR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// اعتماد أو رفض طلب شراء
router.put('/:id/approve', verifyToken, requireRole('admin', 'purchasing'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'الحالة يجب أن تكون approved أو rejected' });
  }

  try {
    const result = await pool.query(
      `UPDATE purchase_requests 
       SET status = $1, 
           approved_by = $2, 
           approved_at = NOW() 
       WHERE id = $3 AND status = 'pending'
       RETURNING *`,
      [status, req.user.id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'الطلب غير موجود أو تمت معالجته مسبقاً' });
    }

    const message = status === 'approved' ? 'تم اعتماد طلب الشراء' : 'تم رفض طلب الشراء';
    res.json({ message, data: result.rows[0] });
  } catch (err) {
    console.error('Error approving request:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// تعديل طلب شراء
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { 
    request_number, 
    department, 
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

    // 1. نحدث الطلب الرئيسي
    const requestResult = await client.query(
      `UPDATE purchase_requests 
       SET request_number = $1, department = $2, warehouse_id = $3,
           currency = $4, exchange_rate = $5, total_usd = $6, total_egp = $7,
           notes = $8
       WHERE id = $9 AND status = 'pending'
       RETURNING *`,
      [
        request_number, 
        department, 
        warehouse_id || null,
        currency || 'USD',
        parseFloat(exchange_rate) || 1,
        parseFloat(total_usd) || 0,
        parseFloat(total_egp) || 0,
        notes || '',
        id
      ]
    );

    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'الطلب غير موجود أو تمت معالجته مسبقاً' });
    }

    // 2. نحذف الأصناف القديمة
    await client.query(
      'DELETE FROM purchase_request_items WHERE purchase_request_id = $1',
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
          `INSERT INTO purchase_request_items 
           (purchase_request_id, item_id, quantity, unit, 
            unit_price_usd, unit_price_egp, total_usd, total_egp, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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
      message: 'تم تعديل طلب الشراء بنجاح',
      data: requestResult.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating purchase request:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// حذف طلب شراء
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const check = await client.query(
      'SELECT status FROM purchase_requests WHERE id = $1',
      [id]
    );

    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'الطلب غير موجود' });
    }

    if (check.rows[0].status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'لا يمكن حذف طلب الشراء إلا في حالة معلق' });
    }

    await client.query('DELETE FROM purchase_request_items WHERE purchase_request_id = $1', [id]);
    await client.query('DELETE FROM purchase_requests WHERE id = $1', [id]);

    await client.query('COMMIT');
    res.json({ message: 'تم حذف طلب الشراء بنجاح' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting request:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// جلب طلبات الشراء المتاحة لأوامر الشراء (أي status مش completed)
router.get('/approved-requests', verifyToken, async (req, res) => {
  try {
    const requestsResult = await pool.query(
      `SELECT pr.*, w.name as warehouse_name,
        u.full_name as requested_by_name
       FROM purchase_requests pr
       LEFT JOIN warehouses w ON pr.warehouse_id = w.id
       LEFT JOIN users u ON pr.requested_by = u.id
       WHERE pr.status != 'completed'
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

module.exports = router;
