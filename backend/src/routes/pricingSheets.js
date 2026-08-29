const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// ============================================
// توليد الرقم التسلسلي: 01082026, 02082026...
// ============================================
router.get('/next-number', verifyToken, async (req, res) => {
  try {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0'); // 08
    const yyyy = now.getFullYear();                          // 2026
    const suffix = mm + yyyy;                                // 082026

    const result = await pool.query(
      `SELECT sheet_number FROM pricing_sheets 
       WHERE sheet_number LIKE $1 
       ORDER BY sheet_number DESC LIMIT 1`,
      [`__${suffix}`]
    );

    let nextSeq = 1;
    if (result.rows.length > 0) {
      const last = result.rows[0].sheet_number; // مثلاً "05082026"
      const lastSeq = parseInt(last.substring(0, 2));
      if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
    }
    
    const nextNumber = String(nextSeq).padStart(2, '0') + suffix;
    res.json({ nextNumber }); // 01082026, 02082026...
  } catch (err) {
    console.error('Next number error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ============================================
// عرض الكل
// ============================================
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ps.*, c.name as customer_name_display
      FROM pricing_sheets ps
      LEFT JOIN customers c ON ps.customer_id = c.id
      ORDER BY ps.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ============================================
// عرض واحد
// ============================================
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ps.*, c.name as customer_name_display
      FROM pricing_sheets ps
      LEFT JOIN customers c ON ps.customer_id = c.id
      WHERE ps.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'البيان غير موجود' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ============================================
// إنشاء
// ============================================
router.post('/', verifyToken, requireRole('sales', 'admin'), async (req, res) => {
  const { sheet_number, sheet_date, customer_id, customer_name, project_name, items, discount, notes } = req.body;
  
  try {
    let subtotal = 0;
    const safeItems = items || [];
    safeItems.forEach(item => {
      subtotal += parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0);
    });
    const disc = parseFloat(discount || 0);
    const total = subtotal - disc;

    const result = await pool.query(`
      INSERT INTO pricing_sheets 
        (sheet_number, sheet_date, customer_id, customer_name, project_name, items, subtotal, discount, total_amount, status, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `, [
      sheet_number, sheet_date, customer_id, customer_name, project_name,
      JSON.stringify(safeItems), subtotal, disc, total, 'draft', notes, req.user.id
    ]);

    res.status(201).json({ message: 'تم إنشاء بيان التسليم', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ============================================
// تعديل (مسودة فقط)
// ============================================
router.put('/:id', verifyToken, requireRole('sales', 'admin'), async (req, res) => {
  const { sheet_date, customer_id, customer_name, project_name, items, discount, notes } = req.body;
  
  try {
    let subtotal = 0;
    const safeItems = items || [];
    safeItems.forEach(item => {
      subtotal += parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0);
    });
    const disc = parseFloat(discount || 0);
    const total = subtotal - disc;

    const result = await pool.query(`
      UPDATE pricing_sheets 
      SET sheet_date = $1, customer_id = $2, customer_name = $3, project_name = $4,
          items = $5, subtotal = $6, discount = $7, total_amount = $8, notes = $9, updated_at = NOW()
      WHERE id = $10 AND status = 'draft'
      RETURNING *
    `, [sheet_date, customer_id, customer_name, project_name, JSON.stringify(safeItems), subtotal, disc, total, notes, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'لا يمكن التعديل - البيان معتمد أو غير موجود' });
    }
    res.json({ message: 'تم التعديل', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ============================================
// حذف (مسودة فقط)
// ============================================
router.delete('/:id', verifyToken, requireRole('sales', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM pricing_sheets WHERE id = $1 AND status = 'draft' RETURNING *",
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'لا يمكن الحذف - البيان معتمد أو غير موجود' });
    }
    res.json({ message: 'تم الحذف بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ============================================
// إلغاء (للبيانات المعتمدة)
// ============================================
router.put('/:id/cancel', verifyToken, requireRole('admin', 'sales'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE pricing_sheets SET status = 'cancelled', updated_at = NOW() 
       WHERE id = $1 AND status = 'approved' RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'لا يمكن الإلغاء - البيان ليس معتمداً' });
    }
    res.json({ message: 'تم الإلغاء', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ============================================
// اعتماد
// ============================================
router.put('/:id/approve', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE pricing_sheets SET status = 'approved', updated_at = NOW() 
       WHERE id = $1 AND status = 'draft' RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(400).json({ message: 'لا يمكن الاعتماد' });
    res.json({ message: 'تم الاعتماد', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;