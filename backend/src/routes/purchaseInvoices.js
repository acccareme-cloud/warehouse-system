const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Generate next invoice number
router.get('/next-number', verifyToken, async (req, res) => {
  const { type } = req.query;
  try {
    const prefix = type === 'import' ? 'PIN-IMP' : 'PIN-LOC';
    const result = await pool.query(
      `SELECT invoice_number FROM purchase_invoices WHERE invoice_number LIKE $1 ORDER BY id DESC LIMIT 1`,
      [`${prefix}-%`]
    );
    let nextNumber = `${prefix}-0001`;
    if (result.rows.length > 0) {
      const last = parseInt(result.rows[0].invoice_number.split('-')[2]);
      nextNumber = `${prefix}-${String(last + 1).padStart(4, '0')}`;
    }
    res.json({ nextNumber });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get approved orders for invoices
router.get('/approved-orders', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT po.*, i.name as item_name, i.code as item_code, s.name as supplier_name
       FROM purchase_orders po
       JOIN items i ON po.item_id = i.id
       LEFT JOIN suppliers s ON po.supplier_id = s.id
       WHERE (po.status = 'approved' OR po.status = 'draft')
       AND NOT EXISTS (
         SELECT 1 FROM purchase_invoices pi 
         WHERE pi.po_id = po.id
       )
       ORDER BY po.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create purchase invoice
router.post('/', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const {
    invoice_number, invoice_type, po_id, supplier_id, supplier_name,
    item_id, quantity, unit_price, tax_discount_percent,
    has_vat, has_discount_tax,
    final_release_value, import_tax, customs_duty, customs_vat,
    shipping_cost, clearance_fees, other_fees,
    insurance_cost, loading_cost, unloading_cost, delivery_cost,
    transport_cost, maritime_fees, gas_cost, admin_fees,
    port_fees, exit_gate_fees, offers_cost, renewal_fees,
    political_approvals, strategic_approvals, bank_fees
  } = req.body;

  try {
    const qty = parseFloat(quantity);
    const price = parseFloat(unit_price);
    const subtotal = qty * price;
    const tax14 = (has_vat !== false) ? subtotal * 0.14 : 0;
    const taxDiscountRate = (has_discount_tax !== false) ? (parseFloat(tax_discount_percent) || 0) : 0;
    const taxDiscount = subtotal * (taxDiscountRate / 100);
    const total = subtotal + tax14 - taxDiscount;

    let extraCosts = 0;
    let landedCost = 0;
    
    if (invoice_type === 'import') {
      extraCosts = 
        (parseFloat(shipping_cost) || 0) +
        (parseFloat(customs_duty) || 0) +
        (parseFloat(customs_vat) || 0) +
        (parseFloat(clearance_fees) || 0) +
        (parseFloat(other_fees) || 0) +
        (parseFloat(import_tax) || 0) +
        (parseFloat(insurance_cost) || 0) +
        (parseFloat(loading_cost) || 0) +
        (parseFloat(unloading_cost) || 0) +
        (parseFloat(delivery_cost) || 0) +
        (parseFloat(transport_cost) || 0) +
        (parseFloat(maritime_fees) || 0) +
        (parseFloat(gas_cost) || 0) +
        (parseFloat(admin_fees) || 0) +
        (parseFloat(port_fees) || 0) +
        (parseFloat(exit_gate_fees) || 0) +
        (parseFloat(offers_cost) || 0) +
        (parseFloat(renewal_fees) || 0) +
        (parseFloat(political_approvals) || 0) +
        (parseFloat(strategic_approvals) || 0) +
        (parseFloat(bank_fees) || 0);
      
      landedCost = qty > 0 ? price + (extraCosts / qty) : 0;
    }

    const grandTotal = total + extraCosts;

    const result = await pool.query(
      `INSERT INTO purchase_invoices (
        invoice_number, invoice_type, po_id, supplier_id, supplier_name, item_id, quantity, unit_price,
        subtotal, tax_14_percent, tax_discount_percent, tax_discount_amount, total_amount,
        has_vat, has_discount_tax,
        final_release_value, import_tax, customs_duty, customs_vat, shipping_cost, clearance_fees, other_fees,
        insurance_cost, loading_cost, unloading_cost, delivery_cost, transport_cost, maritime_fees,
        gas_cost, admin_fees, port_fees, exit_gate_fees, offers_cost, renewal_fees,
        political_approvals, strategic_approvals, bank_fees,
        extra_costs, landed_cost, grand_total,
        status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42)
      RETURNING *`,
      [
        invoice_number, invoice_type, po_id, supplier_id, supplier_name, item_id, qty, price,
        subtotal, tax14, taxDiscountRate, taxDiscount, total,
        has_vat !== false, has_discount_tax !== false,
        final_release_value || 0, import_tax || 0, customs_duty || 0, customs_vat || 0, 
        shipping_cost || 0, clearance_fees || 0, other_fees || 0,
        insurance_cost || 0, loading_cost || 0, unloading_cost || 0, delivery_cost || 0,
        transport_cost || 0, maritime_fees || 0, gas_cost || 0, admin_fees || 0,
        port_fees || 0, exit_gate_fees || 0, offers_cost || 0, renewal_fees || 0,
        political_approvals || 0, strategic_approvals || 0, bank_fees || 0,
        extraCosts, landedCost, grandTotal,
        'draft', req.user.id
      ]
    );

    res.status(201).json({
      message: 'Invoice created successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating invoice:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update invoice
router.put('/:id', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { id } = req.params;
  const {
    invoice_number, invoice_type, po_id, supplier_id, supplier_name,
    item_id, quantity, unit_price, tax_discount_percent,
    has_vat, has_discount_tax,
    final_release_value, import_tax, customs_duty, customs_vat,
    shipping_cost, clearance_fees, other_fees,
    insurance_cost, loading_cost, unloading_cost, delivery_cost,
    transport_cost, maritime_fees, gas_cost, admin_fees,
    port_fees, exit_gate_fees, offers_cost, renewal_fees,
    political_approvals, strategic_approvals, bank_fees
  } = req.body;

  try {
    const qty = parseFloat(quantity);
    const price = parseFloat(unit_price);
    const subtotal = qty * price;
    const tax14 = (has_vat !== false) ? subtotal * 0.14 : 0;
    const taxDiscountRate = (has_discount_tax !== false) ? (parseFloat(tax_discount_percent) || 0) : 0;
    const taxDiscount = subtotal * (taxDiscountRate / 100);
    const total = subtotal + tax14 - taxDiscount;

    let extraCosts = 0;
    let landedCost = 0;
    
    if (invoice_type === 'import') {
      extraCosts = 
        (parseFloat(shipping_cost) || 0) +
        (parseFloat(customs_duty) || 0) +
        (parseFloat(customs_vat) || 0) +
        (parseFloat(clearance_fees) || 0) +
        (parseFloat(other_fees) || 0) +
        (parseFloat(import_tax) || 0) +
        (parseFloat(insurance_cost) || 0) +
        (parseFloat(loading_cost) || 0) +
        (parseFloat(unloading_cost) || 0) +
        (parseFloat(delivery_cost) || 0) +
        (parseFloat(transport_cost) || 0) +
        (parseFloat(maritime_fees) || 0) +
        (parseFloat(gas_cost) || 0) +
        (parseFloat(admin_fees) || 0) +
        (parseFloat(port_fees) || 0) +
        (parseFloat(exit_gate_fees) || 0) +
        (parseFloat(offers_cost) || 0) +
        (parseFloat(renewal_fees) || 0) +
        (parseFloat(political_approvals) || 0) +
        (parseFloat(strategic_approvals) || 0) +
        (parseFloat(bank_fees) || 0);
      
      landedCost = qty > 0 ? price + (extraCosts / qty) : 0;
    }

    const grandTotal = total + extraCosts;

    const result = await pool.query(
      `UPDATE purchase_invoices SET
        invoice_number = $1, invoice_type = $2, po_id = $3, supplier_id = $4, supplier_name = $5,
        item_id = $6, quantity = $7, unit_price = $8,
        subtotal = $9, tax_14_percent = $10, tax_discount_percent = $11, tax_discount_amount = $12, total_amount = $13,
        has_vat = $14, has_discount_tax = $15,
        final_release_value = $16, import_tax = $17, customs_duty = $18, customs_vat = $19,
        shipping_cost = $20, clearance_fees = $21, other_fees = $22,
        insurance_cost = $23, loading_cost = $24, unloading_cost = $25, delivery_cost = $26,
        transport_cost = $27, maritime_fees = $28, gas_cost = $29, admin_fees = $30,
        port_fees = $31, exit_gate_fees = $32, offers_cost = $33, renewal_fees = $34,
        political_approvals = $35, strategic_approvals = $36, bank_fees = $37,
        extra_costs = $38, landed_cost = $39, grand_total = $40,
        updated_at = NOW()
      WHERE id = $41 AND status = 'draft'
      RETURNING *`,
      [
        invoice_number, invoice_type, po_id, supplier_id, supplier_name, item_id, qty, price,
        subtotal, tax14, taxDiscountRate, taxDiscount, total,
        has_vat !== false, has_discount_tax !== false,
        final_release_value || 0, import_tax || 0, customs_duty || 0, customs_vat || 0,
        shipping_cost || 0, clearance_fees || 0, other_fees || 0,
        insurance_cost || 0, loading_cost || 0, unloading_cost || 0, delivery_cost || 0,
        transport_cost || 0, maritime_fees || 0, gas_cost || 0, admin_fees || 0,
        port_fees || 0, exit_gate_fees || 0, offers_cost || 0, renewal_fees || 0,
        political_approvals || 0, strategic_approvals || 0, bank_fees || 0,
        extraCosts, landedCost, grandTotal,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Invoice not found or not in draft status' });
    }

    res.json({
      message: 'Invoice updated successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating invoice:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete invoice
router.delete('/:id', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM purchase_invoices WHERE id = $1 AND status = 'draft' RETURNING *`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Invoice not found or not in draft status' });
    }
    
    res.json({ message: 'Invoice deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Manager approval
router.put('/:id/manager-approve', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE purchase_invoices SET status = 'approved_manager', manager_approved_by = $1, manager_approved_at = NOW()
       WHERE id = $2 AND status = 'draft'
       RETURNING *`,
      [req.user.id, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Invoice not found or not in draft status' });
    }
    
    res.json({ message: 'Manager approved', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Finance approval
router.put('/:id/finance-approve', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE purchase_invoices SET status = 'approved_finance', finance_approved_by = $1, finance_approved_at = NOW()
       WHERE id = $2 AND status = 'approved_manager'
       RETURNING *`,
      [req.user.id, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Invoice not found or not approved by manager' });
    }

    // Auto create receipt voucher
    const invoice = result.rows[0];
    if (invoice) {
      await pool.query(
        `INSERT INTO receipt_vouchers (voucher_number, supplier, item_id, warehouse_id, quantity, purchase_price, 
          tax_14_percent, tax_discount_percent, tax_discount_amount, total_amount, supply_order, receipt_date, created_by, status)
         VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9, $10, CURRENT_DATE, $11, 'pending')`,
        [
          `RCV-${invoice.invoice_number}`, invoice.supplier_name, invoice.item_id,
          invoice.quantity, invoice.unit_price, invoice.tax_14_percent,
          invoice.tax_discount_percent, invoice.tax_discount_amount, invoice.total_amount,
          invoice.po_id ? `PO-${invoice.po_id}` : '', req.user.id
        ]
      );
    }

    res.json({ message: 'Finance approved and receipt created', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get invoices by status
router.get('/by-status/:status', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pi.*, i.name as item_name, i.code as item_code, s.name as supplier_name
       FROM purchase_invoices pi
       LEFT JOIN items i ON pi.item_id = i.id
       LEFT JOIN suppliers s ON pi.supplier_id = s.id
       WHERE pi.status = $1
       ORDER BY pi.created_at DESC`,
      [req.params.status]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all invoices
router.get('/all', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pi.*, i.name as item_name, i.code as item_code, s.name as supplier_name
       FROM purchase_invoices pi
       LEFT JOIN items i ON pi.item_id = i.id
       LEFT JOIN suppliers s ON pi.supplier_id = s.id
       ORDER BY pi.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get single invoice
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pi.*, i.name as item_name, i.code as item_code
       FROM purchase_invoices pi
       JOIN items i ON pi.item_id = i.id
       WHERE pi.id = $1`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;