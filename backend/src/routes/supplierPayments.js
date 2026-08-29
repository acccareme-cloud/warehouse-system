const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// SUPPLIER PAYMENTS API (سداد الموردين)
// ═══════════════════════════════════════════════════════════════

// GET /supplier-payments - كل المدفوعات
router.get('/', verifyToken, async (req, res) => {
  const { supplier_id, shipment_id, payment_method, from_date, to_date } = req.query;
  try {
    let query = `
      SELECT 
        sp.*,
        s.name as supplier_name,
        s.supplier_code,
        sh.shipment_number,
        sh.shipment_year,
        ba.account_name as bank_account_name,
        t.transaction_number as treasury_number,
        u.full_name as created_by_name
      FROM supplier_payments sp
      LEFT JOIN suppliers s ON sp.supplier_id = s.id
      LEFT JOIN shipments sh ON sp.shipment_id = sh.id
      LEFT JOIN bank_accounts ba ON sp.bank_account_id = ba.id
      LEFT JOIN treasury t ON sp.treasury_id = t.id
      LEFT JOIN users u ON sp.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (supplier_id) { params.push(supplier_id); query += ` AND sp.supplier_id = $${params.length}`; }
    if (shipment_id) { params.push(shipment_id); query += ` AND sp.shipment_id = $${params.length}`; }
    if (payment_method) { params.push(payment_method); query += ` AND sp.payment_method = $${params.length}`; }
    if (from_date) { params.push(from_date); query += ` AND sp.payment_date >= $${params.length}`; }
    if (to_date) { params.push(to_date); query += ` AND sp.payment_date <= $${params.length}`; }
    query += ` ORDER BY sp.payment_date DESC, sp.id DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /supplier-payments] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /supplier-payments/:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sp.*, s.name as supplier_name, s.supplier_code, sh.shipment_number, sh.shipment_year,
        ba.account_name as bank_account_name, t.transaction_number as treasury_number, u.full_name as created_by_name
      FROM supplier_payments sp
      LEFT JOIN suppliers s ON sp.supplier_id = s.id
      LEFT JOIN shipments sh ON sp.shipment_id = sh.id
      LEFT JOIN bank_accounts ba ON sp.bank_account_id = ba.id
      LEFT JOIN treasury t ON sp.treasury_id = t.id
      LEFT JOIN users u ON sp.created_by = u.id
      WHERE sp.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'السداد غير موجود' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[GET /supplier-payments/:id] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /supplier-payments - سداد جديد
router.post('/', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { 
    supplier_id, shipment_id, purchase_id,
    payment_date, payment_method, 
    amount_egp, amount_usd, amount_eur, amount_other, other_currency,
    exchange_rate_usd, exchange_rate_eur, exchange_rate_other,
    bank_account_id, treasury_id, check_number, check_date,
    notes, reference_number 
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // حساب الإجمالي بالجنيه
    const egp = parseFloat(amount_egp) || 0;
    const usd = (parseFloat(amount_usd) || 0) * (parseFloat(exchange_rate_usd) || 0);
    const eur = (parseFloat(amount_eur) || 0) * (parseFloat(exchange_rate_eur) || 0);
    const other = (parseFloat(amount_other) || 0) * (parseFloat(exchange_rate_other) || 0);
    const total_egp = egp + usd + eur + other;

    // إنشاء السداد
    const paymentResult = await client.query(
      `INSERT INTO supplier_payments (
        supplier_id, shipment_id, purchase_id, payment_date, payment_method,
        amount_egp, amount_usd, amount_eur, amount_other, other_currency,
        exchange_rate_usd, exchange_rate_eur, exchange_rate_other, total_egp,
        bank_account_id, treasury_id, check_number, check_date,
        notes, reference_number, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *`,
      [
        supplier_id, shipment_id || null, purchase_id || null,
        payment_date || new Date(), payment_method || 'cash',
        amount_egp || 0, amount_usd || 0, amount_eur || 0, amount_other || 0, other_currency || null,
        exchange_rate_usd || 0, exchange_rate_eur || 0, exchange_rate_other || 0, total_egp,
        bank_account_id || null, treasury_id || null, check_number || null, check_date || null,
        notes || null, reference_number || null, req.user.id
      ]
    );

    // تسجيل في دفتر أستاذ المورد (credit)
    await client.query(
      `INSERT INTO supplier_ledger (
        supplier_id, transaction_type, reference_type, reference_id,
        debit_amount, credit_amount, balance_after, currency, exchange_rate, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        supplier_id, 'payment', 'supplier_payment', paymentResult.rows[0].id,
        0, total_egp, 0, 'EGP', 1, notes || `سداد مورد #${reference_number || paymentResult.rows[0].id}`, req.user.id
      ]
    );

    // تحديث رصيد المورد
    await client.query(
      `UPDATE suppliers SET 
        total_paid = COALESCE(total_paid, 0) + $1,
        balance = COALESCE(balance, 0) - $1,
        updated_at = NOW()
      WHERE id = $2`,
      [total_egp, supplier_id]
    );

    // لو فيه شحنة، نضيف المصروف للشحنة
    if (shipment_id) {
      await client.query(
        `INSERT INTO shipment_expenses (
          shipment_id, expense_date, expense_type, description,
          amount_egp, amount_usd, amount_eur, exchange_rate_usd, exchange_rate_eur, total_egp,
          supplier_id, payment_method, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          shipment_id, payment_date || new Date(), 'سداد مورد', notes || 'سداد مورد أجنبي',
          amount_egp || 0, amount_usd || 0, amount_eur || 0, exchange_rate_usd || 0, exchange_rate_eur || 0, total_egp,
          supplier_id, payment_method || 'bank', notes || null, req.user.id
        ]
      );

      // إعادة حساب تكلفة الشحنة
      await recalculateShipmentCost(client, shipment_id);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'تم تسجيل السداد بنجاح', data: paymentResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /supplier-payments] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally { client.release(); }
});

// PUT /supplier-payments/:id
router.put('/:id', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { payment_date, payment_method, amount_egp, amount_usd, amount_eur, 
          exchange_rate_usd, exchange_rate_eur, bank_account_id, notes, reference_number } = req.body;
  try {
    const egp = parseFloat(amount_egp) || 0;
    const usd = (parseFloat(amount_usd) || 0) * (parseFloat(exchange_rate_usd) || 0);
    const eur = (parseFloat(amount_eur) || 0) * (parseFloat(exchange_rate_eur) || 0);
    const total_egp = egp + usd + eur;

    const result = await pool.query(
      `UPDATE supplier_payments SET 
        payment_date = $1, payment_method = $2, amount_egp = $3, amount_usd = $4, amount_eur = $5,
        exchange_rate_usd = $6, exchange_rate_eur = $7, total_egp = $8,
        bank_account_id = $9, notes = $10, reference_number = $11, updated_at = NOW()
      WHERE id = $12 RETURNING *`,
      [
        payment_date, payment_method, amount_egp || 0, amount_usd || 0, amount_eur || 0,
        exchange_rate_usd || 0, exchange_rate_eur || 0, total_egp,
        bank_account_id || null, notes || null, reference_number || null, req.params.id
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'السداد غير موجود' });
    res.json({ message: 'تم تحديث السداد', data: result.rows[0] });
  } catch (err) {
    console.error('[PUT /supplier-payments/:id] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /supplier-payments/:id
router.delete('/:id', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(`DELETE FROM supplier_payments WHERE id = $1 RETURNING *`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'السداد غير موجود' });
    res.json({ message: 'تم حذف السداد' });
  } catch (err) {
    console.error('[DELETE /supplier-payments/:id] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /supplier-payments/supplier/:supplierId - كشف حساب مورد
router.get('/supplier/:supplierId', verifyToken, async (req, res) => {
  const { from_date, to_date } = req.query;
  try {
    let query = `
      SELECT 
        sp.*,
        sh.shipment_number,
        sh.shipment_year,
        p.purchase_number,
        ba.account_name as bank_account_name
      FROM supplier_payments sp
      LEFT JOIN shipments sh ON sp.shipment_id = sh.id
      LEFT JOIN purchases p ON sp.purchase_id = p.id
      LEFT JOIN bank_accounts ba ON sp.bank_account_id = ba.id
      WHERE sp.supplier_id = $1
    `;
    const params = [req.params.supplierId];
    if (from_date) { params.push(from_date); query += ` AND sp.payment_date >= $${params.length}`; }
    if (to_date) { params.push(to_date); query += ` AND sp.payment_date <= $${params.length}`; }
    query += ` ORDER BY sp.payment_date DESC, sp.id DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /supplier-payments/supplier/:supplierId] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Helper: إعادة حساب تكلفة الشحنة
async function recalculateShipmentCost(client, shipmentId) {
  const shipmentResult = await client.query(
    `SELECT s.*, p.total_amount as purchase_total
     FROM shipments s 
     LEFT JOIN purchases p ON s.purchase_id = p.id 
     WHERE s.id = $1`,
    [shipmentId]
  );
  if (shipmentResult.rows.length === 0 || !shipmentResult.rows[0].purchase_id) return;

  const invoiceValueUsd = parseFloat(shipmentResult.rows[0].purchase_total) || 0;
  const expensesResult = await client.query(
    `SELECT COALESCE(SUM(total_egp), 0) as total_expenses FROM shipment_expenses WHERE shipment_id = $1`,
    [shipmentId]
  );
  const totalExpensesEgp = parseFloat(expensesResult.rows[0].total_expenses) || 0;
  let actualExchangeRate = 0;
  if (invoiceValueUsd > 0) actualExchangeRate = totalExpensesEgp / invoiceValueUsd;

  await client.query(
    `UPDATE shipments SET actual_exchange_rate = $1, total_cost_egp = $2, updated_at = NOW() WHERE id = $3`,
    [actualExchangeRate, totalExpensesEgp, shipmentId]
  );
}

module.exports = router;
