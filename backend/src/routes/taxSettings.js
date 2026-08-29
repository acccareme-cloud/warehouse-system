const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

// ============================================
// GET SETTINGS - جلب الإعدادات
// ============================================
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tax_settings ORDER BY id DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      // إرجاع إعدادات افتراضية
      return res.json({
        price_quote_prefix: 'PQ',
        tax_invoice_prefix: 'TAX',
        price_quote_start: 1,
        tax_invoice_start: 1,
        government_quote_format: 'SSMMYYYY',
        default_tax_rate: 14,
        vat_rate: 14.00,
        withholding_rate: 20.00,
        customs_profit_tax_rate: 1.00
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching tax settings:', err);
    res.status(500).json({ error: 'فشل في جلب الإعدادات' });
  }
});

// ============================================
// UPDATE SETTINGS - تحديث الإعدادات
// ============================================
router.put('/', verifyToken, async (req, res) => {
  const { vat_rate, withholding_rate, customs_profit_tax_rate } = req.body;

  try {
    const check = await pool.query('SELECT id FROM tax_settings ORDER BY id DESC LIMIT 1');
    let result;

    if (check.rows.length > 0) {
      // فيه سجل → UPDATE الحقول الضريبية بس
      result = await pool.query(
        `UPDATE tax_settings SET 
          vat_rate = COALESCE($1, vat_rate),
          withholding_rate = COALESCE($2, withholding_rate),
          customs_profit_tax_rate = COALESCE($3, customs_profit_tax_rate),
          updated_at = NOW()
         WHERE id = $4 RETURNING *`,
        [vat_rate, withholding_rate, customs_profit_tax_rate, check.rows[0].id]
      );
    } else {
      // مفيش سجل → INSERT بأعمدة موجودة فقط
      result = await pool.query(
        `INSERT INTO tax_settings 
         (price_quote_prefix, tax_invoice_prefix, price_quote_start, tax_invoice_start,
          default_tax_rate, vat_rate, withholding_rate, customs_profit_tax_rate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        ['PQ', 'TAX', 1, 1, 14, 
         vat_rate || 14, withholding_rate || 20, customs_profit_tax_rate || 1]
      );
    }

    res.json({ message: 'تم تحديث الإعدادات بنجاح', settings: result.rows[0] });
  } catch (err) {
    console.error('Error updating tax settings:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// RESERVE NUMBER - حجز رقم
// ============================================
router.post('/reserve-number', verifyToken, async (req, res) => {
  const { document_type, number_value, notes } = req.body;

  try {
    // التحقق من عدم وجود الرقم
    const checkResult = await pool.query(
      `SELECT id FROM reserved_numbers 
       WHERE number_value = $1 AND document_type = $2 AND status = 'reserved'`,
      [number_value, document_type]
    );

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ error: 'الرقم محجوز مسبقاً' });
    }

    // التحقق من عدم استخدام الرقم في الفواتير
    const invoiceCheck = await pool.query(
      'SELECT id FROM sales_invoices WHERE invoice_number = $1 AND invoice_type = $2',
      [number_value, document_type]
    );

    if (invoiceCheck.rows.length > 0) {
      return res.status(400).json({ error: 'الرقم مستخدم في فاتورة' });
    }

    const result = await pool.query(
      `INSERT INTO reserved_numbers 
       (document_type, number_value, reserved_by, notes, status)
       VALUES ($1, $2, $3, $4, 'reserved')
       RETURNING *`,
      [document_type, number_value, req.user.id, notes || null]
    );

    res.status(201).json({
      message: 'تم حجز الرقم بنجاح',
      reservation: result.rows[0]
    });
  } catch (err) {
    console.error('Error reserving number:', err);
    res.status(500).json({ error: 'فشل في حجز الرقم' });
  }
});

// ============================================
// CANCEL RESERVED NUMBER - إلغاء حجز رقم
// ============================================
router.put('/cancel-reserved/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;

  try {
    const result = await pool.query(
      `UPDATE reserved_numbers 
       SET status = 'cancelled', cancelled_by = $1, cancellation_notes = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND status = 'reserved'
       RETURNING *`,
      [req.user.id, notes || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'الحجز غير موجود أو تم إلغاؤه مسبقاً' });
    }

    res.json({
      message: 'تم إلغاء الحجز بنجاح',
      reservation: result.rows[0]
    });
  } catch (err) {
    console.error('Error canceling reservation:', err);
    res.status(500).json({ error: 'فشل في إلغاء الحجز' });
  }
});

// ============================================
// GET RESERVED NUMBERS - جلب الأرقام المحجوزة
// ============================================
router.get('/reserved-numbers', verifyToken, async (req, res) => {
  const { document_type, status } = req.query;

  try {
    let query = `
      SELECT rn.*, 
        u1.username as reserved_by_name,
        u2.username as cancelled_by_name
      FROM reserved_numbers rn
      LEFT JOIN users u1 ON rn.reserved_by = u1.id
      LEFT JOIN users u2 ON rn.cancelled_by = u2.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (document_type) {
      query += ` AND rn.document_type = $${paramIndex}`;
      params.push(document_type);
      paramIndex++;
    }

    if (status) {
      query += ` AND rn.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY rn.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching reserved numbers:', err);
    res.status(500).json({ error: 'فشل في جلب الأرقام المحجوزة' });
  }
});

// ============================================
// GET NEXT AVAILABLE NUMBER - جلب أول رقم متاح
// ============================================
router.get('/next-available', verifyToken, async (req, res) => {
  const { document_type } = req.query;

  try {
    const settingsResult = await pool.query(
      'SELECT price_quote_prefix, tax_invoice_prefix FROM tax_settings ORDER BY id DESC LIMIT 1'
    );
    const settings = settingsResult.rows[0] || {};

    let prefix;
    if (document_type === 'price_quote') {
      prefix = settings.price_quote_prefix || 'PQ';
    } else if (document_type === 'tax') {
      prefix = settings.tax_invoice_prefix || 'TAX';
    } else {
      return res.status(400).json({ error: 'نوع المستند غير صحيح' });
    }

    // جلب آخر رقم مستخدم
    const usedResult = await pool.query(
      `SELECT invoice_number FROM sales_invoices 
       WHERE invoice_type = $1 AND invoice_number LIKE $2
       ORDER BY id DESC LIMIT 1`,
      [document_type, `${prefix}-%`]
    );

    // جلب الأرقام المحجوزة
    const reservedResult = await pool.query(
      `SELECT number_value FROM reserved_numbers 
       WHERE document_type = $1 AND status = 'reserved'`,
      [document_type]
    );

    const reservedNumbers = reservedResult.rows.map(r => r.number_value);

    let nextNum = 1;
    if (usedResult.rows.length > 0) {
      const match = usedResult.rows[0].invoice_number.match(/-(\d+)$/);
      nextNum = match ? parseInt(match[1]) + 1 : 1;
    }

    // التأكد من عدم تضارب مع المحجوز
    let nextNumber = `${prefix}-${String(nextNum).padStart(4, '0')}`;
    while (reservedNumbers.includes(nextNumber)) {
      nextNum++;
      nextNumber = `${prefix}-${String(nextNum).padStart(4, '0')}`;
    }

    res.json({ nextNumber });
  } catch (err) {
    console.error('Error getting next available:', err);
    res.status(500).json({ error: 'فشل في جلب الرقم المتاح' });
  }
});

module.exports = router;
