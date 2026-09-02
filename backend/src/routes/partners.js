// backend/src/routes/partners.js
const express = require('express');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// ═══════════════════════════════════════════
// ️ مهم: الـ routes الخاصة (company-capital) لازم تكون قبل /:id
// ═══════════════════════════════════════════

// GET /api/partners/company-capital - جلب رأس مال الشركة
router.get('/company-capital', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM company_settings LIMIT 1');
    res.json(result.rows[0] || { capital: 0 });
  } catch (err) {
    console.error('[GET /partners/company-capital] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/partners/company-capital - تحديث رأس مال الشركة
router.put('/company-capital', verifyToken, async (req, res) => {
  const { capital } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO company_settings (id, capital) VALUES (1, $1)
      ON CONFLICT (id) DO UPDATE SET capital = $1, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [capital]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /partners/company-capital] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════
// الآن الـ routes العامة (بعد الخاصة)
// ═══════════════════════════════════════════

// GET /api/partners - جلب كل الشركاء
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM partners 
      ORDER BY name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /partners] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/partners - إضافة شريك جديد
router.post('/', verifyToken, async (req, res) => {
  const { name, phone, email, share_percentage, notes } = req.body;
  
  try {
    const result = await pool.query(`
      INSERT INTO partners (name, phone, email, share_percentage, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [name, phone, email, share_percentage, notes]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[POST /partners] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/partners/:id - تعديل شريك (لازم يكون آخر PUT)
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { name, phone, email, share_percentage, notes } = req.body;
  
  try {
    const result = await pool.query(`
      UPDATE partners 
      SET name = $1, phone = $2, email = $3, share_percentage = $4, notes = $5
      WHERE id = $6
      RETURNING *
    `, [name, phone, email, share_percentage, notes, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'الشريك غير موجود' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /partners/:id] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/partners/:id - حذف شريك
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query('DELETE FROM partners WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'الشريك غير موجود' });
    }
    
    res.json({ message: 'تم حذف الشريك' });
  } catch (err) {
    console.error('[DELETE /partners/:id] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;