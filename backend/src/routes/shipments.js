const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Helper: حساب إجمالي المصاريف للتكلفة (مع خصم VAT المسترد)
const getCostExpensesSQL = () => `
  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN is_tax_only = true THEN 0
        WHEN has_tax_invoice = true AND tax_invoice_amount > 0 THEN tax_invoice_amount
        WHEN has_tax_invoice = true AND (tax_invoice_amount IS NULL OR tax_invoice_amount = 0) THEN GREATEST(total_egp - COALESCE(vat_amount, 0), 0)
        ELSE total_egp 
      END
    ), 0) as cost_total,
    COALESCE(SUM(
      CASE 
        WHEN is_tax_only = true THEN total_egp
        WHEN has_tax_invoice = true THEN COALESCE(vat_amount, 0)
        ELSE 0
      END
    ), 0) as tax_total,
    COALESCE(SUM(total_egp), 0) as gross_total
  FROM shipment_expenses 
  WHERE shipment_id = $1
`;

// Helper: إجمالي الإفراج الجمركي (ضريبة الوارد + VAT + ضريبة الأرباح) لكل إفراجات الشحنة
const getClearanceTotalSQL = () => `
  SELECT COALESCE(SUM(total_clearance), 0) as clearance_total
  FROM shipment_clearances
  WHERE shipment_id = $1
`;

// ═══════════════════════════════════════════════════════════════
// SHIPMENTS API (محدث بالكامل + Logging + Unlink Invoice)
// ═══════════════════════════════════════════════════════════════

// GET /shipments/next-number
router.get('/next-number', verifyToken, async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();

    // Find first gap in active (non-cancelled) shipments
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

    // If no gap, use max + 1 of active shipments
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

// ═══════════════════════════════════════════════════════════════
// استدعاء مصروف موجود (مدفوع من الخزينة/البنك) عشان تربطه بشحنة
// بيستبعد أي معاملة اتربطت بشحنة قبل كده (shipment_id IS NULL فقط)
// ═══════════════════════════════════════════════════════════════
router.get('/available-expenses', verifyToken, async (req, res) => {
  const { category, supplier, bank, search } = req.query;
  try {
    let query = `
      SELECT t.id as treasury_id, t.transaction_number, t.transaction_type, t.transaction_date,
        t.amount, t.currency, t.exchange_rate, t.amount_local, t.description,
        t.bank_name, t.supplier_id, t.supplier_name, t.payment_method,
        t.expense_category_id, ec.category_name,
        t.custody_id, c.custody_number
      FROM treasury t
      LEFT JOIN expense_categories ec ON t.expense_category_id = ec.id
      LEFT JOIN custodies c ON t.custody_id = c.id
      WHERE t.shipment_id IS NULL
        AND t.status NOT IN ('rejected_by_review', 'rejected_by_finance', 'cancelled')
        AND t.transaction_type IN ('expense', 'other_outcome', 'supplier_payment', 'bank_transfer')
    `;
    const params = [];
    if (category) { params.push(`%${category}%`); query += ` AND ec.category_name ILIKE $${params.length}`; }
    if (supplier) { params.push(`%${supplier}%`); query += ` AND t.supplier_name ILIKE $${params.length}`; }
    if (bank) { params.push(`%${bank}%`); query += ` AND t.bank_name ILIKE $${params.length}`; }
    if (search) { params.push(`%${search}%`); query += ` AND (t.description ILIKE $${params.length} OR t.transaction_number ILIKE $${params.length})`; }
    query += ` ORDER BY t.transaction_date DESC LIMIT 100`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /available-expenses] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// 📊 تقرير: مصاريف الخزينة/البنك المنتظرة الربط بشحنة (لمتابعة المالية)
router.get('/available-expenses/report', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        t.id as treasury_id, t.transaction_number, t.transaction_type, t.transaction_date,
        t.amount, t.amount_local, t.description, t.bank_name,
        t.supplier_name, ec.category_name,
        (CURRENT_DATE - t.transaction_date) as days_pending
      FROM treasury t
      LEFT JOIN expense_categories ec ON t.expense_category_id = ec.id
      WHERE t.shipment_id IS NULL
        AND t.status NOT IN ('rejected_by_review', 'rejected_by_finance', 'cancelled')
        AND t.transaction_type IN ('expense', 'other_outcome', 'supplier_payment', 'bank_transfer')
      ORDER BY t.transaction_date ASC
    `);

    const total_pending = result.rows.reduce((sum, r) => sum + (parseFloat(r.amount_local || r.amount) || 0), 0);
    const by_category = {};
    for (const row of result.rows) {
      const key = row.category_name || 'غير مصنف';
      by_category[key] = (by_category[key] || 0) + (parseFloat(row.amount_local || row.amount) || 0);
    }

    res.json({
      success: true,
      generated_at: new Date().toISOString(),
      count: result.rows.length,
      total_pending,
      by_category,
      oldest_pending: result.rows.slice(0, 20), // أقدم 20 معاملة منتظرة (أولوية المراجعة)
      items: result.rows
    });
  } catch (err) {
    console.error('[GET /available-expenses/report] Error:', err);
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
    console.log(`[GET /shipments/${req.params.id}] Starting...`);

    const shipmentResult = await pool.query(
      `SELECT s.*, sup.name as supplier_name, p.purchase_number, p.total_amount as purchase_total_egp, p.exchange_rate as purchase_exchange_rate, u.full_name as created_by_name
      FROM shipments s
      LEFT JOIN suppliers sup ON s.supplier_id = sup.id
      LEFT JOIN purchases p ON s.purchase_id = p.id
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = $1`, [req.params.id]
    );
    console.log(`[GET /shipments/${req.params.id}] Shipment query OK, rows:`, shipmentResult.rows.length);

    if (shipmentResult.rows.length === 0) return res.status(404).json({ message: 'الشحنة غير موجودة' });
    const shipment = shipmentResult.rows[0];

    const expensesResult = await pool.query(
      `SELECT se.*, t.transaction_number as treasury_number, c.custody_number, ec.category_name as category_name, sup.name as supplier_name
      FROM shipment_expenses se
      LEFT JOIN treasury t ON se.treasury_id = t.id
      LEFT JOIN custodies c ON se.custody_id = c.id
      LEFT JOIN expense_categories ec ON se.expense_category_id = ec.id
      LEFT JOIN suppliers sup ON se.supplier_id = sup.id
      WHERE se.shipment_id = $1 ORDER BY se.expense_date`, [req.params.id]
    );
    console.log(`[GET /shipments/${req.params.id}] Expenses query OK, rows:`, expensesResult.rows.length);

    const clearanceResult = await pool.query(
      `SELECT * FROM shipment_clearances WHERE shipment_id = $1`, [req.params.id]
    );
    console.log(`[GET /shipments/${req.params.id}] Clearance query OK, rows:`, clearanceResult.rows.length);

    const attachmentsResult = await pool.query(
      `SELECT sa.*, u.full_name as uploaded_by_name
      FROM shipment_attachments sa
      LEFT JOIN users u ON sa.uploaded_by = u.id
      WHERE sa.shipment_id = $1`, [req.params.id]
    );
    console.log(`[GET /shipments/${req.params.id}] Attachments query OK, rows:`, attachmentsResult.rows.length);

    let itemsResult = { rows: [] };
    if (shipment.purchase_id) {
      itemsResult = await pool.query(
        `SELECT pi.*, i.name as item_name, i.code as item_code
        FROM purchase_items pi
        LEFT JOIN items i ON pi.item_id = i.id
        WHERE pi.purchase_id = $1`, [shipment.purchase_id]
      );
      console.log(`[GET /shipments/${req.params.id}] Items query OK, rows:`, itemsResult.rows.length);
    }

    const response = { ...shipment, expenses: expensesResult.rows, clearances: clearanceResult.rows, attachments: attachmentsResult.rows, items: itemsResult.rows };
    console.log(`[GET /shipments/${req.params.id}] Response ready`);
    res.json(response);
  } catch (err) {
    console.error(`[GET /shipments/${req.params.id}] ERROR:`, err);
    res.status(500).json({ message: 'Server error', error: err.message, stack: err.stack });
  }
});

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
// EXPENSES (محدث - مع تعديل وحذف)
// ═══════════════════════════════════════════════════════════════

// POST /shipments/:id/expenses
router.post('/:id/expenses', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { expense_date, expense_type, description, amount_egp, amount_usd, amount_eur, amount_other, other_currency, exchange_rate_usd, exchange_rate_eur, exchange_rate_other, treasury_id, custody_id, has_tax_invoice, tax_invoice_number, tax_invoice_amount, notes, is_dummy, expense_category_id, is_tax_only, supplier_id, payment_method } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const egp = parseFloat(amount_egp) || 0;
    const usd = (parseFloat(amount_usd) || 0) * (parseFloat(exchange_rate_usd) || 0);
    const eur = (parseFloat(amount_eur) || 0) * (parseFloat(exchange_rate_eur) || 0);
    const other = (parseFloat(amount_other) || 0) * (parseFloat(exchange_rate_other) || 0);
    const total_egp = egp + usd + eur + other;

    const expenseResult = await client.query(
      `INSERT INTO shipment_expenses (shipment_id, expense_date, expense_type, description, amount_egp, amount_usd, amount_eur, amount_other, other_currency, exchange_rate_usd, exchange_rate_eur, exchange_rate_other, total_egp, treasury_id, custody_id, has_tax_invoice, tax_invoice_number, tax_invoice_amount, notes, is_dummy, expense_category_id, is_tax_only, supplier_id, payment_method, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25) RETURNING *`,
      [req.params.id, expense_date || new Date(), expense_type, description || null, amount_egp || 0, amount_usd || 0, amount_eur || 0, amount_other || 0, other_currency || null, exchange_rate_usd || 0, exchange_rate_eur || 0, exchange_rate_other || 0, total_egp, treasury_id || null, custody_id || null, has_tax_invoice || false, tax_invoice_number || null, tax_invoice_amount || null, notes || null, is_dummy || false, expense_category_id || null, is_tax_only || false, supplier_id || null, payment_method || 'cash', req.user.id]
    );
    if (treasury_id) await client.query(`UPDATE treasury SET shipment_id = $1 WHERE id = $2`, [req.params.id, treasury_id]);
    if (custody_id) await client.query(`UPDATE custodies SET shipment_id = $1 WHERE id = $2`, [req.params.id, custody_id]);
    await client.query('COMMIT');
    res.status(201).json({ message: 'تم إضافة المصروف بنجاح', data: expenseResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /expenses] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally { client.release(); }
});

// PUT /shipments/:id/expenses/:expenseId - تعديل مصروف
router.put('/:id/expenses/:expenseId', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { expense_date, expense_type, description, amount_egp, amount_usd, amount_eur, amount_other, other_currency, exchange_rate_usd, exchange_rate_eur, exchange_rate_other, treasury_id, custody_id, has_tax_invoice, tax_invoice_number, tax_invoice_amount, notes, is_dummy, expense_category_id, is_tax_only, supplier_id, payment_method } = req.body;
  try {
    const egp = parseFloat(amount_egp) || 0;
    const usd = (parseFloat(amount_usd) || 0) * (parseFloat(exchange_rate_usd) || 0);
    const eur = (parseFloat(amount_eur) || 0) * (parseFloat(exchange_rate_eur) || 0);
    const other = (parseFloat(amount_other) || 0) * (parseFloat(exchange_rate_other) || 0);
    const total_egp = egp + usd + eur + other;

    const result = await pool.query(
      `UPDATE shipment_expenses SET expense_date = $1, expense_type = $2, description = $3, amount_egp = $4, amount_usd = $5, amount_eur = $6, amount_other = $7, other_currency = $8, exchange_rate_usd = $9, exchange_rate_eur = $10, exchange_rate_other = $11, total_egp = $12, treasury_id = $13, custody_id = $14, has_tax_invoice = $15, tax_invoice_number = $16, tax_invoice_amount = $17, notes = $18, is_dummy = $19, expense_category_id = $20, is_tax_only = $21, supplier_id = $22, payment_method = $23
      WHERE id = $24 AND shipment_id = $25 RETURNING *`,
      [expense_date, expense_type, description || null, amount_egp || 0, amount_usd || 0, amount_eur || 0, amount_other || 0, other_currency || null, exchange_rate_usd || 0, exchange_rate_eur || 0, exchange_rate_other || 0, total_egp, treasury_id || null, custody_id || null, has_tax_invoice || false, tax_invoice_number || null, tax_invoice_amount || null, notes || null, is_dummy || false, expense_category_id || null, is_tax_only || false, supplier_id || null, payment_method || 'cash', req.params.expenseId, req.params.id]
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
// CLEARANCE (محدث - مع تعديل وحذف + نسب ضريبة من الإعدادات)
// ═══════════════════════════════════════════════════════════════

// POST /shipments/:id/clearance
router.post('/:id/clearance', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { clearance_number, clearance_date, declared_value, import_tax, is_vat_exempt, is_profit_tax_exempt, vat_rate, profit_tax_rate, attachment_url, notes } = req.body;
  try {
    let finalVatRate = vat_rate;
    let finalProfitTaxRate = profit_tax_rate;

    if (finalVatRate == null || finalProfitTaxRate == null) {
      const settingsResult = await pool.query('SELECT vat_rate, customs_profit_tax_rate FROM tax_settings ORDER BY id DESC LIMIT 1');
      const settings = settingsResult.rows[0] || {};
      if (finalVatRate == null) finalVatRate = settings.vat_rate || 14;
      if (finalProfitTaxRate == null) finalProfitTaxRate = settings.customs_profit_tax_rate || 1;
    }

    const result = await pool.query(
      `INSERT INTO shipment_clearances (shipment_id, clearance_number, clearance_date, declared_value, import_tax, is_vat_exempt, is_profit_tax_exempt, vat_rate, profit_tax_rate, attachment_url, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [req.params.id, clearance_number, clearance_date || new Date(), declared_value || 0, import_tax || 0, is_vat_exempt || false, is_profit_tax_exempt || false, finalVatRate, finalProfitTaxRate, attachment_url || null, notes || null, req.user.id]
    );
    res.status(201).json({ message: 'تم إضافة الإفراج بنجاح', data: result.rows[0] });
  } catch (err) {
    console.error('[POST /clearance] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /shipments/:id/clearance/:clearanceId - تعديل إفراج
router.put('/:id/clearance/:clearanceId', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { clearance_number, clearance_date, declared_value, import_tax, is_vat_exempt, is_profit_tax_exempt, vat_rate, profit_tax_rate, attachment_url, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE shipment_clearances SET clearance_number = $1, clearance_date = $2, declared_value = $3, import_tax = $4, is_vat_exempt = $5, is_profit_tax_exempt = $6, vat_rate = $7, profit_tax_rate = $8, attachment_url = $9, notes = $10
      WHERE id = $11 AND shipment_id = $12 RETURNING *`,
      [clearance_number, clearance_date, declared_value, import_tax, is_vat_exempt, is_profit_tax_exempt, vat_rate || null, profit_tax_rate || null, attachment_url, notes, req.params.clearanceId, req.params.id]
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
// LINK INVOICE + COST (معدل بالكامل - المعادلة الصحيحة)
// ═══════════════════════════════════════════════════════════════

router.put('/:id/link-invoice', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { purchase_id, exchange_rate } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log(`[link-invoice] shipment=${req.params.id}, purchase=${purchase_id}`);

    // 1. جيب بيانات الفاتورة
    const purchaseResult = await client.query(`SELECT * FROM purchases WHERE id = $1`, [purchase_id]);
    if (purchaseResult.rows.length === 0) throw new Error('الفاتورة غير موجودة');
    const purchase = purchaseResult.rows[0];
    console.log(`[link-invoice] Purchase: total_amount=${purchase.total_amount}, exchange_rate=${purchase.exchange_rate}`);

    // 2. إجمالي المصاريف بالجنيه (بخصم VAT)
    const expensesResult = await client.query(getCostExpensesSQL(), [req.params.id]);
    const totalExpensesEgp = parseFloat(expensesResult.rows[0].cost_total) || 0;
    console.log(`[link-invoice] Total expenses: ${totalExpensesEgp}`);

    // 2ب. إجمالي الإفراج الجمركي (ضريبة الوارد + VAT + ضريبة الأرباح)
    const clearanceResult = await client.query(getClearanceTotalSQL(), [req.params.id]);
    const totalClearanceEgp = parseFloat(clearanceResult.rows[0].clearance_total) || 0;
    console.log(`[link-invoice] Total clearance: ${totalClearanceEgp}`);

    // 3. بيانات الفاتورة
    const purchaseTotalEgp = parseFloat(purchase.total_amount) || 0;
    const purchaseExchangeRate = parseFloat(exchange_rate) || parseFloat(purchase.exchange_rate) || 50;

    // 4. قيمة الفاتورة بالدولار = إجمالي الجنيه ÷ سعر الدولار
    const invoiceValueUsd = purchaseTotalEgp / purchaseExchangeRate;

    // 5. إجمالي التكلفة = قيمة الفاتورة بالجنيه + المصاريف + الإفراج الجمركي
    const totalCostEgp = purchaseTotalEgp + totalExpensesEgp + totalClearanceEgp;

    // 6. المعامل الفعلي = إجمالي التكلفة ÷ الدولار
    let actualExchangeRate = 0;
    if (invoiceValueUsd > 0) {
      actualExchangeRate = totalCostEgp / invoiceValueUsd;
    }
    console.log(`[link-invoice] invoiceValueUsd=${invoiceValueUsd}, totalCostEgp=${totalCostEgp}, actualRate=${actualExchangeRate}`);

    // 7. حدّث الشحنة
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
    console.log(`[link-invoice] SUCCESS`);

    res.json({ 
      message: 'تم ربط الفاتورة بنجاح', 
      data: { 
        shipment_id: req.params.id, 
        purchase_id, 
        actual_exchange_rate: actualExchangeRate, 
        total_expenses_egp: totalExpensesEgp, 
        total_clearance_egp: totalClearanceEgp,
        invoice_value_usd: invoiceValueUsd, 
        invoice_value_egp: purchaseTotalEgp, 
        total_cost_egp: totalCostEgp, 
        exchange_rate_used: purchaseExchangeRate 
      } 
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[link-invoice] ERROR:', err);
    res.status(500).json({ message: err.message || 'Server error', error: err.message, stack: err.stack });
  } finally { client.release(); }
});

// ═══════════════════════════════════════════════════════════════
// UNLINK INVOICE (فك ربط الفاتورة من الشاشة)
// ═══════════════════════════════════════════════════════════════

router.put('/:id/unlink-invoice', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log(`[unlink-invoice] shipment=${req.params.id}`);

    // 1. جيب الشحنة عشان نعرف purchase_id القديم
    const shipmentResult = await client.query(
      `SELECT purchase_id FROM shipments WHERE id = $1`, 
      [req.params.id]
    );

    if (shipmentResult.rows.length === 0) {
      throw new Error('الشحنة غير موجودة');
    }

    const oldPurchaseId = shipmentResult.rows[0].purchase_id;
    console.log(`[unlink-invoice] Old purchase_id=${oldPurchaseId}`);

    // 2. فك الربط من الفاتورة (لو فيه فاتورة مربوطة)
    if (oldPurchaseId) {
      await client.query(
        `UPDATE purchases SET shipment_id = NULL WHERE id = $1`,
        [oldPurchaseId]
      );
      console.log(`[unlink-invoice] Cleared shipment_id from purchase ${oldPurchaseId}`);
    }

    // 3. فك الربط من الشحنة
    await client.query(
      `UPDATE shipments SET 
        purchase_id = NULL, 
        invoice_number = NULL,
        actual_exchange_rate = NULL, 
        total_cost_egp = NULL,
        status = 'open' 
       WHERE id = $1`,
      [req.params.id]
    );

    await client.query('COMMIT');
    console.log(`[unlink-invoice] SUCCESS`);

    res.json({ 
      message: 'تم فك ربط الفاتورة بنجاح',
      data: { shipment_id: req.params.id, unlinked_purchase_id: oldPurchaseId }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[unlink-invoice] ERROR:', err);
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally { client.release(); }
});

// ═══════════════════════════════════════════════════════════════
// CUSTODY SETTLEMENT (تسوية عهدة المخلص من داخل الشحنة)
// ═══════════════════════════════════════════════════════════════

router.post('/:id/custody-settlement', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { custody_id, expenses } = req.body;
  if (!custody_id || !expenses || !Array.isArray(expenses) || expenses.length === 0) {
    return res.status(400).json({ message: 'بيانات غير كاملة: custody_id والمصاريف مطلوبة' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. تأكد إن العهدة موجودة
    const custodyResult = await client.query(`SELECT * FROM custodies WHERE id = $1`, [custody_id]);
    if (custodyResult.rows.length === 0) throw new Error('العهدة غير موجودة');
    const custody = custodyResult.rows[0];

    // 2. تأكد إن العهدة مربوطة بالشحنة دي (أو مفيش shipment_id)
    if (custody.shipment_id && String(custody.shipment_id) !== String(req.params.id)) {
      throw new Error('العهدة مربوطة بشحنة أخرى');
    }

    let settlementTotal = 0;
    const insertedExpenses = [];

    // 3. سجل كل مصروف
    for (const exp of expenses) {
      const egp = parseFloat(exp.amount_egp) || 0;
      const usd = (parseFloat(exp.amount_usd) || 0) * (parseFloat(exp.exchange_rate_usd) || 0);
      const total_egp = egp + usd;
      settlementTotal += total_egp;

      const expenseResult = await client.query(
        `INSERT INTO shipment_expenses (
          shipment_id, expense_date, expense_type, description,
          amount_egp, amount_usd, exchange_rate_usd, total_egp,
          custody_id, has_tax_invoice, tax_invoice_number, tax_invoice_amount,
          vat_rate, withholding_rate, vat_amount, withholding_amount, net_amount,
          notes, payment_method, created_by, expense_category_id, is_tax_only, is_dummy
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
        RETURNING *`,
        [
          req.params.id,
          exp.expense_date || new Date(),
          exp.expense_type,
          exp.description || null,
          exp.amount_egp || 0,
          exp.amount_usd || 0,
          exp.exchange_rate_usd || 0,
          total_egp,
          custody_id,
          exp.has_tax_invoice || false,
          exp.tax_invoice_number || null,
          exp.tax_invoice_amount || null,
          exp.vat_rate || 0,
          exp.withholding_rate || 0,
          exp.vat_amount || 0,
          exp.withholding_amount || 0,
          exp.net_amount || total_egp,
          exp.notes || null,
          exp.payment_method || 'cash',
          req.user.id,
          exp.expense_category_id || null,
          exp.is_tax_only || false,
          exp.is_dummy || false
        ]
      );
      insertedExpenses.push(expenseResult.rows[0]);
    }

    // 4. حدّث العهدة
    const newSettled = parseFloat(custody.settled_amount || 0) + settlementTotal;
    const newRemaining = parseFloat(custody.amount || 0) - newSettled;
    let newStatus = 'active';
    if (newRemaining <= 0) newStatus = 'fully_settled';
    else if (newSettled > 0) newStatus = 'partially_settled';

    await client.query(
      `UPDATE custodies SET settled_amount = $1, remaining_amount = $2, status = $3, updated_at = NOW() WHERE id = $4`,
      [newSettled, newRemaining, newStatus, custody_id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'تم تسجيل تسوية العهدة بنجاح',
      data: {
        custody_id,
        settlement_total: settlementTotal,
        remaining: newRemaining,
        status: newStatus,
        expenses: insertedExpenses
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[custody-settlement] ERROR:', err);
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// RECALCULATE COST (إعادة حساب التكلفة بعد إضافة مصاريف)
// ═══════════════════════════════════════════════════════════════

router.put('/:id/recalculate-cost', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. جيب الشحنة والفاتورة
    const shipmentResult = await client.query(
      `SELECT s.*, p.total_amount as purchase_total_egp, p.exchange_rate as purchase_exchange_rate 
       FROM shipments s 
       LEFT JOIN purchases p ON s.purchase_id = p.id 
       WHERE s.id = $1`,
      [req.params.id]
    );

    if (shipmentResult.rows.length === 0) {
      return res.status(404).json({ message: 'الشحنة غير موجودة' });
    }

    const shipment = shipmentResult.rows[0];
    if (!shipment.purchase_id) {
      return res.status(400).json({ message: 'الشحنة غير مربوطة بفاتورة' });
    }

    // 2. البيانات المالية
    const purchaseTotalEgp = parseFloat(shipment.purchase_total_egp) || 0;
    const purchaseExchangeRate = parseFloat(shipment.purchase_exchange_rate) || 50;
    const invoiceValueUsd = purchaseTotalEgp / purchaseExchangeRate;

    // 3. المصاريف للتكلفة (بخصم VAT)
    const expensesResult = await client.query(getCostExpensesSQL(), [req.params.id]);
    const totalExpensesEgp = parseFloat(expensesResult.rows[0].cost_total) || 0;

    // 3ب. إجمالي الإفراج الجمركي (ضريبة الوارد + VAT + ضريبة الأرباح)
    const clearanceResult = await client.query(getClearanceTotalSQL(), [req.params.id]);
    const totalClearanceEgp = parseFloat(clearanceResult.rows[0].clearance_total) || 0;

    const totalCostEgp = purchaseTotalEgp + totalExpensesEgp + totalClearanceEgp;

    // 4. المعامل الفعلي
    let actualExchangeRate = 0;
    if (invoiceValueUsd > 0) {
      actualExchangeRate = totalCostEgp / invoiceValueUsd;
    }

    // 5. حدّث الشحنة
    await client.query(
      `UPDATE shipments SET actual_exchange_rate = $1, total_cost_egp = $2, updated_at = NOW() WHERE id = $3`,
      [actualExchangeRate, totalCostEgp, req.params.id]
    );

    await client.query('COMMIT');

    res.json({
      message: 'تم إعادة حساب التكلفة',
      data: {
        shipment_id: req.params.id,
        purchase_total_egp: purchaseTotalEgp,
        total_expenses_egp: totalExpensesEgp,
        total_clearance_egp: totalClearanceEgp,
        total_cost_egp: totalCostEgp,
        invoice_value_usd: invoiceValueUsd,
        actual_exchange_rate: actualExchangeRate
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[recalculate-cost] ERROR:', err);
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// CANCEL SHIPMENT (إلغاء شحنة + إتاحة الرقم)
// ═══════════════════════════════════════════════════════════════

router.put('/:id/cancel', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log(`[cancel] shipment=${req.params.id}`);

    // 1. Check if shipment exists and not already cancelled
    const shipmentResult = await client.query(
      `SELECT status, purchase_id FROM shipments WHERE id = $1`, 
      [req.params.id]
    );

    if (shipmentResult.rows.length === 0) {
      return res.status(404).json({ message: 'الشحنة غير موجودة' });
    }

    if (shipmentResult.rows[0].status === 'cancelled') {
      return res.status(400).json({ message: 'الشحنة ملغاة بالفعل' });
    }

    const oldPurchaseId = shipmentResult.rows[0].purchase_id;

    // 2. Unlink purchase if linked
    if (oldPurchaseId) {
      await client.query(
        `UPDATE purchases SET shipment_id = NULL WHERE id = $1`,
        [oldPurchaseId]
      );
      console.log(`[cancel] Cleared shipment_id from purchase ${oldPurchaseId}`);
    }

    // 3. Cancel the shipment
    await client.query(
      `UPDATE shipments SET 
        status = 'cancelled',
        purchase_id = NULL,
        invoice_number = NULL,
        actual_exchange_rate = NULL,
        total_cost_egp = NULL,
        updated_at = NOW()
       WHERE id = $1`,
      [req.params.id]
    );

    await client.query('COMMIT');
    console.log(`[cancel] SUCCESS`);

    res.json({ 
      message: 'تم إلغاء الشحنة وإتاحة رقمها للاستخدام',
      data: { shipment_id: req.params.id, unlinked_purchase_id: oldPurchaseId }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[cancel] ERROR:', err);
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally { client.release(); }
});

router.get('/:id/cost-calculation', verifyToken, async (req, res) => {
  try {
    console.log(`[cost-calculation] shipment=${req.params.id}`);

    // 1. جيب الشحنة مع بيانات الفاتورة
    const shipmentResult = await pool.query(
      `SELECT s.*, p.total_amount as purchase_total_egp, p.exchange_rate as purchase_exchange_rate, p.purchase_number 
       FROM shipments s 
       LEFT JOIN purchases p ON s.purchase_id = p.id 
       WHERE s.id = $1`, 
      [req.params.id]
    );
    if (shipmentResult.rows.length === 0) return res.status(404).json({ message: 'الشحنة غير موجودة' });
    const shipment = shipmentResult.rows[0];
    console.log(`[cost-calculation] Shipment: purchase_id=${shipment.purchase_id}, total_cost_egp=${shipment.total_cost_egp}`);

    // 1ب. إجمالي الإفراج الجمركي (لعرضه منفصل عن باقي المصاريف)
    const clearanceResult = await pool.query(getClearanceTotalSQL(), [req.params.id]);
    const totalClearanceEgp = parseFloat(clearanceResult.rows[0].clearance_total) || 0;

    // 2. جيب أصناف الفاتورة
    const itemsResult = await pool.query(
      `SELECT pi.*, i.name as item_name, i.code as item_code 
       FROM purchase_items pi 
       LEFT JOIN items i ON pi.item_id = i.id 
       WHERE pi.purchase_id = $1`, 
      [shipment.purchase_id]
    );
    console.log(`[cost-calculation] Items: ${itemsResult.rows.length}`);

    // 3. البيانات المالية
    const purchaseTotalEgp = parseFloat(shipment.purchase_total_egp) || 0;
    const totalCostEgp = parseFloat(shipment.total_cost_egp) || 0;
    const actualExchangeRate = parseFloat(shipment.actual_exchange_rate) || 0;
    const purchaseExchangeRate = parseFloat(shipment.purchase_exchange_rate) || 50;

    // 4. نسبة التكلفة = إجمالي التكلفة ÷ إجمالي الفاتورة
    const costRatio = purchaseTotalEgp > 0 ? (totalCostEgp / purchaseTotalEgp) : 1;

    // 5. حسب تكلفة كل صنف
    const itemsWithCost = itemsResult.rows.map(item => {
      const unitPriceEgp = parseFloat(item.unit_price) || 0;
      const quantity = parseFloat(item.quantity) || 1;

      const unitCostEgp = unitPriceEgp * costRatio;
      const totalCostEgpItem = unitCostEgp * quantity;

      const unitPriceUsd = purchaseExchangeRate > 0 ? unitPriceEgp / purchaseExchangeRate : 0;

      return { 
        ...item, 
        unit_price_egp: unitPriceEgp,
        unit_price_usd: unitPriceUsd.toFixed(4),
        unit_cost_egp: unitCostEgp.toFixed(2), 
        total_cost_egp: totalCostEgpItem.toFixed(2), 
        cost_ratio: costRatio.toFixed(6),
        exchange_rate_used: actualExchangeRate,
        purchase_exchange_rate: purchaseExchangeRate
      };
    });

    console.log(`[cost-calculation] SUCCESS`);
    res.json({ 
      shipment_id: shipment.id, 
      shipment_number: shipment.shipment_number, 
      invoice_number: shipment.purchase_number,
      purchase_total_egp: purchaseTotalEgp,
      total_expenses_egp: totalCostEgp - purchaseTotalEgp - totalClearanceEgp,
      total_clearance_egp: totalClearanceEgp,
      total_cost_egp: totalCostEgp,
      invoice_value_usd: purchaseTotalEgp / purchaseExchangeRate,
      actual_exchange_rate: actualExchangeRate,
      purchase_exchange_rate: purchaseExchangeRate,
      cost_ratio: costRatio,
      items: itemsWithCost 
    });
  } catch (err) {
    console.error('[cost-calculation] ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message, stack: err.stack });
  }
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
// SUPPLIER PAYMENTS (سداد الموردين)
// ═══════════════════════════════════════════════════════════════

// GET /shipments/:id/supplier-payments — كل سدادات الموردين في الشحنة
router.get('/:id/supplier-payments', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT se.*, sup.name as supplier_name, sup.supplier_code, t.transaction_number as treasury_number
      FROM shipment_expenses se
      LEFT JOIN suppliers sup ON se.supplier_id = sup.id
      LEFT JOIN treasury t ON se.treasury_id = t.id
      WHERE se.shipment_id = $1 AND se.supplier_id IS NOT NULL
      ORDER BY se.expense_date DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /supplier-payments] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /shipments/:id/supplier-payments — سداد مورد مباشرة (من البنك)
router.post('/:id/supplier-payments', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { supplier_id, amount_egp, amount_usd, amount_eur, exchange_rate_usd, exchange_rate_eur, payment_method, bank_account_id, notes } = req.body;
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
        exchange_rate_usd, exchange_rate_eur, total_egp, supplier_id, payment_method, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [
        req.params.id,
        new Date(),
        'سداد مورد',
        notes || 'سداد مورد أجنبي',
        amount_egp || 0,
        amount_usd || 0,
        amount_eur || 0,
        exchange_rate_usd || 0,
        exchange_rate_eur || 0,
        total_egp,
        supplier_id,
        payment_method || 'bank',
        notes || null,
        req.user.id
      ]
    );

    if (bank_account_id) {
      await client.query(
        `INSERT INTO bank_transactions 
         (bank_account_id, transaction_type, amount, currency, exchange_rate, description, reference_type, reference_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          bank_account_id,
          'debit',
          amount_usd || amount_egp || 0,
          amount_usd ? 'USD' : 'EGP',
          exchange_rate_usd || 1,
          notes || `سداد مورد - شحنة #${req.params.id}`,
          'shipment_expense',
          expenseResult.rows[0].id,
          req.user.id
        ]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ 
      message: 'تم تسجيل سداد المورد بنجاح', 
      data: expenseResult.rows[0] 
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /supplier-payments] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally { 
    client.release(); 
  }
});

module.exports = router;
