const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Generate next voucher number
router.get('/next-number', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT voucher_number FROM warehouse_issue_vouchers 
       WHERE voucher_number LIKE 'ISS-%' 
       ORDER BY id DESC LIMIT 1`
    );

    let nextNumber = 'ISS-0001';
    if (result.rows.length > 0) {
      const last = parseInt(result.rows[0].voucher_number.split('-')[1]);
      nextNumber = `ISS-${String(last + 1).padStart(4, '0')}`;
    }

    res.json({ nextNumber });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// جلب السريالات المتاحة لصنف في مخزن معيّن - تُستخدم قبل الصرف
// ?include_reserved=1 → يرجع [{serial_number, status}] شامل المحجوزة (لشاشات إذن التسليم/أمر الشغل/التعديل)
router.get('/available-serials/:itemId', verifyToken, async (req, res) => {
  const { warehouse_id, include_reserved } = req.query;
  if (!warehouse_id) {
    return res.status(400).json({ message: 'المخزن مطلوب' });
  }
  try {
    if (include_reserved === '1' || include_reserved === 'true') {
      const result = await pool.query(
        `SELECT serial_number, status FROM item_serials 
         WHERE item_id = $1 AND warehouse_id = $2 AND status IN ('available', 'reserved') 
         ORDER BY status, serial_number`,
        [req.params.itemId, warehouse_id]
      );
      return res.json(result.rows);
    }
    const result = await pool.query(
      `SELECT serial_number FROM item_serials 
       WHERE item_id = $1 AND warehouse_id = $2 AND status = 'available' 
       ORDER BY serial_number`,
      [req.params.itemId, warehouse_id]
    );
    res.json(result.rows.map(r => r.serial_number));
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
// Create warehouse issue voucher
router.post('/', verifyToken, requireRole('storekeeper', 'admin'), async (req, res) => {
  const {
    voucher_number, voucher_date, reference_type, reference_id, reference_number,
    customer_id, warehouse_id, items, notes
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const totalItems = items.length;

    // نتحقق من الأصناف اللي بتتصرف بسريال قبل ما نبدأ - عدد السريالات لازم يساوي الكمية
    // ونتأكد إن السريالات دي فعلاً متاحة في نفس المخزن
    for (const item of items) {
      const itemCheck = await client.query('SELECT has_serial, name FROM items WHERE id = $1', [item.item_id]);
      const itemHasSerial = itemCheck.rows[0]?.has_serial;
      if (itemHasSerial) {
        const serials = Array.isArray(item.serial_numbers)
          ? item.serial_numbers.filter(Boolean)
          : (item.serial_numbers ? String(item.serial_numbers).split(',').map(s => s.trim()).filter(Boolean) : []);

        if (serials.length !== Number(item.quantity)) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            message: `الصنف "${itemCheck.rows[0].name}" يُصرف بالسريال - لازم تحدد ${item.quantity} سريال بالظبط (اخترت ${serials.length})`
          });
        }

        const availCheck = await client.query(
          `SELECT serial_number FROM item_serials 
           WHERE item_id = $1 AND warehouse_id = $2 AND status = 'available' AND serial_number = ANY($3::text[])`,
          [item.item_id, warehouse_id, serials]
        );
        if (availCheck.rows.length !== serials.length) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: `بعض السريالات المحددة للصنف "${itemCheck.rows[0].name}" غير متاحة في هذا المخزن` });
        }
        // نطبّع القيمة عشان تتخزن array نظيف
        item.serial_numbers = serials;
      }
    }

    const fkOrNull = (v) => (v === '' || v === undefined ? null : v);

    const voucherResult = await client.query(
      `INSERT INTO warehouse_issue_vouchers (
        voucher_number, voucher_date, reference_type, reference_id, reference_number,
        customer_id, warehouse_id, total_items, status, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        voucher_number, voucher_date, reference_type, fkOrNull(reference_id), reference_number,
        fkOrNull(customer_id), fkOrNull(warehouse_id), totalItems, 'draft', notes, req.user.id
      ]
    );

    const voucherId = voucherResult.rows[0].id;

    // نضيف الأصناف
    for (const item of items) {
      await client.query(
        `INSERT INTO warehouse_issue_items (
          voucher_id, item_id, item_name, quantity, unit_price, total_price, serial_numbers, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          voucherId, item.item_id, item.item_name,
          item.quantity, item.unit_price || 0,
          (item.quantity * (item.unit_price || 0)),
          item.serial_numbers || null, item.notes
        ]
      );

      // نحجز السريالات لحد ما يتم اعتماد الجودة والصرف الفعلي
      if (item.serial_numbers && item.serial_numbers.length > 0) {
        await client.query(
          `UPDATE item_serials SET status = 'reserved' 
           WHERE item_id = $1 AND warehouse_id = $2 AND serial_number = ANY($3::text[])`,
          [item.item_id, warehouse_id, item.serial_numbers]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({
      message: 'تم إنشاء إذن الصرف بنجاح',
      data: voucherResult.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Get all issue vouchers (يدوية بس بشكل افتراضي؛ ?source=invoice يرجّع الإذون التلقائية الناتجة من الفواتير بس)
router.get('/', verifyToken, async (req, res) => {
  const { source } = req.query;
  try {
    const filterClause = source === 'invoice'
      ? `WHERE wiv.reference_type = 'sales_invoice'`
      : `WHERE wiv.reference_type IS NULL OR wiv.reference_type != 'sales_invoice'`;
    
    const result = await pool.query(
      `SELECT wiv.*, c.name as customer_name, w.name as warehouse_name, 
              u.full_name as created_by_name,
              w.manager_name as warehouse_manager_name
       FROM warehouse_issue_vouchers wiv 
       LEFT JOIN customers c ON wiv.customer_id = c.id 
       LEFT JOIN warehouses w ON wiv.warehouse_id = w.id 
       LEFT JOIN users u ON wiv.created_by = u.id 
       ${filterClause} 
       ORDER BY wiv.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get voucher by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const voucherResult = await pool.query(
      `SELECT wiv.*, c.name as customer_name, w.name as warehouse_name
       FROM warehouse_issue_vouchers wiv
       LEFT JOIN customers c ON wiv.customer_id = c.id
       LEFT JOIN warehouses w ON wiv.warehouse_id = w.id
       WHERE wiv.id = $1`,
      [req.params.id]
    );

    if (voucherResult.rows.length === 0) {
      return res.status(404).json({ message: 'الإذن غير موجود' });
    }

    const itemsResult = await pool.query(
      `SELECT * FROM warehouse_issue_items WHERE voucher_id = $1 ORDER BY id`,
      [req.params.id]
    );

    res.json({
      ...voucherResult.rows[0],
      items: itemsResult.rows
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Quality approval
router.put('/:id/quality-approve', verifyToken, requireRole('quality', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE warehouse_issue_vouchers 
       SET quality_approved = true, quality_approved_by = $1, quality_approved_at = NOW(),
           status = 'quality_approved'
       WHERE id = $2 AND status = 'draft'
       RETURNING *`,
      [req.user.id, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'الإذن غير موجود أو تمت معالجته' });
    }

    res.json({ message: 'تم اعتماد الجودة بنجاح', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Warehouse approval (صرف فعلي)
router.put('/:id/warehouse-approve', verifyToken, requireRole('storekeeper', 'admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const voucherResult = await client.query(
      `UPDATE warehouse_issue_vouchers 
       SET warehouse_approved = true, warehouse_approved_by = $1, warehouse_approved_at = NOW(),
           status = 'posted'
       WHERE id = $2 AND status = 'quality_approved'
       RETURNING *`,
      [req.user.id, req.params.id]
    );

    if (voucherResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'الإذن غير موجود أو لم يتم اعتماد الجودة' });
    }

    const voucher = voucherResult.rows[0];

    // نجيب الأصناف
    const itemsResult = await client.query(
      'SELECT * FROM warehouse_issue_items WHERE voucher_id = $1',
      [voucher.id]
    );

    // نصرف من المخزن
    for (const item of itemsResult.rows) {
      // نضيف حركة مخزن (صرف)
      await client.query(
        `INSERT INTO inventory_movements (
          movement_type, item_id, warehouse_id, quantity, unit_price,
          total_amount, reference_type, reference_id, notes, created_by
        ) VALUES ('out', $1, $2, $3, $4, $5, 'warehouse_issue', $6, 'صرف من إذن صرف', $7)`,
        [
          item.item_id, voucher.warehouse_id, item.quantity,
          item.unit_price, item.total_price, voucher.id, req.user.id
        ]
      );

      // نحدث رصيد المخزن
      await client.query(
        `UPDATE inventory_balances 
         SET quantity = quantity - $1,
             last_movement_date = CURRENT_DATE,
             updated_at = NOW()
         WHERE item_id = $2 AND warehouse_id = $3`,
        [item.quantity, item.item_id, voucher.warehouse_id]
      );

      // نسجل نفس الحركة في stock_movements ونحدث stock كمان
      // (عشان تظهر في تقرير الأرصدة اللي بيقرا من الجدول القديم فقط)
      await client.query(
        `INSERT INTO stock_movements 
         (item_id, warehouse_id, movement_type, quantity, reference_type, reference_id, done_by, unit_price) 
         VALUES ($1, $2, 'out', $3, 'warehouse_issue', $4, $5, $6)`,
        [item.item_id, voucher.warehouse_id, item.quantity, voucher.id, req.user.id, item.unit_price || 0]
      );
      const stockCheck2 = await client.query(
        'SELECT * FROM stock WHERE item_id = $1 AND warehouse_id = $2',
        [item.item_id, voucher.warehouse_id]
      );
      if (stockCheck2.rows.length > 0) {
        await client.query(
          'UPDATE stock SET quantity = quantity - $1, updated_at = NOW() WHERE item_id = $2 AND warehouse_id = $3',
          [item.quantity, item.item_id, voucher.warehouse_id]
        );
      } else {
        await client.query(
          'INSERT INTO stock (item_id, warehouse_id, quantity) VALUES ($1, $2, $3)',
          [item.item_id, voucher.warehouse_id, -item.quantity]
        );
      }

      // لو الصنف بسريال - نقفل السريالات نهائيًا (من reserved → sold)
      if (item.serial_numbers && item.serial_numbers.length > 0) {
        await client.query(
          `UPDATE item_serials SET status = 'sold', sold_at = NOW()
           WHERE item_id = $1 AND warehouse_id = $2 AND serial_number = ANY($3::text[])`,
          [item.item_id, voucher.warehouse_id, item.serial_numbers]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'تم الصرف من المخزن بنجاح', data: voucher });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Update voucher (draft only) — تعديل الإذن اليدوي — أدمن فقط
// بيفك حجز السريالات القديمة ويتحقق من الجديدة ويحجزها، زي الإنشاء بالظبط
router.put('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  const {
    voucher_date, reference_type, reference_number,
    customer_id, warehouse_id, items, notes
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // الإذن لازم يكون موجود (أي حالة — الأدمن يقدر يعدل حتى بعد الاعتماد)
    const voucherRes = await client.query(
      `SELECT * FROM warehouse_issue_vouchers WHERE id = $1`,
      [req.params.id]
    );
    if (voucherRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'الإذن غير موجود' });
    }
    const oldVoucher = voucherRes.rows[0];
    const wasPosted = oldVoucher.status === 'posted';

    if (!Array.isArray(items) || items.filter(i => i.item_id).length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'يجب إضافة صنف واحد على الأقل' });
    }

    // فك حجز سريالات الأصناف القديمة
    const oldItemsRes = await client.query(
      'SELECT * FROM warehouse_issue_items WHERE voucher_id = $1', [req.params.id]
    );
    for (const item of oldItemsRes.rows) {
      if (item.serial_numbers && item.serial_numbers.length > 0) {
        // لو كان posted، السريالات حالتها sold مش reserved — نرجعها available في الحالتين
        await client.query(
          `UPDATE item_serials SET status = 'available', sold_at = NULL, updated_at = NOW()
           WHERE item_id = $1 AND warehouse_id = $2 AND serial_number = ANY($3::text[]) AND status IN ('reserved', 'sold')`,
          [item.item_id, oldVoucher.warehouse_id, item.serial_numbers]
        );
      }
      // لو كان الإذن posted، نرجع الرصيد اللي اتخصم بتاع الصنف القديم ده
      if (wasPosted) {
        if (await columnExists('inventory_balances', 'quantity')) {
          await client.query(
            `UPDATE inventory_balances SET quantity = quantity + $1, updated_at = NOW() WHERE item_id = $2 AND warehouse_id = $3`,
            [item.quantity, item.item_id, oldVoucher.warehouse_id]
          );
        }
        const stockChk = await client.query('SELECT * FROM stock WHERE item_id = $1 AND warehouse_id = $2', [item.item_id, oldVoucher.warehouse_id]);
        if (stockChk.rows.length > 0) {
          await client.query('UPDATE stock SET quantity = quantity + $1, updated_at = NOW() WHERE item_id = $2 AND warehouse_id = $3', [item.quantity, item.item_id, oldVoucher.warehouse_id]);
        } else {
          await client.query('INSERT INTO stock (item_id, warehouse_id, quantity) VALUES ($1, $2, $3)', [item.item_id, oldVoucher.warehouse_id, item.quantity]);
        }
      }
    }

    const targetWarehouseId = warehouse_id || oldVoucher.warehouse_id;

    // التحقق من السريالات الجديدة — نفس منطق الإنشاء
    for (const item of items) {
      if (!item.item_id) continue;
      const itemCheck = await client.query('SELECT has_serial, name FROM items WHERE id = $1', [item.item_id]);
      const itemHasSerial = itemCheck.rows[0]?.has_serial;
      if (itemHasSerial) {
        const serials = Array.isArray(item.serial_numbers)
          ? item.serial_numbers.filter(Boolean)
          : (item.serial_numbers ? String(item.serial_numbers).split(',').map(s => s.trim()).filter(Boolean) : []);

        if (serials.length !== Number(item.quantity)) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            message: `الصنف "${itemCheck.rows[0].name}" يُصرف بالسريال - لازم تحدد ${item.quantity} سريال بالظبط (اخترت ${serials.length})`
          });
        }

        const availCheck = await client.query(
          `SELECT serial_number FROM item_serials
           WHERE item_id = $1 AND warehouse_id = $2 AND status = 'available' AND serial_number = ANY($3::text[])`,
          [item.item_id, targetWarehouseId, serials]
        );
        if (availCheck.rows.length !== serials.length) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: `بعض السريالات المحددة للصنف "${itemCheck.rows[0].name}" غير متاحة في هذا المخزن` });
        }
        item.serial_numbers = serials;
      }
    }

    const fkOrNull = (v) => (v === '' || v === undefined ? null : v);
    const cleanItems = items.filter(i => i.item_id);

    // تحديث رأس الإذن — لو كان معتمد (posted) نرجعه draft عشان يتعاد اعتماده من جديد
    await client.query(
      `UPDATE warehouse_issue_vouchers
       SET voucher_date = $1, reference_type = $2, reference_number = $3,
           customer_id = $4, warehouse_id = $5, total_items = $6, notes = $7, updated_at = NOW()
           ${wasPosted ? `, status = 'draft', warehouse_approved = false, warehouse_approved_by = NULL, warehouse_approved_at = NULL,
              quality_approved = false, quality_approved_by = NULL, quality_approved_at = NULL` : ''}
       WHERE id = $8`,
      [
        voucher_date || oldVoucher.voucher_date, reference_type || oldVoucher.reference_type,
        reference_number, fkOrNull(customer_id), fkOrNull(targetWarehouseId),
        cleanItems.length, notes, req.params.id
      ]
    );

    // استبدال الأصناف + حجز السريالات الجديدة
    await client.query('DELETE FROM warehouse_issue_items WHERE voucher_id = $1', [req.params.id]);
    for (const item of cleanItems) {
      await client.query(
        `INSERT INTO warehouse_issue_items (
          voucher_id, item_id, item_name, quantity, unit_price, total_price, serial_numbers, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          req.params.id, item.item_id, item.item_name,
          item.quantity, item.unit_price || 0,
          (item.quantity * (item.unit_price || 0)),
          item.serial_numbers || null, item.notes
        ]
      );

      if (item.serial_numbers && item.serial_numbers.length > 0) {
        await client.query(
          `UPDATE item_serials SET status = 'reserved'
           WHERE item_id = $1 AND warehouse_id = $2 AND serial_number = ANY($3::text[])`,
          [item.item_id, targetWarehouseId, item.serial_numbers]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: wasPosted ? 'تم تعديل الإذن — رجع لحالة مسودة ومحتاج اعتماد جودة ومخزن من جديد' : 'تم تعديل إذن الصرف بنجاح' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Delete voucher (draft only) — أدمن فقط
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // نجيب أصناف الإذن قبل الحذف عشان نفك حجز أي سريالات
    const itemsResult = await client.query(
      'SELECT * FROM warehouse_issue_items WHERE voucher_id = $1',
      [req.params.id]
    );

    const result = await client.query(
      "DELETE FROM warehouse_issue_vouchers WHERE id = $1 AND status = 'draft' RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'لا يمكن حذف الإذن المعتمد' });
    }

    for (const item of itemsResult.rows) {
      if (item.serial_numbers && item.serial_numbers.length > 0) {
        await client.query(
          `UPDATE item_serials SET status = 'available' 
           WHERE item_id = $1 AND warehouse_id = $2 AND serial_number = ANY($3::text[])`,
          [item.item_id, result.rows[0].warehouse_id, item.serial_numbers]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'تم الحذف بنجاح' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
