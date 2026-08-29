const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// PURCHASES API (محدث - مع is_dummy)
// ═══════════════════════════════════════════════════════════════

// GET /purchases/next-number
router.get('/next-number', verifyToken, async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const gapResult = await pool.query(
      `SELECT t1.purchase_number + 1 as next_num
       FROM purchases t1
       WHERE t1.purchase_year = $1
         AND t1.status != 'cancelled'
         AND NOT EXISTS (
           SELECT 1 FROM purchases t2 
           WHERE t2.purchase_number = t1.purchase_number + 1 
           AND t2.purchase_year = $1
           AND t2.status != 'cancelled'
         )
       ORDER BY t1.purchase_number
       LIMIT 1`,
      [year]
    );
    if (gapResult.rows.length > 0 && gapResult.rows[0].next_num > 0) {
      return res.json({ nextNumber: gapResult.rows[0].next_num });
    }
    const maxResult = await pool.query(
      `SELECT COALESCE(MAX(purchase_number), 0) + 1 as next_num 
       FROM purchases 
       WHERE purchase_year = $1 AND status != 'cancelled'`,
      [year]
    );
    res.json({ nextNumber: maxResult.rows[0].next_num });
  } catch (err) {
    console.error('[GET /next-number] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /purchases
router.get('/', verifyToken, async (req, res) => {
  const { year, status, supplier_id, purchase_type, is_dummy } = req.query;
  try {
    let query = `
      SELECT p.*, s.name as supplier_name, s.supplier_code, c.name as currency_name, u.full_name as created_by_name
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN currencies c ON p.currency_id = c.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.status != 'cancelled'
    `;
    const params = [];
    if (year) { params.push(year); query += ` AND p.purchase_year = $${params.length}`; }
    if (status) { params.push(status); query += ` AND p.status = $${params.length}`; }
    if (supplier_id) { params.push(supplier_id); query += ` AND p.supplier_id = $${params.length}`; }
    if (purchase_type) { params.push(purchase_type); query += ` AND p.purchase_type = $${params.length}`; }
    if (is_dummy !== undefined) { params.push(is_dummy === 'true'); query += ` AND p.is_dummy = $${params.length}`; }
    query += ` ORDER BY p.purchase_year DESC, p.purchase_number DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /purchases] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /purchases/:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const purchaseResult = await pool.query(
      `SELECT p.*, s.name as supplier_name, s.supplier_code, c.name as currency_name, c.code as currency_code, u.full_name as created_by_name, sh.shipment_number
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN currencies c ON p.currency_id = c.id
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN shipments sh ON p.shipment_id = sh.id
      WHERE p.id = $1`, [req.params.id]
    );
    if (purchaseResult.rows.length === 0) return res.status(404).json({ message: 'الفاتورة غير موجودة' });
    const purchase = purchaseResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT pi.*, i.name as item_name, i.code as item_code, i.unit_of_measure, i.is_vat_exempt, i.is_profit_tax_exempt
      FROM purchase_items pi
      LEFT JOIN items i ON pi.item_id = i.id
      WHERE pi.purchase_id = $1`, [req.params.id]
    );

    res.json({ ...purchase, items: itemsResult.rows });
  } catch (err) {
    console.error('[GET /purchases/:id] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /purchases
router.post('/', verifyToken, requireRole('purchasing', 'admin', 'finance'), async (req, res) => {
  const { purchase_number, purchase_year, supplier_id, purchase_date, purchase_type, currency_id, exchange_rate, has_vat, tax_14_percent, has_discount_tax, tax_discount_percent, notes, is_dummy, dummy_type, dummy_for_user_id, items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'يجب إضافة بنود للفاتورة' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let finalExchangeRate = exchange_rate;
    if (!finalExchangeRate && currency_id) {
      const currencyResult = await client.query(`SELECT exchange_rate FROM currencies WHERE id = $1`, [currency_id]);
      if (currencyResult.rows.length > 0) finalExchangeRate = currencyResult.rows[0].exchange_rate;
    }
    if (!finalExchangeRate) finalExchangeRate = 1;

    // حساب الإجماليات
    let subtotal = 0;
    let totalVat = 0;
    let totalDiscountTax = 0;

    for (const item of items) {
      const itemTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
      subtotal += itemTotal;

      // ضريبة 14% على البند (لو مش معفى)
      if (has_vat && !item.is_vat_exempt) {
        const vatRate = parseFloat(tax_14_percent) || 14;
        totalVat += itemTotal * (vatRate / 100);
      }

      // خصم ضريبي
      if (has_discount_tax) {
        const discountRate = parseFloat(tax_discount_percent) || 0;
        totalDiscountTax += itemTotal * (discountRate / 100);
      }
    }

    const totalAmount = subtotal + totalVat - totalDiscountTax;

    const purchaseResult = await client.query(
      `INSERT INTO purchases (purchase_number, purchase_year, supplier_id, purchase_date, purchase_type, status, currency_id, exchange_rate, has_vat, tax_14_percent, has_discount_tax, tax_discount_percent, subtotal, total_vat, total_discount_tax, total_amount, notes, is_dummy, dummy_type, dummy_for_user_id, created_by)
      VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING *`,
      [purchase_number, purchase_year || new Date().getFullYear(), supplier_id || null, purchase_date || new Date(), purchase_type || 'local', currency_id || null, finalExchangeRate, has_vat || false, tax_14_percent || 14, has_discount_tax || false, tax_discount_percent || 0, subtotal, totalVat, totalDiscountTax, totalAmount, notes || null, is_dummy || false, dummy_type || null, dummy_for_user_id || null, req.user.id]
    );
    const purchaseId = purchaseResult.rows[0].id;

    for (const item of items) {
      const itemTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
      let itemVat = 0;
      let itemDiscountTax = 0;

      if (has_vat && !item.is_vat_exempt) {
        itemVat = itemTotal * ((parseFloat(tax_14_percent) || 14) / 100);
      }
      if (has_discount_tax) {
        itemDiscountTax = itemTotal * ((parseFloat(tax_discount_percent) || 0) / 100);
      }

      await client.query(
        `INSERT INTO purchase_items (purchase_id, item_id, quantity, unit_price, total_price, unit_of_measure, notes, is_vat_exempt, is_profit_tax_exempt, customs_duty_rate, customs_duty_amount, vat_amount, discount_tax_amount)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [purchaseId, item.item_id, item.quantity, item.unit_price || 0, itemTotal, item.unit_of_measure || null, item.notes || null, item.is_vat_exempt || false, item.is_profit_tax_exempt || false, item.customs_duty_rate || 0, item.customs_duty_amount || 0, itemVat, itemDiscountTax]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'تم إنشاء الفاتورة بنجاح', data: purchaseResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /purchases] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally { client.release(); }
});

// POST /purchases/from-po - إنشاء من أمر شراء معتمد
router.post('/from-po', verifyToken, requireRole('purchasing', 'admin', 'finance'), async (req, res) => {
  const { purchase_order_id, purchase_number, purchase_year, purchase_date, has_vat, tax_14_percent, has_discount_tax, tax_discount_percent, notes, is_dummy, dummy_type } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // جيب بيانات أمر الشراء
    const poResult = await client.query(
      `SELECT * FROM purchase_orders WHERE id = $1 AND status = 'approved'`,
      [purchase_order_id]
    );
    if (poResult.rows.length === 0) throw new Error('أمر الشراء غير موجود أو غير معتمد');
    const po = poResult.rows[0];

    // جيب بنود أمر الشراء
    const poItemsResult = await client.query(
      `SELECT * FROM purchase_order_items WHERE purchase_order_id = $1`,
      [purchase_order_id]
    );
    if (poItemsResult.rows.length === 0) throw new Error('أمر الشراء لا يحتوي على بنود');

    // حساب الإجماليات
    let subtotal = 0;
    let totalVat = 0;
    let totalDiscountTax = 0;

    for (const item of poItemsResult.rows) {
      const itemTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
      subtotal += itemTotal;

      if (has_vat && !item.is_vat_exempt) {
        const vatRate = parseFloat(tax_14_percent) || 14;
        totalVat += itemTotal * (vatRate / 100);
      }

      if (has_discount_tax) {
        const discountRate = parseFloat(tax_discount_percent) || 0;
        totalDiscountTax += itemTotal * (discountRate / 100);
      }
    }

    const totalAmount = subtotal + totalVat - totalDiscountTax;

    const purchaseResult = await client.query(
      `INSERT INTO purchases (purchase_number, purchase_year, supplier_id, purchase_date, purchase_type, status, currency_id, exchange_rate, has_vat, tax_14_percent, has_discount_tax, tax_discount_percent, subtotal, total_vat, total_discount_tax, total_amount, notes, purchase_order_id, is_dummy, dummy_type, created_by)
      VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING *`,
      [purchase_number, purchase_year || new Date().getFullYear(), po.supplier_id, purchase_date || new Date(), po.purchase_type || 'local', po.currency_id, po.exchange_rate, has_vat || false, tax_14_percent || 14, has_discount_tax || false, tax_discount_percent || 0, subtotal, totalVat, totalDiscountTax, totalAmount, notes || po.notes, purchase_order_id, is_dummy || false, dummy_type || null, req.user.id]
    );
    const purchaseId = purchaseResult.rows[0].id;

    for (const item of poItemsResult.rows) {
      const itemTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
      let itemVat = 0;
      let itemDiscountTax = 0;

      if (has_vat && !item.is_vat_exempt) {
        itemVat = itemTotal * ((parseFloat(tax_14_percent) || 14) / 100);
      }
      if (has_discount_tax) {
        itemDiscountTax = itemTotal * ((parseFloat(tax_discount_percent) || 0) / 100);
      }

      await client.query(
        `INSERT INTO purchase_items (purchase_id, item_id, quantity, unit_price, total_price, unit_of_measure, notes, is_vat_exempt, is_profit_tax_exempt, customs_duty_rate, customs_duty_amount, vat_amount, discount_tax_amount)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [purchaseId, item.item_id, item.quantity, item.unit_price || 0, itemTotal, item.unit_of_measure || null, item.notes || null, item.is_vat_exempt || false, item.is_profit_tax_exempt || false, item.customs_duty_rate || 0, item.customs_duty_amount || 0, itemVat, itemDiscountTax]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'تم إنشاء الفاتورة من أمر الشراء بنجاح', data: purchaseResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /purchases/from-po] Error:', err);
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally { client.release(); }
});

// PUT /purchases/:id
router.put('/:id', verifyToken, requireRole('purchasing', 'admin', 'finance'), async (req, res) => {
  const { supplier_id, purchase_date, has_vat, tax_14_percent, has_discount_tax, tax_discount_percent, notes, is_dummy, dummy_type, dummy_for_user_id, items } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const purchaseResult = await client.query(`SELECT status FROM purchases WHERE id = $1`, [req.params.id]);
    if (purchaseResult.rows.length === 0) throw new Error('الفاتورة غير موجودة');
    if (purchaseResult.rows[0].status === 'posted') throw new Error('لا يمكن تعديل فاتورة مرحلة');

    if (items && Array.isArray(items)) {
      await client.query(`DELETE FROM purchase_items WHERE purchase_id = $1`, [req.params.id]);

      let subtotal = 0;
      let totalVat = 0;
      let totalDiscountTax = 0;

      for (const item of items) {
        const itemTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
        subtotal += itemTotal;

        if (has_vat && !item.is_vat_exempt) {
          const vatRate = parseFloat(tax_14_percent) || 14;
          totalVat += itemTotal * (vatRate / 100);
        }

        if (has_discount_tax) {
          const discountRate = parseFloat(tax_discount_percent) || 0;
          totalDiscountTax += itemTotal * (discountRate / 100);
        }

        let itemVat = 0;
        let itemDiscountTax = 0;
        if (has_vat && !item.is_vat_exempt) itemVat = itemTotal * ((parseFloat(tax_14_percent) || 14) / 100);
        if (has_discount_tax) itemDiscountTax = itemTotal * ((parseFloat(tax_discount_percent) || 0) / 100);

        await client.query(
          `INSERT INTO purchase_items (purchase_id, item_id, quantity, unit_price, total_price, unit_of_measure, notes, is_vat_exempt, is_profit_tax_exempt, customs_duty_rate, customs_duty_amount, vat_amount, discount_tax_amount)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [req.params.id, item.item_id, item.quantity, item.unit_price || 0, itemTotal, item.unit_of_measure || null, item.notes || null, item.is_vat_exempt || false, item.is_profit_tax_exempt || false, item.customs_duty_rate || 0, item.customs_duty_amount || 0, itemVat, itemDiscountTax]
        );
      }

      const totalAmount = subtotal + totalVat - totalDiscountTax;
      await client.query(
        `UPDATE purchases SET supplier_id = $1, purchase_date = $2, has_vat = $3, tax_14_percent = $4, has_discount_tax = $5, tax_discount_percent = $6, subtotal = $7, total_vat = $8, total_discount_tax = $9, total_amount = $10, notes = $11, is_dummy = $12, dummy_type = $13, dummy_for_user_id = $14, updated_at = NOW() WHERE id = $15`,
        [supplier_id || null, purchase_date || new Date(), has_vat || false, tax_14_percent || 14, has_discount_tax || false, tax_discount_percent || 0, subtotal, totalVat, totalDiscountTax, totalAmount, notes || null, is_dummy || false, dummy_type || null, dummy_for_user_id || null, req.params.id]
      );
    } else {
      await client.query(
        `UPDATE purchases SET supplier_id = $1, purchase_date = $2, has_vat = $3, tax_14_percent = $4, has_discount_tax = $5, tax_discount_percent = $6, notes = $7, is_dummy = $8, dummy_type = $9, dummy_for_user_id = $10, updated_at = NOW() WHERE id = $11`,
        [supplier_id || null, purchase_date || new Date(), has_vat || false, tax_14_percent || 14, has_discount_tax || false, tax_discount_percent || 0, notes || null, is_dummy || false, dummy_type || null, dummy_for_user_id || null, req.params.id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'تم تحديث الفاتورة' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[PUT /purchases/:id] Error:', err);
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally { client.release(); }
});

// PUT /purchases/:id/approve
router.put('/:id/approve', verifyToken, requireRole('admin', 'purchasing_manager'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE purchases SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2 AND status = 'draft' RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (result.rows.length === 0) return res.status(400).json({ message: 'لا يمكن اعتماد الفاتورة' });
    res.json({ message: 'تم اعتماد الفاتورة', data: result.rows[0] });
  } catch (err) {
    console.error('[PUT /purchases/:id/approve] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /purchases/:id/post
router.put('/:id/post', verifyToken, requireRole('admin', 'purchasing_manager'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const purchaseResult = await client.query(`SELECT * FROM purchases WHERE id = $1`, [req.params.id]);
    if (purchaseResult.rows.length === 0) throw new Error('الفاتورة غير موجودة');
    const purchase = purchaseResult.rows[0];
    if (purchase.status !== 'approved') throw new Error('يجب اعتماد الفاتورة أولاً');

    // جيب بنود الفاتورة
    const itemsResult = await client.query(`SELECT * FROM purchase_items WHERE purchase_id = $1`, [req.params.id]);

    // لو مش فاتورة وهمية، ضيف للمخزن
    if (!purchase.is_dummy) {
      for (const item of itemsResult.rows) {
        await client.query(
          `UPDATE items SET quantity = quantity + $1, updated_at = NOW() WHERE id = $2`,
          [item.quantity, item.item_id]
        );

        // حركة مخزنية
        await client.query(
          `INSERT INTO inventory_movements (item_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, created_by)
          VALUES ($1, 'in', $2, $3, 'purchase', $4, $5, $6)`,
          [item.item_id, item.quantity, item.unit_price, req.params.id, `فاتورة شراء #${purchase.purchase_number}`, req.user.id]
        );
      }
    } else {
      // فاتورة وهمية - ضيف للمخزون الضريبي فقط
      for (const item of itemsResult.rows) {
        await client.query(
          `UPDATE items SET tax_inventory_quantity = tax_inventory_quantity + $1, updated_at = NOW() WHERE id = $2`,
          [item.quantity, item.item_id]
        );
      }
    }

    // دفتر أستاذ المورد
    if (purchase.supplier_id) {
      await client.query(
        `INSERT INTO supplier_ledger (supplier_id, transaction_type, reference_type, reference_id, debit_amount, credit_amount, balance_after, currency, exchange_rate, notes, created_by)
        VALUES ($1, 'purchase', 'purchase', $2, $3, 0, 0, $4, $5, $6, $7)`,
        [purchase.supplier_id, req.params.id, purchase.total_amount, purchase.currency_id ? 'USD' : 'EGP', purchase.exchange_rate || 1, `فاتورة شراء #${purchase.purchase_number}`, req.user.id]
      );

      await client.query(
        `UPDATE suppliers SET total_purchases = COALESCE(total_purchases, 0) + $1, balance = COALESCE(balance, 0) + $1, updated_at = NOW() WHERE id = $2`,
        [purchase.total_amount, purchase.supplier_id]
      );
    }

    await client.query(
      `UPDATE purchases SET status = 'posted', posted_by = $1, posted_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *`,
      [req.user.id, req.params.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'تم ترحيل الفاتورة بنجاح', data: purchaseResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[PUT /purchases/:id/post] Error:', err);
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally { client.release(); }
});

// PUT /purchases/:id/cancel
router.put('/:id/cancel', verifyToken, requireRole('admin', 'purchasing_manager'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE purchases SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND status != 'posted' RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(400).json({ message: 'لا يمكن إلغاء الفاتورة' });
    res.json({ message: 'تم إلغاء الفاتورة', data: result.rows[0] });
  } catch (err) {
    console.error('[PUT /purchases/:id/cancel] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /purchases/:id
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const checkResult = await pool.query(`SELECT status FROM purchases WHERE id = $1`, [req.params.id]);
    if (checkResult.rows.length === 0) return res.status(404).json({ message: 'الفاتورة غير موجودة' });
    if (checkResult.rows[0].status === 'posted') return res.status(400).json({ message: 'لا يمكن حذف فاتورة مرحلة' });
    await pool.query(`DELETE FROM purchases WHERE id = $1`, [req.params.id]);
    res.json({ message: 'تم حذف الفاتورة' });
  } catch (err) {
    console.error('[DELETE /purchases/:id] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /purchases/dummy - الفواتير الوهمية
router.get('/dummy', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, s.name as supplier_name, c.name as currency_name
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN currencies c ON p.currency_id = c.id
      WHERE p.is_dummy = true AND p.status != 'cancelled'
      ORDER BY p.purchase_year DESC, p.purchase_number DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /purchases/dummy] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
