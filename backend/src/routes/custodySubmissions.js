const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Get next submission number
router.get('/next-number', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`SELECT submission_number FROM custody_submissions ORDER BY id DESC LIMIT 1`);
    let nextNumber = 'SUB-0001';
    if (result.rows.length > 0) {
      const last = result.rows[0].submission_number;
      const num = parseInt(last.match(/\d+/)[0]) + 1;
      nextNumber = `SUB-${String(num).padStart(4, '0')}`;
    }
    res.json({ nextNumber });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create submission (تقديم تسوية أو حفظ مسودة)
router.post('/', verifyToken, async (req, res) => {
  const { submission_number, custody_id, details, notes, status = 'pending' } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // نجيب employee_id من جدول custodies
    const custodyResult = await client.query(
      'SELECT employee_id, remaining_amount, status as custody_status FROM custodies WHERE id = $1',
      [custody_id]
    );

    if (custodyResult.rows.length === 0) {
      throw new Error('العهدة غير موجودة');
    }

    const employeeId = custodyResult.rows[0].employee_id;
    const remainingAmount = parseFloat(custodyResult.rows[0].remaining_amount);
    const custodyStatus = custodyResult.rows[0].custody_status;

    // ❌ مانع تقديم تسوية لعهدة مقفولة (fully_settled)
    // الفرق بيسدد من الخزينة (CSET) مش من تقديم تسوية
    if (custodyStatus === 'fully_settled') {
      throw new Error('العهدة تم تسويتها بالكامل ولا يمكن تقديم تسوية جديدة. لو فيه فرق زيادة، يسدد من شاشة الخزينة (سداد فرق عهدة).');
    }

    // نحسب إجمالي التقديم
    const totalAmount = details.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);

    if (totalAmount <= 0) {
      throw new Error('المبلغ الإجمالي يجب أن يكون أكبر من صفر');
    }

    // نعمل التقديم (pending أو draft)
    const submissionResult = await client.query(`
      INSERT INTO custody_submissions (submission_number, custody_id, employee_id, total_amount, notes, status, submitted_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [submission_number, custody_id, employeeId, totalAmount, notes || null, status, req.user.id]);

    const submission = submissionResult.rows[0];

    // نضيف التفاصيل
    for (const detail of details) {
      await client.query(`
        INSERT INTO custody_submission_details (
          submission_id, expense_category_id, cost_center_id, amount, description, receipt_number, receipt_attachment
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [submission.id, detail.expense_category_id, detail.cost_center_id || null, detail.amount, detail.description || null, detail.receipt_number || null, detail.receipt_attachment || null]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: status === 'draft' ? 'تم حفظ المسودة بنجاح' : 'تم تقديم التسوية بنجاح',
      data: submission
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Update submission (تعديل مسودة أو معلق قبل الاعتماد)
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { details, notes, status } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // نتحقق إن التقديم موجود وبتاع الموظف ده ولسه ما اتعتمدش
    const checkResult = await client.query(
      `SELECT * FROM custody_submissions WHERE id = $1 AND submitted_by = $2 AND status IN ('draft', 'pending')`,
      [id, req.user.id]
    );

    if (checkResult.rows.length === 0) {
      throw new Error('التقديم غير موجود أو لا يمكن تعديله');
    }

    const submission = checkResult.rows[0];
    const totalAmount = details.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);

    if (totalAmount <= 0) {
      throw new Error('المبلغ الإجمالي يجب أن يكون أكبر من صفر');
    }

    // نحدث التقديم
    const newStatus = status || submission.status;
    const updateResult = await client.query(`
      UPDATE custody_submissions 
      SET total_amount = $1, notes = $2, status = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [totalAmount, notes || null, newStatus, id]);

    // نحذف التفاصيل القديمة ونضيف الجديدة
    await client.query('DELETE FROM custody_submission_details WHERE submission_id = $1', [id]);

    for (const detail of details) {
      await client.query(`
        INSERT INTO custody_submission_details (
          submission_id, expense_category_id, cost_center_id, amount, description, receipt_number, receipt_attachment
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [id, detail.expense_category_id, detail.cost_center_id || null, detail.amount, detail.description || null, detail.receipt_number || null, detail.receipt_attachment || null]);
    }

    await client.query('COMMIT');

    res.json({
      message: newStatus === 'draft' ? 'تم تحديث المسودة بنجاح' : 'تم تحديث التقديم بنجاح',
      data: updateResult.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Delete submission (حذف مسودة أو معلق وإرجاع العهدة لـ active)
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const checkResult = await client.query(
      `SELECT cs.*, c.status as custody_status 
       FROM custody_submissions cs
       JOIN custodies c ON cs.custody_id = c.id
       WHERE cs.id = $1 AND cs.submitted_by = $2 AND cs.status IN ('draft', 'pending')`,
      [id, req.user.id]
    );

    if (checkResult.rows.length === 0) {
      // المدير أو الأدمن يقدر يحذف أي تقديم معلق
      const adminCheck = await client.query(
        `SELECT cs.*, c.status as custody_status 
         FROM custody_submissions cs
         JOIN custodies c ON cs.custody_id = c.id
         WHERE cs.id = $1 AND cs.status = 'pending'`,
        [id]
      );
      if (adminCheck.rows.length === 0 || !['manager','admin'].includes(req.user.role)) {
        throw new Error('التقديم غير موجود أو لا يمكن حذفه');
      }
    }

    const submission = checkResult.rows[0] || (await client.query(
      `SELECT cs.*, c.status as custody_status, c.id as custody_id
       FROM custody_submissions cs
       JOIN custodies c ON cs.custody_id = c.id
       WHERE cs.id = $1`, [id]
    )).rows[0];

    // نرجع العهدة لـ active لو كانت fully_settled (في حالة rare) أو partially_settled
    if (submission.custody_status === 'fully_settled') {
      await client.query(
        `UPDATE custodies SET status = 'active', updated_at = NOW() WHERE id = $1`,
        [submission.custody_id]
      );
    }

    // نحذف التسويات المرتبطة ثم التفاصيل ثم التقديم
    await client.query('DELETE FROM custody_settlements WHERE submission_id = $1', [id]);
    await client.query('DELETE FROM custody_submission_details WHERE submission_id = $1', [id]);
    await client.query('DELETE FROM custody_submissions WHERE id = $1', [id]);

    await client.query('COMMIT');

    res.json({ message: 'تم حذف التقديم وإرجاع العهدة للحالة النشطة' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Get my submissions (للموظف — كل الحالات)
router.get('/my-submissions', verifyToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT employee_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const employeeId = userResult.rows[0]?.employee_id;

    // Try multiple matching strategies to find employee submissions
    let result;
    if (employeeId) {
      result = await pool.query(`
        SELECT cs.*, c.custody_number, c.employee_name, c.party_type, c.remaining_amount as custody_remaining,
          COALESCE(e.full_name, c.employee_name) as employee_full_name
        FROM custody_submissions cs
        JOIN custodies c ON cs.custody_id = c.id
        LEFT JOIN employees e ON cs.employee_id = e.id
        WHERE cs.employee_id = $1 
           OR cs.submitted_by = $2
           OR c.employee_id = $1
        ORDER BY cs.submitted_at DESC
      `, [employeeId, req.user.id]);
    } else {
      result = await pool.query(`
        SELECT cs.*, c.custody_number, c.employee_name, c.party_type, c.remaining_amount as custody_remaining,
          COALESCE(e.full_name, c.employee_name) as employee_full_name
        FROM custody_submissions cs
        JOIN custodies c ON cs.custody_id = c.id
        LEFT JOIN employees e ON cs.employee_id = e.id
        WHERE cs.submitted_by = $1
           OR c.employee_id IN (SELECT employee_id FROM users WHERE id = $1)
        ORDER BY cs.submitted_at DESC
      `, [req.user.id]);
    }

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all submissions (للمدير — معلق + معتمد + مرفوض)
router.get('/all', verifyToken, requireRole('manager', 'admin', 'finance'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cs.*, c.custody_number, c.remaining_amount as custody_remaining,
        COALESCE(e.full_name, c.employee_name) as employee_name,
        e.employee_number,
        d.name as department_name
      FROM custody_submissions cs
      JOIN custodies c ON cs.custody_id = c.id
      LEFT JOIN employees e ON cs.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      ORDER BY 
        CASE cs.status 
          WHEN 'pending' THEN 1 
          WHEN 'approved' THEN 2 
          WHEN 'draft' THEN 3 
          WHEN 'settled' THEN 4 
          WHEN 'rejected' THEN 5 
        END,
        cs.submitted_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get pending submissions (للمدير)
router.get('/pending', verifyToken, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cs.*, c.custody_number, c.remaining_amount as custody_remaining,
        COALESCE(e.full_name, c.employee_name) as employee_name,
        e.employee_number,
        d.name as department_name
      FROM custody_submissions cs
      JOIN custodies c ON cs.custody_id = c.id
      LEFT JOIN employees e ON cs.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE cs.status = 'pending'
      ORDER BY cs.submitted_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get approved submissions (للمالية)
router.get('/approved', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cs.*, c.custody_number, c.remaining_amount as custody_remaining,
        COALESCE(e.full_name, c.employee_name) as employee_name,
        e.employee_number
      FROM custody_submissions cs
      JOIN custodies c ON cs.custody_id = c.id
      LEFT JOIN employees e ON cs.employee_id = e.id
      WHERE cs.status = 'approved'
      ORDER BY cs.approved_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Approve submission
router.put('/:id/approve', verifyToken, requireRole('manager', 'admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE custody_submissions
      SET status = 'approved', approved_by = $1, approved_at = NOW()
      WHERE id = $2 AND status = 'pending'
      RETURNING *
    `, [req.user.id, req.params.id]);

    if (result.rows.length === 0) {
      throw new Error('التقديم غير موجود أو معتمد بالفعل');
    }

    await client.query('COMMIT');
    res.json({ message: 'تم اعتماد التقديم بنجاح', data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Reject submission
router.put('/:id/reject', verifyToken, requireRole('manager', 'admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE custody_submissions
      SET status = 'rejected', approved_by = $1, approved_at = NOW()
      WHERE id = $2 AND status = 'pending'
      RETURNING *
    `, [req.user.id, req.params.id]);

    if (result.rows.length === 0) {
      throw new Error('التقديم غير موجود أو تمت معالجته');
    }

    await client.query('COMMIT');
    res.json({ message: 'تم رفض التقديم', data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Get submission details
router.get('/:id/details', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        csd.*,
        ec.category_name,
        ec.category_code,
        cc.center_name as cost_center_name,
        cc.center_code as cost_center_code
      FROM custody_submission_details csd
      JOIN expense_categories ec ON csd.expense_category_id = ec.id
      LEFT JOIN cost_centers cc ON csd.cost_center_id = cc.id
      WHERE csd.submission_id = $1
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get submission by id (with details)
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const submissionResult = await pool.query(`
      SELECT cs.*, c.custody_number, c.remaining_amount as custody_remaining,
        COALESCE(e.full_name, c.employee_name) as employee_name,
        e.employee_number
      FROM custody_submissions cs
      JOIN custodies c ON cs.custody_id = c.id
      LEFT JOIN employees e ON cs.employee_id = e.id
      WHERE cs.id = $1
    `, [req.params.id]);

    if (submissionResult.rows.length === 0) {
      return res.status(404).json({ message: 'التقديم غير موجود' });
    }

    const detailsResult = await pool.query(`
      SELECT
        csd.*,
        ec.category_name,
        ec.category_code,
        cc.center_name as cost_center_name,
        cc.center_code as cost_center_code
      FROM custody_submission_details csd
      JOIN expense_categories ec ON csd.expense_category_id = ec.id
      LEFT JOIN cost_centers cc ON csd.cost_center_id = cc.id
      WHERE csd.submission_id = $1
    `, [req.params.id]);

    res.json({
      ...submissionResult.rows[0],
      details: detailsResult.rows
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
