const express = require('express');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// قائمة الموظفين
// ═══════════════════════════════════════════════════════════════
router.get('/employees', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT
        e.id,
        COALESCE(e.full_name, c.employee_name) as full_name,
        e.employee_number,
        d.name as department_name
      FROM custodies c
      LEFT JOIN employees e ON c.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE c.status IN ('active', 'partially_settled', 'fully_settled')
        AND c.status != 'cancelled'
      ORDER BY COALESCE(e.full_name, c.employee_name)
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// تسويات موظف معين
// ═══════════════════════════════════════════════════════════════
router.get('/employee-settlements', verifyToken, async (req, res) => {
  const { employee_id } = req.query;
  if (!employee_id) return res.status(400).json({ message: 'employee_id مطلوب' });

  try {
    const result = await pool.query(`
      SELECT 
        cs.settlement_number,
        cs.settlement_date,
        c.custody_number,
        SUM(cs.amount) as total_amount,
        COUNT(cs.id) as items_count
      FROM custody_settlements cs
      JOIN custodies c ON cs.custody_id = c.id
      WHERE c.employee_id = $1
      GROUP BY cs.settlement_number, cs.settlement_date, c.custody_number
      ORDER BY cs.settlement_date DESC
    `, [employee_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// كشف حساب موظف
// ═══════════════════════════════════════════════════════════════
router.get('/employee-statement', verifyToken, async (req, res) => {
  const { employee_id, from, to } = req.query;
  if (!employee_id) return res.status(400).json({ message: 'employee_id مطلوب' });

  try {
    const empResult = await pool.query(
      `SELECT id, full_name, employee_number FROM employees WHERE id = $1`, [employee_id]
    );
    const employee = empResult.rows[0] || { full_name: 'موظف ' + employee_id, employee_number: '' };

    const movementsResult = await pool.query(`
      SELECT c.custody_date as date, 'custody' as type, c.custody_number as reference, c.amount as amount, c.purpose as purpose
      FROM custodies c WHERE c.employee_id = $1 AND c.status != 'cancelled'
        AND ($2::date IS NULL OR c.custody_date >= $2) AND ($3::date IS NULL OR c.custody_date <= $3)
      UNION ALL
      SELECT cs.settlement_date as date, 'settlement' as type, cs.settlement_number as reference, cs.amount as amount, ec.category_name as purpose
      FROM custody_settlements cs JOIN custodies c ON cs.custody_id = c.id
      LEFT JOIN expense_categories ec ON cs.expense_category_id = ec.id
      WHERE c.employee_id = $1 AND cs.status != 'deleted'
        AND ($2::date IS NULL OR cs.settlement_date >= $2) AND ($3::date IS NULL OR cs.settlement_date <= $3)
      UNION ALL
      SELECT t.transaction_date as date,
        CASE WHEN t.transaction_type = 'custody_return' THEN 'settlement' ELSE 'custody' END as type,
        t.transaction_number as reference, t.amount as amount,
        CASE WHEN t.transaction_type = 'custody_return' THEN 'رد عهدة' ELSE 'سداد فرق عهدة' END as purpose
      FROM treasury t JOIN custodies c ON t.custody_id = c.id
      WHERE c.employee_id = $1 AND t.status = 'active' AND t.transaction_type IN ('custody_return', 'custody_settlement')
        AND ($2::date IS NULL OR t.transaction_date >= $2) AND ($3::date IS NULL OR t.transaction_date <= $3)
      ORDER BY date ASC, reference ASC
    `, [employee_id, from || null, to || null]);

    const openingResult = await pool.query(`
      SELECT COALESCE(SUM(CASE WHEN type = 'custody' THEN amount ELSE -amount END), 0) as opening_balance
      FROM (
        SELECT c.amount, 'custody' as type FROM custodies c
        WHERE c.employee_id = $1 AND c.status != 'cancelled' AND $2::date IS NOT NULL AND c.custody_date < $2
        UNION ALL
        SELECT cs.amount, 'settlement' as type FROM custody_settlements cs JOIN custodies c ON cs.custody_id = c.id
        WHERE c.employee_id = $1 AND cs.status != 'deleted' AND $2::date IS NOT NULL AND cs.settlement_date < $2
        UNION ALL
        SELECT t.amount, CASE WHEN t.transaction_type = 'custody_return' THEN 'settlement' ELSE 'custody' END as type
        FROM treasury t JOIN custodies c ON t.custody_id = c.id
        WHERE c.employee_id = $1 AND t.status = 'active' AND t.transaction_type IN ('custody_return', 'custody_settlement')
          AND $2::date IS NOT NULL AND t.transaction_date < $2
      ) pre
    `, [employee_id, from || null]);

    let openingBalance = parseFloat(openingResult.rows[0]?.opening_balance) || 0;

    const grouped = {};
    movementsResult.rows.forEach(row => {
      if (row.type === 'settlement') {
        if (!grouped[row.reference]) grouped[row.reference] = { ...row, amount: 0, items: [] };
        grouped[row.reference].amount += parseFloat(row.amount);
        grouped[row.reference].items.push({ category: row.purpose || '-' });
      } else {
        grouped[row.reference + '_' + row.date] = { ...row, amount: parseFloat(row.amount) };
      }
    });

    let runningBalance = openingBalance;
    const movements = Object.values(grouped).map(row => {
      const amount = parseFloat(row.amount) || 0;
      if (row.type === 'custody') runningBalance += amount;
      else if (row.type === 'settlement') runningBalance -= amount;
      return { date: row.date, type: row.type, reference: row.reference, purpose: row.purpose || '-', amount, balance: runningBalance, items: row.items || [] };
    });

    res.json({ employee: { full_name: employee.full_name, employee_number: employee.employee_number }, from: from || '', to: to || '', opening_balance: openingBalance, closing_balance: runningBalance, movements });
  } catch (err) {
    console.error('Employee statement error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ملخص أرصدة الموظفين
// ═══════════════════════════════════════════════════════════════
router.post('/employees-summary', verifyToken, async (req, res) => {
  const { employee_ids, from, to } = req.body;
  if (!employee_ids || !Array.isArray(employee_ids) || employee_ids.length === 0) {
    return res.status(400).json({ message: 'employee_ids مطلوب' });
  }

  try {
    const employees = [];
    let totalOpening = 0, totalCustody = 0, totalSettlement = 0, totalRefund = 0, totalCset = 0;

    for (const empId of employee_ids) {
      const empResult = await pool.query(`SELECT id, full_name, employee_number FROM employees WHERE id = $1`, [empId]);
      const emp = empResult.rows[0] || { full_name: 'موظف ' + empId, employee_number: '' };

      const openingResult = await pool.query(`
        SELECT COALESCE(SUM(CASE WHEN type = 'custody' THEN amount ELSE -amount END), 0) as opening_balance
        FROM (
          SELECT amount, 'custody' as type FROM custodies WHERE employee_id = $1 AND status != 'cancelled' AND $2::date IS NOT NULL AND custody_date < $2
          UNION ALL
          SELECT cs.amount, 'settlement' as type FROM custody_settlements cs JOIN custodies c ON cs.custody_id = c.id
          WHERE c.employee_id = $1 AND cs.status != 'deleted' AND $2::date IS NOT NULL AND cs.settlement_date < $2
          UNION ALL
          SELECT t.amount, CASE WHEN t.transaction_type = 'custody_return' THEN 'settlement' ELSE 'custody' END as type
          FROM treasury t JOIN custodies c ON t.custody_id = c.id
          WHERE c.employee_id = $1 AND t.status = 'active' AND t.transaction_type IN ('custody_return', 'custody_settlement')
            AND $2::date IS NOT NULL AND t.transaction_date < $2
        ) pre
      `, [empId, from || null]);
      const openingBalance = parseFloat(openingResult.rows[0]?.opening_balance) || 0;

      const custodyResult = await pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM custodies WHERE employee_id = $1 AND status != 'cancelled' AND ($2::date IS NULL OR custody_date >= $2) AND ($3::date IS NULL OR custody_date <= $3)`, [empId, from || null, to || null]);
      const custody = parseFloat(custodyResult.rows[0].total) || 0;

      const settlementResult = await pool.query(`SELECT COALESCE(SUM(cs.amount), 0) as total FROM custody_settlements cs JOIN custodies c ON cs.custody_id = c.id WHERE c.employee_id = $1 AND cs.status != 'deleted' AND ($2::date IS NULL OR cs.settlement_date >= $2) AND ($3::date IS NULL OR cs.settlement_date <= $3)`, [empId, from || null, to || null]);
      const settlement = parseFloat(settlementResult.rows[0].total) || 0;

      const refundResult = await pool.query(`SELECT COALESCE(SUM(t.amount), 0) as total FROM treasury t JOIN custodies c ON t.custody_id = c.id WHERE c.employee_id = $1 AND t.status = 'active' AND t.transaction_type = 'custody_return' AND ($2::date IS NULL OR t.transaction_date >= $2) AND ($3::date IS NULL OR t.transaction_date <= $3)`, [empId, from || null, to || null]);
      const refund = parseFloat(refundResult.rows[0].total) || 0;

      const csetResult = await pool.query(`SELECT COALESCE(SUM(t.amount), 0) as total FROM treasury t JOIN custodies c ON t.custody_id = c.id WHERE c.employee_id = $1 AND t.status = 'active' AND t.transaction_type = 'custody_settlement' AND ($2::date IS NULL OR t.transaction_date >= $2) AND ($3::date IS NULL OR t.transaction_date <= $3)`, [empId, from || null, to || null]);
      const cset = parseFloat(csetResult.rows[0].total) || 0;

      const balance = openingBalance + custody - settlement - refund + cset;

      totalOpening += openingBalance; totalCustody += custody; totalSettlement += settlement; totalRefund += refund; totalCset += cset;

      employees.push({ employee_id: empId, employee_name: emp.full_name, employee_number: emp.employee_number, opening_balance: openingBalance, total_custody: custody, total_settlement: settlement, total_refund: refund, total_cset: cset, closing_balance: balance });
    }

    res.json({ from: from || '', to: to || '', employees, totals: { opening_balance: totalOpening, total_custody: totalCustody, total_settlement: totalSettlement, total_refund: totalRefund, total_cset: totalCset, closing_balance: totalOpening + totalCustody - totalSettlement - totalRefund + totalCset } });
  } catch (err) {
    console.error('Employees summary error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// تفاصيل تسوية معينة (لطباعة سند التسوية) — نسخة مبسّطة وأمنة
// ═══════════════════════════════════════════════════════════════
router.get('/settlement-detail/:settlement_number', verifyToken, async (req, res) => {
  const { settlement_number } = req.params;

  try {
    // استعلام بسيط أولاً للتأكد من وجود التسوية
    const check = await pool.query(
      `SELECT settlement_number, custody_id FROM custody_settlements WHERE settlement_number = $1 LIMIT 1`,
      [settlement_number]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ message: 'التسوية غير موجودة' });
    }

    // الاستعلام الرئيسي — كل الـ JOINs بـ LEFT JOIN عشان لو جدول ناقص ميعطلش
    const result = await pool.query(`
      SELECT 
        cs.settlement_number,
        cs.settlement_date,
        cs.amount,
        cs.description,
        cs.receipt_number,
        
        c.custody_number,
        c.custody_date,
        c.amount as custody_amount,
        c.remaining_amount as custody_remaining,
        c.purpose as custody_purpose,
        COALESCE(e.full_name, c.employee_name) as employee_name,
        e.employee_number,
        d.name as department_name,
        ec.category_name,
        cc.center_name as cost_center_name
      FROM custody_settlements cs
      JOIN custodies c ON cs.custody_id = c.id
      LEFT JOIN employees e ON c.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN expense_categories ec ON cs.expense_category_id = ec.id
      LEFT JOIN cost_centers cc ON cs.cost_center_id = cc.id
      WHERE cs.settlement_number = $1
      ORDER BY cs.id
    `, [settlement_number]);

    const header = {
      settlement_number: result.rows[0].settlement_number,
      settlement_date: result.rows[0].settlement_date,
      custody_number: result.rows[0].custody_number,
      custody_date: result.rows[0].custody_date,
      custody_amount: result.rows[0].custody_amount,
      custody_remaining: result.rows[0].custody_remaining,
      custody_purpose: result.rows[0].custody_purpose,
      employee_name: result.rows[0].employee_name,
      employee_number: result.rows[0].employee_number,
      department_name: result.rows[0].department_name,
      
      created_by_name: ''
    };

    const items = result.rows.map(r => ({
      category_name: r.category_name || '-',
      category_code: '',
      cost_center_name: r.cost_center_name || '-',
      cost_center_code: '',
      amount: parseFloat(r.amount || 0),
      description: r.description || '-',
      receipt_number: r.receipt_number || '-'
    }));

    const total_amount = items.reduce((sum, it) => sum + it.amount, 0);

    res.json({ header, items, total_amount });
  } catch (err) {
    console.error('Settlement detail FULL ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message, detail: err.stack });
  }
});

// 📊 تقرير العهد المفتوحة المتأخرة (لم تُسوَّى بعد)
router.get('/outstanding', verifyToken, async (req, res) => {
  const minDays = parseInt(req.query.min_days) || 0;
  try {
    const result = await pool.query(`
      SELECT
        c.id, c.custody_number, c.custody_date, c.amount, c.remaining_amount,
        c.settled_amount, c.status, c.party_type,
        COALESCE(c.employee_name, c.supplier_name, c.party_name) as holder_name,
        c.shipment_id, s.shipment_number,
        (CURRENT_DATE - c.custody_date) as days_open
      FROM custodies c
      LEFT JOIN shipments s ON c.shipment_id = s.id
      WHERE c.status IN ('active', 'partially_settled')
        AND (CURRENT_DATE - c.custody_date) >= $1
      ORDER BY days_open DESC
    `, [minDays]);

    const buckets = { '0_15': [], '16_30': [], '31_60': [], over_60: [] };
    for (const row of result.rows) {
      const days = row.days_open;
      if (days <= 15) buckets['0_15'].push(row);
      else if (days <= 30) buckets['16_30'].push(row);
      else if (days <= 60) buckets['31_60'].push(row);
      else buckets.over_60.push(row);
    }

    res.json({
      success: true,
      generated_at: new Date().toISOString(),
      total_outstanding: result.rows.reduce((sum, r) => sum + (parseFloat(r.remaining_amount) || 0), 0),
      count: result.rows.length,
      linked_to_shipment_count: result.rows.filter(r => r.shipment_id).length,
      buckets
    });
  } catch (err) {
    console.error('[GET /outstanding] Error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;