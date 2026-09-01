// backend/src/routes/settings.js
// إعدادات عامة للبرنامج: اسم البرنامج + اسم الشركة بالعربي والإنجليزي + اللغة الافتراضية
//
// GET  /api/settings         -> عام، بدون تسجيل دخول (شاشة اللوجين محتاجة الاسم قبل ما المستخدم يدخل)
// PUT  /api/settings         -> أدمن بس

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken: authenticateToken, requireRole } = require('../middleware/auth');

// ============================================================
// GET /api/settings - جلب إعدادات البرنامج (عام - بدون توكين)
// ============================================================
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM app_settings WHERE id = 1');
    if (result.rows.length === 0) {
      // fallback لو الجدول لسه فاضي لأي سبب
      return res.json({
        program_name_ar: 'نظام كير ميد',
        program_name_en: 'Care Med System',
        company_name_ar: 'شركة كير ميد',
        company_name_en: 'Care Med Company',
        logo_url: null,
        default_language: 'ar',
      });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching app settings:', error);
    res.status(500).json({ error: 'فشل في جلب إعدادات البرنامج' });
  }
});

// ============================================================
// PUT /api/settings - تعديل إعدادات البرنامج (أدمن بس)
// ============================================================
router.put('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      program_name_ar,
      program_name_en,
      company_name_ar,
      company_name_en,
      logo_url,
      default_language,
    } = req.body;

    const result = await pool.query(
      `UPDATE app_settings SET
        program_name_ar = COALESCE($1, program_name_ar),
        program_name_en = COALESCE($2, program_name_en),
        company_name_ar = COALESCE($3, company_name_ar),
        company_name_en = COALESCE($4, company_name_en),
        logo_url = COALESCE($5, logo_url),
        default_language = COALESCE($6, default_language),
        updated_at = NOW()
       WHERE id = 1
       RETURNING *`,
      [program_name_ar, program_name_en, company_name_ar, company_name_en, logo_url, default_language]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'إعدادات البرنامج غير موجودة' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating app settings:', error);
    res.status(500).json({ error: 'فشل في تحديث إعدادات البرنامج' });
  }
});

module.exports = router;
