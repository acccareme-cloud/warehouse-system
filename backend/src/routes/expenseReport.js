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

module.exports = router;
