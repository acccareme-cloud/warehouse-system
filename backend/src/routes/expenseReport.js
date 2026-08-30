const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');

// ============================================
// Helper functions
// ============================================
async function tableExists(tableName) {
  try {
    const result = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`, [tableName]
    );
    return result.rows[0].exists;
  } catch (err) { return false; }
}

async function columnExists(tableName, columnName) {
  try {
    const result = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1 
        AND column_name = $2
      )`, [tableName, columnName]
    );
    return result.rows[0].exists;
  } catch (err) { return false; }
}

// ============================================
// GET /api/expense-reports/expenses
// ============================================
router.get('/expenses', verifyToken, async (req, res) => {
  try {
    const hasExpenseCategories = await tableExists('expense_categories');
    const hasCustodySettlements = await tableExists('custody_settlements');

    let regularExpenses = [];
    let custodyExpenses = [];

    if (hasExpenseCategories) {
      const codeCol = await columnExists('expense_categories', 'category_code') ? 'category_code' : 'code';
      const nameCol = await columnExists('expense_categories', 'category_name') ? 'category_name' : 'name';
      const parentCol = await columnExists('expense_categories', 'parent_id') ? 'parent_id' : 'id';

      // Regular expenses - parents
      const regularQuery = `
        SELECT 
          id as parent_id,
          ${codeCol} as parent_code,
          ${nameCol} as parent_name,
          id as main_id,
          ${codeCol} as main_code,
          ${nameCol} as main_name,
          'regular' as source_type
        FROM expense_categories
        WHERE parent_id IS NULL
        ORDER BY ${codeCol}
      `;

      const regularResult = await pool.query(regularQuery);

      for (let parent of regularResult.rows) {
        const subQuery = `
          SELECT 
            id,
            ${codeCol} as code,
            ${nameCol} as name,
            parent_id
          FROM expense_categories
          WHERE parent_id = $1
          ORDER BY ${codeCol}
        `;
        const subResult = await pool.query(subQuery, [parent.parent_id]);
        parent.sub_categories = subResult.rows;
      }

      regularExpenses = regularResult.rows;

      // Custody expenses - from custody_settlements
      if (hasCustodySettlements) {
        const hasExpenseCategoryId = await columnExists('custody_settlements', 'expense_category_id');

        if (hasExpenseCategoryId) {
          const custodyQuery = `
            SELECT DISTINCT
              p.id as parent_id,
              p.${codeCol} as parent_code,
              p.${nameCol} as parent_name,
              p.id as main_id,
              p.${codeCol} as main_code,
              p.${nameCol} as main_name,
              'custody' as source_type
            FROM custody_settlements cs
            JOIN expense_categories c ON cs.expense_category_id = c.id
            JOIN expense_categories p ON c.parent_id = p.id
            ORDER BY p.${codeCol}
          `;

          const custodyResult = await pool.query(custodyQuery);

          for (let parent of custodyResult.rows) {
            const subQuery = `
              SELECT DISTINCT
                c.id,
                c.${codeCol} as code,
                c.${nameCol} as name,
                c.parent_id
              FROM custody_settlements cs
              JOIN expense_categories c ON cs.expense_category_id = c.id
              WHERE c.parent_id = $1
              ORDER BY c.${codeCol}
            `;
            const subResult = await pool.query(subQuery, [parent.parent_id]);
            parent.sub_categories = subResult.rows;
          }

          custodyExpenses = custodyResult.rows;
        }
      }
    }

    res.json({
      success: true,
      regular_expenses: regularExpenses,
      custody_expenses: custodyExpenses
    });
  } catch (err) {
    console.error('Error in /expenses:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message,
      regular_expenses: [],
      custody_expenses: []
    });
  }
});

// ============================================
// GET /api/expense-reports/cost-centers
// ============================================
router.get('/cost-centers', verifyToken, async (req, res) => {
  try {
    const hasCostCenters = await tableExists('cost_centers');
    if (!hasCostCenters) return res.json({ success: true, data: [] });

    const nameCol = await columnExists('cost_centers', 'center_name') ? 'center_name' : 
                   (await columnExists('cost_centers', 'name') ? 'name' : 'id');

    const result = await pool.query(
      `SELECT id, ${nameCol} as center_name FROM cost_centers ORDER BY id`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// GET /api/expense-reports/pivot
// ============================================
router.get('/pivot', verifyToken, async (req, res) => {
  const { from_date, to_date, expense_ids, custody_ids } = req.query;

  try {
    const expenseIds = expense_ids ? expense_ids.split(',').map(Number).filter(id => id > 0) : [];
    const custodyIds = custody_ids ? custody_ids.split(',').map(Number).filter(id => id > 0) : [];

    const hasCostCenters = await tableExists('cost_centers');
    const hasTreasury = await tableExists('treasury');
    const hasCustodySettlements = await tableExists('custody_settlements');
    const hasExpenseCategories = await tableExists('expense_categories');

    // Get cost centers
    let costCenters = [];
    if (hasCostCenters) {
      const nameCol = await columnExists('cost_centers', 'center_name') ? 'center_name' : 
                     (await columnExists('cost_centers', 'name') ? 'name' : 'id');
      const ccResult = await pool.query(
        `SELECT id, ${nameCol} as center_name FROM cost_centers ORDER BY id`
      );
      costCenters = ccResult.rows;
    }

    let allData = [];
    let grandTotal = 0;

    if (hasExpenseCategories) {
      const codeCol = await columnExists('expense_categories', 'category_code') ? 'category_code' : 'code';
      const nameCol = await columnExists('expense_categories', 'category_name') ? 'category_name' : 'name';

      // Regular expenses from treasury
      if (hasTreasury && expenseIds.length > 0) {
        try {
          const placeholders = expenseIds.map((_, i) => `$${i + 3}`).join(',');

          const query = `
            SELECT 
              t.cost_center_id,
              COALESCE(p.id, c.id) as parent_id,
              COALESCE(p.${nameCol}, c.${nameCol}) as parent_name,
              COALESCE(p.${codeCol}, c.${codeCol}) as parent_code,
              c.id as child_id,
              c.${nameCol} as child_name,
              c.${codeCol} as child_code,
              SUM(t.amount) as total_amount,
              COUNT(t.id) as transaction_count,
              'expense' as source_type
            FROM treasury t
            LEFT JOIN expense_categories c ON t.expense_category_id = c.id
            LEFT JOIN expense_categories p ON c.parent_id = p.id
            WHERE t.expense_category_id IN (${placeholders})
              AND t.transaction_date BETWEEN $1 AND $2
            GROUP BY t.cost_center_id, 
                     COALESCE(p.id, c.id), COALESCE(p.${nameCol}, c.${nameCol}), COALESCE(p.${codeCol}, c.${codeCol}),
                     c.id, c.${nameCol}, c.${codeCol}
          `;

          const result = await pool.query(query, [from_date, to_date, ...expenseIds]);
          allData = [...allData, ...result.rows];
        } catch (err) {
          console.log('Regular pivot query failed:', err.message);
        }
      }

      // Custody settlements
      if (hasCustodySettlements && custodyIds.length > 0) {
        try {
          const placeholders = custodyIds.map((_, i) => `$${i + 3}`).join(',');

          const query = `
            SELECT 
              cs.cost_center_id,
              COALESCE(p.id, c.id) as parent_id,
              COALESCE(p.${nameCol}, c.${nameCol}) as parent_name,
              COALESCE(p.${codeCol}, c.${codeCol}) as parent_code,
              c.id as child_id,
              c.${nameCol} as child_name,
              c.${codeCol} as child_code,
              SUM(cs.amount) as total_amount,
              COUNT(cs.id) as transaction_count,
              'custody' as source_type
            FROM custody_settlements cs
            LEFT JOIN expense_categories c ON cs.expense_category_id = c.id
            LEFT JOIN expense_categories p ON c.parent_id = p.id
            WHERE cs.expense_category_id IN (${placeholders})
              AND cs.settlement_date BETWEEN $1 AND $2
            GROUP BY cs.cost_center_id,
                     COALESCE(p.id, c.id), COALESCE(p.${nameCol}, c.${nameCol}), COALESCE(p.${codeCol}, c.${codeCol}),
                     c.id, c.${nameCol}, c.${codeCol}
          `;

          const result = await pool.query(query, [from_date, to_date, ...custodyIds]);
          allData = [...allData, ...result.rows];
        } catch (err) {
          console.log('Custody pivot query failed:', err.message);
        }
      }
    }

    grandTotal = allData.reduce((sum, row) => sum + parseFloat(row.total_amount || 0), 0);

    res.json({
      success: true,
      cost_centers: costCenters,
      pivot: allData,
      grand_total: grandTotal,
      from_date,
      to_date
    });

  } catch (err) {
    console.error('Error in /pivot:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message,
      cost_centers: [],
      pivot: [],
      grand_total: 0
    });
  }
});

// ============================================
// GET /api/expense-reports/detail
// ============================================
router.get('/detail', verifyToken, async (req, res) => {
  const { from_date, to_date, cost_center_id, child_id, source_type } = req.query;

  try {
    let data = [];
    let total = 0;

    if (source_type === 'custody') {
      const hasCustodySettlements = await tableExists('custody_settlements');
      if (hasCustodySettlements) {
        try {
          const query = `
            SELECT 
              cs.settlement_date as transaction_date,
              cs.settlement_number as transaction_number,
              cs.description,
              cs.amount,
              'تسوية عهدة' as source_type
            FROM custody_settlements cs
            WHERE cs.cost_center_id = $1 
              AND cs.expense_category_id = $2
              AND cs.settlement_date BETWEEN $3 AND $4
            ORDER BY cs.settlement_date DESC
          `;

          const result = await pool.query(query, [cost_center_id, child_id, from_date, to_date]);
          data = result.rows;
          total = data.reduce((sum, row) => sum + parseFloat(row.amount || 0), 0);
        } catch (err) {
          console.log('Custody detail query failed:', err.message);
        }
      }
    } else {
      const hasTreasury = await tableExists('treasury');
      if (hasTreasury) {
        try {
          const query = `
            SELECT 
              t.transaction_date,
              t.transaction_number,
              t.description,
              t.amount,
              'مصروف عادي' as source_type
            FROM treasury t
            WHERE t.cost_center_id = $1 
              AND t.expense_category_id = $2
              AND t.transaction_date BETWEEN $3 AND $4
            ORDER BY t.transaction_date DESC
          `;

          const result = await pool.query(query, [cost_center_id, child_id, from_date, to_date]);
          data = result.rows;
          total = data.reduce((sum, row) => sum + parseFloat(row.amount || 0), 0);
        } catch (err) {
          console.log('Treasury detail query failed:', err.message);
        }
      }
    }

    res.json({
      success: true,
      data: data,
      total: total,
      source_type
    });

  } catch (err) {
    console.error('Error in /detail:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message,
      data: [],
      total: 0
    });
  }
});

// ============================================
// تقرير ضريبة القيمة المضافة (مدخلات + مخرجات = الصافي المستحق)
// ============================================
router.get('/vat-report', verifyToken, async (req, res) => {
  const { date_from, date_to } = req.query;
  const from = date_from || '2000-01-01';
  const to = date_to || '2100-01-01';

  try {
    // ── مدخلات: مصاريف الشحنات (VAT مدفوعة على الشحن/التخليص/عهدة المخلص) ──
    const shipmentExpensesVat = await pool.query(`
      SELECT COALESCE(SUM(vat_amount), 0) as total
      FROM shipment_expenses
      WHERE expense_date BETWEEN $1 AND $2 AND vat_amount > 0
    `, [from, to]);

    // ── مدخلات: الإفراج الجمركي (VAT 14% المحسوبة عند التخليص) ──
    const clearanceVat = await pool.query(`
      SELECT COALESCE(SUM(vat_14_amount), 0) as total
      FROM shipment_clearances
      WHERE clearance_date BETWEEN $1 AND $2
    `, [from, to]);

    // ── مدخلات: فواتير المشتريات (tax_14_percent بيخزن قيمة الـ VAT فعليًا مش النسبة) ──
    const purchasesVat = await pool.query(`
      SELECT COALESCE(SUM(tax_14_percent), 0) as total
      FROM purchases
      WHERE created_at::date BETWEEN $1 AND $2 AND has_vat = true AND status != 'cancelled'
    `, [from, to]);

    // ── مخرجات: الفواتير الضريبية الصادرة للعملاء ──
    const outputVat = await pool.query(`
      SELECT COALESCE(SUM(vat_amount), 0) as total
      FROM tax_invoices
      WHERE invoice_date BETWEEN $1 AND $2 AND status != 'cancelled'
    `, [from, to]);

    const inputTotal =
      parseFloat(shipmentExpensesVat.rows[0].total) +
      parseFloat(clearanceVat.rows[0].total) +
      parseFloat(purchasesVat.rows[0].total);
    const outputTotal = parseFloat(outputVat.rows[0].total);

    // ── تفصيل شهري (للمقارنة عبر الوقت) ──
    const monthlyResult = await pool.query(`
      WITH input_monthly AS (
        SELECT to_char(expense_date, 'YYYY-MM') as month, SUM(vat_amount) as amount
        FROM shipment_expenses WHERE expense_date BETWEEN $1 AND $2 AND vat_amount > 0
        GROUP BY 1
        UNION ALL
        SELECT to_char(clearance_date, 'YYYY-MM') as month, SUM(vat_14_amount) as amount
        FROM shipment_clearances WHERE clearance_date BETWEEN $1 AND $2
        GROUP BY 1
        UNION ALL
        SELECT to_char(created_at::date, 'YYYY-MM') as month, SUM(tax_14_percent) as amount
        FROM purchases WHERE created_at::date BETWEEN $1 AND $2 AND has_vat = true AND status != 'cancelled'
        GROUP BY 1
      ),
      output_monthly AS (
        SELECT to_char(invoice_date, 'YYYY-MM') as month, SUM(vat_amount) as amount
        FROM tax_invoices WHERE invoice_date BETWEEN $1 AND $2 AND status != 'cancelled'
        GROUP BY 1
      ),
      input_agg AS (
        SELECT month, SUM(amount) as input_vat FROM input_monthly GROUP BY month
      )
      SELECT
        COALESCE(i.month, o.month) as month,
        COALESCE(i.input_vat, 0) as input_vat,
        COALESCE(o.amount, 0) as output_vat,
        COALESCE(o.amount, 0) - COALESCE(i.input_vat, 0) as net_due
      FROM input_agg i
      FULL OUTER JOIN output_monthly o ON i.month = o.month
      ORDER BY 1
    `, [from, to]);

    res.json({
      success: true,
      period: { from, to },
      summary: {
        input_vat: {
          shipment_expenses: parseFloat(shipmentExpensesVat.rows[0].total),
          shipment_clearances: parseFloat(clearanceVat.rows[0].total),
          purchases: parseFloat(purchasesVat.rows[0].total),
          total: inputTotal
        },
        output_vat: {
          tax_invoices: outputTotal,
          total: outputTotal
        },
        net_due: outputTotal - inputTotal // موجب = مستحق للمصلحة | سالب = قابل للاسترداد
      },
      monthly: monthlyResult.rows
    });
  } catch (err) {
    console.error('[GET /vat-report] Error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// تفصيل بنود VAT المدخلات لفترة معينة (للنزول من الملخص لمستوى المستند)
router.get('/vat-report/input-detail', verifyToken, async (req, res) => {
  const { date_from, date_to } = req.query;
  const from = date_from || '2000-01-01';
  const to = date_to || '2100-01-01';
  try {
    const result = await pool.query(`
      SELECT 'shipment_expense' as source, se.id, se.expense_date as date, se.expense_type as description,
        se.vat_amount as vat, s.shipment_number
      FROM shipment_expenses se
      LEFT JOIN shipments s ON se.shipment_id = s.id
      WHERE se.expense_date BETWEEN $1 AND $2 AND se.vat_amount > 0
      UNION ALL
      SELECT 'shipment_clearance' as source, sc.id, sc.clearance_date as date, sc.clearance_number as description,
        sc.vat_14_amount as vat, s.shipment_number
      FROM shipment_clearances sc
      LEFT JOIN shipments s ON sc.shipment_id = s.id
      WHERE sc.clearance_date BETWEEN $1 AND $2 AND sc.vat_14_amount > 0
      UNION ALL
      SELECT 'purchase' as source, p.id, p.created_at::date as date, p.purchase_number as description,
        p.tax_14_percent as vat, s.shipment_number
      FROM purchases p
      LEFT JOIN shipments s ON p.shipment_id = s.id
      WHERE p.created_at::date BETWEEN $1 AND $2 AND p.has_vat = true AND p.status != 'cancelled' AND p.tax_14_percent > 0
      ORDER BY date DESC
    `, [from, to]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[GET /vat-report/input-detail] Error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;
