const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Generate next invoice number
router.get('/next-number', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT invoice_number FROM tax_invoices 
       WHERE invoice_number LIKE 'TAX-%' 
       ORDER BY id DESC LIMIT 1`
    );

    let nextNumber = 'TAX-0001';
    if (result.rows.length > 0) {
      const last = parseInt(result.rows[0].invoice_number.split('-')[1]);
      nextNumber = `TAX-${String(last + 1).padStart(4, '0')}`;
    }

    res.json({ nextNumber });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create tax invoice
router.post('/', verifyToken, requireRole('sales', 'admin'), async (req, res) => {
  const {
    invoice_number, invoice_date, customer_id, customer_name,
    items, pricing_sheet_ids, notes, payment_due_date
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // نجيب إعدادات الضريبة
    const taxResult = await client.query('SELECT * FROM tax_settings ORDER BY id DESC LIMIT 1');
    const taxSettings = taxResult.rows[0] || { vat_rate: 14.00, withholding_rate: 20.00 };

    // نجيب إعدادات العميل
    const customerTaxResult = await client.query(
      'SELECT * FROM customer_tax_settings WHERE customer_id = $1',
      [customer_id]
    );
    const customerTax = customerTaxResult.rows[0] || { has_vat: true, has_withholding: false };

    // نحسب المبالغ
    let subtotal = 0;
    for (const item of items) {
      subtotal += parseFloat(item.quantity) * parseFloat(item.unit_price);
    }

    const vatRate = customerTax.has_vat ? taxSettings.vat_rate : 0;
    const vatAmount = subtotal * (vatRate / 100);

    const withholdingRate = customerTax.has_withholding ? taxSettings.withholding_rate : 0;
    const withholdingAmount = vatAmount * (withholdingRate / 100);

    const totalAmount = subtotal + vatAmount - withholdingAmount;

    // ننشئ الفاتورة
    const invoiceResult = await client.query(
      `INSERT INTO tax_invoices (
        invoice_number, invoice_date, customer_id, customer_name,
        subtotal, vat_rate, vat_amount, withholding_rate, withholding_amount,
        total_amount, payment_status, remaining_amount, payment_due_date,
        status, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        invoice_number, invoice_date, customer_id, customer_name,
        subtotal, vatRate, vatAmount, withholdingRate, withholdingAmount,
        totalAmount, 'unpaid', totalAmount, payment_due_date,
        'draft', notes, req.user.id
      ]
    );

    const invoiceId = invoiceResult.rows[0].id;

    // نضيف الأصناف
    for (const item of items) {
      await client.query(
        `INSERT INTO tax_invoice_items (
          invoice_id, item_id, item_name, quantity, unit_price, total_price, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          invoiceId, item.item_id, item.item_name,
          item.quantity, item.unit_price,
          item.quantity * item.unit_price, item.notes
        ]
      );
    }

    // نربط ببيانات التسليم المسعر
    if (pricing_sheet_ids && pricing_sheet_ids.length > 0) {
      for (const sheetId of pricing_sheet_ids) {
        await client.query(
          `INSERT INTO tax_invoice_pricing_links (invoice_id, pricing_sheet_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [invoiceId, sheetId]
        );

        // نحدث حالة بيان التسليم
        await client.query(
          `UPDATE pricing_sheets SET status = 'linked_to_invoice', updated_at = NOW()
           WHERE id = $1`,
          [sheetId]
        );
      }
    }

    // نضيف في دفتر أستاذ العميل
    await client.query(
      `INSERT INTO customer_ledger (
        customer_id, transaction_date, transaction_type, reference_type,
        reference_id, reference_number, debit, balance, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9)`,
      [
        customer_id, invoice_date, 'فاتورة ضريبية', 'tax_invoice',
        invoiceId, invoice_number, totalAmount, 'فاتورة ضريبية جديدة', req.user.id
      ]
    );

    await client.query('COMMIT');
    res.status(201).json({
      message: 'تم إنشاء الفاتورة الضريبية بنجاح',
      data: invoiceResult.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Get all tax invoices
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ti.*, c.name as customer_name_display, c.code as customer_code,
        u.full_name as created_by_name,
        (SELECT COUNT(*) FROM tax_invoice_items WHERE invoice_id = ti.id) as items_count,
        (SELECT COUNT(*) FROM tax_invoice_pricing_links WHERE invoice_id = ti.id) as linked_sheets_count
       FROM tax_invoices ti
       LEFT JOIN customers c ON ti.customer_id = c.id
       LEFT JOIN users u ON ti.created_by = u.id
       ORDER BY ti.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get tax invoice by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const invoiceResult = await pool.query(
      `SELECT ti.*, c.name as customer_name_display, c.code as customer_code,
        u.full_name as created_by_name
       FROM tax_invoices ti
       LEFT JOIN customers c ON ti.customer_id = c.id
       LEFT JOIN users u ON ti.created_by = u.id
       WHERE ti.id = $1`,
      [req.params.id]
    );

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ message: 'الفاتورة غير موجودة' });
    }

    const itemsResult = await pool.query(
      `SELECT * FROM tax_invoice_items WHERE invoice_id = $1 ORDER BY id`,
      [req.params.id]
    );

    const linksResult = await pool.query(
      `SELECT ps.* FROM pricing_sheets ps
       JOIN tax_invoice_pricing_links tipl ON ps.id = tipl.pricing_sheet_id
       WHERE tipl.invoice_id = $1`,
      [req.params.id]
    );

    res.json({
      ...invoiceResult.rows[0],
      items: itemsResult.rows,
      linked_sheets: linksResult.rows
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update tax invoice (draft only)
router.put('/:id', verifyToken, requireRole('sales', 'admin'), async (req, res) => {
  const { id } = req.params;
  const { invoice_date, customer_id, customer_name, items, pricing_sheet_ids, notes, payment_due_date } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // نجيب إعدادات الضريبة
    const taxResult = await client.query('SELECT * FROM tax_settings ORDER BY id DESC LIMIT 1');
    const taxSettings = taxResult.rows[0] || { vat_rate: 14.00, withholding_rate: 20.00 };

    // نجيب إعدادات العميل
    const customerTaxResult = await client.query(
      'SELECT * FROM customer_tax_settings WHERE customer_id = $1',
      [customer_id]
    );
    const customerTax = customerTaxResult.rows[0] || { has_vat: true, has_withholding: false };

    // نحسب المبالغ
    let subtotal = 0;
    for (const item of items) {
      subtotal += parseFloat(item.quantity) * parseFloat(item.unit_price);
    }

    const vatRate = customerTax.has_vat ? taxSettings.vat_rate : 0;
    const vatAmount = subtotal * (vatRate / 100);

    const withholdingRate = customerTax.has_withholding ? taxSettings.withholding_rate : 0;
    const withholdingAmount = vatAmount * (withholdingRate / 100);

    const totalAmount = subtotal + vatAmount - withholdingAmount;

    const result = await client.query(
      `UPDATE tax_invoices 
       SET invoice_date = $1, customer_id = $2, customer_name = $3,
           subtotal = $4, vat_rate = $5, vat_amount = $6,
           withholding_rate = $7, withholding_amount = $8,
           total_amount = $9, remaining_amount = $9, payment_due_date = $10,
           notes = $11, updated_at = NOW()
       WHERE id = $12 AND status = 'draft'
       RETURNING *`,
      [
        invoice_date, customer_id, customer_name,
        subtotal, vatRate, vatAmount,
        withholdingRate, withholdingAmount,
        totalAmount, payment_due_date, notes, id
      ]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'الفاتورة غير موجودة أو تم اعتمادها' });
    }

    // نحذف الأصناف القديمة ونضيف الجديدة
    await client.query('DELETE FROM tax_invoice_items WHERE invoice_id = $1', [id]);

    for (const item of items) {
      await client.query(
        `INSERT INTO tax_invoice_items (
          invoice_id, item_id, item_name, quantity, unit_price, total_price, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id, item.item_id, item.item_name,
          item.quantity, item.unit_price,
          item.quantity * item.unit_price, item.notes
        ]
      );
    }

    // نحدث الربط ببيانات التسليم
    await client.query('DELETE FROM tax_invoice_pricing_links WHERE invoice_id = $1', [id]);

    if (pricing_sheet_ids && pricing_sheet_ids.length > 0) {
      for (const sheetId of pricing_sheet_ids) {
        await client.query(
          `INSERT INTO tax_invoice_pricing_links (invoice_id, pricing_sheet_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [id, sheetId]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'تم تحديث الفاتورة بنجاح', data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Update platform link
router.put('/:id/platform-link', verifyToken, requireRole('sales', 'admin'), async (req, res) => {
  const { platform_number } = req.body;

  try {
    const result = await pool.query(
      `UPDATE tax_invoices 
       SET platform_number = $1, linked_to_platform = true, linked_to_platform_date = CURRENT_DATE,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [platform_number, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'الفاتورة غير موجودة' });
    }

    res.json({ message: 'تم ربط الفاتورة بالمنصة بنجاح', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update payment status
router.put('/:id/payment', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { paid_amount, payment_date } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const invoiceResult = await pool.query(
      'SELECT * FROM tax_invoices WHERE id = $1',
      [req.params.id]
    );

    if (invoiceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'الفاتورة غير موجودة' });
    }

    const invoice = invoiceResult.rows[0];
    const newPaidAmount = parseFloat(invoice.paid_amount || 0) + parseFloat(paid_amount);
    const remainingAmount = parseFloat(invoice.total_amount) - newPaidAmount;

    let paymentStatus = 'unpaid';
    if (remainingAmount <= 0) paymentStatus = 'paid';
    else if (newPaidAmount > 0) paymentStatus = 'partial';

    const result = await client.query(
      `UPDATE tax_invoices 
       SET paid_amount = $1, remaining_amount = $2, payment_status = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [newPaidAmount, remainingAmount, paymentStatus, req.params.id]
    );

    // نضيف في دفتر أستاذ العميل
    await client.query(
      `INSERT INTO customer_ledger (
        customer_id, transaction_date, transaction_type, reference_type,
        reference_id, reference_number, credit, balance, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        invoice.customer_id, payment_date || new Date(), 'تحصيل', 'tax_invoice_payment',
        invoice.id, invoice.invoice_number, paid_amount, remainingAmount,
        'تحصيل فاتورة ضريبية', req.user.id
      ]
    );

    await client.query('COMMIT');
    res.json({ message: 'تم تسجيل التحصيل بنجاح', data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Update deduction certificate status
router.put('/:id/deduction', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { status, certificate_number, certificate_date, certificate_amount } = req.body;

  try {
    const result = await pool.query(
      `UPDATE tax_invoices 
       SET deduction_certificate_status = $1, deduction_certificate_number = $2,
           deduction_certificate_date = $3, deduction_certificate_amount = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [status, certificate_number, certificate_date, certificate_amount, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'الفاتورة غير موجودة' });
    }

    res.json({ message: 'تم تحديث بيان الاستقطاع بنجاح', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Manager approval
router.put('/:id/manager-approve', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE tax_invoices 
       SET status = 'approved_manager', updated_at = NOW()
       WHERE id = $1 AND status = 'draft'
       RETURNING *`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'الفاتورة غير موجودة أو تم اعتمادها' });
    }

    res.json({ message: 'تم اعتماد الفاتورة من المدير', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Finance approval
router.put('/:id/finance-approve', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE tax_invoices 
       SET status = 'approved_finance', updated_at = NOW()
       WHERE id = $1 AND status = 'approved_manager'
       RETURNING *`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'الفاتورة غير موجودة أو لم يتم اعتمادها من المدير' });
    }

    res.json({ message: 'تم اعتماد الفاتورة من المالية', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete tax invoice (draft only)
router.delete('/:id', verifyToken, requireRole('sales', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM tax_invoices WHERE id = $1 AND status = 'draft' RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'لا يمكن حذف الفاتورة المعتمدة' });
    }

    res.json({ message: 'تم الحذف بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
