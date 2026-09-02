const express = require('express');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// INVENTORY REPORTS API (تقارير المخزون)
// ═══════════════════════════════════════════════════════════════

// GET /inventory-reports/summary - ملخص المخزون
router.get('/summary', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_items,
        SUM(quantity) as total_quantity,
        SUM(quantity * unit_cost) as total_value,
        SUM(tax_inventory_quantity) as total_tax_quantity,
        SUM(tax_inventory_quantity * unit_cost) as total_tax_value
      FROM items
      WHERE status = 'active'
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[GET /inventory-reports/summary] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /inventory-reports/items - تقرير الأصناف
router.get('/items', verifyToken, async (req, res) => {
  const { category_id, supplier_id, has_serial, low_stock } = req.query;
  try {
   let query = `
  SELECT
    i.id, i.code, i.name, i.category_id, ic.name as category_name,
    i.quantity, i.unit_cost, i.quantity * i.unit_cost as total_value,
    i.tax_inventory_quantity, i.tax_inventory_quantity * i.unit_cost as tax_value,
    i.reorder_level, i.status,
    i.is_vat_exempt, i.is_profit_tax_exempt,
    i.customs_duty_rate, i.customs_duty_amount,
    s.name as supplier_name
  FROM items i
  LEFT JOIN item_categories ic ON i.category_id = ic.id
  LEFT JOIN suppliers s ON i.supplier_id = s.id
  WHERE i.status = 'active'
`;

const params = [];
if(category_id) { params.push(category_id); query += ` AND i.category_id = $${params.length}`; }
if(supplier_id) { params.push(supplier_id); query += ` AND i.supplier_id = $${params.length}`; }
if(has_serial === 'true') { query += ` AND i.has_serial = true`; }
if(low_stock === 'true') { query += ` AND i.quantity <= i.reorder_level`; }

// ✅ إضافة فلتر الرصيد (افتراضياً نخفي صفر الرصيد)
const showZeroStock = req.query.show_zero_stock === 'true';
if (!showZeroStock) {
  query += ` AND i.quantity > 0`;
}

query += ` ORDER BY i.name`;
    const params = [];
    if (category_id) { params.push(category_id); query += ` AND i.category_id = $${params.length}`; }
    if (supplier_id) { params.push(supplier_id); query += ` AND i.supplier_id = $${params.length}`; }
    if (has_serial === 'true') { query += ` AND i.has_serial = true`; }
    if (low_stock === 'true') { query += ` AND i.quantity <= i.reorder_level`; }
    query += ` ORDER BY i.name`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /inventory-reports/items] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /inventory-reports/tax-inventory - المخزون الضريبي
router.get('/tax-inventory', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        i.id, i.code, i.name, i.category_id, ic.name as category_name,
        i.quantity as actual_quantity,
        i.tax_inventory_quantity,
        i.quantity - i.tax_inventory_quantity as difference,
        i.unit_cost,
        i.tax_inventory_quantity * i.unit_cost as tax_value,
        s.name as supplier_name
      FROM items i
      LEFT JOIN item_categories ic ON i.category_id = ic.id
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      WHERE i.tax_inventory_quantity > 0
      ORDER BY i.name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /inventory-reports/tax-inventory] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /inventory-reports/comparison - مقارنة المخزون الفعلي والضريبي
router.get('/comparison', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        i.id, i.code, i.name,
        i.quantity as actual_quantity,
        i.tax_inventory_quantity,
        i.quantity - i.tax_inventory_quantity as difference,
        CASE 
          WHEN i.quantity > i.tax_inventory_quantity THEN 'فائض'
          WHEN i.quantity < i.tax_inventory_quantity THEN 'عجز'
          ELSE 'متطابق'
        END as status,
        i.unit_cost,
        (i.quantity - i.tax_inventory_quantity) * i.unit_cost as value_difference
      FROM items i
      WHERE i.status = 'active'
      ORDER BY ABS(i.quantity - i.tax_inventory_quantity) DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /inventory-reports/comparison] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /inventory-reports/movements - حركات المخزون
router.get('/movements', verifyToken, async (req, res) => {
  const { item_id, from_date, to_date, movement_type } = req.query;
  try {
    let query = `
      SELECT 
        im.*,
        i.name as item_name, i.code as item_code,
        u.full_name as created_by_name
      FROM inventory_movements im
      LEFT JOIN items i ON im.item_id = i.id
      LEFT JOIN users u ON im.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (item_id) { params.push(item_id); query += ` AND im.item_id = $${params.length}`; }
    if (from_date) { params.push(from_date); query += ` AND im.movement_date >= $${params.length}`; }
    if (to_date) { params.push(to_date); query += ` AND im.movement_date <= $${params.length}`; }
    if (movement_type) { params.push(movement_type); query += ` AND im.movement_type = $${params.length}`; }
    query += ` ORDER BY im.movement_date DESC, im.id DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /inventory-reports/movements] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /inventory-reports/serial-numbers - تقرير السريالات
router.get('/serial-numbers', verifyToken, async (req, res) => {
  const { item_id, status, from_date, to_date } = req.query;
  try {
    let query = `
      SELECT 
        sn.*,
        i.name as item_name, i.code as item_code,
        rv.voucher_number as receipt_voucher_number,
        so.sales_order_number
      FROM serial_numbers sn
      LEFT JOIN items i ON sn.item_id = i.id
      LEFT JOIN receipt_vouchers rv ON sn.receipt_voucher_id = rv.id
      LEFT JOIN sales_orders so ON sn.sales_order_id = so.id
      WHERE 1=1
    `;
    const params = [];
    if (item_id) { params.push(item_id); query += ` AND sn.item_id = $${params.length}`; }
    if (status) { params.push(status); query += ` AND sn.status = $${params.length}`; }
    if (from_date) { params.push(from_date); query += ` AND sn.created_at >= $${params.length}`; }
    if (to_date) { params.push(to_date); query += ` AND sn.created_at <= $${params.length}`; }
    query += ` ORDER BY sn.created_at DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /inventory-reports/serial-numbers] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /inventory-reports/purchases-by-item - مشتريات حسب الصنف
router.get('/purchases-by-item', verifyToken, async (req, res) => {
  const { item_id, from_date, to_date, supplier_id } = req.query;
  try {
    let query = `
      SELECT 
        pi.id, pi.item_id, i.name as item_name, i.code as item_code,
        pi.quantity, pi.unit_price, pi.total_price, pi.currency,
        p.purchase_number, p.purchase_date, p.purchase_type,
        s.name as supplier_name,
        sh.shipment_number, sh.actual_exchange_rate
      FROM purchase_items pi
      LEFT JOIN items i ON pi.item_id = i.id
      LEFT JOIN purchases p ON pi.purchase_id = p.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN shipments sh ON p.shipment_id = sh.id
      WHERE p.status = 'posted'
    `;
    const params = [];
    if (item_id) { params.push(item_id); query += ` AND pi.item_id = $${params.length}`; }
    if (from_date) { params.push(from_date); query += ` AND p.purchase_date >= $${params.length}`; }
    if (to_date) { params.push(to_date); query += ` AND p.purchase_date <= $${params.length}`; }
    if (supplier_id) { params.push(supplier_id); query += ` AND p.supplier_id = $${params.length}`; }
    query += ` ORDER BY p.purchase_date DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /inventory-reports/purchases-by-item] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /inventory-reports/shipments-cost - تكلفة الشحنات
router.get('/shipments-cost', verifyToken, async (req, res) => {
  const { from_date, to_date, supplier_id } = req.query;
  try {
    let query = `
      SELECT 
        sh.id, sh.shipment_number, sh.shipment_year,
        sh.actual_exchange_rate, sh.total_cost_egp,
        sh.purchase_id, p.purchase_number, p.total_amount as invoice_value_usd,
        p.exchange_rate as bank_exchange_rate,
        s.name as supplier_name,
        (SELECT COALESCE(SUM(total_egp), 0) FROM shipment_expenses WHERE shipment_id = sh.id) as total_expenses,
        (SELECT COALESCE(SUM(total_egp), 0) FROM shipment_expenses WHERE shipment_id = sh.id AND expense_type = 'سداد مورد') as bank_payments,
        (SELECT COALESCE(SUM(total_egp), 0) FROM shipment_expenses WHERE shipment_id = sh.id AND expense_type != 'سداد مورد') as other_expenses,
        (SELECT COALESCE(SUM(import_tax), 0) FROM shipment_clearances WHERE shipment_id = sh.id) as total_customs_duty,
        (SELECT COALESCE(SUM(vat_14_amount), 0) FROM shipment_clearances WHERE shipment_id = sh.id) as total_vat,
        (SELECT COALESCE(SUM(profit_tax_amount), 0) FROM shipment_clearances WHERE shipment_id = sh.id) as total_profit_tax
      FROM shipments sh
      LEFT JOIN purchases p ON sh.purchase_id = p.id
      LEFT JOIN suppliers s ON sh.supplier_id = s.id
      WHERE sh.status != 'cancelled'
    `;
    const params = [];
    if (from_date) { params.push(from_date); query += ` AND sh.created_at >= $${params.length}`; }
    if (to_date) { params.push(to_date); query += ` AND sh.created_at <= $${params.length}`; }
    if (supplier_id) { params.push(supplier_id); query += ` AND sh.supplier_id = $${params.length}`; }
    query += ` ORDER BY sh.shipment_year DESC, sh.shipment_number DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /inventory-reports/shipments-cost] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /inventory-reports/shipments-cost/:shipmentId - تفاصيل تكلفة شحنة
router.get('/shipments-cost/:shipmentId', verifyToken, async (req, res) => {
  try {
    // بيانات الشحنة
    const shipmentResult = await pool.query(
      `SELECT sh.*, p.purchase_number, p.total_amount as invoice_value_usd, p.exchange_rate as bank_exchange_rate, s.name as supplier_name
       FROM shipments sh
       LEFT JOIN purchases p ON sh.purchase_id = p.id
       LEFT JOIN suppliers s ON sh.supplier_id = s.id
       WHERE sh.id = $1`,
      [req.params.shipmentId]
    );
    if (shipmentResult.rows.length === 0) return res.status(404).json({ message: 'الشحنة غير موجودة' });
    const shipment = shipmentResult.rows[0];

    // المصاريف
    const expensesResult = await pool.query(
      `SELECT * FROM shipment_expenses WHERE shipment_id = $1 ORDER BY expense_date`,
      [req.params.shipmentId]
    );

    // الإفراج الجمركي
    const clearanceResult = await pool.query(
      `SELECT * FROM shipment_clearances WHERE shipment_id = $1`,
      [req.params.shipmentId]
    );

    // أصناف الفاتورة
    const itemsResult = await pool.query(
      `SELECT pi.*, i.name as item_name, i.code as item_code
       FROM purchase_items pi
       LEFT JOIN items i ON pi.item_id = i.id
       WHERE pi.purchase_id = $1`,
      [shipment.purchase_id]
    );

    // حساب تكلفة كل صنف
    const actualExchangeRate = parseFloat(shipment.actual_exchange_rate) || 0;
    const itemsWithCost = itemsResult.rows.map(item => {
      const unitPriceUsd = parseFloat(item.unit_price) || 0;
      const quantity = parseFloat(item.quantity) || 1;
      const unitCostEgp = unitPriceUsd * actualExchangeRate;
      return {
        ...item,
        unit_price_usd: unitPriceUsd,
        unit_cost_egp: unitCostEgp.toFixed(2),
        total_cost_egp: (unitCostEgp * quantity).toFixed(2)
      };
    });

    res.json({
      shipment,
      expenses: expensesResult.rows,
      clearances: clearanceResult.rows,
      items: itemsWithCost,
      summary: {
        invoice_value_usd: parseFloat(shipment.invoice_value_usd) || 0,
        bank_exchange_rate: parseFloat(shipment.bank_exchange_rate) || 0,
        total_expenses: expensesResult.rows.reduce((sum, e) => sum + parseFloat(e.total_egp || 0), 0),
        total_clearance_taxes: clearanceResult.rows.reduce((sum, c) => sum + parseFloat(c.total_taxes || 0), 0),
        actual_exchange_rate: actualExchangeRate,
        total_cost_egp: parseFloat(shipment.total_cost_egp) || 0
      }
    });
  } catch (err) {
    console.error('[GET /shipments-cost/:shipmentId] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
