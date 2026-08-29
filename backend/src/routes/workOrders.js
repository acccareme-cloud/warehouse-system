const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// ============================================
// Helpers
// ============================================
async function tableExists(tableName) {
  try {
    const result = await pool.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
      [tableName]
    );
    return result.rows[0].exists;
  } catch (e) { return false; }
}

async function columnExists(tableName, columnName) {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = $2
      )
    `, [tableName, columnName]);
    return result.rows[0].exists;
  } catch (e) { return false; }
}

// ربط مصفوفة الأصناف بكل أمر شغل (مع fallback للأعمدة المسطحة)
async function attachItemsToOrders(rows) {
  if (!rows || rows.length === 0) return rows;
  const byId = {};
  rows.forEach(r => { byId[r.id] = r; r.items = []; });

  if (await tableExists('work_order_items')) {
    const ids = rows.map(r => r.id);
    const itemsResult = await pool.query(
      `SELECT woi.*, i.code AS item_code, i.has_serial, i.unit AS item_unit,
              w.name AS warehouse_name
       FROM work_order_items woi
       LEFT JOIN items i ON woi.item_id = i.id
       LEFT JOIN warehouses w ON woi.warehouse_id = w.id
       WHERE woi.work_order_id = ANY($1::int[])
       ORDER BY woi.id`,
      [ids]
    );
    itemsResult.rows.forEach(it => {
      if (byId[it.work_order_id]) byId[it.work_order_id].items.push(it);
    });
  }

  rows.forEach(r => {
    if (r.items.length === 0 && (r.item_id || r.quantity)) {
      r.items = [{
        id: null, item_id: r.item_id, item_name: r.item_name || null,
        quantity: r.quantity, warehouse_id: r.warehouse_id || null,
        warehouse_name: r.warehouse_name || null,
        serial_numbers: r.serial_numbers || null
      }];
    }
    r.items_count = r.items.length;
  });
  return rows;
}

// Get all work orders
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT wo.*, c.name as customer_name_join, e.full_name as assigned_to_name,
        si.invoice_number, si.invoice_type, dq.dq_number, w.name as warehouse_name
       FROM work_orders wo
       LEFT JOIN customers c ON wo.customer_id = c.id
       LEFT JOIN employees e ON wo.assigned_to = e.id
       LEFT JOIN sales_invoices si ON wo.invoice_id = si.id
       LEFT JOIN delivery_quotes dq ON wo.dq_id = dq.id
       LEFT JOIN warehouses w ON wo.warehouse_id = w.id
       ORDER BY wo.created_at DESC`
    );
    const rows = result.rows.map(r => ({ ...r, customer_name: r.customer_name || r.customer_name_join }));
    await attachItemsToOrders(rows);
    res.json(rows);
  } catch (err) {
    console.error('Get work orders error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get work order by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT wo.*, c.name as customer_name_join, e.full_name as assigned_to_name,
        si.invoice_number, dq.dq_number, w.name as warehouse_name
       FROM work_orders wo
       LEFT JOIN customers c ON wo.customer_id = c.id
       LEFT JOIN employees e ON wo.assigned_to = e.id
       LEFT JOIN sales_invoices si ON wo.invoice_id = si.id
       LEFT JOIN delivery_quotes dq ON wo.dq_id = dq.id
       LEFT JOIN warehouses w ON wo.warehouse_id = w.id
       WHERE wo.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'أمر الشغل غير موجود' });
    }
    const rows = result.rows.map(r => ({ ...r, customer_name: r.customer_name || r.customer_name_join }));
    await attachItemsToOrders(rows);
    res.json(rows[0]);
  } catch (err) {
    console.error('Get work order error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create work order manually (أصناف متعددة + سريال لكل صنف)
router.post('/', verifyToken, requireRole('sales', 'admin', 'manager'), async (req, res) => {
  const {
    work_order_number, customer_id, customer_name, item_id, item_name, quantity,
    work_type, description, start_date, expected_end_date, assigned_to, notes, serial_numbers,
    items, warehouse_id
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // تطبيع الأصناف
    let woItems = [];
    if (Array.isArray(items) && items.length > 0) {
      woItems = items.filter(it => it.item_id && parseFloat(it.quantity) > 0).map(it => ({
        item_id: it.item_id,
        item_name: it.item_name || '',
        quantity: parseFloat(it.quantity),
        unit_price: parseFloat(it.unit_price || 0),
        warehouse_id: it.warehouse_id || warehouse_id || null,
        serial_numbers: Array.isArray(it.serial_numbers) ? it.serial_numbers.filter(Boolean) : null,
        notes: it.notes || null
      }));
    } else if (item_id && quantity) {
      woItems = [{
        item_id, item_name: item_name || '', quantity: parseFloat(quantity), unit_price: 0,
        warehouse_id: warehouse_id || null,
        serial_numbers: Array.isArray(serial_numbers) ? serial_numbers.filter(Boolean) : null,
        notes: null
      }];
    }

    // التحقق من سريالات الأصناف اللي بسريال (لو اتبعتت)
    for (const it of woItems) {
      const itemCheck = await client.query('SELECT has_serial, name FROM items WHERE id = $1', [it.item_id]);
      it.has_serial = itemCheck.rows[0]?.has_serial || false;
      it.item_name = it.item_name || itemCheck.rows[0]?.name || '';
      if (it.has_serial && it.serial_numbers && it.quantity && it.serial_numbers.length !== Number(it.quantity)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `الصنف "${it.item_name}" يُصرف بالسريال - لازم تحدد ${it.quantity} سريال بالظبط (اخترت ${it.serial_numbers.length})` });
      }
    }

    let wn = work_order_number;
    if (!wn) {
      const lastResult = await client.query(
        `SELECT work_order_number FROM work_orders WHERE work_order_number LIKE 'WO-%' ORDER BY id DESC LIMIT 1`
      );
      wn = 'WO-0001';
      if (lastResult.rows.length > 0) {
        const last = parseInt(lastResult.rows[0].work_order_number.split('-')[1]);
        if (!isNaN(last)) wn = `WO-${String(last + 1).padStart(4, '0')}`;
      }
    }

    const firstItem = woItems[0] || {};
    const hasSerialCol = await columnExists('work_orders', 'serial_numbers');

    const cols = ['work_order_number', 'status', 'created_by'];
    const vals = [wn, 'pending', req.user.id];
    const add = (c, v) => { if (v !== undefined && v !== null && v !== '') { cols.push(c); vals.push(v); } };

    add('customer_id', customer_id);
    add('customer_name', customer_name);
    add('item_id', firstItem.item_id);
    add('item_name', firstItem.item_name);
    add('quantity', firstItem.quantity);
    add('work_type', work_type);
    add('description', description);
    add('start_date', start_date);
    add('expected_end_date', expected_end_date);
    add('assigned_to', assigned_to);
    add('notes', notes);
    add('warehouse_id', firstItem.warehouse_id);
    if (hasSerialCol) add('serial_numbers', firstItem.serial_numbers);

    const result = await client.query(
      `INSERT INTO work_orders (${cols.join(', ')}) VALUES (${vals.map((_, i) => '$' + (i + 1)).join(', ')}) RETURNING *`,
      vals
    );
    const woId = result.rows[0].id;

    // إدخال كل الأصناف
    if (woItems.length > 0 && (await tableExists('work_order_items'))) {
      for (const it of woItems) {
        await client.query(
          `INSERT INTO work_order_items (work_order_id, item_id, item_name, quantity, unit_price, warehouse_id, serial_numbers, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [woId, it.item_id, it.item_name, it.quantity, it.unit_price, it.warehouse_id,
           it.has_serial ? it.serial_numbers : null, it.notes]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'تم إنشاء أمر الشغل بنجاح', data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create work order error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Update work order (pending فقط) — يدعم تعديل الأصناف — أدمن فقط
router.put('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  const { work_type, description, start_date, expected_end_date, assigned_to, notes, items } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (work_type !== undefined) { updates.push(`work_type = $${paramIndex++}`); values.push(work_type); }
    if (description !== undefined) { updates.push(`description = $${paramIndex++}`); values.push(description); }
    if (start_date !== undefined) { updates.push(`start_date = $${paramIndex++}`); values.push(start_date); }
    if (expected_end_date !== undefined) { updates.push(`expected_end_date = $${paramIndex++}`); values.push(expected_end_date); }
    if (assigned_to !== undefined) { updates.push(`assigned_to = $${paramIndex++}`); values.push(assigned_to); }
    if (notes !== undefined) { updates.push(`notes = $${paramIndex++}`); values.push(notes); }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const result = await client.query(
      `UPDATE work_orders SET ${updates.join(', ')}
       WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'أمر الشغل غير موجود' });
    }

    // استبدال الأصناف لو اتبعتت
    if (Array.isArray(items) && items.length > 0 && (await tableExists('work_order_items'))) {
      // نفك حجز السريالات القديمة الأول عشان ماتفضلش عالقة
      const oldItemsRes = await client.query('SELECT * FROM work_order_items WHERE work_order_id = $1', [req.params.id]);
      for (const oldIt of oldItemsRes.rows) {
        if (oldIt.serial_numbers && oldIt.serial_numbers.length > 0) {
          await client.query(
            `UPDATE item_serials SET status = 'available', updated_at = NOW()
             WHERE item_id = $1 AND warehouse_id = $2 AND serial_number = ANY($3::text[]) AND status IN ('reserved', 'delivered', 'sold')`,
            [oldIt.item_id, oldIt.warehouse_id, oldIt.serial_numbers]
          );
        }
      }
      await client.query('DELETE FROM work_order_items WHERE work_order_id = $1', [req.params.id]);
      for (const it of items) {
        if (!it.item_id || !parseFloat(it.quantity)) continue;
        const itemCheck = await client.query('SELECT has_serial, name FROM items WHERE id = $1', [it.item_id]);
        const hasSerial = itemCheck.rows[0]?.has_serial || false;
        const serials = Array.isArray(it.serial_numbers) ? it.serial_numbers.filter(Boolean) : null;
        if (hasSerial && serials && serials.length !== Number(it.quantity)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: `الصنف "${itemCheck.rows[0].name}" يُصرف بالسريال - لازم ${it.quantity} سريال بالظبط` });
        }
        await client.query(
          `INSERT INTO work_order_items (work_order_id, item_id, item_name, quantity, unit_price, warehouse_id, serial_numbers, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [req.params.id, it.item_id, it.item_name || itemCheck.rows[0]?.name || '', parseFloat(it.quantity),
           parseFloat(it.unit_price || 0), it.warehouse_id || null, hasSerial ? serials : null, it.notes || null]
        );
        // نحجز السريالات الجديدة
        if (hasSerial && serials && serials.length > 0) {
          await client.query(
            `UPDATE item_serials SET status = 'reserved', updated_at = NOW()
             WHERE item_id = $1 AND warehouse_id = $2 AND serial_number = ANY($3::text[])`,
            [it.item_id, it.warehouse_id, serials]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'تم التحديث بنجاح', data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update work order error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Update work order status
router.put('/:id/status', verifyToken, requireRole('sales', 'admin', 'manager'), async (req, res) => {
  const { status, completion_notes, actual_end_date } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updates = ['status = $1'];
    const values = [status];
    let paramIndex = 2;

    if (await columnExists('work_orders', 'completion_notes')) {
      if (completion_notes !== undefined) { updates.push(`completion_notes = $${paramIndex++}`); values.push(completion_notes); }
    }
    if (await columnExists('work_orders', 'actual_end_date')) {
      if (actual_end_date !== undefined) { updates.push(`actual_end_date = $${paramIndex++}`); values.push(actual_end_date); }
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const result = await client.query(
      `UPDATE work_orders SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'أمر الشغل غير موجود' });
    }

    await client.query('COMMIT');
    res.json({ message: 'تم تحديث الحالة', data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update status error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Delete work order (pending only)
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      "DELETE FROM work_orders WHERE id = $1 AND status = 'pending' RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'لا يمكن حذف أمر الشغل المعتمد' });
    }

    // حذف الأصناف
    if (await tableExists('work_order_items')) {
      await client.query('DELETE FROM work_order_items WHERE work_order_id = $1', [req.params.id]);
    }

    // فك ارتباط الـ DQ
    if (result.rows[0].dq_id && (await columnExists('delivery_quotes', 'work_order_id'))) {
      await client.query('UPDATE delivery_quotes SET work_order_id = NULL WHERE id = $1 AND work_order_id = $2', [result.rows[0].dq_id, req.params.id]);
    }

    // إرجاع حالة الفاتورة لو مرتبطة
    if (result.rows[0].invoice_id) {
      await client.query(
        `UPDATE sales_invoices SET status = 'approved_manager' WHERE id = $1 AND status = 'work_order'`,
        [result.rows[0].invoice_id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'تم الحذف بنجاح' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete work order error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
