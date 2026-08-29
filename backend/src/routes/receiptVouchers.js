const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// توليد رقم إذن إضافة
router.get('/next-number', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT voucher_number FROM receipt_vouchers WHERE voucher_number LIKE 'RCV-%' ORDER BY id DESC LIMIT 1`
    );
    let nextNumber = 'RCV-0001';
    if (result.rows.length > 0) {
      const last = parseInt(result.rows[0].voucher_number.split('-')[1]);
      nextNumber = `RCV-${String(last + 1).padStart(4, '0')}`;
    }
    res.json({ nextNumber });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// إنشاء إذن إضافة (تلقائي من الفاتورة)
router.post('/', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const {
    voucher_number, supplier, item_id, warehouse_id, quantity,
    purchase_price, tax_14_percent, tax_discount_percent, tax_discount_amount,
    total_amount, supply_order, purchase_invoice_id
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO receipt_vouchers (
        voucher_number, supplier, item_id, warehouse_id, quantity, purchase_price,
        tax_14_percent, tax_discount_percent, tax_discount_amount, total_amount,
        supply_order, purchase_invoice_id, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', $13)
      RETURNING *`,
      [voucher_number, supplier, item_id, warehouse_id, quantity, purchase_price,
       tax_14_percent, tax_discount_percent, tax_discount_amount, total_amount,
       supply_order, purchase_invoice_id, req.user.id]
    );

    res.status(201).json({
      message: 'تم إنشاء إذن الإضافة بنجاح',
      data: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// جلب كل إذونات الإضافة
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT rv.*, i.name as item_name, i.code as item_code, i.has_serial,
        w.name as warehouse_name
       FROM receipt_vouchers rv
       JOIN items i ON rv.item_id = i.id
       LEFT JOIN warehouses w ON rv.warehouse_id = w.id
       ORDER BY rv.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// جلب إذن الإضافة حسب الحالة
router.get('/by-status/:status', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT rv.*, i.name as item_name, i.code as item_code, i.has_serial,
        w.name as warehouse_name
       FROM receipt_vouchers rv
       JOIN items i ON rv.item_id = i.id
       LEFT JOIN warehouses w ON rv.warehouse_id = w.id
       WHERE rv.status = $1
       ORDER BY rv.created_at DESC`,
      [req.params.status]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// فحص الجودة
router.put('/:id/quality-check', verifyToken, requireRole('quality', 'admin'), async (req, res) => {
  const { quality_notes, serial_numbers } = req.body;

  try {
    // تحديث حالة الإذن
    const result = await pool.query(
      `UPDATE receipt_vouchers 
       SET status = 'approved_quality', 
           quality_checked_by = $1, 
           quality_checked_at = NOW(),
           quality_notes = $2
       WHERE id = $3 AND status = 'pending'
       RETURNING *`,
      [req.user.id, quality_notes, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'الإذن غير موجود أو تمت معالجته' });
    }

    const voucher = result.rows[0];

    // إضافة السريالات لو موجودة
    if (serial_numbers && serial_numbers.length > 0) {
      for (const serial of serial_numbers) {
        await pool.query(
          `INSERT INTO serial_numbers (serial_number, item_id, receipt_voucher_id, status)
           VALUES ($1, $2, $3, 'in_stock')`,
          [serial, voucher.item_id, voucher.id]
        );
      }
    }

    res.json({ message: 'تم فحص الجودة بنجاح', data: voucher });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// استلام المخزن
router.put('/:id/warehouse-receive', verifyToken, requireRole('warehouse', 'admin'), async (req, res) => {
  const { received_quantity, serial_numbers } = req.body;

  try {
    const result = await pool.query(
      `UPDATE receipt_vouchers 
       SET status = 'warehouse_received', 
           warehouse_approved_by = $1, 
           warehouse_approved_at = NOW(),
           received_quantity = $2
       WHERE id = $3 AND status = 'approved_quality'
       RETURNING *`,
      [req.user.id, received_quantity || 0, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'الإذن غير موجود أو لم يتم فحص الجودة بعد' });
    }

    const voucher = result.rows[0];

    // إضافة السريالات لو لم تضاف في الجودة
    if (serial_numbers && serial_numbers.length > 0) {
      for (const serial of serial_numbers) {
        await pool.query(
          `INSERT INTO serial_numbers (serial_number, item_id, receipt_voucher_id, status)
           VALUES ($1, $2, $3, 'in_stock')
           ON CONFLICT (serial_number) DO NOTHING`,
          [serial, voucher.item_id, voucher.id]
        );
      }
    }

    res.json({ message: 'تم استلام المخزن بنجاح', data: voucher });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ترحيل الإذن (بواسطة المحاسب)
router.put('/:id/post', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE receipt_vouchers 
       SET status = 'posted'
       WHERE id = $1 AND status = 'warehouse_received'
       RETURNING *`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'الإذن غير موجود أو لم يتم استلام المخزن بعد' });
    }

    const voucher = result.rows[0];

    // إضافة حركة مخزن
    await pool.query(
      `INSERT INTO inventory_movements (movement_type, item_id, warehouse_id, quantity, unit_price, total_amount, reference_type, reference_id, notes, created_by)
       VALUES ('in', $1, $2, $3, $4, $5, 'receipt_voucher', $6, 'إذن إضافة مخزن', $7)`,
      [voucher.item_id, voucher.warehouse_id, voucher.quantity, voucher.purchase_price, 
       voucher.total_amount, voucher.id, req.user.id]
    );

    // تحديث رصيد المخزن
    await pool.query(
      `INSERT INTO inventory_balances (item_id, warehouse_id, quantity, average_cost, last_movement_date)
       VALUES ($1, $2, $3, $4, CURRENT_DATE)
       ON CONFLICT (item_id, warehouse_id) 
       DO UPDATE SET 
         quantity = inventory_balances.quantity + $3,
         average_cost = ((inventory_balances.quantity * inventory_balances.average_cost) + ($3 * $4)) / (inventory_balances.quantity + $3),
         last_movement_date = CURRENT_DATE,
         updated_at = NOW()`,
      [voucher.item_id, voucher.warehouse_id, voucher.quantity, voucher.purchase_price]
    );

    res.json({ message: 'تم ترحيل الإذن وتحديث الرصيد بنجاح', data: voucher });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
