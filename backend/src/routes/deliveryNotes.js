const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// ============================================
// Helpers
// ============================================
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

async function tableExists(tableName) {
  try {
    const result = await pool.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
      [tableName]
    );
    return result.rows[0].exists;
  } catch (e) { return false; }
}

// ربط مصفوفة الأصناف بكل إذن تسليم (مع fallback للأعمدة المسطحة)
async function attachItemsToNotes(rows) {
  if (!rows || rows.length === 0) return rows;
  const byId = {};
  rows.forEach(r => { byId[r.id] = r; r.items = []; });

  if (await tableExists('delivery_note_items')) {
    const ids = rows.map(r => r.id);
    const itemsResult = await pool.query(
      `SELECT dni.*, i.code AS item_code, i.has_serial, i.unit AS item_unit,
              w.name AS warehouse_name
       FROM delivery_note_items dni
       LEFT JOIN items i ON dni.item_id = i.id
       LEFT JOIN warehouses w ON dni.warehouse_id = w.id
       WHERE dni.delivery_note_id = ANY($1::int[])
       ORDER BY dni.id`,
      [ids]
    );
    itemsResult.rows.forEach(it => {
      if (byId[it.delivery_note_id]) byId[it.delivery_note_id].items.push(it);
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

// ============================================
// Get all delivery notes
// ============================================
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT dn.*, 
        c.name as customer_name,
        i.name as item_name,
        i.has_serial as item_has_serial,
        si.invoice_number,
        dq.dq_number,
        w.name as warehouse_name
       FROM delivery_notes dn
       LEFT JOIN customers c ON dn.customer_id = c.id
       LEFT JOIN items i ON dn.item_id = i.id
       LEFT JOIN sales_invoices si ON dn.invoice_id = si.id
       LEFT JOIN delivery_quotes dq ON dn.dq_id = dq.id
       LEFT JOIN warehouses w ON dn.warehouse_id = w.id
       ORDER BY dn.created_at DESC`
    );
    const rows = await attachItemsToNotes(result.rows);
    res.json(rows);
  } catch (err) {
    console.error('Get delivery notes error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ============================================
// Get delivery note by ID
// ============================================
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT dn.*, 
        c.name as customer_name,
        c.address as customer_address,
        c.phone as customer_phone,
        i.name as item_name,
        i.code as item_code,
        i.has_serial as item_has_serial,
        si.invoice_number,
        si.total_amount as invoice_total,
        dq.dq_number,
        w.name as warehouse_name
       FROM delivery_notes dn
       LEFT JOIN customers c ON dn.customer_id = c.id
       LEFT JOIN items i ON dn.item_id = i.id
       LEFT JOIN sales_invoices si ON dn.invoice_id = si.id
       LEFT JOIN delivery_quotes dq ON dn.dq_id = dq.id
       LEFT JOIN warehouses w ON dn.warehouse_id = w.id
       WHERE dn.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'إذن التسليم غير موجود' });
    }
    const rows = await attachItemsToNotes(result.rows);
    res.json(rows[0]);
  } catch (err) {
    console.error('Get delivery note error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ============================================
// Create delivery note manually (أصناف متعددة + سريال لكل صنف)
// ============================================
router.post('/', verifyToken, requireRole('sales', 'admin', 'manager'), async (req, res) => {
  const { note_number, invoice_id, customer_id, item_id, warehouse_id, quantity, notes, serial_numbers, items, delivery_date } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // تطبيع الأصناف: items[] أو صنف واحد مسطح
    let noteItems = [];
    if (Array.isArray(items) && items.length > 0) {
      noteItems = items.filter(it => it.item_id && parseFloat(it.quantity) > 0).map(it => ({
        item_id: it.item_id,
        item_name: it.item_name || '',
        quantity: parseFloat(it.quantity),
        unit_price: parseFloat(it.unit_price || 0),
        warehouse_id: it.warehouse_id || warehouse_id || null,
        serial_numbers: Array.isArray(it.serial_numbers) ? it.serial_numbers.filter(Boolean) : null,
        notes: it.notes || null
      }));
    } else if (item_id && quantity) {
      noteItems = [{
        item_id, item_name: '', quantity: parseFloat(quantity), unit_price: 0,
        warehouse_id: warehouse_id || null,
        serial_numbers: Array.isArray(serial_numbers) ? serial_numbers.filter(Boolean) : null,
        notes: null
      }];
    }

    if (noteItems.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'يجب إضافة صنف واحد على الأقل' });
    }

    // التحقق من السريالات لكل صنف بسريال
    for (const it of noteItems) {
      const itemResult = await client.query('SELECT has_serial, name FROM items WHERE id = $1', [it.item_id]);
      it.has_serial = itemResult.rows[0]?.has_serial || false;
      it.item_name = it.item_name || itemResult.rows[0]?.name || '';

      if (it.has_serial) {
        const serials = it.serial_numbers || [];
        if (serials.length !== Number(it.quantity)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: `الصنف "${it.item_name}" يُصرف بالسريال - لازم تحدد ${it.quantity} سريال بالظبط (اخترت ${serials.length})` });
        }
        const availCheck = await client.query(
          `SELECT serial_number FROM item_serials 
           WHERE item_id = $1 AND warehouse_id = $2 AND status IN ('available','reserved') AND serial_number = ANY($3::text[])`,
          [it.item_id, it.warehouse_id, serials]
        );
        if (availCheck.rows.length !== serials.length) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: `بعض السريالات المحددة للصنف "${it.item_name}" غير متاحة في هذا المخزن` });
        }
      }
    }

    let nn = note_number;
    if (!nn) {
      const lastResult = await client.query(
        `SELECT note_number FROM delivery_notes WHERE note_number LIKE 'DN-%' ORDER BY id DESC LIMIT 1`
      );
      nn = 'DN-0001';
      if (lastResult.rows.length > 0) {
        const last = parseInt(lastResult.rows[0].note_number.split('-')[1]);
        if (!isNaN(last)) nn = `DN-${String(last + 1).padStart(4, '0')}`;
      }
    }

    const firstItem = noteItems[0];
    const hasSerialCol = await columnExists('delivery_notes', 'serial_numbers');
    const hasDeliveryDate = await columnExists('delivery_notes', 'delivery_date');

    const cols = ['note_number', 'invoice_id', 'customer_id', 'item_id', 'warehouse_id', 'quantity', 'status', 'notes', 'created_by'];
    const vals = [nn, invoice_id || null, customer_id || null, firstItem.item_id, firstItem.warehouse_id, firstItem.quantity, 'pending', notes || null, req.user.id];
    if (hasSerialCol) { cols.push('serial_numbers'); vals.push(firstItem.has_serial ? (firstItem.serial_numbers || null) : null); }
    if (hasDeliveryDate) { cols.push('delivery_date'); vals.push(delivery_date || new Date()); }

    const result = await client.query(
      `INSERT INTO delivery_notes (${cols.join(', ')}) VALUES (${vals.map((_, i) => '$' + (i + 1)).join(', ')}) RETURNING *`,
      vals
    );
    const noteId = result.rows[0].id;

    // إدخال كل الأصناف + حجز السريالات
    if (await tableExists('delivery_note_items')) {
      for (const it of noteItems) {
        await client.query(
          `INSERT INTO delivery_note_items (delivery_note_id, item_id, item_name, quantity, unit_price, warehouse_id, serial_numbers, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [noteId, it.item_id, it.item_name, it.quantity, it.unit_price, it.warehouse_id, it.has_serial ? it.serial_numbers : null, it.notes]
        );
        if (it.has_serial && it.serial_numbers && it.serial_numbers.length > 0) {
          await client.query(
            `UPDATE item_serials SET status = 'reserved', updated_at = NOW()
             WHERE item_id = $1 AND warehouse_id = $2 AND serial_number = ANY($3::text[])`,
            [it.item_id, it.warehouse_id, it.serial_numbers]
          );
        }
      }
    } else if (firstItem.has_serial && firstItem.serial_numbers && firstItem.serial_numbers.length > 0) {
      await client.query(
        `UPDATE item_serials SET status = 'reserved' WHERE item_id = $1 AND warehouse_id = $2 AND serial_number = ANY($3::text[])`,
        [firstItem.item_id, firstItem.warehouse_id, firstItem.serial_numbers]
      );
    }

    // مزامنة السريالات مع الفاتورة وأمر الشغل عشان تظهر في الصرف والطباعة
    await syncSerialsUpstream(client, noteId, invoice_id || null);

    await client.query('COMMIT');
    res.status(201).json({ message: 'تم إنشاء إذن التسليم بنجاح', data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create delivery note error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// ============================================
// Update delivery note (pending فقط) — يدعم تعديل الأصناف — أدمن فقط
// ============================================
router.put('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  const { customer_id, warehouse_id, notes, delivery_date, items } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const dnRes = await client.query(
      `SELECT * FROM delivery_notes WHERE id = $1`,
      [req.params.id]
    );
    if (dnRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'إذن التسليم غير موجود' });
    }
    const oldNote = dnRes.rows[0];

    // فك حجز سريالات الأصناف القديمة
    await releaseNoteSerials(client, req.params.id, oldNote);

    // تحديث الرأس
    const updates = ['updated_at = NOW()'];
    const vals = [];
    let idx = 1;
    if (customer_id !== undefined) { updates.push(`customer_id = $${idx++}`); vals.push(customer_id); }
    if (warehouse_id !== undefined) { updates.push(`warehouse_id = $${idx++}`); vals.push(warehouse_id); }
    if (notes !== undefined) { updates.push(`notes = $${idx++}`); vals.push(notes); }
    if (delivery_date !== undefined && (await columnExists('delivery_notes', 'delivery_date'))) { updates.push(`delivery_date = $${idx++}`); vals.push(delivery_date); }
    vals.push(req.params.id);
    await client.query(`UPDATE delivery_notes SET ${updates.join(', ')} WHERE id = $${idx}`, vals);

    // استبدال الأصناف لو اتبعتت
    let removedItemIds = [];
    if (Array.isArray(items) && items.length > 0 && (await tableExists('delivery_note_items'))) {
      // نحتفظ بأصناف الإذن القديمة عشان ننضّف سريالاتها من الفاتورة/أمر الشغل لو اتشالت
      const oldItemsRes = await client.query(
        'SELECT item_id FROM delivery_note_items WHERE delivery_note_id = $1', [req.params.id]
      );
      const newItemIds = items.filter(it => it.item_id && parseFloat(it.quantity)).map(it => Number(it.item_id));
      removedItemIds = oldItemsRes.rows.map(r => r.item_id).filter(id => !newItemIds.includes(Number(id)));

      await client.query('DELETE FROM delivery_note_items WHERE delivery_note_id = $1', [req.params.id]);
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
          `INSERT INTO delivery_note_items (delivery_note_id, item_id, item_name, quantity, unit_price, warehouse_id, serial_numbers, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [req.params.id, it.item_id, it.item_name || itemCheck.rows[0]?.name || '', parseFloat(it.quantity),
           parseFloat(it.unit_price || 0), it.warehouse_id || warehouse_id || null, hasSerial ? serials : null, it.notes || null]
        );
        if (hasSerial && serials && serials.length > 0) {
          await client.query(
            `UPDATE item_serials SET status = 'reserved', updated_at = NOW()
             WHERE item_id = $1 AND warehouse_id = $2 AND serial_number = ANY($3::text[])`,
            [it.item_id, it.warehouse_id || warehouse_id, serials]
          );
        }
      }
    }

    // مزامنة السريالات الجديدة مع الفاتورة وأمر الشغل
    await syncSerialsUpstream(client, req.params.id, oldNote.invoice_id, removedItemIds);

    await client.query('COMMIT');
    res.json({ message: 'تم تحديث إذن التسليم بنجاح' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update delivery note error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// ============================================
// Helper: مزامنة سريالات إذن التسليم مع الفاتورة وأمر الشغل
// (عشان تظهر في شاشة صرف المخزن وطباعة أمر الشغل)
// ============================================
async function syncSerialsUpstream(client, noteId, invoiceId, removedItemIds = []) {
  if (!invoiceId) return;
  if (!(await tableExists('delivery_note_items'))) return;

  const itemsRes = await client.query(
    'SELECT item_id, serial_numbers FROM delivery_note_items WHERE delivery_note_id = $1',
    [noteId]
  );
  const noteItems = itemsRes.rows;

  // 1) أصناف الفاتورة: نسخ السريالات لكل صنف موجود في الإذن
  if (await tableExists('sales_invoice_items')) {
    for (const it of noteItems) {
      await client.query(
        `UPDATE sales_invoice_items SET serial_numbers = $1
         WHERE invoice_id = $2 AND item_id = $3`,
        [it.serial_numbers && it.serial_numbers.length > 0 ? it.serial_numbers : null, invoiceId, it.item_id]
      );
    }
    // تصفير سريالات الأصناف اللي اتشالت من الإذن وقت التعديل
    for (const itemId of removedItemIds) {
      await client.query(
        `UPDATE sales_invoice_items SET serial_numbers = NULL
         WHERE invoice_id = $1 AND item_id = $2`,
        [invoiceId, itemId]
      );
    }
  }

  // 2) أصناف أمر الشغل المرتبط بالفاتورة
  if (await tableExists('work_order_items')) {
    for (const it of noteItems) {
      await client.query(
        `UPDATE work_order_items woi SET serial_numbers = $1
         FROM work_orders wo
         WHERE woi.work_order_id = wo.id AND wo.invoice_id = $2 AND woi.item_id = $3`,
        [it.serial_numbers && it.serial_numbers.length > 0 ? it.serial_numbers : null, invoiceId, it.item_id]
      );
    }
    for (const itemId of removedItemIds) {
      await client.query(
        `UPDATE work_order_items woi SET serial_numbers = NULL
         FROM work_orders wo
         WHERE woi.work_order_id = wo.id AND wo.invoice_id = $1 AND woi.item_id = $2`,
        [invoiceId, itemId]
      );
    }
  }

  // 3) الأعمدة المسطحة (fallback لو الجداول التفصيلية مش موجودة/فاضية)
  const firstWithSerials = noteItems.find(it => it.serial_numbers && it.serial_numbers.length > 0);
  if (await columnExists('sales_invoices', 'serial_numbers')) {
    await client.query(
      `UPDATE sales_invoices SET serial_numbers = $1 WHERE id = $2`,
      [firstWithSerials ? firstWithSerials.serial_numbers : null, invoiceId]
    );
  }
  if (await columnExists('work_orders', 'serial_numbers')) {
    await client.query(
      `UPDATE work_orders SET serial_numbers = $1, updated_at = NOW() WHERE invoice_id = $2`,
      [firstWithSerials ? firstWithSerials.serial_numbers : null, invoiceId]
    );
  }
}

// ============================================
// Helper: فك حجز سريالات إذن تسليم (من جدول الأصناف أو الأعمدة المسطحة)
// ============================================
async function releaseNoteSerials(client, noteId, noteRow) {
  if (await tableExists('delivery_note_items')) {
    const itemsRes = await client.query(
      'SELECT * FROM delivery_note_items WHERE delivery_note_id = $1', [noteId]
    );
    for (const it of itemsRes.rows) {
      if (it.serial_numbers && it.serial_numbers.length > 0) {
        await client.query(
          `UPDATE item_serials SET status = 'available', updated_at = NOW()
           WHERE item_id = $1 AND warehouse_id = $2 AND serial_number = ANY($3::text[]) AND status IN ('reserved', 'delivered')`,
          [it.item_id, it.warehouse_id, it.serial_numbers]
        );
      }
    }
  }
  if (noteRow && noteRow.serial_numbers && noteRow.serial_numbers.length > 0) {
    await client.query(
      `UPDATE item_serials SET status = 'available', updated_at = NOW()
       WHERE item_id = $1 AND warehouse_id = $2 AND serial_number = ANY($3::text[]) AND status IN ('reserved', 'delivered')`,
      [noteRow.item_id, noteRow.warehouse_id, noteRow.serial_numbers]
    );
  }
}

// ============================================
// Mark as delivered — سريالات كل الأصناف: reserved → delivered
// ============================================
router.put('/:id/deliver', verifyToken, requireRole('sales', 'admin', 'manager', 'storekeeper'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const dnResult = await client.query(`SELECT * FROM delivery_notes WHERE id = $1`, [req.params.id]);

    if (dnResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'إذن التسليم غير موجود' });
    }

    const deliveryNote = dnResult.rows[0];

    if (deliveryNote.status === 'delivered') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'إذن التسليم تم تسليمه مسبقاً' });
    }

    const hasDeliveredAt = await columnExists('delivery_notes', 'delivered_at');
    await client.query(
      `UPDATE delivery_notes SET status = 'delivered', updated_at = NOW()${hasDeliveredAt ? ', delivered_at = NOW()' : ''} WHERE id = $1`,
      [req.params.id]
    );

    // سريالات كل الأصناف: reserved → delivered
    if (await tableExists('delivery_note_items')) {
      const itemsRes = await client.query('SELECT * FROM delivery_note_items WHERE delivery_note_id = $1', [req.params.id]);
      for (const it of itemsRes.rows) {
        if (it.serial_numbers && it.serial_numbers.length > 0) {
          await client.query(
            `UPDATE item_serials SET status = 'delivered', updated_at = NOW()
             WHERE item_id = $1 AND warehouse_id = $2 AND serial_number = ANY($3::text[])`,
            [it.item_id, it.warehouse_id, it.serial_numbers]
          );
        }
      }
    }
    if (deliveryNote.serial_numbers && deliveryNote.serial_numbers.length > 0) {
      await client.query(
        `UPDATE item_serials SET status = 'delivered', updated_at = NOW()
         WHERE item_id = $1 AND warehouse_id = $2 AND serial_number = ANY($3::text[])`,
        [deliveryNote.item_id, deliveryNote.warehouse_id, deliveryNote.serial_numbers]
      );
    }

    // تحديث حالة الفاتورة لو مرتبطة
    if (deliveryNote.invoice_id) {
      await client.query(
        `UPDATE sales_invoices SET status = 'pending_delivery' WHERE id = $1 AND status = 'work_order'`,
        [deliveryNote.invoice_id]
      );
    }

    // تحديث حالة التسليم في الـ DQ لو مرتبط
    if (deliveryNote.dq_id) {
      await client.query(
        `UPDATE delivery_quotes SET delivery_status = 'delivered', updated_at = NOW() WHERE id = $1`,
        [deliveryNote.dq_id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'تم تأكيد التسليم بنجاح' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Deliver error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// ============================================
// Mark as rejected — فك حجز كل السريالات
// ============================================
router.put('/:id/reject', verifyToken, requireRole('sales', 'admin', 'manager'), async (req, res) => {
  const { rejection_reason } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const dnResult = await client.query(`SELECT * FROM delivery_notes WHERE id = $1`, [req.params.id]);

    if (dnResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'إذن التسليم غير موجود' });
    }

    const deliveryNote = dnResult.rows[0];

    const hasReasonCol = await columnExists('delivery_notes', 'rejection_reason');
    await client.query(
      `UPDATE delivery_notes SET status = 'rejected', updated_at = NOW()${hasReasonCol ? ', rejection_reason = $2' : ''} WHERE id = $1`,
      hasReasonCol ? [req.params.id, rejection_reason || null] : [req.params.id]
    );

    // فك حجز سريالات كل الأصناف
    await releaseNoteSerials(client, req.params.id, deliveryNote);

    if (deliveryNote.invoice_id) {
      await client.query(
        `UPDATE sales_invoices SET status = 'work_order' WHERE id = $1 AND status = 'pending_delivery'`,
        [deliveryNote.invoice_id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'تم رفض التسليم' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Reject error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// ============================================
// Cancel (إلغاء بدون رفض) — alias متوافق مع الفرونت
// ============================================
router.put('/:id/cancel', verifyToken, requireRole('sales', 'admin', 'manager'), async (req, res) => {
  req.body = req.body || {};
  // نفس منطق الرفض لكن بحالة cancelled
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const dnResult = await client.query(`SELECT * FROM delivery_notes WHERE id = $1 AND status = 'pending'`, [req.params.id]);
    if (dnResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'إذن التسليم غير موجود أو تم تسليمه' });
    }
    await client.query(`UPDATE delivery_notes SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [req.params.id]);
    await releaseNoteSerials(client, req.params.id, dnResult.rows[0]);
    await client.query('COMMIT');
    res.json({ message: 'تم إلغاء إذن التسليم' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// ============================================
// Delete delivery note — فك حجز السريالات + حذف الأصناف
// ============================================
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const checkRes = await client.query(
      `SELECT * FROM delivery_notes WHERE id = $1 AND status = 'pending'`,
      [req.params.id]
    );

    if (checkRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'لا يمكن حذف إذن التسليم المعتمد أو المسلّم' });
    }

    const note = checkRes.rows[0];

    // فك حجز السريالات
    await releaseNoteSerials(client, req.params.id, note);

    // حذف الأصناف ثم الإذن
    if (await tableExists('delivery_note_items')) {
      await client.query('DELETE FROM delivery_note_items WHERE delivery_note_id = $1', [req.params.id]);
    }
    await client.query('DELETE FROM delivery_notes WHERE id = $1', [req.params.id]);

    // فك ارتباط الـ DQ
    if (note.dq_id && (await columnExists('delivery_quotes', 'delivery_note_id'))) {
      await client.query('UPDATE delivery_quotes SET delivery_note_id = NULL WHERE id = $1 AND delivery_note_id = $2', [note.dq_id, req.params.id]);
    }

    // إرجاع حالة الفاتورة لو مرتبطة
    if (note.invoice_id) {
      await client.query(
        `UPDATE sales_invoices SET status = 'work_order' WHERE id = $1 AND status = 'pending_delivery'`,
        [note.invoice_id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'تم الحذف بنجاح' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete delivery note error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// ============================================
// Print delivery note (كل الأصناف + السريالات)
// ============================================
router.get('/:id/print', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT dn.*, 
        c.name as customer_name,
        c.address as customer_address,
        c.phone as customer_phone,
        i.name as item_name,
        i.code as item_code,
        i.has_serial as item_has_serial,
        si.invoice_number,
        si.total_amount as invoice_total,
        dq.dq_number,
        w.name as warehouse_name
       FROM delivery_notes dn
       LEFT JOIN customers c ON dn.customer_id = c.id
       LEFT JOIN items i ON dn.item_id = i.id
       LEFT JOIN sales_invoices si ON dn.invoice_id = si.id
       LEFT JOIN delivery_quotes dq ON dn.dq_id = dq.id
       LEFT JOIN warehouses w ON dn.warehouse_id = w.id
       WHERE dn.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'إذن التسليم غير موجود' });
    }

    const rows = await attachItemsToNotes(result.rows);

    res.json({
      delivery_note: rows[0],
      items: rows[0].items,
      print_date: new Date().toISOString()
    });
  } catch (err) {
    console.error('Print error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
