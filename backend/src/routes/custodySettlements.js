const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const crypto = require('crypto');
const router = express.Router();

// Generate next settlement number
router.get('/next-number', verifyToken, async (req, res) => {
  try {
    const uuid = crypto.randomUUID().split('-')[0].toUpperCase();
    const nextNumber = `SET-${uuid}`;
    res.json({ nextNumber });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create settlement from approved submission
router.post('/', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const {
    submission_id,
    custody_id,
    notes
  } = req.body;

  if (!submission_id) {
    return res.status(400).json({ message: 'submission_id مطلوب' });
  }
  if (!custody_id) {
    return res.status(400).json({ message: 'custody_id مطلوب' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ✅ نتحقق إن التقديم مش متسوى قبل كده
    const existingCheck = await client.query(
      `SELECT id, status FROM custody_submissions WHERE id = $1`,
      [submission_id]
    );

    if (existingCheck.rows.length === 0) {
      throw new Error('التقديم غير موجود');
    }

    if (existingCheck.rows[0].status === 'settled') {
      throw new Error('التقديم تم تسويته بالفعل');
    }

    // ✅ نولد رقم فريد 100% باستخدام UUID
    const uuid = crypto.randomUUID().split('-')[0].toUpperCase();
    let settlement_number = `SET-${submission_id}-${uuid}`;

    let checkResult = await client.query(
      `SELECT settlement_number FROM custody_settlements WHERE settlement_number = $1`,
      [settlement_number]
    );

    let attempts = 0;
    while (checkResult.rows.length > 0 && attempts < 5) {
      const newUuid = crypto.randomUUID().split('-')[0].toUpperCase();
      settlement_number = `SET-${submission_id}-${newUuid}`;
      checkResult = await client.query(
        `SELECT settlement_number FROM custody_settlements WHERE settlement_number = $1`,
        [settlement_number]
      );
      attempts++;
    }

    if (checkResult.rows.length > 0) {
      throw new Error('لم نتمكن من توليد رقم تسوية فريد، حاول مرة أخرى');
    }

    // 1. نجيب التقديم المعتمد مع بيانات العهدة الكاملة
    const submissionResult = await client.query(
      `SELECT cs.*, 
        c.custody_number, 
        c.amount as custody_original_amount, 
        c.remaining_amount, 
        c.employee_name, 
        c.settled_amount as custody_settled, 
        c.payment_method, 
        c.currency,
        c.exchange_rate,
        c.employee_id as custody_employee_id,
        c.shipment_id as custody_shipment_id
       FROM custody_submissions cs
       JOIN custodies c ON cs.custody_id = c.id
       WHERE cs.id = $1 AND cs.status = 'approved'`,
      [submission_id]
    );
    if (submissionResult.rows.length === 0) {
      throw new Error('التقديم غير موجود أو لم يتم اعتماده');
    }

    const submission = submissionResult.rows[0];
    const remainingAmount = parseFloat(submission.remaining_amount);
    const totalAmount = parseFloat(submission.total_amount);
    const custodyOriginalAmount = parseFloat(submission.custody_original_amount);
    const currentSettled = parseFloat(submission.custody_settled || 0);

    // 2. نجيب تفاصيل التقديم
    const detailsResult = await client.query(
      `SELECT csd.*, ec.category_name, ec.category_code
       FROM custody_submission_details csd
       JOIN expense_categories ec ON csd.expense_category_id = ec.id
       WHERE csd.submission_id = $1`,
      [submission_id]
    );

    // 3. نعمل التسوية لكل بند
    for (const detail of detailsResult.rows) {
      await client.query(
        `INSERT INTO custody_settlements (
          settlement_number, custody_id, expense_category_id,
          cost_center_id, amount, description, receipt_number, 
          submission_id, created_by, settlement_date, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_DATE, 'posted')`,
        [settlement_number, custody_id, detail.expense_category_id,
         detail.cost_center_id || null, detail.amount, detail.description || null, 
         detail.receipt_number || null, submission_id, req.user.id]
      );
    }

    // 3ب. لو العهدة مرتبطة بشحنة، كل بند تسوية بيتحول تلقائيًا لمصروف شحنة
    // (بدل ما ندخل نفس البيانات مرتين) — ده اللي بيخلي تسوية عهدة المخلص/الموظف
    // تنعكس تلقائيًا على تكلفة الشحنة من غير تكرار إدخال
    if (submission.custody_shipment_id) {
      for (const detail of detailsResult.rows) {
        const amt = parseFloat(detail.amount) || 0;
        await client.query(
          `INSERT INTO shipment_expenses (
            shipment_id, expense_date, expense_type, description,
            amount_egp, amount_usd, amount_eur, amount_other, exchange_rate_usd, exchange_rate_eur, exchange_rate_other,
            total_egp, custody_id, has_tax_invoice, attachment_url, notes,
            expense_category_id, supplier_id, payment_method, created_by
          ) VALUES ($1, CURRENT_DATE, $2, $3, $4, 0, 0, 0, 0, 0, 0, $4, $5, false, $6, $7, $8, $9, 'custody', $10)`,
          [
            submission.custody_shipment_id,
            detail.category_name || 'مصروف عهدة',
            detail.description || detail.category_name || `تسوية عهدة ${submission.custody_number}`,
            amt,
            custody_id,
            detail.receipt_attachment || null,
            `تسوية تلقائية من عهدة ${submission.custody_number} — ${settlement_number}`,
            detail.expense_category_id || null,
            submission.supplier_id || null,
            req.user.id
          ]
        );
      }
    }

    // 4. نحدث مراكز التكلفة
    for (const detail of detailsResult.rows) {
      if (detail.cost_center_id) {
        await client.query(
          `UPDATE cost_centers 
           SET spent_amount = spent_amount + $1,
               remaining_budget = budget_amount - (spent_amount + $1),
               updated_at = NOW()
           WHERE id = $2`,
          [detail.amount, detail.cost_center_id]
        );
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 5. حساب الفرق بين مبلغ التسوية والمتبقي من العهدة
    // ═══════════════════════════════════════════════════════════════
    const difference = totalAmount - remainingAmount; // موجب = صرف زيادة | سالب = فائض/رد

    // ═══════════════════════════════════════════════════════════════
    // 6. تحديث العهدة حسب حالة التسوية
    // ═══════════════════════════════════════════════════════════════
    let newRemaining, newSettled, newStatus, message;

    if (Math.abs(difference) <= 0.01) {
      // ✅ مطابق تماماً: العهدة بتتقفل
      newRemaining = 0;
      newSettled = currentSettled + totalAmount;
      newStatus = 'fully_settled';
      message = '✅ تم تسجيل التسوية بنجاح — العهدة متقفلة بالكامل';

    } else if (difference < -0.01) {
      // ✅ تسوية أقل من العهدة → فائض للموظف
      // العهدة بتفضل نشطة بالفائض، والموظف لسه معاه الفرق
      newRemaining = Math.abs(difference); // 250 مثلاً
      newSettled = currentSettled + totalAmount;
      newStatus = 'active'; // العهدة لسه نشطة (فيها فائض)
      message = `✅ تم تسجيل التسوية بنجاح.\n\nℹ️ مبلغ التسوية (${totalAmount.toFixed(2)}) أقل من العهدة (${remainingAmount.toFixed(2)}) بـ ${Math.abs(difference).toFixed(2)}.\n💰 الفائض ${Math.abs(difference).toFixed(2)} ج.م لسه مع الموظف — العهدة نشطة.\n👉 لو الموظف هيرد الفائض، اذهب لشاشة الخزينة واعمل سند رد (CRET) يدويًا.`;

    } else {
      // ✅ تسوية أكبر من العهدة → زيادة على الشركة
      newRemaining = 0;
      newSettled = currentSettled + remainingAmount; // بنسوي بحدود المتبقي
      newStatus = 'fully_settled';
      message = `✅ تم تسجيل التسوية بنجاح.\n\n⚠️ مبلغ التسوية (${totalAmount.toFixed(2)}) أكبر من العهدة (${remainingAmount.toFixed(2)}) بـ ${difference.toFixed(2)}.\n👉 اذهب لشاشة الخزينة واعمل سند صرف (CSET) يدويًا بـ ${difference.toFixed(2)} ج.م.`;
    }

    await client.query(
      `UPDATE custodies 
       SET remaining_amount = $1, settled_amount = $2, status = $3, updated_at = NOW()
       WHERE id = $4`,
      [newRemaining, newSettled, newStatus, custody_id]
    );

    // 7. نحدث حالة التقديم
    await client.query(
      `UPDATE custody_submissions 
       SET status = 'settled', settled_at = NOW()
       WHERE id = $1`,
      [submission_id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message,
      data: {
        settlement_number,
        custody_id,
        submission_id,
        total_amount: totalAmount,
        remaining: newRemaining,
        custody_original_amount: custodyOriginalAmount,
        difference: Math.abs(difference) > 0.01 ? difference : 0
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Get approved submissions for settlement (للمالية)
router.get('/approved-submissions', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cs.*, 
        c.custody_number, 
        c.amount as custody_original_amount,
        c.remaining_amount as custody_remaining,
        c.settled_amount as custody_settled,
        c.currency,
        c.exchange_rate,
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

// Get settlements (active only — exclude deleted)
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cs.*, 
        c.custody_number, 
        COALESCE(e.full_name, c.employee_name) as employee_name,
        ec.category_name as expense_name,
        cc.center_name as cost_center_name
       FROM custody_settlements cs
       JOIN custodies c ON cs.custody_id = c.id
       LEFT JOIN employees e ON c.employee_id = e.id
       JOIN expense_categories ec ON cs.expense_category_id = ec.id
       LEFT JOIN cost_centers cc ON cs.cost_center_id = cc.id
       WHERE cs.status = 'posted'
       ORDER BY cs.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get settlement by custody
router.get('/by-custody/:custodyId', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cs.*, 
        ec.category_name as expense_name,
        cc.center_name as cost_center_name,
        u.full_name as created_by_name
       FROM custody_settlements cs
       JOIN expense_categories ec ON cs.expense_category_id = ec.id
       LEFT JOIN cost_centers cc ON cs.cost_center_id = cc.id
       LEFT JOIN users u ON cs.created_by = u.id
       WHERE cs.custody_id = $1 AND cs.status = 'posted'
       ORDER BY cs.created_at DESC`,
      [req.params.custodyId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete settlement and reverse everything
router.delete('/:settlement_number', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { settlement_number } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get the settlement group to find submission_id and custody_id
    const settlementRows = await client.query(
      `SELECT * FROM custody_settlements WHERE settlement_number = $1 AND status = 'posted'`,
      [settlement_number]
    );

    if (settlementRows.rows.length === 0) {
      throw new Error('التسوية غير موجودة أو تم حذفها مسبقًا');
    }

    const firstRow = settlementRows.rows[0];
    const submissionId = firstRow.submission_id;
    const custodyId = firstRow.custody_id;

    // 1. Reverse cost centers
    for (const row of settlementRows.rows) {
      if (row.cost_center_id) {
        await client.query(
          `UPDATE cost_centers 
           SET spent_amount = spent_amount - $1,
               remaining_budget = budget_amount - (spent_amount - $1),
               updated_at = NOW()
           WHERE id = $2`,
          [row.amount, row.cost_center_id]
        );
      }
    }

    // 2. Soft delete — mark as deleted and break FK link so submission can be deleted later
    await client.query(
      `UPDATE custody_settlements SET status = 'deleted', deleted_at = NOW(), submission_id = NULL WHERE settlement_number = $1`,
      [settlement_number]
    );

    // 3. Get custody data to restore remaining_amount
    const custodyRes = await client.query('SELECT amount, settled_amount FROM custodies WHERE id = $1', [custodyId]);
    const custodyAmount = parseFloat(custodyRes.rows[0]?.amount || 0);
    const currentSettled = parseFloat(custodyRes.rows[0]?.settled_amount || 0);

    // 4. Get submission total to restore
    let submissionTotal = 0;
    if (submissionId) {
      const subRes = await client.query('SELECT total_amount FROM custody_submissions WHERE id = $1', [submissionId]);
      submissionTotal = parseFloat(subRes.rows[0]?.total_amount || 0);
    } else {
      submissionTotal = settlementRows.rows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    }

    const newRemaining = Math.min(custodyAmount, (custodyAmount - currentSettled) + submissionTotal);
    const newSettled = Math.max(0, currentSettled - submissionTotal);
    const newStatus = newRemaining >= custodyAmount ? 'active' : (newRemaining > 0 ? 'partially_settled' : 'fully_settled');

    await client.query(
      `UPDATE custodies SET remaining_amount = $1, settled_amount = $2, status = $3, updated_at = NOW() WHERE id = $4`,
      [newRemaining, newSettled, newStatus, custodyId]
    );

    // 5. Restore submission status to DRAFT (not approved) so employee can edit/delete
    if (submissionId) {
      await client.query(
        `UPDATE custody_submissions 
         SET status = 'draft', settled_at = NULL, approved_by = NULL, approved_at = NULL, updated_at = NOW() 
         WHERE id = $1`,
        [submissionId]
      );
    }

    await client.query('COMMIT');
    res.json({ message: '✅ تم إلغاء التسوية. العهدة رجعت نشطة والتقديم رجع مسودة — الموظف يقدر يعدّلها أو يحذفها.' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Get deleted/cancelled settlements (للمالية — التسويات الملغاة)
router.get('/deleted', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cs.*, 
        c.custody_number, 
        COALESCE(e.full_name, c.employee_name) as employee_name,
        ec.category_name as expense_name,
        cc.center_name as cost_center_name
       FROM custody_settlements cs
       JOIN custodies c ON cs.custody_id = c.id
       LEFT JOIN employees e ON c.employee_id = e.id
       JOIN expense_categories ec ON cs.expense_category_id = ec.id
       LEFT JOIN cost_centers cc ON cs.cost_center_id = cc.id
       WHERE cs.status = 'deleted'
       ORDER BY cs.deleted_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
