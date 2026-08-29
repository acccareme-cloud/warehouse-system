const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Get next voucher number
router.get('/next-number', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT voucher_number 
      FROM receipt_vouchers 
      WHERE voucher_number LIKE 'RCV-%'
      ORDER BY created_at DESC 
      LIMIT 1
    `);

    let nextNumber = 'RCV-0001';

    if (result.rows.length > 0) {
      const lastNumber = result.rows[0].voucher_number;
      const match = lastNumber.match(/RCV-(\d+)/);
      if (match) {
        const lastNum = parseInt(match[1]);
        nextNumber = `RCV-${String(lastNum + 1).padStart(4, '0')}`;
      }
    }

    res.json({ nextNumber });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create receipt voucher
router.post('/', verifyToken, async (req, res) => {
  const { 
    voucher_number, 
    supplier, 
    item_id, 
    warehouse_id, 
    quantity, 
    purchase_price, 
    tax_discount_percent, 
    supply_order, 
    receipt_date,
    has_serial,
    serials
  } = req.body;

  try {
    const qty = parseFloat(quantity);
    const price = parseFloat(purchase_price || 0);
    const subtotal = qty * price;
    const tax14 = subtotal * 0.14;
    const taxDiscountRate = parseFloat(tax_discount_percent || 0);
    const taxDiscount = subtotal * (taxDiscountRate / 100);
    const total = subtotal + tax14 - taxDiscount;

    const voucherDate = receipt_date ? new Date(receipt_date) : new Date();

    const result = await pool.query(
      `INSERT INTO receipt_vouchers 
       (voucher_number, supplier, item_id, warehouse_id, quantity, purchase_price, 
        tax_14_percent, tax_discount_percent, tax_discount_amount, total_amount, 
        supply_order, receipt_date, created_by, has_serial, financial_approval_status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending') 
       RETURNING *`,
      [
        voucher_number, 
        supplier, 
        item_id, 
        warehouse_id, 
        qty, 
        price, 
        tax14, 
        taxDiscountRate, 
        taxDiscount, 
        total, 
        supply_order, 
        voucherDate, 
        req.user.id,
        has_serial || false
      ]
    );

    const receiptId = result.rows[0].id;

    // إنشاء السريالات لو الصنف له سريال (في item_serials - الجدول الموحّد لكل شاشات الصرف/الجودة/التسليم)
    if (has_serial && serials && serials.length > 0) {
      for (const serial of serials) {
        if (serial.trim()) {
          await pool.query(`
            INSERT INTO item_serials (serial_number, item_id, warehouse_id, receipt_voucher_id, status)
            VALUES ($1, $2, $3, $4, 'available')
          `, [serial.trim(), item_id, warehouse_id, receiptId]);
        }
      }
    }

    res.status(201).json({
      message: 'تم إنشاء إذن الإضافة بنجاح',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating receipt:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get ALL receipts (الرئيسي - للجودة)
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, i.name as item_name, i.code as item_code, w.name as warehouse_name, u.full_name as created_by_name
      FROM receipt_vouchers r
      LEFT JOIN items i ON r.item_id = i.id
      LEFT JOIN warehouses w ON r.warehouse_id = w.id
      LEFT JOIN users u ON r.created_by = u.id
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get ALL receipts (للجميع)
router.get('/all', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, i.name as item_name, i.code as item_code, w.name as warehouse_name, u.full_name as created_by_name
      FROM receipt_vouchers r
      LEFT JOIN items i ON r.item_id = i.id
      LEFT JOIN warehouses w ON r.warehouse_id = w.id
      LEFT JOIN users u ON r.created_by = u.id
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get pending receipts (للجودة والمالية)
router.get('/pending', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, i.name as item_name, i.code as item_code, w.name as warehouse_name, u.full_name as created_by_name
      FROM receipt_vouchers r
      LEFT JOIN items i ON r.item_id = i.id
      LEFT JOIN warehouses w ON r.warehouse_id = w.id
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.financial_approval_status = 'pending'
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get single receipt with serials
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const receiptResult = await pool.query(`
      SELECT r.*, i.name as item_name, i.code as item_code, w.name as warehouse_name
      FROM receipt_vouchers r
      LEFT JOIN items i ON r.item_id = i.id
      LEFT JOIN warehouses w ON r.warehouse_id = w.id
      WHERE r.id = $1
    `, [req.params.id]);

    if (receiptResult.rows.length === 0) {
      return res.status(404).json({ message: 'الإذن غير موجود' });
    }

    const receipt = receiptResult.rows[0];

    // جلب السريالات
    const serialsResult = await pool.query(`
      SELECT serial_number, status, created_at
      FROM item_serials
      WHERE receipt_voucher_id = $1
      ORDER BY created_at
    `, [req.params.id]);

    receipt.serials = serialsResult.rows;

    res.json(receipt);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Approve/Reject receipt (Finance)
router.put('/:id/approve', verifyToken, requireRole('warehouse', 'finance', 'admin'), async (req, res) => {
  console.log('=== APPROVE CALLED ===');
  console.log('User:', req.user);
  console.log('ID:', req.params.id);
  console.log('Body:', req.body);

  const { id } = req.params;
  const { status } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'الحالة يجب أن تكون approved أو rejected' });
  }

  try {
    console.log('=== BEFORE checkResult ===');
    const checkResult = await pool.query(
      `SELECT * FROM receipt_vouchers WHERE id = $1`,
      [id]
    );
    console.log('=== AFTER checkResult ===', checkResult.rows);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'الإذن غير موجود' });
    }

    const receipt = checkResult.rows[0];
    console.log('Receipt status:', receipt.status);

    if (receipt.status !== 'warehouse_received') {
      return res.status(400).json({ message: 'الإذن لم يتم استلامه من المخزن بعد' });
    }

    console.log('=== BEFORE UPDATE ===');
    const result = await pool.query(
      `UPDATE receipt_vouchers 
       SET financial_approval_status = $1, 
           approved_by = $2, 
           approved_at = NOW() 
       WHERE id = $3 
       RETURNING *`,
      [status, req.user.id, id]
    );
    console.log('=== AFTER UPDATE ===', result.rows);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'الإذن غير موجود' });
    }

    const updatedReceipt = result.rows[0];
    console.log('=== BEFORE items query ===');

    if (status === 'approved') {
      const itemsResult = await pool.query(
        `SELECT * FROM receipt_voucher_items WHERE receipt_voucher_id = $1`,
        [id]
      );
      console.log('Items found:', itemsResult.rows.length);

      if (itemsResult.rows.length === 0) {
        return res.status(400).json({ message: 'الإذن لا يحتوي على أصناف' });
      }

      for (const item of itemsResult.rows) {
        console.log('Processing item:', item.item_id, 'Qty:', item.quantity);

        // إضافة كل صنف للمخزن
        await pool.query(
          `INSERT INTO stock_movements 
           (item_id, warehouse_id, movement_type, quantity, reference_type, reference_id, done_by, unit_price) 
           VALUES ($1, $2, 'in', $3, 'receipt', $4, $5, $6)`,
          [item.item_id, updatedReceipt.warehouse_id, item.quantity, updatedReceipt.id, req.user.id, item.unit_price]
        );

        // تحديث أو إنشاء رصيد المخزن لكل صنف
        const stockCheck = await pool.query(
          'SELECT * FROM stock WHERE item_id = $1 AND warehouse_id = $2',
          [item.item_id, updatedReceipt.warehouse_id]
        );

        if (stockCheck.rows.length > 0) {
          const currentQty = parseFloat(stockCheck.rows[0].quantity);
          const newQty = currentQty + parseFloat(item.quantity);
          await pool.query(
            'UPDATE stock SET quantity = $1, updated_at = NOW() WHERE item_id = $2 AND warehouse_id = $3',
            [newQty, item.item_id, updatedReceipt.warehouse_id]
          );
        } else {
          await pool.query(
            'INSERT INTO stock (item_id, warehouse_id, quantity) VALUES ($1, $2, $3)',
            [item.item_id, updatedReceipt.warehouse_id, item.quantity]
          );
        }
      }

      // نحدث الحالة لـ posted بعد ما نخلص
      await pool.query(
        `UPDATE receipt_vouchers SET status = 'posted' WHERE id = $1`,
        [id]
      );
    }

    res.json({
      message: status === 'approved' ? 'تم اعتماد الإذن وتحديث المخزن' : 'تم رفض الإذن',
      data: updatedReceipt
    });
  } catch (err) {
    console.error('=== FULL ERROR ===');
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// PUT /:id/warehouse-receive - استلام المخزن مع السريالات
// ═══════════════════════════════════════════════════════════════
router.put('/:id/warehouse-receive', verifyToken, requireRole('warehouse', 'admin'), async (req, res) => {
  const { id } = req.params;
  const { items, received_by } = req.body;

  // التحقق من received_by
  if (!received_by || !received_by.trim()) {
    return res.status(400).json({ message: 'اسم أمين المخزن مطلوب' });
  }

  try {
    // 1. نتأكد من الإذن
    const voucherResult = await pool.query(
      `SELECT * FROM receipt_vouchers WHERE id = $1 AND status = 'approved_quality'`,
      [id]
    );

    if (voucherResult.rows.length === 0) {
      return res.status(404).json({ message: 'الإذن غير موجود أو لم يتم اعتماد الجودة' });
    }

    const voucher = voucherResult.rows[0];

    // 2. نستلم كل صنف
    for (const item of items) {
      const itemResult = await pool.query(
        `SELECT * FROM receipt_voucher_items WHERE receipt_voucher_id = $1 AND item_id = $2`,
        [id, item.item_id]
      );

      if (itemResult.rows.length === 0) {
        return res.status(400).json({ message: `الصنف غير موجود في الإذن` });
      }

      const voucherItem = itemResult.rows[0];
      const receivedQty = parseFloat(item.received_quantity || 0);

      // نتحقق من السريالات
      const itemInfo = await pool.query(
        `SELECT has_serial FROM items WHERE id = $1`,
        [item.item_id]
      );

      const hasSerial = itemInfo.rows.length > 0 && itemInfo.rows[0].has_serial;

      if (hasSerial) {
        const serials = item.serials || [];
        if (serials.length !== receivedQty) {
          return res.status(400).json({ 
            message: `عدد السريالات (${serials.length}) لا يطابق الكمية (${receivedQty})` 
          });
        }

        for (const serial of serials) {
          if (!serial || !serial.trim()) {
            return res.status(400).json({ message: 'السريال فارغ' });
          }

          const existingSerial = await pool.query(
            `SELECT id FROM item_serials WHERE serial_number = $1`,
            [serial.trim()]
          );

          if (existingSerial.rows.length > 0) {
            return res.status(400).json({ message: `السريال ${serial} مستخدم` });
          }

          await pool.query(`
            INSERT INTO item_serials (serial_number, item_id, receipt_voucher_id, status, warehouse_id)
            VALUES ($1, $2, $3, 'available', $4)
          `, [serial.trim(), item.item_id, id, voucher.warehouse_id]);
        }
      }

      await pool.query(`
        UPDATE receipt_voucher_items SET received_quantity = $1 WHERE id = $2
      `, [receivedQty, voucherItem.id]);
    }

    // 3. نحدث حالة الإذن
    await pool.query(`
      UPDATE receipt_vouchers 
      SET status = 'warehouse_received', warehouse_approved_by = $1, warehouse_approved_at = NOW(), received_by = $3
      WHERE id = $2
    `, [req.user.id, id, received_by.trim()]);

    res.json({ message: 'تم استلام المخزن بنجاح', voucher_id: id });

  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// PUT /:id - تعديل إذن (بعد الترحيل posted)
// ═══════════════════════════════════════════════════════════════
router.put('/:id', verifyToken, requireRole('warehouse', 'admin'), async (req, res) => {
  const { id } = req.params;
  const { warehouse_id, received_by, items } = req.body;

  try {
    // 1. نتأكد من الإذن موجود وposted
    const voucherResult = await pool.query(
      `SELECT * FROM receipt_vouchers WHERE id = $1 AND status = 'posted'`,
      [id]
    );

    if (voucherResult.rows.length === 0) {
      return res.status(404).json({ message: 'الإذن غير موجود أو لم يتم ترحيله' });
    }

    const voucher = voucherResult.rows[0];

    // 2. نحدث بيانات الإذن
        // نتحقق من وجود العمود received_by
    const columnCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'receipt_vouchers' AND column_name = 'received_by'
    `);
    
    if (columnCheck.rows.length > 0) {
      await pool.query(`
        UPDATE receipt_vouchers 
        SET warehouse_id = $1, received_by = $2
        WHERE id = $3
      `, [warehouse_id, received_by || voucher.received_by, id]);
    } else {
      await pool.query(`
        UPDATE receipt_vouchers 
        SET warehouse_id = $1
        WHERE id = $2
      `, [warehouse_id, id]);
    }
    // 3. نحدث السريالات لو فيه تغيير
    if (items && items.length > 0) {
      for (const item of items) {
        if (item.serials && item.serials.length > 0) {
          // نمسح السريالات القديمة ونضيف الجديدة
          await pool.query(
            `DELETE FROM item_serials WHERE receipt_voucher_id = $1 AND item_id = $2`,
            [id, item.item_id]
          );

          for (const serial of item.serials) {
            if (serial && serial.trim()) {
              await pool.query(`
                INSERT INTO item_serials (serial_number, item_id, receipt_voucher_id, status, warehouse_id)
                VALUES ($1, $2, $3, 'available', $4)
              `, [serial.trim(), item.item_id, id, warehouse_id || voucher.warehouse_id]);
            }
          }
        }

        // نحدث received_quantity
        if (item.received_quantity) {
          await pool.query(`
            UPDATE receipt_voucher_items 
            SET received_quantity = $1 
            WHERE receipt_voucher_id = $2 AND item_id = $3
          `, [item.received_quantity, id, item.item_id]);
        }
      }
    }

    res.json({ message: 'تم تحديث الإذن بنجاح' });
  } catch (err) {
    console.error('Error updating receipt:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// DELETE /:id - حذف إذن
// ═══════════════════════════════════════════════════════════════
router.delete('/:id', verifyToken, requireRole('warehouse', 'admin'), async (req, res) => {
  const { id } = req.params;

  try {
    // 1. نتأكد من الإذن موجود
    const voucherResult = await pool.query(
      `SELECT * FROM receipt_vouchers WHERE id = $1`,
      [id]
    );

    if (voucherResult.rows.length === 0) {
      return res.status(404).json({ message: 'الإذن غير موجود' });
    }

    const voucher = voucherResult.rows[0];

    // 2. لو الإذن posted → نرجع الكمية للمخزن الأول
    if (voucher.status === 'posted') {
      const itemsResult = await pool.query(
        `SELECT * FROM receipt_voucher_items WHERE receipt_voucher_id = $1`,
        [id]
      );

      for (const item of itemsResult.rows) {
        // نرجع الكمية من المخزن
        await pool.query(
          `UPDATE stock SET quantity = quantity - $1, updated_at = NOW() WHERE item_id = $2 AND warehouse_id = $3`,
          [item.quantity, item.item_id, voucher.warehouse_id]
        );

        // نسجل حركة عكسية
        await pool.query(
          `INSERT INTO stock_movements 
           (item_id, warehouse_id, movement_type, quantity, reference_type, reference_id, done_by, unit_price) 
           VALUES ($1, $2, 'out', $3, 'receipt_delete', $4, $5, $6)`,
          [item.item_id, voucher.warehouse_id, item.quantity, id, req.user.id, item.unit_price]
        );
      }
    }

    // 3. نمسح السريالات
    await pool.query(`DELETE FROM item_serials WHERE receipt_voucher_id = $1`, [id]);

    // 4. نمسح أصناف الإذن
    await pool.query(`DELETE FROM receipt_voucher_items WHERE receipt_voucher_id = $1`, [id]);

    // 5. نمسح الإذن
    await pool.query(`DELETE FROM receipt_vouchers WHERE id = $1`, [id]);

    res.json({ message: 'تم حذف الإذن بنجاح' });
  } catch (err) {
    console.error('Error deleting receipt:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /:id/items - جلب أصناف الإذن
// ═══════════════════════════════════════════════════════════════
router.get('/:id/items', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT rvi.*, i.name as item_name, i.code as item_code, i.has_serial
      FROM receipt_voucher_items rvi
      LEFT JOIN items i ON rvi.item_id = i.id
      WHERE rvi.receipt_voucher_id = $1
      ORDER BY rvi.id
    `, [req.params.id]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching receipt items:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
// Get serials for a receipt voucher (optionally filtered by item_id)
router.get('/:id/serials', verifyToken, async (req, res) => {
  try {
    const { item_id } = req.query;
    let query = `
      SELECT sn.*, i.name as item_name
      FROM item_serials sn
      LEFT JOIN items i ON sn.item_id = i.id
      WHERE sn.receipt_voucher_id = $1
    `;
    const params = [req.params.id];

    if (item_id) {
      query += ` AND sn.item_id = $2`;
      params.push(item_id);
    }

    query += ` ORDER BY sn.created_at`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching serials:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
