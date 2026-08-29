// ============================================
// routes/supplierReports.js - تقارير الموردين
// ============================================
const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// 📊 التقرير الأول: كشف حساب المورد (حركة تفصيلية)
router.get('/ledger', verifyToken, async (req, res) => {
  const { supplier_id, from_date, to_date } = req.query;

  try {
    // 1. نجيب الرصيد الافتتاحي (قبل من التاريخ)
    const openingResult = await pool.query(`
      SELECT 
        COALESCE(SUM(debit), 0) as total_debit,
        COALESCE(SUM(credit), 0) as total_credit
      FROM supplier_ledger
      WHERE supplier_id = $1 AND transaction_date < $2
    `, [supplier_id, from_date]);

    const openingDebit = parseFloat(openingResult.rows[0].total_debit);
    const openingCredit = parseFloat(openingResult.rows[0].total_credit);
    const openingBalance = openingDebit - openingCredit; // علينا - مدفوعاتنا

    // 2. نجيب الحركات في الفترة
    const transactionsResult = await pool.query(`
      SELECT 
        sl.*,
        s.name as supplier_name,
        s.code as supplier_code
      FROM supplier_ledger sl
      JOIN suppliers s ON sl.supplier_id = s.id
      WHERE sl.supplier_id = $1 
        AND sl.transaction_date BETWEEN $2 AND $3
      ORDER BY sl.transaction_date, sl.id
    `, [supplier_id, from_date, to_date]);

    // 3. نحسب الرصيد التراكمي
    let runningBalance = openingBalance;
    const transactions = transactionsResult.rows.map(t => {
      runningBalance += (parseFloat(t.debit) - parseFloat(t.credit));
      return {
        ...t,
        running_balance: runningBalance
      };
    });

    // 4. نجيب ملخص الفترة
    const summaryResult = await pool.query(`
      SELECT 
        COALESCE(SUM(debit), 0) as total_debit,
        COALESCE(SUM(credit), 0) as total_credit
      FROM supplier_ledger
      WHERE supplier_id = $1 
        AND transaction_date BETWEEN $2 AND $3
    `, [supplier_id, from_date, to_date]);

    const periodDebit = parseFloat(summaryResult.rows[0].total_debit);
    const periodCredit = parseFloat(summaryResult.rows[0].total_credit);
    const closingBalance = openingBalance + periodDebit - periodCredit;

    res.json({
      supplier: transactionsResult.rows[0]?.supplier_name || '',
      supplier_code: transactionsResult.rows[0]?.supplier_code || '',
      from_date,
      to_date,
      opening_balance: openingBalance,
      transactions,
      summary: {
        period_debit: periodDebit,      // إجمالي الفواتير
        period_credit: periodCredit,     // إجمالي المدفوعات
        closing_balance: closingBalance  // الرصيد الحالي
      }
    });

  } catch (err) {
    console.error('Error fetching supplier ledger:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// 📊 التقرير الثاني: أرصدة الموردين (ملخص)
router.get('/balances', verifyToken, async (req, res) => {
  const { from_date, to_date } = req.query;

  try {
    const result = await pool.query(`
      WITH opening_balances AS (
        -- الرصيد الافتتاحي (قبل من التاريخ)
        SELECT 
          s.id as supplier_id,
          s.name as supplier_name,
          s.code as supplier_code,
          COALESCE(SUM(sl.debit), 0) - COALESCE(SUM(sl.credit), 0) as opening_balance
        FROM suppliers s
        LEFT JOIN supplier_ledger sl ON s.id = sl.supplier_id 
          AND sl.transaction_date < $1
        WHERE s.is_active = true
        GROUP BY s.id, s.name, s.code
      ),
      period_movements AS (
        -- حركات الفترة
        SELECT 
          sl.supplier_id,
          COALESCE(SUM(sl.debit), 0) as total_debit,
          COALESCE(SUM(sl.credit), 0) as total_credit
        FROM supplier_ledger sl
        WHERE sl.transaction_date BETWEEN $1 AND $2
        GROUP BY sl.supplier_id
      )
      SELECT 
        ob.supplier_id,
        ob.supplier_name,
        ob.supplier_code,
        ob.opening_balance,
        COALESCE(pm.total_debit, 0) as total_invoices,    -- إجمالي الفواتير
        COALESCE(pm.total_credit, 0) as total_payments,    -- إجمالي المدفوعات
        ob.opening_balance + COALESCE(pm.total_debit, 0) - COALESCE(pm.total_credit, 0) as closing_balance
      FROM opening_balances ob
      LEFT JOIN period_movements pm ON ob.supplier_id = pm.supplier_id
      ORDER BY ob.supplier_name
    `, [from_date, to_date]);

    // ملخص الكل
    const summary = result.rows.reduce((acc, row) => ({
      total_opening: acc.total_opening + parseFloat(row.opening_balance),
      total_invoices: acc.total_invoices + parseFloat(row.total_invoices),
      total_payments: acc.total_payments + parseFloat(row.total_payments),
      total_closing: acc.total_closing + parseFloat(row.closing_balance)
    }), { total_opening: 0, total_invoices: 0, total_payments: 0, total_closing: 0 });

    res.json({
      from_date,
      to_date,
      suppliers: result.rows,
      summary
    });

  } catch (err) {
    console.error('Error fetching supplier balances:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// 📝 إضافة حركة في دفتر الاستاذ (يستخدم من purchases.js و payments.js)
router.post('/ledger-entry', verifyToken, async (req, res) => {
  const {
    supplier_id, transaction_type, reference_type, reference_id,
    reference_number, debit, credit, notes, transaction_date
  } = req.body;

  try {
    // ═══ FIX: supplier_ledger مالوش عمود supplier_name ═══
    const result = await pool.query(`
      INSERT INTO supplier_ledger (
        supplier_id, transaction_date, transaction_type, reference_type,
        reference_id, reference_number, debit, credit, balance, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 
        (SELECT COALESCE(balance, 0) FROM supplier_ledger WHERE supplier_id = $1 ORDER BY id DESC LIMIT 1) + $7 - $8,
        $9, $10)
      RETURNING *
    `, [
      supplier_id, transaction_date || new Date(), transaction_type, reference_type,
      reference_id, reference_number, debit || 0, credit || 0, notes,
      req.user.id
    ]);

    // نحدث رصيد المورد في جدول suppliers
    await pool.query(`
      UPDATE suppliers 
      SET balance = (
        SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0)
        FROM supplier_ledger WHERE supplier_id = $1
      )
      WHERE id = $1
    `, [supplier_id]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding ledger entry:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// 📊 التقرير الثالث: تقرير الأصناف (مورد و/أو صنف خلال فترة)
router.get('/items-report', verifyToken, async (req, res) => {
  const { supplier_id, item_id, from_date, to_date } = req.query;

  if (!from_date || !to_date) {
    return res.status(400).json({ message: 'يرجى تحديد الفترة' });
  }
  if (!supplier_id && !item_id) {
    return res.status(400).json({ message: 'يرجى اختيار مورد أو صنف على الأقل' });
  }

  try {
    // نبني شروط الفلترة ديناميكيًا
    const conditions = [`p.status NOT IN ('draft', 'cancelled', 'rejected')`];
    const params = [];

    conditions.push(`p.created_at::date BETWEEN $${params.length + 1} AND $${params.length + 2}`);
    params.push(from_date, to_date);

    if (supplier_id) {
      conditions.push(`s.id = $${params.length + 1}`);
      params.push(supplier_id);
    }
    if (item_id) {
      conditions.push(`i.id = $${params.length + 1}`);
      params.push(item_id);
    }

    const whereClause = conditions.join(' AND ');

    // 1. الحركة التفصيلية
    const transactionsResult = await pool.query(`
      SELECT 
        pi.id as transaction_id,
        p.created_at as purchase_date,
        p.purchase_number,
        p.status,
        s.id as supplier_id,
        s.code as supplier_code,
        s.name as supplier_name,
        i.id as item_id,
        i.code as item_code,
        i.name as item_name,
        pi.quantity,
        pi.unit,
        pi.unit_price,
        pi.total_amount
      FROM purchase_items pi
      JOIN purchases p ON pi.purchase_id = p.id
      JOIN items i ON pi.item_id = i.id
      LEFT JOIN suppliers s ON p.supplier = s.name
      WHERE ${whereClause}
      ORDER BY p.created_at, p.id
    `, params);

    const transactions = transactionsResult.rows;

    // 2. الإجمالي حسب الصنف (مفيد لو اخترنا مورد بس، أو صنف بس)
    const summaryByItemMap = {};
    // 3. الإجمالي حسب المورد (مفيد لو اخترنا صنف بس بدون مورد)
    const summaryBySupplierMap = {};

    for (const t of transactions) {
      const qty = parseFloat(t.quantity) || 0;
      const amount = parseFloat(t.total_amount) || 0;

      const itemKey = t.item_id;
      if (!summaryByItemMap[itemKey]) {
        summaryByItemMap[itemKey] = {
          item_id: t.item_id,
          item_code: t.item_code,
          item_name: t.item_name,
          unit: t.unit,
          total_quantity: 0,
          total_amount: 0,
          transactions_count: 0
        };
      }
      summaryByItemMap[itemKey].total_quantity += qty;
      summaryByItemMap[itemKey].total_amount += amount;
      summaryByItemMap[itemKey].transactions_count += 1;

      const supplierKey = t.supplier_id || t.supplier_name || 'غير محدد';
      if (!summaryBySupplierMap[supplierKey]) {
        summaryBySupplierMap[supplierKey] = {
          supplier_id: t.supplier_id,
          supplier_code: t.supplier_code,
          supplier_name: t.supplier_name || 'غير محدد',
          total_quantity: 0,
          total_amount: 0,
          transactions_count: 0
        };
      }
      summaryBySupplierMap[supplierKey].total_quantity += qty;
      summaryBySupplierMap[supplierKey].total_amount += amount;
      summaryBySupplierMap[supplierKey].transactions_count += 1;
    }

    const summary = {
      total_quantity: transactions.reduce((sum, t) => sum + (parseFloat(t.quantity) || 0), 0),
      total_amount: transactions.reduce((sum, t) => sum + (parseFloat(t.total_amount) || 0), 0),
      transactions_count: transactions.length
    };

    res.json({
      from_date,
      to_date,
      filters: { supplier_id: supplier_id || null, item_id: item_id || null },
      transactions,
      summary_by_item: Object.values(summaryByItemMap),
      summary_by_supplier: Object.values(summaryBySupplierMap),
      summary
    });

  } catch (err) {
    console.error('Error fetching items report:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// 📦 أصناف مورد معين (للاستخدام في فلتر تقرير الأصناف)
router.get('/supplier-items', verifyToken, async (req, res) => {
  const { supplier_id } = req.query;

  if (!supplier_id) {
    return res.status(400).json({ message: 'يرجى تحديد المورد' });
  }

  try {
    const result = await pool.query(`
      SELECT DISTINCT i.id, i.code, i.name
      FROM purchase_items pi
      JOIN purchases p ON pi.purchase_id = p.id
      JOIN items i ON pi.item_id = i.id
      LEFT JOIN suppliers s ON p.supplier = s.name
      WHERE s.id = $1
        AND p.status NOT IN ('draft', 'cancelled', 'rejected')
      ORDER BY i.name
    `, [supplier_id]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching supplier items:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
