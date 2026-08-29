const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken: authenticateToken } = require('../middleware/auth');

// ============================================================
// GET /api/currencies - جلب كل العملات
// ============================================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, u.username as created_by_name
      FROM currencies c
      LEFT JOIN users u ON u.id = c.created_by
      WHERE c.is_active = true
      ORDER BY c.is_default DESC, c.code ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching currencies:', error);
    res.status(500).json({ error: 'فشل في جلب العملات' });
  }
});

// ============================================================
// GET /api/currencies/:id - جلب عملة محددة
// ============================================================
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT c.*, u.username as created_by_name
      FROM currencies c
      LEFT JOIN users u ON u.id = c.created_by
      WHERE c.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'العملة غير موجودة' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching currency:', error);
    res.status(500).json({ error: 'فشل في جلب العملة' });
  }
});

// ============================================================
// POST /api/currencies - إضافة عملة جديدة
// ============================================================
router.post('/', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { code, name, symbol, exchange_rate, is_default } = req.body;

    // التحقق من عدم تكرار الكود
    const existing = await client.query(
      'SELECT id FROM currencies WHERE code = $1',
      [code]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'كود العملة موجود مسبقاً' });
    }

    // لو العملة الافتراضية، إلغاء الافتراضية من الباقي
    if (is_default) {
      await client.query('UPDATE currencies SET is_default = false');
    }

    const result = await client.query(`
      INSERT INTO currencies (code, name, symbol, exchange_rate, is_default)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [code, name, symbol, exchange_rate, is_default || false]);

    // تسجيل في تاريخ المعاملات
    await client.query(`
      INSERT INTO exchange_rate_history (currency_id, exchange_rate, effective_date, notes, created_by)
      VALUES ($1, $2, CURRENT_DATE, 'إضافة عملة جديدة', $3)
    `, [result.rows[0].id, exchange_rate, req.user.id]);

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating currency:', error);
    res.status(500).json({ error: 'فشل في إضافة العملة' });
  } finally {
    client.release();
  }
});

// ============================================================
// PUT /api/currencies/:id - تعديل عملة
// ============================================================
router.put('/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { name, symbol, exchange_rate, is_default, is_active } = req.body;

    // جلب العملة الحالية
    const current = await client.query('SELECT * FROM currencies WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'العملة غير موجودة' });
    }

    const oldRate = current.rows[0].exchange_rate;

    // لو العملة الافتراضية، إلغاء الافتراضية من الباقي
    if (is_default) {
      await client.query('UPDATE currencies SET is_default = false WHERE id != $1', [id]);
    }

    const result = await client.query(`
      UPDATE currencies SET
        name = COALESCE($1, name),
        symbol = COALESCE($2, symbol),
        exchange_rate = COALESCE($3, exchange_rate),
        is_default = COALESCE($4, is_default),
        is_active = COALESCE($5, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [name, symbol, exchange_rate, is_default, is_active, id]);

    // لو تغير معامل التحويل، تسجيل في التاريخ
    if (exchange_rate && exchange_rate !== oldRate) {
      await client.query(`
        INSERT INTO exchange_rate_history (currency_id, exchange_rate, effective_date, notes, created_by)
        VALUES ($1, $2, CURRENT_DATE, 'تعديل معامل التحويل من ' || $3 || ' إلى ' || $2, $4)
      `, [id, exchange_rate, oldRate, req.user.id]);
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating currency:', error);
    res.status(500).json({ error: 'فشل في تعديل العملة' });
  } finally {
    client.release();
  }
});

// ============================================================
// DELETE /api/currencies/:id - حذف عملة (soft delete)
// ============================================================
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // التأكد إنها مش العملة الافتراضية
    const currency = await pool.query('SELECT is_default FROM currencies WHERE id = $1', [id]);
    if (currency.rows.length === 0) {
      return res.status(404).json({ error: 'العملة غير موجودة' });
    }
    if (currency.rows[0].is_default) {
      return res.status(400).json({ error: 'لا يمكن حذف العملة الافتراضية' });
    }

    await pool.query('UPDATE currencies SET is_active = false WHERE id = $1', [id]);
    res.json({ message: 'تم حذف العملة بنجاح' });
  } catch (error) {
    console.error('Error deleting currency:', error);
    res.status(500).json({ error: 'فشل في حذف العملة' });
  }
});

// ============================================================
// GET /api/currencies/:id/history - تاريخ معاملات التحويل
// ============================================================
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT erh.*, u.username as created_by_name
      FROM exchange_rate_history erh
      LEFT JOIN users u ON u.id = erh.created_by
      WHERE erh.currency_id = $1
      ORDER BY erh.effective_date DESC, erh.created_at DESC
    `, [id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching exchange rate history:', error);
    res.status(500).json({ error: 'فشل في جلب التاريخ' });
  }
});

// ============================================================
// POST /api/currencies/:id/history - إضافة معامل تحويل جديد
// ============================================================
router.post('/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { exchange_rate, effective_date, notes } = req.body;

    const result = await pool.query(`
      INSERT INTO exchange_rate_history (currency_id, exchange_rate, effective_date, notes, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, exchange_rate, effective_date || new Date(), notes, req.user.id]);

    // تحديث العملة بالمعامل الجديد
    await pool.query(
      'UPDATE currencies SET exchange_rate = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [exchange_rate, id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating exchange rate history:', error);
    res.status(500).json({ error: 'فشل في إضافة معامل التحويل' });
  }
});

// ============================================================
// GET /api/currencies/convert - تحويل بين العملات
// ============================================================
router.post('/convert', authenticateToken, async (req, res) => {
  try {
    const { amount, from_currency, to_currency } = req.body;

    const fromResult = await pool.query('SELECT exchange_rate FROM currencies WHERE code = $1 AND is_active = true', [from_currency]);
    const toResult = await pool.query('SELECT exchange_rate FROM currencies WHERE code = $1 AND is_active = true', [to_currency]);

    if (fromResult.rows.length === 0 || toResult.rows.length === 0) {
      return res.status(400).json({ error: 'إحدى العملات غير موجودة' });
    }

    const fromRate = fromResult.rows[0].exchange_rate;
    const toRate = toResult.rows[0].exchange_rate;

    // المعادلة: (المبلغ × سعر العملة المصدر) ÷ سعر العملة الهدف
    const convertedAmount = (amount * fromRate) / toRate;

    res.json({
      amount,
      from_currency,
      to_currency,
      from_rate: fromRate,
      to_rate: toRate,
      converted_amount: parseFloat(convertedAmount.toFixed(2)),
      exchange_rate: fromRate / toRate
    });
  } catch (error) {
    console.error('Error converting currency:', error);
    res.status(500).json({ error: 'فشل في التحويل' });
  }
});

module.exports = router;
