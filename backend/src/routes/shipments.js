const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// SHIPMENTS API - Final Version with Customs Expenses Linking
// ═══════════════════════════════════════════════════════════════

// GET /shipments/next-number
router.get('/next-number', verifyToken, async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const gapResult = await pool.query(
      `SELECT t1.shipment_number + 1 as next_num
       FROM shipments t1
       WHERE t1.shipment_year = $1
         AND t1.status != 'cancelled'
         AND NOT EXISTS (
           SELECT 1 FROM shipments t2 
           WHERE t2.shipment_number = t1.shipment_number + 1 
           AND t2.shipment_year = $1
           AND t2.status != 'cancelled'
         )
       ORDER BY t1.shipment_number
       LIMIT 1`,
      [year]
    );
    if (gapResult.rows.length > 0 && gapResult.rows[0].next_num > 0) {
      return res.json({ nextNumber: gapResult.rows[0].next_num });
    }
    const maxResult = await pool.query(
      `SELECT COALESCE(MAX(shipment_number), 0) + 1 as next_num 
       FROM shipments 
       WHERE shipment_year = $1 AND status != 'cancelled'`,
      [year]
    );
    res.json({ nextNumber: maxResult.rows[0].next_num });
  } catch (err) {
    console.error('[GET /next-number] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /shipments
router.get('/', verifyToken, async (req, res) => {
  const { year, status, type } = req.query;
  try {
    let query = `
      SELECT s.*, sup.name as supplier_name, p.purchase_number, u.full_name as created_by_name
      FROM shipments s
      LEFT JOIN suppliers sup ON s.supplier_id = sup.id
      LEFT JOIN purchases p ON s.purchase_id = p.id
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.status != 'cancelled'
    `;
    const params = [];
    if (year) { params.push(year); query += ` AND s.shipment_year = $${params.length}`; }
    if (status) { params.push(status); query += ` AND s.status = $${params.length}`; }
    if (type) { params.push(type); query += ` AND s.shipment_type = $${params.length}`; }
    query += ` ORDER BY s.shipment_year DESC, s.shipment_number DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /shipments] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /shipments/:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const shipmentResult = await pool.query(
      `SELECT s.*, sup.name as supplier_name, p.purchase_number, p.total_amount as purchase_total, p.exchange_rate as purchase_exchange_rate, p.purchase_type, u.full_name as created_by_name
      FROM shipments s
      LEFT JOIN suppliers sup ON s.supplier_id = sup.id
      LEFT JOIN purchases p ON s.purchase_id = p.id
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = $1`, [req.params.id]
    );
    if (shipmentResult.rows.length === 0) return res.status(404).json({ message: 'الشحنة غير موجودة' });
    const shipment = shipmentResult.rows[0];

    const expensesResult = await pool.query(
      `SELECT se.*, t.transaction_number as treasury_number, c.custody_number, ba.account_name as bank_account_name, ec.category_name as category_name, sup.name as supplier_name
      FROM shipment_expenses se
      LEFT JOIN treasury t ON se.treasury_id = t.id
      LEFT JOIN custodies c ON se.custody_id = c.id
      LEFT JOIN bank_accounts ba ON se.bank_account_id = ba.id
      LEFT JOIN expense_categories ec ON se.expense_category_id = ec.id
      LEFT JOIN suppliers sup ON se.supplier_id = sup.id
      WHERE se.shipment_id = $1 ORDER BY se.expense_date`, [req.params.id]
    );

    const clearanceResult = await pool.query(
      `SELECT * FROM shipment_clearances WHERE shipment_id = $1`, [req.params.id]
    );

    const attachmentsResult = await pool.query(
      `SELECT sa.*, u.full_name as uploaded_by_name
      FROM shipment_attachments sa
      LEFT JOIN users u ON sa.uploaded_by = u.id
      WHERE sa.shipment_id = $1`, [req.params.id]
    );

    let itemsResult = { rows: [] };
    if (shipment.purchase_id) {
      itemsResult = await pool.query(
        `SELECT pi.*, i.name as item_name, i.code as item_code
        FROM purchase_items pi
        LEFT JOIN items i ON pi.item_id = i.id
        WHERE pi.purchase_id = $1`, [shipment.purchase_id]
      );
    }

    // حساب التكلفة النهائية
    const costCalculation = await calculateLandedCost(req.params.id, pool);

    const response = { 
      ...shipment, 
      expenses: expensesResult.rows, 
      clearances: clearanceResult.rows, 
      attachments: attachmentsResult.rows, 
      items: itemsResult.rows,
      cost_calculation: costCalculation
    };
    res.json(response);
  } catch (err) {
    console.error(`[GET /shipments/${req.params.id}] ERROR:`, err);
    res.status(500).json({ message: 'Server error', error: err.message, stack: err.stack });
  }
});

// ═══════════════════════════════════════════════════════════════
// Helper: حساب التكلفة النهائية (Landed Cost)
// ═══════════════════════════════════════════════════════════════
async function calculateLandedCost(shipmentId, dbPool) {
  try {
    const shipmentResult = await dbPool.query(
      `SELECT s.*, p.total_amount as purchase_total, p.exchange_rate as purchase_exchange_rate, p.purchase_type
       FROM shipments s 
       LEFT JOIN purchases p ON s.purchase_id = p.id 
       WHERE s.id = $1`,
      [shipmentId]
    );
    if (shipmentResult.rows.length === 0) return null;
    const shipment = shipmentResult.rows[0];
    if (!shipment.purchase_id) return null;

    const invoiceValueUsd = parseFloat(shipment.purchase_total) || 0;
    const bankExchangeRate = parseFloat(shipment.purchase_exchange_rate) || 0;

    // كل المصاريف المربوطة بالشحنة
    const expensesResult = await dbPool.query(
      `SELECT 
        COALESCE(SUM(total_egp), 0) as total_expenses,
        COALESCE(SUM(CASE WHEN paid_by = 'company' THEN total_egp ELSE 0 END), 0) as company_expenses,
        COALESCE(SUM(CASE WHEN paid_by = 'custodian' THEN total_egp ELSE 0 END), 0) as custodian_expenses,
        COALESCE(SUM(CASE WHEN expense_type IN ('سداد مورد', 'bank_payment', 'تحويل بنكي') THEN total_egp ELSE 0 END), 0) as bank_payments,
        COALESCE(SUM(CASE WHEN expense_type IN ('customs', 'clearance', 'تخليص') THEN total_egp ELSE 0 END), 0) as clearance_expenses,
        COALESCE(SUM(CASE WHEN expense_type IN ('shipping', 'شحن') THEN total_egp ELSE 0 END), 0) as shipping_expenses,
        COALESCE(SUM(CASE WHEN expense_type IN ('bank_commission', 'عمولة بنك') THEN total_egp ELSE 0 END), 0) as bank_commission,
        COALESCE(SUM(CASE WHEN expense_type NOT IN ('سداد مورد', 'bank_payment', 'تحويل بنكي', 'customs', 'clearance', 'تخليص', 'shipping', 'شحن', 'bank_commission', 'عمولة بنك') THEN total_egp ELSE 0 END), 0) as other_expenses
      FROM shipment_expenses 
      WHERE shipment_id = $1 AND status = 'linked'`,
      [shipmentId]
    );

    const totalExpensesEgp = parseFloat(expensesResult.rows[0].total_expenses) || 0;
    const companyExpenses = parseFloat(expensesResult.rows[0].company_expenses) || 0;
    const custodianExpenses = parseFloat(expensesResult.rows[0].custodian_expenses) || 0;
    const bankPayments = parseFloat(expensesResult.rows[0].bank_payments) || 0;
    const clearanceExpenses = parseFloat(expensesResult.rows[0].clearance_expenses) || 0;
    const shippingExpenses = parseFloat(expensesResult.rows[0].shipping_expenses) || 0;
    const bankCommission = parseFloat(expensesResult.rows[0].bank_commission) || 0;
    const otherExpenses = parseFloat(expensesResult.rows[0].other_expenses) || 0;

    // ضرائب الإفراج الجمركي
    const clearanceResult = await dbPool.query(
      `SELECT COALESCE(SUM(total_taxes), 0) as total_clearance_taxes,
              COALESCE(SUM(customs_duty_total), 0) as total_customs_duty,
              COALESCE(SUM(vat_amount), 0) as total_vat,
              COALESCE(SUM(profit_tax_amount), 0) as total_profit_tax
       FROM shipment_clearances 
       WHERE shipment_id = $1`,
      [shipmentId]
    );
    const totalClearanceTaxes = parseFloat(clearanceResult.rows[0].total_clearance_taxes) || 0;
    const totalCustomsDuty = parseFloat(clearanceResult.rows[0].total_customs_duty) || 0;
    const totalVat = parseFloat(clearanceResult.rows[0].total_vat) || 0;
    const totalProfitTax = parseFloat(clearanceResult.rows[0].total_profit_tax) || 0;

    // إجمالي التكلفة
    const totalCostEgp = totalExpensesEgp + totalClearanceTaxes;

    // المعامل الفعلي
    let actualExchangeRate = 0;
    if (invoiceValueUsd > 0) {
      actualExchangeRate = totalCostEgp / invoiceValueUsd;
    }

    return {
      invoice_value_usd: invoiceValueUsd,
      bank_exchange_rate: bankExchangeRate,
      invoice_value_egp: invoiceValueUsd * bankExchangeRate,

      expenses: {
        total_expenses: totalExpensesEgp,
        company_expenses: companyExpenses,
        custodian_expenses: custodianExpenses,
        bank_payments: bankPayments,
        clearance_expenses: clearanceExpenses,
        shipping_expenses: shippingExpenses,
        bank_commission: bankCommission,
        other_expenses: otherExpenses
      },

      taxes: {
        total_clearance_taxes: totalClearanceTaxes,
        customs_duty: totalCustomsDuty,
        vat_14: totalVat,
        profit_tax_1: totalProfitTax
      },

      total_cost_egp: totalCostEgp,
      actual_exchange_rate: actualExchangeRate
    };
  } catch (err) {
    console.error('[calculateLandedCost] Error:', err);
    return null;
  }
}

// POST /shipments
router.post('/', verifyToken, requireRole('purchasing', 'admin', 'finance'), async (req, res) => {
  const { shipment_number, shipment_year, supplier_id, country_of_origin, shipping_method, expected_arrival, notes, shipment_type, is_dummy, dummy_for_user_id } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO shipments (shipment_number, shipment_year, supplier_id, country_of_origin, shipping_method, expected_arrival, status, notes, shipment_type, is_dummy, dummy_for_user_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8, $9, $10, $11) RETURNING *`,
      [shipment_number, shipment_year || new Date().getFullYear(), supplier_id || null, country_of_origin || null, shipping_method || null, expected_arrival || null, notes || null, shipment_type || 'commercial', is_dummy || false, dummy_for_user_id || null, req.user.id]
    );
    res.status(201).json({ message: 'تم إنشاء الشحنة بنجاح', data: result.rows[0] });
  } catch (err) {
    console.error('[POST /shipments] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /shipments/:id
router.put('/:id', verifyToken, requireRole('purchasing', 'admin', 'finance'), async (req, res) => {
  const { supplier_id, country_of_origin, shipping_method, expected_arrival, actual_arrival, status, notes, shipment_type, is_dummy, dummy_for_user_id } = req.body;
  try {
    const result = await pool.query(
      `UPDATE shipments SET supplier_id = $1, country_of_origin = $2, shipping_method = $3, expected_arrival = $4, actual_arrival = $5, status = $6, notes = $7, shipment_type = $8, is_dummy = $9, dummy_for_user_id = $10, updated_at = NOW() WHERE id = $11 RETURNING *`,
      [supplier_id || null, country_of_origin || null, shipping_method || null, expected_arrival || null, actual_arrival || null, status || 'open', notes || null, shipment_type || 'commercial', is_dummy || false, dummy_for_user_id || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'الشحنة غير موجودة' });
    res.json({ message: 'تم تحديث الشحنة', data: result.rows[0] });
  } catch (err) {
    console.error('[PUT /shipments/:id] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// EXPENSES (مصاريف الشحنة)
// ═══════════════════════════════════════════════════════════════

// POST /shipments/:id/expenses
router.post('/:id/expenses', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { 
    expense_date, expense_type, description, 
    amount_egp, amount_usd, amount_eur, amount_other, other_currency, 
    exchange_rate_usd, exchange_rate_eur, exchange_rate_other, 
    treasury_id, custody_id, bank_account_id, paid_by,
    has_tax_invoice, tax_invoice_number, tax_invoice_amount, 
    notes, is_dummy, expense_category_id, is_tax_only, supplier_id, payment_method 
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const egp = parseFloat(amount_egp) || 0;
    const usd = (parseFloat(amount_usd) || 0) * (parseFloat(exchange_rate_usd) || 0);
    const eur = (parseFloat(amount_eur) || 0) * (parseFloat(exchange_rate_eur) || 0);
    const other = (parseFloat(amount_other) || 0) * (parseFloat(exchange_rate_other) || 0);
    const total_egp = egp + usd + eur + other;

    const expenseResult = await client.query(
      `INSERT INTO shipment_expenses (
        shipment_id, expense_date, expense_type, description, 
        amount_egp, amount_usd, amount_eur, amount_other, other_currency, 
        exchange_rate_usd, exchange_rate_eur, exchange_rate_other, total_egp, 
        treasury_id, custody_id, bank_account_id, paid_by,
        has_tax_invoice, tax_invoice_number, tax_invoice_amount, 
        notes, is_dummy, expense_category_id, is_tax_only, supplier_id, payment_method, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28) RETURNING *`,
      [
        req.params.id, expense_date || new Date(), expense_type, description || null, 
        amount_egp || 0, amount_usd || 0, amount_eur || 0, amount_other || 0, other_currency || null, 
        exchange_rate_usd || 0, exchange_rate_eur || 0, exchange_rate_other || 0, total_egp, 
        treasury_id || null, custody_id || null, bank_account_id || null, paid_by || 'company',
        has_tax_invoice || false, tax_invoice_number || null, tax_invoice_amount || null, 
        notes || null, is_dummy || false, expense_category_id || null, is_tax_only || false, supplier_id || null, payment_method || 'cash', 'linked', req.user.id
      ]
    );

    if (treasury_id) await client.query(`UPDATE treasury SET shipment_id = $1 WHERE id = $2`, [req.params.id, treasury_id]);
    if (custody_id) await client.query(`UPDATE custodies SET shipment_id = $1 WHERE id = $2`, [req.params.id, custody_id]);
    if (bank_account_id) await client.query(`UPDATE bank_accounts SET last_used = NOW() WHERE id = $1`, [bank_account_id]);

    await client.query('COMMIT');
    res.status(201).json({ message: 'تم إضافة المصروف بنجاح', data: expenseResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /expenses] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally { client.release(); }
});

// PUT /shipments/:id/expenses/:expenseId
router.put('/:id/expenses/:expenseId', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { 
    expense_date, expense_type, description, 
    amount_egp, amount_usd, amount_eur, amount_other, other_currency, 
    exchange_rate_usd, exchange_rate_eur, exchange_rate_other, 
    treasury_id, custody_id, bank_account_id, paid_by,
    has_tax_invoice, tax_invoice_number, tax_invoice_amount, 
    notes, is_dummy, expense_category_id, is_tax_only, supplier_id, payment_method 
  } = req.body;

  try {
    const egp = parseFloat(amount_egp) || 0;
    const usd = (parseFloat(amount_usd) || 0) * (parseFloat(exchange_rate_usd) || 0);
    const eur = (parseFloat(amount_eur) || 0) * (parseFloat(exchange_rate_eur) || 0);
    const other = (parseFloat(amount_other) || 0) * (parseFloat(exchange_rate_other) || 0);
    const total_egp = egp + usd + eur + other;

    const result = await pool.query(
      `UPDATE shipment_expenses SET 
        expense_date = $1, expense_type = $2, description = $3, 
        amount_egp = $4, amount_usd = $5, amount_eur = $6, amount_other = $7, other_currency = $8, 
        exchange_rate_usd = $9, exchange_rate_eur = $10, exchange_rate_other = $11, total_egp = $12, 
        treasury_id = $13, custody_id = $14, bank_account_id = $15, paid_by = $16,
        has_tax_invoice = $17, tax_invoice_number = $18, tax_invoice_amount = $19, 
        notes = $20, is_dummy = $21, expense_category_id = $22, is_tax_only = $23, supplier_id = $24, payment_method = $25
      WHERE id = $26 AND shipment_id = $27 RETURNING *`,
      [
        expense_date, expense_type, description || null, 
        amount_egp || 0, amount_usd || 0, amount_eur || 0, amount_other || 0, other_currency || null, 
        exchange_rate_usd || 0, exchange_rate_eur || 0, exchange_rate_other || 0, total_egp, 
        treasury_id || null, custody_id || null, bank_account_id || null, paid_by || 'company',
        has_tax_invoice || false, tax_invoice_number || null, tax_invoice_amount || null, 
        notes || null, is_dummy || false, expense_category_id || null, is_tax_only || false, supplier_id || null, payment_method || 'cash', req.params.expenseId, req.params.id
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'المصروف غير موجود' });
    res.json({ message: 'تم تحديث المصروف', data: result.rows[0] });
  } catch (err) {
    console.error('[PUT /expenses] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /shipments/:id/expenses/:expenseId
router.delete('/:id/expenses/:expenseId', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(`DELETE FROM shipment_expenses WHERE id = $1 AND shipment_id = $2 RETURNING *`, [req.params.expenseId, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'المصروف غير موجود' });
    res.json({ message: 'تم حذف المصروف' });
  } catch (err) {
    console.error('[DELETE /expenses] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// AVAILABLE EXPENSES (المصاريف الجمركية المتاحة)
// ═══════════════════════════════════════════════════════════════

// GET /shipments/available-expenses
// بيجيب كل المصاريف الجمركية المتاحة (pending) اللي مش مربوطة بشحنة
router.get('/available-expenses', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT se.*, 
        t.transaction_number as treasury_number,
        c.custody_number,
        ba.account_name as bank_account_name,
        sup.name as supplier_name,
        ec.category_name as category_name
      FROM shipment_expenses se
      LEFT JOIN treasury t ON se.treasury_id = t.id
      LEFT JOIN custodies c ON se.custody_id = c.id
      LEFT JOIN bank_accounts ba ON se.bank_account_id = ba.id
      LEFT JOIN suppliers sup ON se.supplier_id = sup.id
      LEFT JOIN expense_categories ec ON se.expense_category_id = ec.id
      WHERE se.status = 'pending' 
        AND se.shipment_id IS NULL
        AND (se.expense_type IN ('customs', 'clearance', 'تخليص', 'shipping', 'شحن', 'bank_commission', 'عمولة بنك')
             OR se.has_tax_invoice = true)
      ORDER BY se.expense_date DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /available-expenses] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /shipments/:id/link-expenses
// بيربط مصاريف جمركية متاحة بالشحنة
router.post('/:id/link-expenses', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { expense_ids } = req.body;
  if (!expense_ids || !Array.isArray(expense_ids) || expense_ids.length === 0) {
    return res.status(400).json({ message: 'يجب اختيار مصاريف للربط' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // تأكد إن الشحنة موجودة
    const shipmentResult = await client.query(`SELECT id FROM shipments WHERE id = $1`, [req.params.id]);
    if (shipmentResult.rows.length === 0) throw new Error('الشحنة غير موجودة');

    const linkedExpenses = [];
    for (const expenseId of expense_ids) {
      // تأكد إن المصروف موجود ومتاح
      const expenseCheck = await client.query(
        `SELECT id, status, shipment_id FROM shipment_expenses WHERE id = $1`,
        [expenseId]
      );

      if (expenseCheck.rows.length === 0) {
        throw new Error(`المصروف #${expenseId} غير موجود`);
      }

      if (expenseCheck.rows[0].status === 'linked') {
        throw new Error(`المصروف #${expenseId} مربوط بشحنة أخرى`);
      }

      // ربط المصروف بالشحنة
      const result = await client.query(
        `UPDATE shipment_expenses 
         SET shipment_id = $1, status = 'linked', updated_at = NOW() 
         WHERE id = $2 AND status = 'pending' AND shipment_id IS NULL
         RETURNING *`,
        [req.params.id, expenseId]
      );

      if (result.rows.length > 0) {
        linkedExpenses.push(result.rows[0]);
      }
    }

    await client.query('COMMIT');
    res.json({ 
      message: `تم ربط ${linkedExpenses.length} مصروف بالشحنة بنجاح`,
      data: { linked_expenses: linkedExpenses }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /link-expenses] ERROR:', err);
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally { client.release(); }
});

// POST /shipments/:id/unlink-expenses
// بيفك ربط مصاريف من الشحنة (بيرجعهم pending)
router.post('/:id/unlink-expenses', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { expense_ids } = req.body;
  if (!expense_ids || !Array.isArray(expense_ids) || expense_ids.length === 0) {
    return res.status(400).json({ message: 'يجب اختيار مصاريف لفك الربط' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const unlinkedExpenses = [];
    for (const expenseId of expense_ids) {
      const result = await client.query(
        `UPDATE shipment_expenses 
         SET shipment_id = NULL, status = 'pending', updated_at = NOW() 
         WHERE id = $1 AND shipment_id = $2 AND status = 'linked'
         RETURNING *`,
        [expenseId, req.params.id]
      );

      if (result.rows.length > 0) {
        unlinkedExpenses.push(result.rows[0]);
      }
    }

    await client.query('COMMIT');
    res.json({ 
      message: `تم فك ربط ${unlinkedExpenses.length} مصروف من الشحنة`,
      data: { unlinked_expenses: unlinkedExpenses }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /unlink-expenses] ERROR:', err);
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally { client.release(); }
});

// ═══════════════════════════════════════════════════════════════
// CLEARANCE (إفراج جمركي)
// ═══════════════════════════════════════════════════════════════

// POST /shipments/:id/clearance
router.post('/:id/clearance', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { 
    clearance_number, clearance_date, declared_value, 
    customs_duty_rate, customs_duty_amount, 
    is_vat_exempt, is_profit_tax_exempt, 
    vat_rate, profit_tax_rate, 
    attachment_url, notes 
  } = req.body;

  try {
    let finalVatRate = vat_rate;
    let finalProfitTaxRate = profit_tax_rate;

    if (finalVatRate == null || finalProfitTaxRate == null) {
      const settingsResult = await pool.query('SELECT vat_rate, customs_profit_tax_rate FROM tax_settings ORDER BY id DESC LIMIT 1');
      const settings = settingsResult.rows[0] || {};
      if (finalVatRate == null) finalVatRate = settings.vat_rate || 14;
      if (finalProfitTaxRate == null) finalProfitTaxRate = settings.customs_profit_tax_rate || 1;
    }

    // حساب ضريبة الوارد
    let finalCustomsDuty = 0;
    if (customs_duty_amount && parseFloat(customs_duty_amount) > 0) {
      finalCustomsDuty = parseFloat(customs_duty_amount);
    } else if (customs_duty_rate && parseFloat(customs_duty_rate) > 0) {
      finalCustomsDuty = (parseFloat(declared_value || 0) * parseFloat(customs_duty_rate)) / 100;
    }

    // حساب الضرائب
    const valueAfterDuty = parseFloat(declared_value || 0) + finalCustomsDuty;
    const vatAmount = is_vat_exempt ? 0 : (valueAfterDuty * parseFloat(finalVatRate)) / 100;
    const profitTaxAmount = is_profit_tax_exempt ? 0 : (parseFloat(declared_value || 0) * parseFloat(finalProfitTaxRate)) / 100;
    const totalTaxes = finalCustomsDuty + vatAmount + profitTaxAmount;
    const finalReleaseValue = parseFloat(declared_value || 0) + totalTaxes;

    const result = await pool.query(
      `INSERT INTO shipment_clearances (
        shipment_id, clearance_number, clearance_date, declared_value, 
        customs_duty_rate, customs_duty_amount, customs_duty_total,
        is_vat_exempt, is_profit_tax_exempt, 
        vat_rate, profit_tax_rate, vat_amount, profit_tax_amount,
        total_taxes, final_release_value,
        attachment_url, notes, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`,
      [
        req.params.id, clearance_number, clearance_date || new Date(), declared_value || 0,
        customs_duty_rate || 0, customs_duty_amount || 0, finalCustomsDuty,
        is_vat_exempt || false, is_profit_tax_exempt || false,
        finalVatRate, finalProfitTaxRate, vatAmount, profitTaxAmount,
        totalTaxes, finalReleaseValue,
        attachment_url || null, notes || null, req.user.id
      ]
    );
    res.status(201).json({ message: 'تم إضافة الإفراج بنجاح', data: result.rows[0] });
  } catch (err) {
    console.error('[POST /clearance] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /shipments/:id/clearance/:clearanceId
router.put('/:id/clearance/:clearanceId', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { 
    clearance_number, clearance_date, declared_value, 
    customs_duty_rate, customs_duty_amount,
    is_vat_exempt, is_profit_tax_exempt, 
    vat_rate, profit_tax_rate, 
    attachment_url, notes 
  } = req.body;

  try {
    let finalCustomsDuty = 0;
    if (customs_duty_amount && parseFloat(customs_duty_amount) > 0) {
      finalCustomsDuty = parseFloat(customs_duty_amount);
    } else if (customs_duty_rate && parseFloat(customs_duty_rate) > 0) {
      finalCustomsDuty = (parseFloat(declared_value || 0) * parseFloat(customs_duty_rate)) / 100;
    }

    const valueAfterDuty = parseFloat(declared_value || 0) + finalCustomsDuty;
    const vatAmount = is_vat_exempt ? 0 : (valueAfterDuty * parseFloat(vat_rate || 14)) / 100;
    const profitTaxAmount = is_profit_tax_exempt ? 0 : (parseFloat(declared_value || 0) * parseFloat(profit_tax_rate || 1)) / 100;
    const totalTaxes = finalCustomsDuty + vatAmount + profitTaxAmount;
    const finalReleaseValue = parseFloat(declared_value || 0) + totalTaxes;

    const result = await pool.query(
      `UPDATE shipment_clearances SET 
        clearance_number = $1, clearance_date = $2, declared_value = $3,
        customs_duty_rate = $4, customs_duty_amount = $5, customs_duty_total = $6,
        is_vat_exempt = $7, is_profit_tax_exempt = $8,
        vat_rate = $9, profit_tax_rate = $10, vat_amount = $11, profit_tax_amount = $12,
        total_taxes = $13, final_release_value = $14,
        attachment_url = $15, notes = $16
      WHERE id = $17 AND shipment_id = $18 RETURNING *`,
      [
        clearance_number, clearance_date, declared_value || 0,
        customs_duty_rate || 0, customs_duty_amount || 0, finalCustomsDuty,
        is_vat_exempt || false, is_profit_tax_exempt || false,
        vat_rate || 14, profit_tax_rate || 1, vatAmount, profitTaxAmount,
        totalTaxes, finalReleaseValue,
        attachment_url, notes, req.params.clearanceId, req.params.id
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'الإفراج غير موجود' });
    res.json({ message: 'تم تحديث الإفراج', data: result.rows[0] });
  } catch (err) {
    console.error('[PUT /clearance] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /shipments/:id/clearance/:clearanceId
router.delete('/:id/clearance/:clearanceId', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(`DELETE FROM shipment_clearances WHERE id = $1 AND shipment_id = $2 RETURNING *`, [req.params.clearanceId, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'الإفراج غير موجود' });
    res.json({ message: 'تم حذف الإفراج' });
  } catch (err) {
    console.error('[DELETE /clearance] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// LINK INVOICE + COST
// ═══════════════════════════════════════════════════════════════

router.put('/:id/link-invoice', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { purchase_id, exchange_rate } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log(`[link-invoice] shipment=${req.params.id}, purchase=${purchase_id}`);

    const purchaseResult = await client.query(`SELECT * FROM purchases WHERE id = $1`, [purchase_id]);
    if (purchaseResult.rows.length === 0) throw new Error('الفاتورة غير موجودة');
    const purchase = purchaseResult.rows[0];

    const invoiceValueUsd = parseFloat(purchase.total_amount) || 0;
    const bankExchangeRate = parseFloat(exchange_rate) || parseFloat(purchase.exchange_rate) || 50;

    // حساب التكلفة
    const costCalculation = await calculateLandedCost(req.params.id, client);
    const totalCostEgp = costCalculation ? costCalculation.total_cost_egp : 0;
    let actualExchangeRate = 0;
    if (invoiceValueUsd > 0) {
      actualExchangeRate = totalCostEgp / invoiceValueUsd;
    }

    await client.query(
      `UPDATE shipments SET 
        purchase_id = $1, 
        invoice_number = $2,
        actual_exchange_rate = $3, 
        total_cost_egp = $4,
        status = 'linked' 
       WHERE id = $5`,
      [purchase_id, purchase.purchase_number, actualExchangeRate, totalCostEgp, req.params.id]
    );

    await client.query(`UPDATE purchases SET shipment_id = $1 WHERE id = $2`, [req.params.id, purchase_id]);
    await client.query('COMMIT');

    res.json({ 
      message: 'تم ربط الفاتورة بنجاح', 
      data: { 
        shipment_id: req.params.id, 
        purchase_id, 
        invoice_value_usd: invoiceValueUsd,
        bank_exchange_rate: bankExchangeRate,
        total_cost_egp: totalCostEgp,
        actual_exchange_rate: actualExchangeRate,
        cost_calculation: costCalculation
      } 
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[link-invoice] ERROR:', err);
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally { client.release(); }
});

// ═══════════════════════════════════════════════════════════════
// UNLINK INVOICE
// ═══════════════════════════════════════════════════════════════

router.put('/:id/unlink-invoice', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const shipmentResult = await client.query(`SELECT purchase_id FROM shipments WHERE id = $1`, [req.params.id]);
    if (shipmentResult.rows.length === 0) throw new Error('الشحنة غير موجودة');
    const oldPurchaseId = shipmentResult.rows[0].purchase_id;
    if (oldPurchaseId) {
      await client.query(`UPDATE purchases SET shipment_id = NULL WHERE id = $1`, [oldPurchaseId]);
    }
    await client.query(
      `UPDATE shipments SET 
        purchase_id = NULL, invoice_number = NULL,
        actual_exchange_rate = NULL, total_cost_egp = NULL,
        status = 'open' 
       WHERE id = $1`,
      [req.params.id]
    );
    await client.query('COMMIT');
    res.json({ message: 'تم فك ربط الفاتورة بنجاح', data: { shipment_id: req.params.id, unlinked_purchase_id: oldPurchaseId }});
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[unlink-invoice] ERROR:', err);
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally { client.release(); }
});

// ═══════════════════════════════════════════════════════════════
// CUSTODY SETTLEMENT (تسوية عهدة المخلص)
// ═══════════════════════════════════════════════════════════════

router.post('/:id/custody-settlement', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { custody_id, expenses } = req.body;
  if (!custody_id || !expenses || !Array.isArray(expenses) || expenses.length === 0) {
    return res.status(400).json({ message: 'بيانات غير كاملة: custody_id والمصاريف مطلوبة' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const custodyResult = await client.query(`SELECT * FROM custodies WHERE id = $1`, [custody_id]);
    if (custodyResult.rows.length === 0) throw new Error('العهدة غير موجودة');
    const custody = custodyResult.rows[0];
    if (custody.shipment_id && String(custody.shipment_id) !== String(req.params.id)) {
      throw new Error('العهدة مربوطة بشحنة أخرى');
    }

    let settlementTotal = 0;
    const insertedExpenses = [];

    for (const exp of expenses) {
      const egp = parseFloat(exp.amount_egp) || 0;
      const usd = (parseFloat(exp.amount_usd) || 0) * (parseFloat(exp.exchange_rate_usd) || 0);
      const total_egp = egp + usd;
      settlementTotal += total_egp;

      const expenseResult = await client.query(
        `INSERT INTO shipment_expenses (
          shipment_id, expense_date, expense_type, description,
          amount_egp, amount_usd, exchange_rate_usd, total_egp,
          custody_id, paid_by, has_tax_invoice, tax_invoice_number, tax_invoice_amount,
          vat_rate, withholding_rate, vat_amount, withholding_amount, net_amount,
          notes, payment_method, created_by, expense_category_id, is_tax_only, is_dummy, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
        RETURNING *`,
        [
          req.params.id, exp.expense_date || new Date(), exp.expense_type, exp.description || null,
          exp.amount_egp || 0, exp.amount_usd || 0, exp.exchange_rate_usd || 0, total_egp,
          custody_id, 'custodian', exp.has_tax_invoice || false, exp.tax_invoice_number || null, exp.tax_invoice_amount || null,
          exp.vat_rate || 0, exp.withholding_rate || 0, exp.vat_amount || 0, exp.withholding_amount || 0,
          exp.net_amount || total_egp, exp.notes || null, exp.payment_method || 'cash',
          req.user.id, exp.expense_category_id || null, exp.is_tax_only || false, exp.is_dummy || false, 'linked'
        ]
      );
      insertedExpenses.push(expenseResult.rows[0]);
    }

    const newSettled = parseFloat(custody.settled_amount || 0) + settlementTotal;
    const newRemaining = parseFloat(custody.amount || 0) - newSettled;
    let newStatus = 'active';
    if (newRemaining <= 0) newStatus = 'fully_settled';
    else if (newSettled > 0) newStatus = 'partially_settled';

    await client.query(
      `UPDATE custodies SET settled_amount = $1, remaining_amount = $2, status = $3, updated_at = NOW() WHERE id = $4`,
      [newSettled, newRemaining, newStatus, custody_id]
    );

    // تسجيل التسوية في جدول custody_settlements
    await client.query(
      `INSERT INTO custody_settlements (custody_id, shipment_id, settlement_date, total_expenses, custody_amount, difference, settlement_type, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        custody_id, req.params.id, new Date(), settlementTotal, parseFloat(custody.amount || 0),
        newRemaining, newRemaining > 0 ? 'refund' : newRemaining < 0 ? 'additional_payment' : 'exact',
        `تسوية عهدة #${custody.custody_number}`, req.user.id
      ]
    );

    await client.query('COMMIT');
    res.status(201).json({
      message: 'تم تسجيل تسوية العهدة بنجاح',
      data: { custody_id, settlement_total: settlementTotal, remaining: newRemaining, status: newStatus, expenses: insertedExpenses }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[custody-settlement] ERROR:', err);
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally { client.release(); }
});

// ═══════════════════════════════════════════════════════════════
// RECALCULATE COST
// ═══════════════════════════════════════════════════════════════

router.put('/:id/recalculate-cost', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const shipmentResult = await client.query(
      `SELECT s.*, p.total_amount as purchase_total, p.exchange_rate as purchase_exchange_rate, p.purchase_type
       FROM shipments s 
       LEFT JOIN purchases p ON s.purchase_id = p.id 
       WHERE s.id = $1`,
      [req.params.id]
    );
    if (shipmentResult.rows.length === 0) return res.status(404).json({ message: 'الشحنة غير موجودة' });
    const shipment = shipmentResult.rows[0];
    if (!shipment.purchase_id) return res.status(400).json({ message: 'الشحنة غير مربوطة بفاتورة' });

    const invoiceValueUsd = parseFloat(shipment.purchase_total) || 0;
    const costCalculation = await calculateLandedCost(req.params.id, client);
    const totalCostEgp = costCalculation ? costCalculation.total_cost_egp : 0;
    let actualExchangeRate = 0;
    if (invoiceValueUsd > 0) actualExchangeRate = totalCostEgp / invoiceValueUsd;

    await client.query(
      `UPDATE shipments SET actual_exchange_rate = $1, total_cost_egp = $2, updated_at = NOW() WHERE id = $3`,
      [actualExchangeRate, totalCostEgp, req.params.id]
    );
    await client.query('COMMIT');
    res.json({
      message: 'تم إعادة حساب التكلفة',
      data: {
        shipment_id: req.params.id,
        invoice_value_usd: invoiceValueUsd,
        total_cost_egp: totalCostEgp,
        actual_exchange_rate: actualExchangeRate,
        cost_calculation: costCalculation
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[recalculate-cost] ERROR:', err);
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally { client.release(); }
});

// ═══════════════════════════════════════════════════════════════
// COST CALCULATION
// ═══════════════════════════════════════════════════════════════

router.get('/:id/cost-calculation', verifyToken, async (req, res) => {
  try {
    const shipmentResult = await pool.query(
      `SELECT s.*, p.total_amount as purchase_total, p.exchange_rate as purchase_exchange_rate
       FROM shipments s 
       LEFT JOIN purchases p ON s.purchase_id = p.id 
       WHERE s.id = $1`,
      [req.params.id]
    );
    if (shipmentResult.rows.length === 0) return res.status(404).json({ message: 'الشحنة غير موجودة' });
    const shipment = shipmentResult.rows[0];
    if (!shipment.purchase_id) return res.status(400).json({ message: 'الشحنة غير مربوطة بفاتورة' });

    const itemsResult = await pool.query(
      `SELECT pi.*, i.name as item_name, i.code as item_code 
       FROM purchase_items pi 
       LEFT JOIN items i ON pi.item_id = i.id 
       WHERE pi.purchase_id = $1`,
      [shipment.purchase_id]
    );

    const invoiceValueUsd = parseFloat(shipment.purchase_total) || 0;
    const totalCostEgp = parseFloat(shipment.total_cost_egp) || 0;
    const actualExchangeRate = parseFloat(shipment.actual_exchange_rate) || 0;

    const itemsWithCost = itemsResult.rows.map(item => {
      const unitPriceUsd = parseFloat(item.unit_price) || 0;
      const quantity = parseFloat(item.quantity) || 1;
      const unitCostEgp = unitPriceUsd * actualExchangeRate;
      const totalCostEgpItem = unitCostEgp * quantity;

      return { 
        ...item, 
        unit_price_usd: unitPriceUsd,
        unit_cost_egp: unitCostEgp.toFixed(2), 
        total_cost_egp: totalCostEgpItem.toFixed(2), 
        actual_exchange_rate: actualExchangeRate
      };
    });

    res.json({ 
      shipment_id: shipment.id, 
      shipment_number: shipment.shipment_number, 
      invoice_number: shipment.purchase_number,
      invoice_value_usd: invoiceValueUsd,
      total_cost_egp: totalCostEgp,
      actual_exchange_rate: actualExchangeRate,
      items: itemsWithCost 
    });
  } catch (err) {
    console.error('[cost-calculation] ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// CANCEL SHIPMENT
// ═══════════════════════════════════════════════════════════════

router.put('/:id/cancel', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const shipmentResult = await client.query(`SELECT status, purchase_id FROM shipments WHERE id = $1`, [req.params.id]);
    if (shipmentResult.rows.length === 0) return res.status(404).json({ message: 'الشحنة غير موجودة' });
    if (shipmentResult.rows[0].status === 'cancelled') return res.status(400).json({ message: 'الشحنة ملغاة بالفعل' });
    const oldPurchaseId = shipmentResult.rows[0].purchase_id;
    if (oldPurchaseId) await client.query(`UPDATE purchases SET shipment_id = NULL WHERE id = $1`, [oldPurchaseId]);

    // فك ربط المصاريف
    await client.query(
      `UPDATE shipment_expenses SET shipment_id = NULL, status = 'pending' WHERE shipment_id = $1`,
      [req.params.id]
    );

    await client.query(
      `UPDATE shipments SET status = 'cancelled', purchase_id = NULL, invoice_number = NULL,
        actual_exchange_rate = NULL, total_cost_egp = NULL, updated_at = NOW()
       WHERE id = $1`,
      [req.params.id]
    );
    await client.query('COMMIT');
    res.json({ message: 'تم إلغاء الشحنة وإتاحة رقمها للاستخدام', data: { shipment_id: req.params.id, unlinked_purchase_id: oldPurchaseId }});
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[cancel] ERROR:', err);
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally { client.release(); }
});

// ═══════════════════════════════════════════════════════════════
// ATTACHMENTS
// ═══════════════════════════════════════════════════════════════

router.post('/:id/attachments', verifyToken, async (req, res) => {
  const { file_name, file_url, file_type, notes } = req.body;
  try {
    const result = await pool.query(`INSERT INTO shipment_attachments (shipment_id, file_name, file_url, file_type, notes, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [req.params.id, file_name, file_url, file_type, notes, req.user.id]);
    res.status(201).json({ message: 'تم رفع المرفق', data: result.rows[0] });
  } catch (err) {
    console.error('[POST /attachments] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id/attachments/:attachmentId', verifyToken, async (req, res) => {
  try {
    await pool.query(`DELETE FROM shipment_attachments WHERE id = $1 AND shipment_id = $2`, [req.params.attachmentId, req.params.id]);
    res.json({ message: 'تم حذف المرفق' });
  } catch (err) {
    console.error('[DELETE /attachments] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// DELETE SHIPMENT
// ═══════════════════════════════════════════════════════════════

router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const checkResult = await pool.query(`SELECT status FROM shipments WHERE id = $1`, [req.params.id]);
    if (checkResult.rows.length === 0) return res.status(404).json({ message: 'الشحنة غير موجودة' });
    if (checkResult.rows[0].status !== 'open') return res.status(400).json({ message: 'لا يمكن حذف شحنة تم البدء فيها' });
    await pool.query(`DELETE FROM shipments WHERE id = $1`, [req.params.id]);
    res.json({ message: 'تم حذف الشحنة' });
  } catch (err) {
    console.error('[DELETE /shipments] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// SUPPLIER PAYMENTS
// ═══════════════════════════════════════════════════════════════

router.get('/:id/supplier-payments', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT se.*, sup.name as supplier_name, sup.supplier_code, t.transaction_number as treasury_number, ba.account_name as bank_account_name
      FROM shipment_expenses se
      LEFT JOIN suppliers sup ON se.supplier_id = sup.id
      LEFT JOIN treasury t ON se.treasury_id = t.id
      LEFT JOIN bank_accounts ba ON se.bank_account_id = ba.id
      WHERE se.shipment_id = $1 AND se.expense_type IN ('سداد مورد', 'bank_payment', 'تحويل بنكي')
      ORDER BY se.expense_date DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /supplier-payments] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/:id/supplier-payments', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { supplier_id, amount_egp, amount_usd, amount_eur, exchange_rate_usd, exchange_rate_eur, payment_method, bank_account_id, treasury_id, notes } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const egp = parseFloat(amount_egp) || 0;
    const usd = (parseFloat(amount_usd) || 0) * (parseFloat(exchange_rate_usd) || 0);
    const eur = (parseFloat(amount_eur) || 0) * (parseFloat(exchange_rate_eur) || 0);
    const total_egp = egp + usd + eur;

    const expenseResult = await client.query(
      `INSERT INTO shipment_expenses 
       (shipment_id, expense_date, expense_type, description, amount_egp, amount_usd, amount_eur, 
        exchange_rate_usd, exchange_rate_eur, total_egp, supplier_id, payment_method, bank_account_id, treasury_id, paid_by, notes, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`,
      [
        req.params.id, new Date(), 'سداد مورد', notes || 'سداد مورد أجنبي',
        amount_egp || 0, amount_usd || 0, amount_eur || 0,
        exchange_rate_usd || 0, exchange_rate_eur || 0, total_egp,
        supplier_id, payment_method || 'bank', bank_account_id || null, treasury_id || null, 'company', notes || null, 'linked', req.user.id
      ]
    );

    if (bank_account_id) {
      await client.query(
        `INSERT INTO bank_transactions 
         (bank_account_id, transaction_type, amount, currency, exchange_rate, description, reference_type, reference_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          bank_account_id, 'debit', amount_usd || amount_egp || 0,
          amount_usd ? 'USD' : 'EGP', exchange_rate_usd || 1,
          notes || `سداد مورد - شحنة #${req.params.id}`,
          'shipment_expense', expenseResult.rows[0].id, req.user.id
        ]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'تم تسجيل سداد المورد بنجاح', data: expenseResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /supplier-payments] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally { client.release(); }
});

module.exports = router;
