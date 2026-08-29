const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

// ============================================
// CUSTOMER BALANCE REPORT - تقرير أرصدة العملاء
// ============================================
router.get('/balance', verifyToken, async (req, res) => {
  const { search, customer_type, status } = req.query;

  try {
    let query = `
      SELECT 
        c.id,
        c.code,
        c.name,
        c.customer_type,
        c.status,
        c.phone,
        c.email,
        c.address,
        p.name as parent_name,
        COALESCE(
          (SELECT SUM(CASE WHEN ct.transaction_type = 'debit' THEN ct.amount ELSE -ct.amount END)
           FROM customer_transactions ct WHERE ct.customer_id = c.id), 0
        ) as balance,
        COALESCE(
          (SELECT SUM(si.total_amount) 
           FROM sales_invoices si WHERE si.customer_id = c.id AND si.status IN ('posted', 'draft', 'approved', 'quality_approved', 'approved_finance', 'pending', 'cancelled')), 0
        ) as total_sales,
        COALESCE(
          (SELECT COUNT(*) 
           FROM sales_invoices si WHERE si.customer_id = c.id AND si.status IN ('posted', 'draft', 'approved', 'quality_approved', 'approved_finance', 'pending', 'cancelled')), 0
        ) as invoices_count
      FROM customers c
      LEFT JOIN customers p ON c.parent_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (c.name ILIKE $${paramIndex} OR c.code ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (customer_type) {
      query += ` AND c.customer_type = $${paramIndex}`;
      params.push(customer_type);
      paramIndex++;
    }

    if (status) {
      query += ` AND c.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY c.name`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching balance report:', err);
    res.status(500).json({ error: 'فشل في جلب تقرير الأرصدة' });
  }
});

// ============================================
// HIERARCHY REPORT - تقرير الهيئة والفروع
// ============================================
router.get('/hierarchy', verifyToken, async (req, res) => {
  try {
    // جلب الهيئات
    const authoritiesResult = await pool.query(
      `SELECT 
        c.id,
        c.code,
        c.name,
        c.tax_number,
        c.phone,
        c.email,
        c.address,
        c.status,
        COALESCE(
          (SELECT SUM(si.total_amount) 
           FROM sales_invoices si WHERE si.customer_id = c.id AND si.status IN ('posted', 'draft', 'approved', 'quality_approved', 'approved_finance', 'pending', 'cancelled')), 0
        ) as direct_sales,
        COALESCE(
          (SELECT SUM(CASE WHEN ct.transaction_type = 'debit' THEN ct.amount ELSE -ct.amount END)
           FROM customer_transactions ct WHERE ct.customer_id = c.id), 0
        ) as direct_balance
      FROM customers c
      WHERE c.customer_type = 'authority'
      ORDER BY c.name`
    );

    const authorities = authoritiesResult.rows;

    // جلب الفروع لكل هيئة
    for (const authority of authorities) {
      const childrenResult = await pool.query(
        `SELECT 
          c.id,
          c.code,
          c.name,
          c.phone,
          c.email,
          c.address,
          c.status,
          COALESCE(
            (SELECT SUM(si.total_amount) 
             FROM sales_invoices si WHERE si.customer_id = c.id AND si.status IN ('posted', 'draft', 'approved', 'quality_approved', 'approved_finance', 'pending', 'cancelled')), 0
          ) as total_sales,
          COALESCE(
            (SELECT SUM(CASE WHEN ct.transaction_type = 'debit' THEN ct.amount ELSE -ct.amount END)
             FROM customer_transactions ct WHERE ct.customer_id = c.id), 0
          ) as balance
        FROM customers c
        WHERE c.parent_id = $1
        ORDER BY c.name`,
        [authority.id]
      );

      authority.children = childrenResult.rows;
      authority.children_count = childrenResult.rows.length;

      // حساب إجمالي مبيعات الفروع
      authority.children_sales = childrenResult.rows.reduce((sum, child) => sum + parseFloat(child.total_sales), 0);

      // حساب إجمالي رصيد الفروع
      authority.children_balance = childrenResult.rows.reduce((sum, child) => sum + parseFloat(child.balance), 0);

      // الإجمالي الكلي
      authority.total_sales = parseFloat(authority.direct_sales) + authority.children_sales;
      authority.total_balance = parseFloat(authority.direct_balance) + authority.children_balance;
    }

    res.json(authorities);
  } catch (err) {
    console.error('Error fetching hierarchy report:', err);
    res.status(500).json({ error: 'فشل في جلب تقرير الهرمية' });
  }
});

// ============================================
// CUSTOMER STATEMENT - كشف حساب عميل
// ============================================
router.get('/statement/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { from_date, to_date } = req.query;

  try {
    // جلب بيانات العميل
    const customerResult = await pool.query(
      `SELECT c.*, p.name as parent_name
      FROM customers c
      LEFT JOIN customers p ON c.parent_id = p.id
      WHERE c.id = $1`,
      [id]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'العميل غير موجود' });
    }

    const customer = customerResult.rows[0];

    // جلب الحركات
    let query = `
      SELECT 
        ct.id,
        ct.transaction_date,
        ct.transaction_type,
        ct.amount,
        ct.description,
        ct.reference_number,
        si.invoice_number,
        si.invoice_type,
        u.username as created_by_name
      FROM customer_transactions ct
      LEFT JOIN sales_invoices si ON ct.invoice_id = si.id
      LEFT JOIN users u ON ct.created_by = u.id
      WHERE ct.customer_id = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (from_date) {
      query += ` AND ct.transaction_date >= $${paramIndex}`;
      params.push(from_date);
      paramIndex++;
    }

    if (to_date) {
      query += ` AND ct.transaction_date <= $${paramIndex}`;
      params.push(to_date);
      paramIndex++;
    }

    query += ` ORDER BY ct.transaction_date, ct.id`;

    const transactionsResult = await pool.query(query, params);

    // حساب الرصيد التراكمي
    let runningBalance = 0;
    const transactions = transactionsResult.rows.map(t => {
      if (t.transaction_type === 'debit') {
        runningBalance += parseFloat(t.amount);
      } else {
        runningBalance -= parseFloat(t.amount);
      }
      return {
        ...t,
        balance: runningBalance
      };
    });

    // إجماليات
    const totalsResult = await pool.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE 0 END), 0) as total_debit,
        COALESCE(SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END), 0) as total_credit
      FROM customer_transactions WHERE customer_id = $1`,
      [id]
    );

    res.json({
      customer,
      transactions,
      summary: totalsResult.rows[0],
      final_balance: runningBalance
    });
  } catch (err) {
    console.error('Error fetching statement:', err);
    res.status(500).json({ error: 'فشل في جلب كشف الحساب' });
  }
});

// ============================================
// SALES BY CUSTOMER - مبيعات العملاء
// ============================================
router.get('/sales-by-customer', verifyToken, async (req, res) => {
  const { from_date, to_date, customer_type } = req.query;

  try {
    let query = `
      SELECT 
        c.id,
        c.code,
        c.name,
        c.customer_type,
        p.name as parent_name,
        COUNT(si.id) as invoices_count,
        COALESCE(SUM(si.subtotal), 0) as total_subtotal,
        COALESCE(SUM(si.discount_amount), 0) as total_discount,
        COALESCE(SUM(si.tax_amount), 0) as total_tax,
        COALESCE(SUM(si.total_amount), 0) as total_amount
      FROM customers c
      LEFT JOIN sales_invoices si ON c.id = si.customer_id AND si.status IN ('posted', 'draft', 'approved', 'quality_approved', 'approved_finance', 'pending', 'cancelled')
      LEFT JOIN customers p ON c.parent_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (from_date) {
      query += ` AND si.invoice_date >= $${paramIndex}`;
      params.push(from_date);
      paramIndex++;
    }

    if (to_date) {
      query += ` AND si.invoice_date <= $${paramIndex}`;
      params.push(to_date);
      paramIndex++;
    }

    if (customer_type) {
      query += ` AND c.customer_type = $${paramIndex}`;
      params.push(customer_type);
      paramIndex++;
    }

    query += ` GROUP BY c.id, c.code, c.name, c.customer_type, p.name ORDER BY total_amount DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching sales by customer:', err);
    res.status(500).json({ error: 'فشل في جلب تقرير المبيعات' });
  }
});

// ============================================
// AGING REPORT - تقرير تقادم الديون
// ============================================
router.get('/aging', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        c.id,
        c.code,
        c.name,
        c.customer_type,
        p.name as parent_name,
        COALESCE(
          (SELECT SUM(CASE WHEN ct.transaction_type = 'debit' THEN ct.amount ELSE -ct.amount END)
           FROM customer_transactions ct WHERE ct.customer_id = c.id), 0
        ) as total_balance,
        COALESCE(
          (SELECT SUM(CASE WHEN ct.transaction_type = 'debit' THEN ct.amount ELSE -ct.amount END)
           FROM customer_transactions ct 
           WHERE ct.customer_id = c.id 
           AND ct.transaction_date > CURRENT_DATE - INTERVAL '30 days'), 0
        ) as current_0_30,
        COALESCE(
          (SELECT SUM(CASE WHEN ct.transaction_type = 'debit' THEN ct.amount ELSE -ct.amount END)
           FROM customer_transactions ct 
           WHERE ct.customer_id = c.id 
           AND ct.transaction_date BETWEEN CURRENT_DATE - INTERVAL '60 days' AND CURRENT_DATE - INTERVAL '30 days'), 0
        ) as days_31_60,
        COALESCE(
          (SELECT SUM(CASE WHEN ct.transaction_type = 'debit' THEN ct.amount ELSE -ct.amount END)
           FROM customer_transactions ct 
           WHERE ct.customer_id = c.id 
           AND ct.transaction_date BETWEEN CURRENT_DATE - INTERVAL '90 days' AND CURRENT_DATE - INTERVAL '60 days'), 0
        ) as days_61_90,
        COALESCE(
          (SELECT SUM(CASE WHEN ct.transaction_type = 'debit' THEN ct.amount ELSE -ct.amount END)
           FROM customer_transactions ct 
           WHERE ct.customer_id = c.id 
           AND ct.transaction_date < CURRENT_DATE - INTERVAL '90 days'), 0
        ) as over_90
      FROM customers c
      LEFT JOIN customers p ON c.parent_id = p.id
      WHERE c.status = 'active'
      ORDER BY total_balance DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching aging report:', err);
    res.status(500).json({ error: 'فشل في جلب تقرير التقادم' });
  }
});

module.exports = router;
