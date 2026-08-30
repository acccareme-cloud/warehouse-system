const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Helper: get supplier_id by name
async function getSupplierIdByName(client, supplierName) {
  const result = await client.query(
    'SELECT id FROM suppliers WHERE name = $1 OR supplier_name = $1 LIMIT 1',
    [supplierName]
  );
  return result.rows.length > 0 ? result.rows[0].id : null;
}

// Helper: record invoice in supplier_ledger
async function recordSupplierLedger(client, supplierId, purchase, userId, notes) {
  if (!supplierId) return;
  const amount = parseFloat(purchase.net_amount || purchase.total_amount || 0);
  if (amount <= 0) return;

  await client.query(
    `SELECT update_supplier_ledger($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [supplierId, 'invoice', purchase.id, 'purchase', purchase.purchase_number, amount, 0, notes || 'فاتورة مشتريات', userId]
  );
}

// Helper: reverse invoice from supplier_ledger
async function reverseSupplierLedger(client, supplierId, purchase, userId, notes) {
  if (!supplierId) return;
  const amount = parseFloat(purchase.net_amount || purchase.total_amount || 0);
  if (amount <= 0) return;

  await client.query(
    `SELECT update_supplier_ledger($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [supplierId, 'return', purchase.id, 'purchase', purchase.purchase_number, 0, amount, notes || 'عكس فاتورة مشتريات - إلغاء/تعديل', userId]
  );
}

// Get next number
router.get('/next-number', verifyToken, async (req, res) => {
  const { type } = req.query;
  try {
    let prefix;
    if (type === 'invoice_local') {
      prefix = 'PIN-LOC';
    } else if (type === 'invoice_import') {
      prefix = 'PIN-IMP';
    } else {
      prefix = type === 'import' ? 'IMP' : 'LOC';
    }

    const result = await pool.query(`
      SELECT purchase_number as number 
      FROM purchases 
      WHERE purchase_number LIKE $1
      ORDER BY created_at DESC 
      LIMIT 1
    `, [`${prefix}-%`]);

    let nextNumber = `${prefix}-0001`;
    if (result.rows.length > 0) {
      const lastNumber = result.rows[0].number;
      const match = lastNumber.match(/\d+/);
      if (match) {
        const lastNum = parseInt(match[0]);
        nextNumber = `${prefix}-${String(lastNum + 1).padStart(4, '0')}`;
      }
    }

    res.json({ nextNumber });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create purchase/invoice — MULTI-ITEM support
router.post('/', verifyToken, requireRole('purchasing', 'admin'), async (req, res) => {
  const {
    purchase_type, purchase_number, supplier, warehouse_id,
    tax_discount_percent, has_vat, has_discount_tax, shipment_id, notes, items
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Handle multi-item or single-item
    let itemList = [];
    if (items && Array.isArray(items) && items.length > 0) {
      itemList = items;
    } else if (req.body.item_id) {
      // Backward compatibility: single item
      itemList = [{
        item_id: req.body.item_id,
        quantity: req.body.quantity,
        unit_price: req.body.unit_price,
        unit: req.body.unit,
        notes: ''
      }];
    }

    if (itemList.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'يجب إضافة صنف واحد على الأقل' });
    }

    // Calculate totals from all items
    let subtotal = 0;
    for (const item of itemList) {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      subtotal += qty * price;
    }

    const tax14 = (has_vat !== false) ? subtotal * 0.14 : 0;
    const taxDiscountRate = (has_discount_tax !== false) ? (parseFloat(tax_discount_percent || 0)) : 0;
    const taxDiscount = subtotal * (taxDiscountRate / 100);
    const netAmount = subtotal + tax14 - taxDiscount;

    // Use first item for backward compatibility in main purchase record
    const firstItem = itemList[0];
    const firstQty = parseFloat(firstItem.quantity) || 0;
    const firstPrice = parseFloat(firstItem.unit_price) || 0;

    const result = await client.query(`
      INSERT INTO purchases (
        purchase_type, purchase_number, supplier, item_id, warehouse_id,
        quantity, unit_price, total_amount, tax_14_percent, tax_discount_percent,
        tax_discount_amount, net_amount, unit, landed_cost,
        shipping_cost, customs_duty, customs_vat, clearance_fees, other_fees,
        final_release_value, import_tax, total_with_tax, tax_14_percent_on_total,
        commercial_profit_tax_1_percent, transfer_commission_type, transfer_commission_value,
        transfer_commission_amount, has_vat, has_discount_tax, is_invoice, status, created_by,
        shipment_id, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34)
      RETURNING *
    `, [
      purchase_type, purchase_number, supplier || '', firstItem.item_id, warehouse_id || 1,
      firstQty, firstPrice, subtotal, tax14, taxDiscountRate, taxDiscount, netAmount,
      firstItem.unit || 'عدد', firstPrice,
      0, 0, 0, 0, 0,
      0, 0, 0, 0, 0,
      null, 0, 0,
      has_vat !== false, has_discount_tax !== false,
      true, 'draft', req.user.id,
      shipment_id || null, notes || null
    ]);

    const purchase = result.rows[0];

    // Insert all items into purchase_items
    for (const item of itemList) {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      const itemTotal = qty * price;
      await client.query(`
        INSERT INTO purchase_items (purchase_id, item_id, quantity, unit, unit_price, total_amount, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        purchase.id, item.item_id, qty, item.unit || 'عدد', price, itemTotal, item.notes || ''
      ]);
    }

    await client.query('COMMIT');
    res.status(201).json(purchase);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating purchase:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// UPDATE — تعديل فاتورة (مسموح فقط في حالة draft) — MULTI-ITEM support
router.put('/:id', verifyToken, requireRole('purchasing', 'admin'), async (req, res) => {
  const { id } = req.params;

  const {
    purchase_type, purchase_number, supplier, warehouse_id,
    tax_discount_percent, has_vat, has_discount_tax, shipment_id, notes, items
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT * FROM purchases WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'الفاتورة غير موجودة' });
    }

    if (existing.rows[0].status !== 'draft') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'لا يمكن تعديل الفاتورة إلا في حالة مسودة. استخدم إلغاء الاعتماد أولاً' });
    }

    // Handle multi-item or single-item
    let itemList = [];
    if (items && Array.isArray(items) && items.length > 0) {
      itemList = items;
    } else if (req.body.item_id) {
      itemList = [{
        item_id: req.body.item_id,
        quantity: req.body.quantity,
        unit_price: req.body.unit_price,
        unit: req.body.unit,
        notes: ''
      }];
    }

    if (itemList.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'يجب إضافة صنف واحد على الأقل' });
    }

    // Calculate totals
    let subtotal = 0;
    for (const item of itemList) {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      subtotal += qty * price;
    }

    const tax14 = (has_vat !== false) ? subtotal * 0.14 : 0;
    const taxDiscountRate = (has_discount_tax !== false) ? (parseFloat(tax_discount_percent || 0)) : 0;
    const taxDiscount = subtotal * (taxDiscountRate / 100);
    const netAmount = subtotal + tax14 - taxDiscount;

    const firstItem = itemList[0];
    const firstQty = parseFloat(firstItem.quantity) || 0;
    const firstPrice = parseFloat(firstItem.unit_price) || 0;

    const result = await client.query(`
      UPDATE purchases SET
        purchase_type = $1,
        purchase_number = $2,
        supplier = $3,
        item_id = $4,
        warehouse_id = $5,
        quantity = $6,
        unit_price = $7,
        total_amount = $8,
        tax_14_percent = $9,
        tax_discount_percent = $10,
        tax_discount_amount = $11,
        net_amount = $12,
        unit = $13,
        landed_cost = $14,
        shipping_cost = 0,
        customs_duty = 0,
        customs_vat = 0,
        clearance_fees = 0,
        other_fees = 0,
        final_release_value = 0,
        import_tax = 0,
        total_with_tax = 0,
        tax_14_percent_on_total = 0,
        commercial_profit_tax_1_percent = 0,
        transfer_commission_type = null,
        transfer_commission_value = 0,
        transfer_commission_amount = 0,
        has_vat = $15,
        has_discount_tax = $16,
        shipment_id = $17,
        notes = $18,
        updated_at = NOW()
      WHERE id = $19
      RETURNING *
    `, [
      purchase_type, purchase_number, supplier || '', firstItem.item_id, warehouse_id,
      firstQty, firstPrice, subtotal, tax14, taxDiscountRate, taxDiscount, netAmount,
      firstItem.unit || 'عدد', firstPrice,
      has_vat !== false, has_discount_tax !== false,
      shipment_id || null, notes || null,
      id
    ]);

    // Delete old items and insert new ones
    await client.query('DELETE FROM purchase_items WHERE purchase_id = $1', [id]);
    for (const item of itemList) {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      const itemTotal = qty * price;
      await client.query(`
        INSERT INTO purchase_items (purchase_id, item_id, quantity, unit, unit_price, total_amount, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        id, item.item_id, qty, item.unit || 'عدد', price, itemTotal, item.notes || ''
      ]);
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating purchase:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// DUPLICATE — تكرار فاتورة
router.post('/:id/duplicate', verifyToken, requireRole('purchasing', 'admin'), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const original = await client.query('SELECT * FROM purchases WHERE id = $1', [id]);
    if (original.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'الفاتورة غير موجودة' });
    }

    const p = original.rows[0];

    // توليد رقم جديد
    const type = p.purchase_type === 'import' ? 'PIN-IMP' : 'PIN-LOC';
    const lastResult = await client.query(
      `SELECT purchase_number FROM purchases WHERE purchase_number LIKE $1 ORDER BY id DESC LIMIT 1`,
      [`${type}-%`]
    );
    let nextNumber = `${type}-0001`;
    if (lastResult.rows.length > 0) {
      const last = lastResult.rows[0].purchase_number;
      const match = last.match(/\d+/);
      if (match) {
        const num = parseInt(match[0]) + 1;
        nextNumber = `${type}-${String(num).padStart(4, '0')}`;
      }
    }

    // إنشاء فاتورة جديدة
    const result = await client.query(`
      INSERT INTO purchases (
        purchase_type, purchase_number, supplier, item_id, warehouse_id,
        quantity, unit_price, total_amount, tax_14_percent, tax_discount_percent,
        tax_discount_amount, net_amount, unit, landed_cost,
        shipping_cost, customs_duty, customs_vat, clearance_fees, other_fees,
        final_release_value, import_tax, total_with_tax, tax_14_percent_on_total,
        commercial_profit_tax_1_percent, transfer_commission_type, transfer_commission_value,
        transfer_commission_amount, has_vat, has_discount_tax, is_invoice, status, created_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
      RETURNING *
    `, [
      p.purchase_type, nextNumber, p.supplier, p.item_id, p.warehouse_id,
      p.quantity, p.unit_price, p.total_amount, p.tax_14_percent, p.tax_discount_percent,
      p.tax_discount_amount, p.net_amount, p.unit, p.landed_cost,
      p.shipping_cost, p.customs_duty, p.customs_vat, p.clearance_fees, p.other_fees,
      p.final_release_value, p.import_tax, p.total_with_tax, p.tax_14_percent_on_total,
      p.commercial_profit_tax_1_percent, p.transfer_commission_type, p.transfer_commission_value,
      p.transfer_commission_amount, p.has_vat, p.has_discount_tax, true, 'draft', req.user.id,
      `نسخة من ${p.purchase_number}`
    ]);

    const newId = result.rows[0].id;

    // نسخ الأصناف
    const itemsResult = await client.query('SELECT * FROM purchase_items WHERE purchase_id = $1', [id]);
    for (const item of itemsResult.rows) {
      await client.query(`
        INSERT INTO purchase_items (purchase_id, item_id, quantity, unit, unit_price, total_amount, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [newId, item.item_id, item.quantity, item.unit, item.unit_price, item.total_amount, item.notes]);
    }

    await client.query('COMMIT');
    res.status(201).json({
      message: `تم تكرار الفاتورة بنجاح برقم ${nextNumber}`,
      data: result.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Duplicate error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// CANCEL — إلغاء فاتورة وإرجاعها لحالة مسودة (مع إلغاء كل التأثيرات)
router.put('/:id/cancel', verifyToken, requireRole('purchasing', 'admin'), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT * FROM purchases WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'الفاتورة غير موجودة' });
    }

    const purchase = existing.rows[0];

    // لا يمكن إلغاء الفاتورة إذا كانت مسودة (احذفها عادي)
    if (purchase.status === 'draft') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'الفاتورة في حالة مسودة — استخدم الحذف العادي' });
    }

    // 1. لو posted → نرجع المخزن
    if (purchase.status === 'posted') {
      // حذف حركات المخزن
      await client.query(
        `DELETE FROM inventory_movements WHERE reference_type = 'purchase' AND reference_id = $1`,
        [id]
      );

      // خصم الكمية من رصيد المخزن
      const qty = parseFloat(purchase.quantity) || 0;
      await client.query(`
        UPDATE inventory_balances 
        SET quantity = GREATEST(quantity - $1, 0),
            updated_at = NOW()
        WHERE item_id = $2 AND warehouse_id = $3
      `, [qty, purchase.item_id, purchase.warehouse_id]);

      // Serial numbers
      await client.query(`
        UPDATE serial_numbers 
        SET status = 'cancelled'
        WHERE receipt_voucher_id IN (SELECT id FROM receipt_vouchers WHERE purchase_id = $1)
      `, [id]);
    }

    // 2. لو approved أو أعلى → عكس supplier_ledger
    if (['approved', 'quality_passed', 'warehouse_received', 'posted'].includes(purchase.status)) {
      const supplierId = await getSupplierIdByName(client, purchase.supplier);
      if (supplierId) {
        await reverseSupplierLedger(client, supplierId, purchase, req.user.id, 'إلغاء فاتورة وإرجاع لمسودة');
      }
    }

    // 3. إلغاء سند الاستلام
    await client.query(
      `UPDATE receipt_vouchers SET status = 'cancelled' WHERE purchase_id = $1`,
      [id]
    );

    // 4. رجوع الفاتورة لحالة مسودة
    await client.query(`
      UPDATE purchases 
      SET status = 'draft', 
          approved_by = NULL, 
          approved_at = NULL,
          updated_at = NOW()
      WHERE id = $1
    `, [id]);

    // 5. If linked to purchase order, revert PO status back to approved
    if (purchase.purchase_order_id) {
      await client.query(
        "UPDATE purchase_orders SET status = 'approved', updated_at = NOW() WHERE id = $1",
        [purchase.purchase_order_id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'تم إلغاء الفاتورة وإرجاعها لحالة مسودة بنجاح' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Cancel error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// DELETE — حذف فاتورة (مسموح فقط في حالة draft)
router.delete('/:id', verifyToken, requireRole('purchasing', 'admin'), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT * FROM purchases WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'الفاتورة غير موجودة' });
    }

    const purchase = existing.rows[0];

    if (purchase.status !== 'draft') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'لا يمكن حذف الفاتورة إلا في حالة مسودة. استخدم إلغاء الاعتماد أولاً' });
    }

    // Get purchase_order_id before deleting
    const purchaseOrderResult = await client.query(
      'SELECT purchase_order_id FROM purchases WHERE id = $1',
      [id]
    );
    const purchaseOrderId = purchaseOrderResult.rows[0]?.purchase_order_id;

    // Delete related records first (foreign key constraints) - in reverse dependency order
    // serial_numbers -> receipt_vouchers -> purchases
    await client.query('DELETE FROM serial_numbers WHERE receipt_voucher_id IN (SELECT id FROM receipt_vouchers WHERE purchase_id = $1)', [id]);
    await client.query('DELETE FROM receipt_vouchers WHERE purchase_id = $1', [id]);
    await client.query('DELETE FROM purchase_items WHERE purchase_id = $1', [id]);
    await client.query('DELETE FROM purchases WHERE id = $1', [id]);

    // If linked to purchase order, revert status back to approved
    if (purchaseOrderId) {
      await client.query(
        "UPDATE purchase_orders SET status = 'approved', updated_at = NOW() WHERE id = $1",
        [purchaseOrderId]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'تم حذف الفاتورة بنجاح' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting purchase:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Get all purchases and invoices - WITH receipt status
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.*, 
        i.name as item_name, 
        i.unit as item_unit, 
        w.name as warehouse_name, 
        u.full_name as created_by_name,
        rv.id as receipt_voucher_id,
        rv.voucher_number as receipt_voucher_number,
        rv.status as receipt_status
      FROM purchases p
      LEFT JOIN items i ON p.item_id = i.id
      LEFT JOIN warehouses w ON p.warehouse_id = w.id
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN receipt_vouchers rv ON p.id = rv.purchase_id
      ORDER BY p.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Approve purchase/invoice
router.put('/:id/approve', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { id } = req.params;
  let { status } = req.body;

  console.log('=== APPROVE ===');
  console.log('ID:', id, 'Status:', status);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'حالة غير صالحة' });
    }

    if (status === 'pending') {
      const checkResult = await client.query(
        `SELECT status FROM purchases WHERE id = $1`,
        [id]
      );
      if (checkResult.rows.length > 0 && checkResult.rows[0].status === 'draft') {
        status = 'pending';
      } else if (checkResult.rows.length > 0 && checkResult.rows[0].status === 'pending') {
        status = 'approved';
      }
    }

    const result = await client.query(`
      UPDATE purchases 
      SET status = $1, approved_by = $2, approved_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [status, req.user.id, id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'الفاتورة غير موجودة' });
    }

    const purchase = result.rows[0];
    console.log('Purchase updated:', purchase);

    // ═══ تسجيل في supplier_ledger عند الاعتماد ═══
    if (status === 'approved') {
      const supplierId = await getSupplierIdByName(client, purchase.supplier);
      if (supplierId) {
        await recordSupplierLedger(client, supplierId, purchase, req.user.id, 'فاتورة مشتريات معتمدة');
      }

      // إنشاء سند استلام
      try {
        const existingReceipt = await client.query(
          `SELECT id FROM receipt_vouchers WHERE purchase_id = $1`,
          [purchase.id]
        );

        if (existingReceipt.rows.length === 0) {
          const insertResult = await client.query(`
            INSERT INTO receipt_vouchers (
              voucher_number, supplier, item_id, warehouse_id, quantity, unit,
              purchase_price, tax_14_percent, tax_discount_percent, tax_discount_amount,
              total_amount, supply_order, receipt_date, created_by, purchase_id,
              shipping_cost, customs_duty, customs_vat, clearance_fees, other_fees, landed_cost,
              status
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13, $14,
              $15, $16, $17, $18, $19, $20, $21
            )
            RETURNING *
          `, [
            `RCV-${purchase.purchase_number}`,
            purchase.supplier,
            purchase.item_id,
            purchase.warehouse_id,
            purchase.quantity,
            purchase.unit || 'عدد',
            purchase.unit_price,
            purchase.tax_14_percent,
            purchase.tax_discount_percent,
            purchase.tax_discount_amount,
            purchase.net_amount,
            purchase.purchase_number,
            req.user.id,
            purchase.id,
            0, 0, 0, 0, 0,  // shipping details = 0 (now in shipments)
            purchase.unit_price,
            'pending'
          ]);

          const voucherId = insertResult.rows[0].id;
          const purchaseItems = await client.query(
            `SELECT * FROM purchase_items WHERE purchase_id = $1`,
            [purchase.id]
          );

          for (const item of purchaseItems.rows) {
            await client.query(`
              INSERT INTO receipt_voucher_items (
                receipt_voucher_id, item_id, quantity, unit_price, total_amount, unit, notes
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
              voucherId,
              item.item_id,
              item.quantity,
              item.unit_price,
              item.total_amount,
              item.unit || 'عدد',
              'مستورد من الفاتورة'
            ]);
          }
        }
      } catch (insertErr) {
        console.error('Error creating receipt:', insertErr);
      }
    }

    await client.query('COMMIT');

    res.json({
      message: status === 'approved' ? 'تم الاعتماد وإنشاء سند الاستلام' : 
               status === 'pending' ? 'تم إرسال الفاتورة للاعتماد' : 'تم تحديث الحالة',
      data: purchase
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('=== APPROVE ERROR ===');
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Send for approval
router.put('/:id/send-for-approval', verifyToken, requireRole('purchasing', 'admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`
      UPDATE purchases 
      SET status = 'pending'
      WHERE id = $1 AND status = 'draft'
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'الفاتورة غير موجودة أو ليست في حالة مسودة' });
    }

    res.json({
      message: 'تم إرسال الفاتورة للاعتماد بنجاح',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error sending for approval:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Quality Approval
router.put('/:id/quality-approve', verifyToken, requireRole('quality', 'admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`
      UPDATE purchases 
      SET status = 'quality_passed'
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Not found' });
    }

    const purchase = result.rows[0];
    await pool.query(`
      UPDATE receipt_vouchers 
      SET status = 'approved_quality',
          quality_checked_by = $1,
          quality_checked_at = NOW()
      WHERE purchase_id = $2
    `, [req.user.id, purchase.id]);

    res.json({
      message: 'تم اعتماد الجودة بنجاح',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Quality approve error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Quality Reject
router.put('/:id/quality-reject', verifyToken, requireRole('quality', 'admin'), async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE purchases 
      SET status = 'rejected'
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Not found' });
    }

    const purchase = result.rows[0];

    // عكس الحركة في supplier_ledger
    const supplierId = await getSupplierIdByName(client, purchase.supplier);
    if (supplierId) {
      await reverseSupplierLedger(client, supplierId, purchase, req.user.id, 'رفض فاتورة من الجودة');
    }

    await client.query(`
      UPDATE receipt_vouchers 
      SET status = 'cancelled'
      WHERE purchase_id = $1
    `, [purchase.id]);

    await client.query('COMMIT');

    res.json({
      message: 'تم رفض الفاتورة من الجودة',
      data: result.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Quality reject error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Warehouse Receive
router.put('/:id/warehouse-receive', verifyToken, requireRole('warehouse', 'admin'), async (req, res) => {
  const { id } = req.params;
  const { received_quantity } = req.body;

  try {
    await pool.query(`
      UPDATE purchases 
      SET status = 'warehouse_received'
      WHERE id = $1
    `, [id]);

    const qty = received_quantity !== undefined ? parseFloat(received_quantity) : 0;

    await pool.query(`
      UPDATE receipt_vouchers 
      SET status = 'warehouse_received',
          received_quantity = $1,
          received_at = NOW(),
          warehouse_approved_by = $2,
          warehouse_approved_at = NOW()
      WHERE purchase_id = $3
    `, [qty, req.user.id, id]);

    res.json({ 
      message: 'تم استلام المخزن بنجاح - يرجى استخدام شاشة الإذون للاستلام التفصيلي',
      redirect_to_receipts: true
    });
  } catch (err) {
    console.error('Warehouse receive error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Post - ترحيل الإذن وإضافة للمخزن
router.put('/:id/post', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE purchases 
      SET status = 'posted'
      WHERE id = $1 AND status = 'warehouse_received'
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'الفاتورة غير موجودة أو لم يتم استلام المخزن بعد' });
    }

    const purchase = result.rows[0];

    const receiptResult = await client.query(`
      UPDATE receipt_vouchers 
      SET status = 'posted'
      WHERE purchase_id = $1 AND status = 'warehouse_received'
      RETURNING *
    `, [purchase.id]);

    if (receiptResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'سند الاستلام غير موجود أو لم يتم استلام المخزن' });
    }

    const receipt = receiptResult.rows[0];

    // ═══ نسبة التكلفة الفعلية (شامل مصاريف الشحن + الإفراج الجمركي) لو الفاتورة مرتبطة بشحنة ═══
    let costRatio = 1;
    if (purchase.shipment_id) {
      const shipmentResult = await client.query(
        `SELECT total_cost_egp FROM shipments WHERE id = $1`,
        [purchase.shipment_id]
      );
      const totalCostEgp = parseFloat(shipmentResult.rows[0]?.total_cost_egp) || 0;
      const purchaseTotalEgp = parseFloat(purchase.total_amount) || 0;
      if (purchaseTotalEgp > 0 && totalCostEgp > 0) {
        costRatio = totalCostEgp / purchaseTotalEgp;
      }
    }
    console.log(`[post] purchase=${purchase.id}, shipment_id=${purchase.shipment_id}, cost_ratio=${costRatio}`);

    // ═══ جيب كل أصناف الفاتورة (فاتورة قد تحتوي أكثر من صنف) ═══
    const purchaseItemsResult = await client.query(
      `SELECT * FROM purchase_items WHERE purchase_id = $1`,
      [purchase.id]
    );
    // توافقًا مع فواتير قديمة قد لا يكون لها صفوف في purchase_items
    const itemsList = purchaseItemsResult.rows.length > 0
      ? purchaseItemsResult.rows
      : [{ item_id: purchase.item_id, quantity: purchase.quantity, unit_price: purchase.unit_price }];

    // فاتورة الصنف الواحد فقط ممكن يكون لها كمية مستلمة فعليًا مختلفة عن المطلوبة
    const receivedQtyOverride = (itemsList.length === 1 && receipt.received_quantity)
      ? parseFloat(receipt.received_quantity)
      : null;

    let totalAddedQty = 0;
    const postedItems = [];

    for (const item of itemsList) {
      const qty = receivedQtyOverride !== null ? receivedQtyOverride : (parseFloat(item.quantity) || 0);
      if (qty <= 0) continue;

      const rawUnitPrice = parseFloat(item.unit_price) || 0;
      const landedUnitPrice = rawUnitPrice * costRatio; // شامل الشحن والجمارك وضريبة الوارد

      // 1. حركة مخزن
      await client.query(`
        INSERT INTO inventory_movements (
          movement_type, item_id, warehouse_id, quantity, unit_price, 
          total_amount, reference_type, reference_id, notes, created_by
        ) VALUES ('in', $1, $2, $3, $4, $5, 'purchase', $6, 'إضافة مخزن من فاتورة مشتريات', $7)
      `, [
        item.item_id,
        purchase.warehouse_id,
        qty,
        landedUnitPrice,
        qty * landedUnitPrice,
        purchase.id,
        req.user.id
      ]);

      // 2. تحديث رصيد المخزن
      const balanceResult = await client.query(`
        SELECT * FROM inventory_balances 
        WHERE item_id = $1 AND warehouse_id = $2
      `, [item.item_id, purchase.warehouse_id]);

      if (balanceResult.rows.length > 0) {
        const currentQty = parseFloat(balanceResult.rows[0].quantity);
        const currentAvgCost = parseFloat(balanceResult.rows[0].average_cost || 0);
        const newTotalQty = currentQty + qty;
        const newAvgCost = newTotalQty > 0 
          ? ((currentQty * currentAvgCost) + (qty * landedUnitPrice)) / newTotalQty 
          : landedUnitPrice;

        await client.query(`
          UPDATE inventory_balances 
          SET quantity = $1,
              average_cost = $2,
              last_movement_date = CURRENT_DATE,
              updated_at = NOW()
          WHERE item_id = $3 AND warehouse_id = $4
        `, [newTotalQty, newAvgCost, item.item_id, purchase.warehouse_id]);
      } else {
        await client.query(`
          INSERT INTO inventory_balances (
            item_id, warehouse_id, quantity, average_cost, last_movement_date
          ) VALUES ($1, $2, $3, $4, CURRENT_DATE)
        `, [item.item_id, purchase.warehouse_id, qty, landedUnitPrice]);
      }

      // 3. Serial numbers (لكل صنف على حدة)
      const itemInfoResult = await client.query(
        `SELECT has_serial FROM items WHERE id = $1`,
        [item.item_id]
      );

      if (itemInfoResult.rows.length > 0 && itemInfoResult.rows[0].has_serial) {
        await client.query(`
          UPDATE serial_numbers 
          SET status = 'in_stock',
              warehouse_id = $1
          WHERE receipt_voucher_id = $2 AND item_id = $3 AND status = 'pending'
        `, [purchase.warehouse_id, receipt.id, item.item_id]);
      }

      totalAddedQty += qty;
      postedItems.push({ item_id: item.item_id, quantity: qty, unit_cost_egp: landedUnitPrice.toFixed(2) });
    }

    // ═══ تسجيل في supplier_ledger (لو مش مسجل قبل كده في approve) ═══
    const existingLedger = await client.query(
      `SELECT id FROM supplier_ledger WHERE reference_id = $1 AND reference_type = 'purchase' AND transaction_type = 'invoice'`,
      [purchase.id]
    );

    if (existingLedger.rows.length === 0) {
      const supplierId = await getSupplierIdByName(client, purchase.supplier);
      if (supplierId) {
        await recordSupplierLedger(client, supplierId, purchase, req.user.id, 'فاتورة مشتريات مرحلة');
      }
    }

    await client.query('COMMIT');

    res.json({
      message: 'تم ترحيل الفاتورة وإضافة الكمية للمخزن بنجاح',
      purchase: purchase,
      cost_ratio: costRatio.toFixed(6),
      added_quantity: totalAddedQty,
      items_posted: postedItems,
      warehouse_id: purchase.warehouse_id
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Post error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// استيراد فاتورة من أمر شراء معتمد
router.post('/from-po', verifyToken, requireRole('purchasing', 'admin'), async (req, res) => {
  const { purchase_order_id, selected_items } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const poResult = await client.query(
      `SELECT * FROM purchase_orders WHERE id = $1 AND status = 'approved'`,
      [purchase_order_id]
    );

    if (poResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'أمر الشراء غير معتمد أو غير موجود' });
    }

    const po = poResult.rows[0];

    let itemsQuery = `
      SELECT poi.*, i.name as item_name, i.unit as item_unit
      FROM purchase_order_items poi
      LEFT JOIN items i ON poi.item_id = i.id
      WHERE poi.purchase_order_id = $1
    `;
    let queryParams = [purchase_order_id];

    if (selected_items && selected_items.length > 0) {
      itemsQuery += ` AND poi.item_id = ANY($2::int[])`;
      queryParams.push(selected_items);
    }

    const itemsResult = await client.query(itemsQuery, queryParams);

    if (itemsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'لا يوجد أصناف للاستيراد' });
    }

    const items = itemsResult.rows;

    const type = po.order_type === 'import' ? 'import' : 'local';
    const prefix = type === 'import' ? 'PIN-IMP' : 'PIN-LOC';

    const lastResult = await client.query(
      `SELECT purchase_number FROM purchases WHERE purchase_number LIKE $1 ORDER BY id DESC LIMIT 1`,
      [`${prefix}-%`]
    );

    let nextNumber = `${prefix}-0001`;
    if (lastResult.rows.length > 0) {
      const last = lastResult.rows[0].purchase_number;
      const match = last.match(/\d+/);
      if (match) {
        const num = parseInt(match[0]) + 1;
        nextNumber = `${prefix}-${String(num).padStart(4, '0')}`;
      }
    }

    const totalEgp = items.reduce((sum, i) => sum + (parseFloat(i.total_egp) || 0), 0);
    const totalQty = items.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0);
    const tax14 = totalEgp * 0.14;
    const netAmount = totalEgp + tax14;

    const firstItem = items[0];

    const purchaseResult = await client.query(`
      INSERT INTO purchases (
        purchase_type, purchase_number, supplier, item_id, warehouse_id,
        quantity, unit_price, total_amount, tax_14_percent, tax_discount_percent,
        tax_discount_amount, net_amount, unit, landed_cost,
        shipping_cost, customs_duty, customs_vat, clearance_fees, other_fees,
        final_release_value, import_tax, total_with_tax, tax_14_percent_on_total,
        commercial_profit_tax_1_percent, transfer_commission_type, transfer_commission_value,
        transfer_commission_amount, has_vat, has_discount_tax, is_invoice, status, created_by, purchase_order_id, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34)
      RETURNING *
    `, [
      po.order_type, nextNumber, po.supplier, firstItem.item_id, po.warehouse_id,
      totalQty, totalEgp / totalQty, totalEgp, tax14, 0, 0, netAmount, firstItem.unit || 'عدد', totalEgp / totalQty,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, 0, 0, true, true, true, 'draft', req.user.id, po.id,
      `فاتورة متعددة الأصناف من ${po.order_number}: ${items.map(i => `${i.item_name} (${i.quantity})`).join('، ')}`
    ]);

    const purchaseId = purchaseResult.rows[0].id;

    for (const item of items) {
      await client.query(`
        INSERT INTO purchase_items (
          purchase_id, item_id, quantity, unit, unit_price, total_amount, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        purchaseId,
        item.item_id,
        item.quantity,
        item.unit || 'عدد',
        item.unit_price_egp || 0,
        item.total_egp || 0,
        `مستورد من ${po.order_number}`
      ]);
    }

    if (!selected_items || selected_items.length === items.length) {
      await client.query(
        `UPDATE purchase_orders SET status = 'completed' WHERE id = $1`,
        [purchase_order_id]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: `تم إنشاء الفاتورة بنجاح مع ${items.length} صنف`,
      data: purchaseResult.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating invoice from PO:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// جلب أصناف الفاتورة
router.get('/:id/items', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pi.*, i.name as item_name, i.code as item_code
      FROM purchase_items pi
      LEFT JOIN items i ON pi.item_id = i.id
      WHERE pi.purchase_id = $1
    `, [req.params.id]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching purchase items:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
