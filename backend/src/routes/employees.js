const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// ============================================
// الموظفين
// ============================================

// Get all employees (supports ?status=active|inactive|all)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { status } = req.query;
    let whereClause = '';
    const params = [];

    if (status && status !== 'all') {
      whereClause = 'WHERE e.status = $1';
      params.push(status);
    }

    const result = await pool.query(`
      SELECT e.*, d.name as department_name, s.name as section_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN sections s ON e.section_id = s.id
      ${whereClause}
      ORDER BY 
        CASE WHEN e.status = 'active' THEN 0 ELSE 1 END,
        e.created_at DESC
    `, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create employee
router.post('/', verifyToken, requireRole('admin', 'hr'), async (req, res) => {
  const { 
    employee_number, full_name, national_id, phone, email, address,
    department_id, section_id, job_title, hire_date, salary 
  } = req.body;

  try {
    const result = await pool.query(`
      INSERT INTO employees (
        employee_number, full_name, national_id, phone, email, address,
        department_id, section_id, job_title, hire_date, salary, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active')
      RETURNING *
    `, [
      employee_number, full_name, national_id, phone, email, address,
      department_id, section_id, job_title, hire_date, salary
    ]);

    res.status(201).json({
      message: 'تم إضافة الموظف بنجاح',
      data: result.rows[0]
    });
  } catch (err) {
    if (err.code === '23505') {
      const constraint = err.constraint || '';
      let errorMessage = 'خطأ: ';

      if (constraint.includes('national_id')) {
        errorMessage += 'الرقم القومي موجود مسبقاً!';
      } else if (constraint.includes('employee_number')) {
        errorMessage += 'الرقم الوظيفي موجود مسبقاً!';
      } else if (constraint.includes('email')) {
        errorMessage += 'البريد الإلكتروني موجود مسبقاً!';
      } else {
        errorMessage += 'هناك بيانات مكررة في النظام!';
      }

      return res.status(400).json({ message: errorMessage });
    }

    console.error('Create employee error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update employee
router.put('/:id', verifyToken, requireRole('admin', 'hr'), async (req, res) => {
  const { 
    employee_number, full_name, national_id, phone, email, address,
    department_id, section_id, job_title, hire_date, salary 
  } = req.body;

  try {
    const result = await pool.query(`
      UPDATE employees SET
        employee_number = $1, full_name = $2, national_id = $3, phone = $4,
        email = $5, address = $6, department_id = $7, section_id = $8,
        job_title = $9, hire_date = $10, salary = $11
      WHERE id = $12
      RETURNING *
    `, [
      employee_number || null, 
      full_name || null, 
      national_id || null, 
      phone || null, 
      email || null, 
      address || null,
      department_id || null, 
      section_id || null,
      job_title || null, 
      hire_date || null, 
      salary || null, 
      req.params.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'الموظف غير موجود' });
    }

    res.json({
      message: 'تم تحديث الموظف بنجاح',
      data: result.rows[0]
    });
  } catch (err) {
    if (err.code === '23505') {
      const constraint = err.constraint || '';
      let errorMessage = 'خطأ: ';

      if (constraint.includes('national_id')) {
        errorMessage += 'الرقم القومي موجود مسبقاً!';
      } else if (constraint.includes('employee_number')) {
        errorMessage += 'الرقم الوظيفي موجود مسبقاً!';
      } else if (constraint.includes('email')) {
        errorMessage += 'البريد الإلكتروني موجود مسبقاً!';
      } else {
        errorMessage += 'هناك بيانات مكررة في النظام!';
      }

      return res.status(400).json({ message: errorMessage });
    }

    console.error('Update employee error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Toggle employee status (Soft Delete) — Admin only
router.put('/:id/toggle-status', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const existing = await pool.query('SELECT status FROM employees WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'الموظف غير موجود' });
    }

    const currentStatus = existing.rows[0].status;
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

    const result = await pool.query(
      `UPDATE employees SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [newStatus, req.params.id]
    );

    const msg = newStatus === 'active' ? 'تم إعادة تفعيل الموظف بنجاح' : 'تم إلغاء تفعيل الموظف بنجاح';
    res.json({ message: msg, data: result.rows[0] });
  } catch (err) {
    console.error('Toggle status error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ============================================
// الإدارات (Departments)
// ============================================

router.get('/departments', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM departments ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/departments', verifyToken, requireRole('admin'), async (req, res) => {
  const { name, code, description } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO departments (name, code, description) 
      VALUES ($1, $2, $3) 
      RETURNING *
    `, [name, code, description]);
    res.status(201).json({ message: 'تم إضافة الإدارة بنجاح', data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'كود الإدارة أو الاسم موجود مسبقاً!' });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/departments/:id', verifyToken, requireRole('admin'), async (req, res) => {
  const { name, code, description } = req.body;
  try {
    const result = await pool.query(`
      UPDATE departments 
      SET name = $1, code = $2, description = $3
      WHERE id = $4 
      RETURNING *
    `, [name, code, description, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'الإدارة غير موجودة' });
    }
    res.json({ message: 'تم تحديث الإدارة بنجاح', data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'كود الإدارة أو الاسم موجود مسبقاً!' });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/departments/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const checkSections = await pool.query(
      'SELECT COUNT(*) FROM sections WHERE department_id = $1',
      [req.params.id]
    );
    if (parseInt(checkSections.rows[0].count) > 0) {
      return res.status(400).json({ message: 'لا يمكن الحذف: يوجد أقسام مرتبطة بهذه الإدارة' });
    }
    const result = await pool.query('DELETE FROM departments WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'الإدارة غير موجودة' });
    }
    res.json({ message: 'تم حذف الإدارة بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ============================================
// الأقسام (Sections)
// ============================================

router.get('/sections', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, d.name as department_name 
      FROM sections s
      LEFT JOIN departments d ON s.department_id = d.id
      ORDER BY d.name, s.name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/sections/by-department/:deptId', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, d.name as department_name
      FROM sections s
      JOIN departments d ON s.department_id = d.id
      WHERE s.department_id = $1
      ORDER BY s.name
    `, [req.params.deptId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/sections', verifyToken, requireRole('admin'), async (req, res) => {
  const { name, code, department_id, description } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO sections (name, code, department_id, description) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *
    `, [name, code, department_id, description]);
    res.status(201).json({ message: 'تم إضافة القسم بنجاح', data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'كود القسم أو الاسم موجود مسبقاً!' });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/sections/:id', verifyToken, requireRole('admin'), async (req, res) => {
  const { name, code, department_id, description } = req.body;
  try {
    const result = await pool.query(`
      UPDATE sections 
      SET name = $1, code = $2, department_id = $3, description = $4
      WHERE id = $5 
      RETURNING *
    `, [name, code, department_id, description, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'القسم غير موجود' });
    }
    res.json({ message: 'تم تحديث القسم بنجاح', data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'كود القسم أو الاسم موجود مسبقاً!' });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/sections/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const checkEmployees = await pool.query(
      'SELECT COUNT(*) FROM employees WHERE section_id = $1',
      [req.params.id]
    );
    if (parseInt(checkEmployees.rows[0].count) > 0) {
      return res.status(400).json({ message: 'لا يمكن الحذف: يوجد موظفون مرتبطون بهذا القسم' });
    }
    const result = await pool.query('DELETE FROM sections WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'القسم غير موجود' });
    }
    res.json({ message: 'تم حذف القسم بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /employees/warehouse-keepers
// ═══════════════════════════════════════════════════════════════
router.get('/warehouse-keepers', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.id, e.full_name, e.employee_number, e.job_title
      FROM employees e
      WHERE e.status = 'active' AND (
        e.job_title ILIKE '%مخزن%' 
        OR e.job_title ILIKE '%warehouse%'
        OR e.full_name ILIKE '%مخزن%'
      )
      ORDER BY e.full_name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching warehouse keepers:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
