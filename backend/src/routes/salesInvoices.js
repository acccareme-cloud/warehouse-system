const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

async function columnExists(tableName, columnName) {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = $2
      )
    `, [tableName, columnName]);
    return result.rows[0].exists;
  } catch (e) {
    return false;
  }
}

async function tableExists(tableName) {
  try {
    const result = await pool.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)
    `, [tableName]);
    return result.rows[0].exists;
  } catch (e) {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// attachItemsToInvoices — بيربط مصفوفة الأصناف بكل فاتورة
// (من sales_invoice_items، مع fallback للأعمدة المسطحة القديمة)
// ═══════════════════════════════════════════════════════════════
async function attachItemsToInvoices(rows) {
  if (!rows || rows.length === 0) return rows;
  const hasItemsTable = await tableExists('sales_invoice_items');
  const byId = {};
  rows.forEach(r => { byId[r.id] = r; r.items = []; });

  if (hasItemsTable) {
    const ids = rows.map(r => r.id);
    const itemsResult = await pool.query(
      `SELECT sii.*, i.name AS item_name_lookup, i.code AS item_code,
              i.has_serial AS item_has_serial, w.name AS warehouse_name,
              COALESCE(u.full_name, u.username) AS issued_by_name
       FROM sales_invoice_items sii
       LEFT JOIN items i ON sii.item_id = i.id
       LEFT JOIN warehouses w ON sii.warehouse_id = w.id
       LEFT JOIN users u ON sii.issued_by = u.id
       WHERE sii.invoice_id = ANY($1::int[])
       ORDER BY sii.id`,
      [ids]
    );
    itemsResult.rows.forEach(it => {
      if (byId[it.invoice_id]) {
        byId[it.invoice_id].items.push({
          ...it,
          item_name: it.item_name || it.item_name_lookup,
          has_serial: it.item_has_serial
        });
      }
    });
  }

  // fallback للفواتير القديمة اللي ملهاش أسطر في جدول الأصناف
  rows.forEach(r => {
    if (r.items.length === 0 && (r.item_id || r.quantity)) {
      r.items = [{
        id: null, item_id: r.item_id, item_name: r.item_name || null,
        quantity: r.quantity, unit_price: r.unit_price,
        warehouse_id: r.warehouse_id || null, warehouse_name: r.warehouse_name || null,
        serial_numbers: r.serial_numbers || null, issued: false
      }];
    }
    r.items_count = r.items.length;
    r.items_summary = r.items.map(i => i.item_name).filter(Boolean).slice(0, 3).join('، ')
      + (r.items.length > 3 ? ` +${r.items.length - 3}` : '');
  });

  // أرقام بيانات التسليم المسعر المرتبطة بالفاتورة
  const hasLinkTable = await tableExists('sales_invoice_dqs');
  if (hasLinkTable) {
    const ids = rows.map(r => r.id);
    const dqResult = await pool.query(
      `SELECT sid.invoice_id, dq.dq_number
       FROM sales_invoice_dqs sid
       JOIN delivery_quotes dq ON sid.dq_id = dq.id
       WHERE sid.invoice_id = ANY($1::int[])`,
      [ids]
    );
    dqResult.rows.forEach(l => {
      if (byId[l.invoice_id]) {
        byId[l.invoice_id].dq_numbers = byId[l.invoice_id].dq_numbers || [];
        byId[l.invoice_id].dq_numbers.push(l.dq_number);
      }
    });
  }

  return rows;
}

// ═══════════════════════════════════════════════════════════════
// GET ALL (with filters)
// ═══════════════════════════════════════════════════════════════

router.get('/', verifyToken, async (req, res) => {
  try {
    const { type, status, customer_id, tax_sub_type } = req.query;
    let query = `
      SELECT si.*, 
        c.name as customer_name_display, c.code as customer_code,
        p.name as parent_customer_name,
        so.order_number as sales_order_number,
        u.full_name as created_by_name
      FROM sales_invoices si
      LEFT JOIN customers c ON si.customer_id = c.id
      LEFT JOIN customers p ON c.parent_id = p.id
      LEFT JOIN sales_orders so ON si.so_id = so.id
      LEFT JOIN users u ON si.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (type) {
      query += ` AND si.invoice_type = $${idx}`;
      params.push(type);
      idx++;
    }
    if (tax_sub_type) {
      query += ` AND si.tax_sub_type = $${idx}`;
      params.push(tax_sub_type);
      idx++;
    }
    if (status) {
      query += ` AND si.status = $${idx}`;
      params.push(status);
      idx++;
    }
    if (customer_id) {
      query += ` AND si.customer_id = $${idx}`;
      params.push(customer_id);
      idx++;
    }

    query += ` ORDER BY si.created_at DESC`;

    const result = await pool.query(query, params);
    const rows = await attachItemsToInvoices(result.rows);
    res.json(rows);
  } catch (err) {
    console.error('Get all invoices error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// SPECIFIC ROUTES (before /:id)
// ═══════════════════════════════════════════════════════════════

router.get('/next-number', verifyToken, async (req, res) => {
  const { type, sub_type } = req.query;
  try {
    let prefix = 'INV';
    if (type === 'tax') {
      if (sub_type === 'virtual') prefix = 'VTX';
      else prefix = 'TAX';
    } else if (type === 'price_quote') {
      prefix = 'PQ';
    } else if (type === 'government_quote') {
      prefix = 'GOV';
    }

    const result = await pool.query(
      `SELECT invoice_number FROM sales_invoices 
       WHERE invoice_number LIKE $1 
       ORDER BY id DESC LIMIT 1`,
      [`${prefix}-%`]
    );

    let nextNumber = 1;
    if (result.rows.length > 0) {
      const parts = result.rows[0].invoice_number.split('-');
      if (parts.length >= 2) {
        const last = parseInt(parts[parts.length - 1]);
        if (!isNaN(last)) nextNumber = last + 1;
      }
    }

    res.json({ nextNumber: `${prefix}-${String(nextNumber).padStart(4, '0')}` });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/pending-quality', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT si.id, si.invoice_number, si.invoice_type, si.customer_id, si.customer_name,
        si.item_id, si.quantity, si.unit_price, si.total_amount, si.status, si.notes,
        si.created_at, si.warehouse_id, si.so_id, si.pricing_sheet_number,
        i.name as item_name, i.code as item_code,
        c.name as customer_name_display,
        w.name as warehouse_name
       FROM sales_invoices si
       LEFT JOIN items i ON si.item_id = i.id
       LEFT JOIN customers c ON si.customer_id = c.id
       LEFT JOIN warehouses w ON si.warehouse_id = w.id
       WHERE si.status IN ('pending_delivery', 'quality_rejected')
       ORDER BY si.created_at DESC`
    );
    const rows = await attachItemsToInvoices(result.rows);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/quality-approved', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT si.id, si.invoice_number, si.invoice_type, si.customer_id, si.customer_name,
        si.item_id, si.quantity, si.unit_price, si.total_amount, si.status, si.notes,
        si.created_at, si.warehouse_id,
        i.name as item_name, i.code as item_code,
        c.name as customer_name_display,
        w.name as warehouse_name
       FROM sales_invoices si
       LEFT JOIN items i ON si.item_id = i.id
       LEFT JOIN customers c ON si.customer_id = c.id
       LEFT JOIN warehouses w ON si.warehouse_id = w.id
       WHERE si.status = 'quality_approved'
       ORDER BY si.created_at DESC`
    );
    const rows = await attachItemsToInvoices(result.rows);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/pending-warehouse', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT si.id, si.invoice_number, si.invoice_type, si.customer_id, si.customer_name,
        si.item_id, si.quantity, si.unit_price, si.total_amount, si.status, si.notes,
        si.created_at, si.warehouse_id,
        i.name as item_name, i.code as item_code,
        c.name as customer_name_display,
        w.name as warehouse_name
       FROM sales_invoices si
       LEFT JOIN items i ON si.item_id = i.id
       LEFT JOIN customers c ON si.customer_id = c.id
       LEFT JOIN warehouses w ON si.warehouse_id = w.id
       WHERE si.status = 'quality_approved'
       ORDER BY si.created_at DESC`
    );
    // بنرجع الفواتير اللي لسه فيها أسطر مش متصرفة (كل مخزن يصرف أسطره)
    let rows = await attachItemsToInvoices(result.rows);
    rows = rows.filter(r => (r.items || []).some(it => !it.issued));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/warehouse-approved', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT si.id, si.invoice_number, si.invoice_type, si.customer_id, si.customer_name,
        si.item_id, si.quantity, si.unit_price, si.total_amount, si.status, si.notes,
        si.created_at, si.warehouse_id,
        si.warehouse_approved_by, si.warehouse_approved_at,
        i.name as item_name, i.code as item_code,
        c.name as customer_name_display,
        w.name as warehouse_name,
        COALESCE(u.full_name, u.username) as warehouse_approved_by_name
       FROM sales_invoices si
       LEFT JOIN items i ON si.item_id = i.id
       LEFT JOIN customers c ON si.customer_id = c.id
       LEFT JOIN warehouses w ON si.warehouse_id = w.id
       LEFT JOIN users u ON si.warehouse_approved_by = u.id
       WHERE si.status = 'warehouse_approved'
       ORDER BY si.created_at DESC`
    );
    const rows = await attachItemsToInvoices(result.rows);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// APPROVED ORDERS — Returns approved sales_orders for invoice creation
// ═══════════════════════════════════════════════════════════════

router.get('/approved-orders', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT so.id, so.order_number as order_number, so.customer_id, c.name as customer_name,
        soi.id as line_id, soi.item_id, i.name as item_name, i.code as item_code,
        soi.quantity, soi.unit_price, (soi.quantity * soi.unit_price) as line_total,
        so.currency, so.status, so.order_date
       FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id = c.id
       JOIN sales_order_items soi ON soi.sales_order_id = so.id
       LEFT JOIN items i ON soi.item_id = i.id
       WHERE so.status = 'approved' AND (so.order_type = 'sales_order' OR so.order_type IS NULL)
         AND so.converted_to_invoice_id IS NULL
       ORDER BY so.created_at DESC, soi.id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get approved orders error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// APPROVED DQs — بيانات التسليم المعتمدة اللي لسه متعملهاش فاتورة
// (تُستخدم في شاشة الفواتير لاختيار كذا DQ وتجميعهم في فاتورة واحدة)
// ═══════════════════════════════════════════════════════════════

router.get('/approved-dqs', verifyToken, async (req, res) => {
  try {
    const hasLink = await tableExists('sales_invoice_dqs');

    const dqResult = await pool.query(
      `SELECT dq.id, dq.dq_number, dq.order_date, dq.delivery_date,
        dq.customer_id, dq.customer_branch_id, dq.total_amount, dq.currency,
        dq.status, dq.delivery_status, dq.notes,
        c.name AS customer_name, cb.name AS branch_name
       FROM delivery_quotes dq
       LEFT JOIN customers c ON dq.customer_id = c.id
       LEFT JOIN customers cb ON dq.customer_branch_id = cb.id
       WHERE dq.status = 'approved'
         AND dq.converted_to_invoice_id IS NULL
       ORDER BY dq.id DESC`
    );

    const dqs = dqResult.rows;
    if (dqs.length === 0) return res.json([]);

    const ids = dqs.map(d => d.id);
    const itemsResult = await pool.query(
      `SELECT dqi.id AS line_id, dqi.delivery_quote_id, dqi.item_id, dqi.item_name,
        dqi.quantity, dqi.unit_price, dqi.discount_percent, dqi.discount_amount,
        dqi.unit, i.code AS item_code, i.has_serial, i.warehouse_id AS item_warehouse_id,
        w.name AS warehouse_name
       FROM delivery_quote_items dqi
       LEFT JOIN items i ON dqi.item_id = i.id
       LEFT JOIN warehouses w ON i.warehouse_id = w.id
       WHERE dqi.delivery_quote_id = ANY($1::int[])
       ORDER BY dqi.id`,
      [ids]
    );

    // الأسطر اللي اتربطت بفواتير قبل كده (استبعاد جزئي)
    let usedLineIds = new Set();
    if (hasLink) {
      const usedRes = await pool.query(
        `SELECT DISTINCT sii.dq_id FROM sales_invoice_items sii
         WHERE sii.dq_id = ANY($1::int[])`,
        [ids]
      ).catch(() => ({ rows: [] }));
      // DQ متربط بفاتورة = مش متاح (converted_to_invoice_id بيتساوي عند الإنشاء أصلاً)
      usedLineIds = new Set(usedRes.rows.map(r => r.dq_id));
    }

    const byDq = {};
    dqs.forEach(d => { byDq[d.id] = { ...d, items: [] }; });
    itemsResult.rows.forEach(it => {
      if (byDq[it.delivery_quote_id]) byDq[it.delivery_quote_id].items.push(it);
    });

    res.json(Object.values(byDq).filter(d => !usedLineIds.has(d.id)));
  } catch (err) {
    console.error('Get approved DQs error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// CREATE SALES INVOICE (Manual or from SO)
// ═══════════════════════════════════════════════════════════════

function normalizeInvoiceItems(body) {
  if (Array.isArray(body.items) && body.items.length > 0) {
    return body.items.map(it => ({
      item_id: it.item_id || null,
      item_name: it.item_name || '',
      quantity: parseFloat(it.quantity || 0),
      unit_price: parseFloat(it.unit_price || 0),
      tax_percent: it.tax_percent !== undefined ? parseFloat(it.tax_percent || 0) : null,
      discount_percent: parseFloat(it.discount_percent || 0),
      discount_amount: parseFloat(it.discount_amount || 0),
      warehouse_id: it.warehouse_id || body.warehouse_id || null,
      notes: it.notes || null,
      serial_numbers: it.serial_numbers || null,
      dq_id: it.dq_id || null
    }));
  }
  return [{
    item_id: body.item_id || null,
    item_name: body.item_name || '',
    quantity: parseFloat(body.quantity || 0),
    unit_price: parseFloat(body.unit_price || 0),
    tax_percent: null,
    discount_percent: 0,
    discount_amount: 0,
    warehouse_id: body.warehouse_id || null,
    notes: null,
    serial_numbers: null
  }];
}

function computeInvoiceTotals(items, { is_taxable, has_vat, has_discount_tax, tax_discount_percent }) {
  const headerTaxDiscountRate = (has_discount_tax !== false) ? (parseFloat(tax_discount_percent) || 0) : 0;
  let subtotal = 0, taxTotal = 0, discountTotal = 0;

  const lines = items.map(it => {
    const gross = it.quantity * it.unit_price;
    const lineDiscount = it.discount_amount > 0 ? it.discount_amount : (gross * it.discount_percent / 100);
    const afterDiscount = gross - lineDiscount;
    const vatRate = it.tax_percent !== null ? it.tax_percent : ((is_taxable !== false && has_vat !== false) ? 14 : 0);
    const lineTax = afterDiscount * vatRate / 100;
    const lineTaxDiscount = afterDiscount * headerTaxDiscountRate / 100;
    const lineTotal = afterDiscount + lineTax - lineTaxDiscount;

    subtotal += gross;
    taxTotal += lineTax;
    discountTotal += lineDiscount + lineTaxDiscount;

    return { ...it, gross, lineDiscount, lineTax, lineTaxDiscount, lineTotal, vatRate };
  });

  const total = subtotal - discountTotal + taxTotal;
  return { lines, subtotal, taxTotal, discountTotal, total, headerTaxDiscountRate };
}

async function insertInvoiceItems(client, invoiceId, lines) {
  const hasItemsTable = await tableExists('sales_invoice_items');
  if (!hasItemsTable) return;

  const itemCols = await pool.query(`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'sales_invoice_items'
  `);
  const itemColNames = itemCols.rows.map(r => r.column_name);

  for (const line of lines) {
    const cols = [];
    const vals = [];
    const add = (col, val) => { if (itemColNames.includes(col)) { cols.push(col); vals.push(val); } };

    add('invoice_id', invoiceId);
    add('item_id', line.item_id);
    add('item_name', line.item_name);
    add('quantity', line.quantity);
    add('unit_price', line.unit_price);
    add('warehouse_id', line.warehouse_id);
    add('discount_percent', line.discount_percent);
    add('discount_amount', line.lineDiscount);
    add('tax_percent', line.vatRate);
    add('tax_amount', line.lineTax);
    add('subtotal', line.gross);
    add('total_price', line.lineTotal);
    add('total', line.lineTotal);
    add('notes', line.notes);
    add('serial_numbers', line.serial_numbers);
    add('dq_id', line.dq_id);

    if (cols.length > 0) {
      const placeholders = vals.map((_, i) => '$' + (i + 1)).join(', ');
      await client.query(`INSERT INTO sales_invoice_items (${cols.join(', ')}) VALUES (${placeholders})`, vals);
    }
  }
}

router.post('/', verifyToken, requireRole('sales', 'admin'), async (req, res) => {
  let {
    invoice_number, invoice_type, so_id, customer_id, customer_name,
    tax_discount_percent, has_vat, has_discount_tax, is_taxable, notes, parent_id,
    salesperson_id, commission_rate, currency, exchange_rate,
    delivery_location, invoice_date, tax_sub_type, warehouse_type, dq_ids
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ═══ لو فيه dq_ids: نجيب أسطر بيانات التسليم ونبني منها الأصناف ═══
    let sourceDqs = [];
    if (Array.isArray(dq_ids) && dq_ids.length > 0) {
      const dqRes = await client.query(
        `SELECT dq.*, c.name AS cust_name FROM delivery_quotes dq
         LEFT JOIN customers c ON dq.customer_id = c.id
         WHERE dq.id = ANY($1::int[]) AND dq.status = 'approved' AND dq.converted_to_invoice_id IS NULL`,
        [dq_ids]
      );
      if (dqRes.rows.length !== dq_ids.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'بعض بيانات التسليم المختارة غير معتمدة أو اتربطت بفاتورة قبل كده' });
      }
      sourceDqs = dqRes.rows;

      const dqItemsRes = await client.query(
        `SELECT dqi.*, i.name AS item_name_lookup, i.warehouse_id AS item_warehouse_id
         FROM delivery_quote_items dqi
         LEFT JOIN items i ON dqi.item_id = i.id
         WHERE dqi.delivery_quote_id = ANY($1::int[])
         ORDER BY dqi.delivery_quote_id, dqi.id`,
        [dq_ids]
      );

      // نبني items من أسطر الـ DQ (مع الحفاظ على dq_id لكل سطر)
      req.body.items = dqItemsRes.rows.map(l => ({
        item_id: l.item_id,
        item_name: l.item_name || l.item_name_lookup || '',
        quantity: parseFloat(l.quantity) || 0,
        unit_price: parseFloat(l.unit_price) || 0,
        discount_percent: parseFloat(l.discount_percent) || 0,
        discount_amount: parseFloat(l.discount_amount) || 0,
        warehouse_id: l.warehouse_id || l.item_warehouse_id || null,
        notes: l.notes || null,
        dq_id: l.delivery_quote_id
      }));

      // العميل الافتراضي من أول DQ لو مش متبعت
      if (!customer_id && sourceDqs[0].customer_branch_id) {
        customer_id = sourceDqs[0].customer_branch_id; // العميل الفرعي (الجهة اللي اتسلم لها)
      } else if (!customer_id) {
        customer_id = sourceDqs[0].customer_id;
      }

      // نضيف أرقام الـ DQ للملاحظات
      const dqNums = sourceDqs.map(d => d.dq_number).join('، ');
      notes = notes ? `${notes} | بيانات التسليم: ${dqNums}` : `مستند إلى بيانات التسليم المسعر: ${dqNums}`;
    }

    const items = normalizeInvoiceItems(req.body);
    if (items.length === 0 || items.every(it => !it.item_id && !it.quantity)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'يجب إضافة صنف واحد على الأقل للفاتورة' });
    }

    const { lines, subtotal, taxTotal, discountTotal, total, headerTaxDiscountRate } =
      computeInvoiceTotals(items, { is_taxable, has_vat, has_discount_tax, tax_discount_percent });

    let finalCommissionRate = commission_rate || 2.00;
    if (salesperson_id && !commission_rate) {
      const empResult = await client.query('SELECT commission_rate FROM employees WHERE id = $1', [salesperson_id]);
      if (empResult.rows.length > 0 && empResult.rows[0].commission_rate) {
        finalCommissionRate = parseFloat(empResult.rows[0].commission_rate);
      }
    }
    const commissionAmount = total * (finalCommissionRate / 100);

    const curr = currency || 'EGP';
    const exRate = parseFloat(exchange_rate || 1);
    const firstLine = lines[0];

    const result = await client.query(
      `INSERT INTO sales_invoices (
        invoice_number, invoice_type, so_id, customer_id, customer_name,
        item_id, warehouse_id, quantity, unit_price, subtotal, tax_14_percent,
        tax_discount_percent, tax_discount_amount, total_amount,
        commission_rate, commission_amount, salesperson_id,
        is_taxable, has_vat, has_discount_tax, remaining_amount, paid_amount, payment_status,
        status, notes, created_by, parent_id, currency, exchange_rate,
        delivery_location, invoice_date, tax_sub_type, warehouse_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
      RETURNING *`,
      [
        invoice_number, invoice_type, so_id || null, customer_id, customer_name,
        firstLine.item_id, firstLine.warehouse_id, firstLine.quantity, firstLine.unit_price,
        subtotal, taxTotal, headerTaxDiscountRate, discountTotal, total,
        finalCommissionRate, commissionAmount, salesperson_id || null,
        is_taxable !== false, has_vat !== false, has_discount_tax !== false,
        total, 0, 'unpaid',
        'draft', notes || null, req.user.id, parent_id || null,
        curr, exRate, delivery_location || null,
        invoice_date || new Date().toISOString().split('T')[0],
        tax_sub_type || 'real',
        warehouse_type || (invoice_type === 'price_quote' ? 'company' : 'tax')
      ]
    );

    const invoice = result.rows[0];
    await insertInvoiceItems(client, invoice.id, lines);

    // ═══ ربط الفاتورة ببيانات التسليم المسعر ═══
    if (sourceDqs.length > 0) {
      const hasLink = await tableExists('sales_invoice_dqs');
      for (const dq of sourceDqs) {
        if (hasLink) {
          await client.query(
            'INSERT INTO sales_invoice_dqs (invoice_id, dq_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [invoice.id, dq.id]
          );
        }
        await client.query(
          `UPDATE delivery_quotes SET converted_to_invoice_id = $1, delivery_status = 'invoiced', updated_at = NOW()
           WHERE id = $2`,
          [invoice.id, dq.id]
        );
      }
    }

    // ═══ ربط أمر البيع المصدر بالفاتورة عشان ميظهرش تاني في قائمة أوامر البيع المتاحة ═══
    if (so_id) {
      await client.query(
        `UPDATE sales_orders SET converted_to_invoice_id = $1, converted_to_invoice_type = $2, updated_at = NOW()
         WHERE id = $3`,
        [invoice.id, invoice_type, so_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'تم إنشاء فاتورة البيع بنجاح', data: invoice });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating sales invoice:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// UPDATE INVOICE (draft only)
// ═══════════════════════════════════════════════════════════════

router.put('/:id', verifyToken, requireRole('sales', 'admin'), async (req, res) => {
  const { id } = req.params;
  const {
    invoice_number, invoice_date, customer_id, customer_name,
    tax_discount_percent, has_vat, has_discount_tax, is_taxable, notes,
    salesperson_id, commission_rate, currency, exchange_rate, delivery_location,
    tax_sub_type, warehouse_type
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const items = normalizeInvoiceItems(req.body);
    const { lines, subtotal, taxTotal, discountTotal, total, headerTaxDiscountRate } =
      computeInvoiceTotals(items, { is_taxable, has_vat, has_discount_tax, tax_discount_percent });

    let finalCommissionRate = commission_rate || 2.00;
    if (salesperson_id && !commission_rate) {
      const empResult = await client.query('SELECT commission_rate FROM employees WHERE id = $1', [salesperson_id]);
      if (empResult.rows.length > 0 && empResult.rows[0].commission_rate) {
        finalCommissionRate = parseFloat(empResult.rows[0].commission_rate);
      }
    }
    const commissionAmount = total * (finalCommissionRate / 100);
    const firstLine = lines[0];

    const isAdmin = req.user.role === 'admin';
    const result = await client.query(
      `UPDATE sales_invoices 
       SET invoice_number = $1, invoice_date = $2, customer_id = $3, customer_name = $4,
           item_id = $5, warehouse_id = $6, quantity = $7, unit_price = $8,
           subtotal = $9, tax_14_percent = $10, tax_discount_percent = $11,
           tax_discount_amount = $12, total_amount = $13,
           commission_rate = $14, commission_amount = $15, salesperson_id = $16,
           is_taxable = $17, has_vat = $18, has_discount_tax = $19,
           notes = $20, updated_at = NOW(), currency = $21, exchange_rate = $22,
           delivery_location = $23, tax_sub_type = $24, warehouse_type = $25
       WHERE id = $26 ${isAdmin ? '' : "AND status = 'draft'"}
       RETURNING *`,
      [
        invoice_number, invoice_date || new Date().toISOString().split('T')[0],
        customer_id, customer_name, firstLine.item_id, firstLine.warehouse_id,
        firstLine.quantity, firstLine.unit_price, subtotal, taxTotal, headerTaxDiscountRate, discountTotal, total,
        finalCommissionRate, commissionAmount, salesperson_id || null,
        is_taxable !== false, has_vat !== false, has_discount_tax !== false,
        notes || null, currency || 'EGP', parseFloat(exchange_rate || 1),
        delivery_location || null,
        tax_sub_type || 'real',
        warehouse_type || (req.body.invoice_type === 'price_quote' ? 'company' : 'tax'),
        id
      ]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'الفاتورة غير موجودة أو تم اعتمادها' });
    }

    const hasItemsTable = await tableExists('sales_invoice_items');
    if (hasItemsTable) {
      await client.query('DELETE FROM sales_invoice_items WHERE invoice_id = $1', [id]);
      await insertInvoiceItems(client, id, lines);
    }

    await client.query('COMMIT');
    res.json({ message: 'تم تحديث الفاتورة بنجاح', data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update invoice error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// DELETE INVOICE (draft only — admin can delete approved)
// ═══════════════════════════════════════════════════════════════

router.delete('/:id', verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    const isAdmin = userResult.rows.length > 0 && userResult.rows[0].role === 'admin';

    let query = "DELETE FROM sales_invoices WHERE id = $1";
    if (!isAdmin) {
      query += " AND status = 'draft'";
    }
    query += " RETURNING *";

    // ═══ نحذف حركات العميل المرتبطة بالفاتورة الأول — العمود ده مالوش ON DELETE CASCADE
    // وكان بيمنع الحذف لو الفاتورة اتعمل لها اعتماد مالية وإلغاء قبل كده ═══
    if (await columnExists('customer_transactions', 'invoice_id')) {
      await client.query('DELETE FROM customer_transactions WHERE invoice_id = $1', [req.params.id]);
    }

    const result = await client.query(query, [req.params.id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'لا يمكن حذف الفاتورة' });
    }

    const deleted = result.rows[0];
    if (deleted.so_id) {
      await client.query(
        `UPDATE sales_orders SET converted_to_invoice_id = NULL, converted_to_invoice_type = NULL WHERE id = $1 AND converted_to_invoice_id = $2`,
        [deleted.so_id, deleted.id]
      );
    }
    if (await tableExists('sales_invoice_dqs')) {
      const links = await client.query('SELECT dq_id FROM sales_invoice_dqs WHERE invoice_id = $1', [deleted.id]);
      for (const l of links.rows) {
        await client.query(`UPDATE delivery_quotes SET converted_to_invoice_id = NULL WHERE id = $1`, [l.dq_id]);
      }
      await client.query('DELETE FROM sales_invoice_dqs WHERE invoice_id = $1', [deleted.id]);
    }

    await client.query('COMMIT');
    res.json({ message: 'تم الحذف بنجاح' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete invoice error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// MANAGER APPROVAL
// ═══════════════════════════════════════════════════════════════

router.put('/:id/manager-approve', verifyToken, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE sales_invoices 
       SET status = 'approved_manager', manager_approved_by = $1, manager_approved_at = NOW()
       WHERE id = $2 AND status = 'draft'
       RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'الفاتورة غير موجودة أو لم يتم إنشاؤها كمسودة' });
    }
    res.json({ message: 'تم اعتماد الفاتورة من المدير', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// CREATE WORK ORDER FROM INVOICE
// ═══════════════════════════════════════════════════════════════

router.post('/:id/create-work-order', verifyToken, requireRole('sales', 'admin', 'manager'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const invoiceResult = await client.query(
      `SELECT * FROM sales_invoices WHERE id = $1 AND status = 'approved_manager'`,
      [req.params.id]
    );

    if (invoiceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'الفاتورة غير موجودة أو لم يتم اعتمادها من المدير' });
    }

    const invoice = invoiceResult.rows[0];

    // نجيب كل أسطر الفاتورة (من جدول الأصناف، مع fallback للأعمدة المسطحة)
    let invLines = [];
    const hasItemsTable = await tableExists('sales_invoice_items');
    if (hasItemsTable) {
      const linesRes = await client.query(
        `SELECT sii.*, i.name AS item_name_lookup, i.warehouse_id AS item_warehouse_id
         FROM sales_invoice_items sii
         LEFT JOIN items i ON sii.item_id = i.id
         WHERE sii.invoice_id = $1 ORDER BY sii.id`,
        [invoice.id]
      );
      invLines = linesRes.rows.map(l => ({
        item_id: l.item_id,
        item_name: l.item_name || l.item_name_lookup || '',
        quantity: l.quantity,
        unit_price: l.unit_price,
        warehouse_id: l.warehouse_id || l.item_warehouse_id || invoice.warehouse_id,
        serial_numbers: l.serial_numbers || null
      }));
    }
    if (invLines.length === 0) {
      invLines = [{
        item_id: invoice.item_id, item_name: null, quantity: invoice.quantity,
        unit_price: invoice.unit_price, warehouse_id: invoice.warehouse_id,
        serial_numbers: invoice.serial_numbers || null
      }];
    }

    const woResult = await client.query(
      `SELECT work_order_number FROM work_orders WHERE work_order_number LIKE 'WO-%' ORDER BY id DESC LIMIT 1`
    );
    let nextWo = 'WO-0001';
    if (woResult.rows.length > 0) {
      const last = parseInt(woResult.rows[0].work_order_number.split('-')[1]);
      nextWo = `WO-${String(last + 1).padStart(4, '0')}`;
    }

    const firstLine = invLines[0];
    const woInsert = await client.query(
      `INSERT INTO work_orders (work_order_number, invoice_id, invoice_number, customer_id, customer_name,
        item_id, item_name, quantity, warehouse_id, description, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11)
       RETURNING id`,
      [nextWo, invoice.id, invoice.invoice_number, invoice.customer_id, invoice.customer_name || null,
       firstLine.item_id, firstLine.item_name, firstLine.quantity, firstLine.warehouse_id,
       invoice.notes || `أمر شغل لفاتورة ${invoice.invoice_number}`, req.user.id]
    );
    const woId = woInsert.rows[0].id;

    // نسخ كل الأصناف لجدول work_order_items
    if (await tableExists('work_order_items')) {
      for (const line of invLines) {
        await client.query(
          `INSERT INTO work_order_items (work_order_id, item_id, item_name, quantity, unit_price, warehouse_id, serial_numbers)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [woId, line.item_id, line.item_name, line.quantity, line.unit_price || 0, line.warehouse_id, line.serial_numbers]
        );
      }
    }

    await client.query(`UPDATE sales_invoices SET status = 'work_order', work_order_id = $1 WHERE id = $2`, [woId, req.params.id]);

    await client.query('COMMIT');
    res.json({ message: 'تم إنشاء أمر الشغل بنجاح', work_order_number: nextWo });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// CREATE DELIVERY NOTE FROM INVOICE
// ═══════════════════════════════════════════════════════════════

router.post('/:id/create-delivery-note', verifyToken, requireRole('sales', 'admin', 'manager'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const invoiceResult = await client.query(
      `SELECT * FROM sales_invoices WHERE id = $1 AND status = 'work_order'`,
      [req.params.id]
    );

    if (invoiceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'الفاتورة غير موجودة أو لم يتم إنشاء أمر شغل لها' });
    }

    const invoice = invoiceResult.rows[0];

    // نجيب كل أسطر الفاتورة
    let invLines = [];
    const hasItemsTable = await tableExists('sales_invoice_items');
    if (hasItemsTable) {
      const linesRes = await client.query(
        `SELECT sii.*, i.name AS item_name_lookup, i.warehouse_id AS item_warehouse_id
         FROM sales_invoice_items sii
         LEFT JOIN items i ON sii.item_id = i.id
         WHERE sii.invoice_id = $1 ORDER BY sii.id`,
        [invoice.id]
      );
      invLines = linesRes.rows.map(l => ({
        item_id: l.item_id,
        item_name: l.item_name || l.item_name_lookup || '',
        quantity: l.quantity,
        unit_price: l.unit_price,
        warehouse_id: l.warehouse_id || l.item_warehouse_id || invoice.warehouse_id,
        serial_numbers: l.serial_numbers || null
      }));
    }
    if (invLines.length === 0) {
      invLines = [{
        item_id: invoice.item_id, item_name: null, quantity: invoice.quantity,
        unit_price: invoice.unit_price, warehouse_id: invoice.warehouse_id,
        serial_numbers: invoice.serial_numbers || null
      }];
    }

    const dnResult = await client.query(
      `SELECT note_number FROM delivery_notes WHERE note_number LIKE 'DN-%' ORDER BY id DESC LIMIT 1`
    );
    let nextDn = 'DN-0001';
    if (dnResult.rows.length > 0) {
      const last = parseInt(dnResult.rows[0].note_number.split('-')[1]);
      nextDn = `DN-${String(last + 1).padStart(4, '0')}`;
    }

    const firstLine = invLines[0];
    const dnInsert = await client.query(
      `INSERT INTO delivery_notes (note_number, invoice_id, invoice_number, customer_id, customer_name,
        item_id, item_name, quantity, warehouse_id, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)
       RETURNING id`,
      [nextDn, invoice.id, invoice.invoice_number, invoice.customer_id, invoice.customer_name || null,
       firstLine.item_id, firstLine.item_name, firstLine.quantity, firstLine.warehouse_id, req.user.id]
    );
    const dnId = dnInsert.rows[0].id;

    // نسخ كل الأصناف لجدول delivery_note_items
    if (await tableExists('delivery_note_items')) {
      for (const line of invLines) {
        await client.query(
          `INSERT INTO delivery_note_items (delivery_note_id, item_id, item_name, quantity, unit_price, warehouse_id, serial_numbers)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [dnId, line.item_id, line.item_name, line.quantity, line.unit_price || 0, line.warehouse_id, line.serial_numbers]
        );
      }
    }

    await client.query(`UPDATE sales_invoices SET status = 'pending_delivery', delivery_note_id = $1 WHERE id = $2`, [dnId, req.params.id]);

    await client.query('COMMIT');
    res.json({ message: 'تم إنشاء إذن التسليم بنجاح', note_number: nextDn });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// QUALITY APPROVAL
// ═══════════════════════════════════════════════════════════════

router.put('/:id/quality-approve', verifyToken, requireRole('quality', 'admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const invoiceCheck = await client.query(
      'SELECT status FROM sales_invoices WHERE id = $1',
      [req.params.id]
    );

    if (invoiceCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'الفاتورة غير موجودة' });
    }

    if (!['pending_delivery', 'quality_rejected'].includes(invoiceCheck.rows[0].status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        message: 'الفاتورة يجب أن تكون في حالة انتظار التسليم أو مرفوضة من الجودة',
        current_status: invoiceCheck.rows[0].status
      });
    }

    const hasQualityCols = await columnExists('sales_invoices', 'quality_approved_by');

    if (hasQualityCols) {
      await client.query(
        `UPDATE sales_invoices 
         SET status = 'quality_approved', quality_approved_by = $1, quality_approved_at = NOW()
         WHERE id = $2`,
        [req.user.id, req.params.id]
      );
    } else {
      await client.query(
        `UPDATE sales_invoices SET status = 'quality_approved' WHERE id = $1`,
        [req.params.id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'تم اعتماد الجودة بنجاح' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// QUALITY REJECT (رفض الجودة مع سبب)
// ═══════════════════════════════════════════════════════════════

router.put('/:id/quality-reject', verifyToken, requireRole('quality', 'admin'), async (req, res) => {
  const { rejection_reason } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE sales_invoices
       SET status = 'quality_rejected',
           quality_rejected_by = $1,
           quality_rejected_at = NOW(),
           quality_rejection_reason = $2
       WHERE id = $3 AND status = 'pending_delivery'
       RETURNING *`,
      [req.user.id, rejection_reason || 'مرفوض من الجودة', req.params.id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'الفاتورة غير موجودة أو ليست في انتظار الجودة' });
    }

    await client.query('COMMIT');
    res.json({ message: 'تم رفض الجودة — الفاتورة اترجعت لإعادة الفحص أو التعديل', data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// WAREHOUSE APPROVAL (with serial numbers)
// ═══════════════════════════════════════════════════════════════

router.put('/:id/warehouse-approve', verifyToken, requireRole('storekeeper', 'admin'), async (req, res) => {
  const { serial_numbers: bodySerials, line_serials: bodyLineSerials, warehouse_id: bodyWarehouseId } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const invoiceResult = await client.query(
      `SELECT * FROM sales_invoices WHERE id = $1 AND status = 'quality_approved'`,
      [req.params.id]
    );

    if (invoiceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'الفاتورة غير موجودة أو لم يتم اعتماد الجودة لها' });
    }

    const invoice = invoiceResult.rows[0];

    // ═══ نجيب أسطر الفاتورة ═══
    const hasItemsTable = await tableExists('sales_invoice_items');
    let allLines;
    if (hasItemsTable) {
      const itemsResult = await client.query(
        `SELECT sii.*, i.warehouse_id AS item_warehouse_id
         FROM sales_invoice_items sii
         LEFT JOIN items i ON sii.item_id = i.id
         WHERE sii.invoice_id = $1 ORDER BY sii.id`,
        [invoice.id]
      );
      allLines = itemsResult.rows.length > 0
        ? itemsResult.rows.map(l => ({ ...l, warehouse_id: l.warehouse_id || l.item_warehouse_id || invoice.warehouse_id }))
        : [{ id: null, item_id: invoice.item_id, warehouse_id: invoice.warehouse_id, quantity: invoice.quantity, unit_price: invoice.unit_price, serial_numbers: invoice.serial_numbers }];
    } else {
      allLines = [{ id: null, item_id: invoice.item_id, warehouse_id: invoice.warehouse_id, quantity: invoice.quantity, unit_price: invoice.unit_price, serial_numbers: invoice.serial_numbers }];
    }

    // ═══ لو الشاشة بعتت مخزن مختلف لكل سطر (صنفين في نفس الفاتورة على مخزنين مختلفين،
    // أو صنف من غير مخزن محدد واختاره أمين المخزن يدويًا) — نطبّق التحديد ده فوق مخزن السطر الأصلي ═══
    const lineWarehouseOverrides = {};
    if (Array.isArray(bodyLineSerials)) {
      bodyLineSerials.forEach(ls => {
        if (ls && ls.line_id != null && ls.warehouse_id) {
          lineWarehouseOverrides[String(ls.line_id)] = ls.warehouse_id;
        }
      });
    }
    allLines = allLines.map(l => {
      const override = l.id != null ? lineWarehouseOverrides[String(l.id)] : undefined;
      return override ? { ...l, warehouse_id: override } : l;
    });

    // ═══ كل مخزن يصرف أسطره بس ═══
    let linesToProcess = allLines.filter(l => !l.issued);

    // لو الطلب حدد أسطر بعينها (line_serials فيها line_id)، نصرف الأسطر دي بس — كل واحد بمخزنه الخاص
    const explicitLineIds = Array.isArray(bodyLineSerials)
      ? bodyLineSerials.filter(ls => ls && ls.line_id != null).map(ls => String(ls.line_id))
      : [];

    if (explicitLineIds.length > 0) {
      linesToProcess = linesToProcess.filter(l => explicitLineIds.includes(String(l.id)));
      if (linesToProcess.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'لا توجد أصناف متبقية لصرفها — ربما تم صرفها بالفعل' });
      }
    } else if (bodyWarehouseId) {
      // توافقًا مع الاستدعاءات القديمة اللي بتبعت مخزن واحد للمجموعة كلها
      linesToProcess = linesToProcess.filter(l => String(l.warehouse_id) === String(bodyWarehouseId));
      if (linesToProcess.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'لا توجد أصناف متبقية لهذا المخزن في الفاتورة — ربما تم صرفها بالفعل' });
      }
    }

    // ═══ لازم كل سطر هيتصرف يكون ليه مخزن محدد، وإلا الصرف مينفعش يتم (بدل ما يتجاهل السطر بصمت) ═══
    const linesMissingWarehouse = linesToProcess.filter(l => !l.warehouse_id);
    if (linesMissingWarehouse.length > 0) {
      await client.query('ROLLBACK');
      const names = linesMissingWarehouse.map(l => l.item_name || l.item_id).join('، ');
      return res.status(400).json({ message: `لازم تحدد مخزن للأصناف دي قبل الصرف: ${names}` });
    }

    // خريطة السريالات لكل سطر: [{line_id, serial_numbers}]
    const lineSerialsMap = {};
    if (Array.isArray(bodyLineSerials)) {
      bodyLineSerials.forEach(ls => {
        if (ls && ls.line_id != null) {
          lineSerialsMap[String(ls.line_id)] = Array.isArray(ls.serial_numbers) ? ls.serial_numbers.filter(Boolean) : [];
        }
      });
    }

    const hasSerials = await tableExists('item_serials');
    const hasMovements = await columnExists('inventory_movements', 'movement_type');
    const hasBalances = await columnExists('inventory_balances', 'quantity');
    const processedLines = [];

    for (const line of linesToProcess) {
      if (!line.item_id || !line.warehouse_id || !line.quantity) continue;

      if (hasSerials) {
        const itemCheck = await client.query('SELECT has_serial, name FROM items WHERE id = $1', [line.item_id]);
        const itemHasSerial = itemCheck.rows[0]?.has_serial;

        if (itemHasSerial) {
          // أولوية السريالات: 1) line_serials للسطر ده  2) سريالات عامة في الـ body  3) المحفوظة في السطر
          let requestedSerials = [];
          if (line.id != null && lineSerialsMap[String(line.id)] !== undefined) {
            requestedSerials = lineSerialsMap[String(line.id)];
          } else if (Array.isArray(bodySerials) && bodySerials.filter(Boolean).length > 0) {
            requestedSerials = bodySerials.filter(Boolean);
          } else if (Array.isArray(line.serial_numbers)) {
            requestedSerials = line.serial_numbers.filter(Boolean);
          }

          if (requestedSerials.length !== Number(line.quantity)) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              message: `الصنف "${itemCheck.rows[0].name}" يُصرف بالسريال - لازم تحدد ${line.quantity} سريال بالظبط (اخترت ${requestedSerials.length})`
            });
          }

          const serialRows = await client.query(
            `SELECT id, serial_number FROM item_serials
             WHERE item_id = $1 AND warehouse_id = $2 AND status IN ('available', 'reserved', 'delivered')
               AND serial_number = ANY($3::text[])
             FOR UPDATE`,
            [line.item_id, line.warehouse_id, requestedSerials]
          );

          if (serialRows.rows.length !== requestedSerials.length) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              message: `بعض السريالات المحددة للصنف "${itemCheck.rows[0].name}" غير متاحة في هذا المخزن`
            });
          }

          const serialIds = serialRows.rows.map(r => r.id);
          const hasSoldInvoiceCol = await columnExists('item_serials', 'sold_invoice_id');
          await client.query(
            hasSoldInvoiceCol
              ? `UPDATE item_serials SET status = 'sold', sold_invoice_id = $1, updated_at = NOW() WHERE id = ANY($2::int[])`
              : `UPDATE item_serials SET status = 'sold', updated_at = NOW() WHERE id = ANY($2::int[])`,
            hasSoldInvoiceCol ? [invoice.id, serialIds] : [serialIds]
          );

          const serialNumbers = serialRows.rows.map(r => r.serial_number);
          line.resolved_serials = serialNumbers;
          if (hasItemsTable && line.id) {
            const hasLineSerialsCol = await columnExists('sales_invoice_items', 'serial_numbers');
            if (hasLineSerialsCol) {
              await client.query(
                `UPDATE sales_invoice_items SET serial_numbers = $1 WHERE id = $2`,
                [serialNumbers, line.id]
              );
            }
          } else {
            const hasInvoiceSerialsCol = await columnExists('sales_invoices', 'serial_numbers');
            if (hasInvoiceSerialsCol) {
              await client.query(`UPDATE sales_invoices SET serial_numbers = $1 WHERE id = $2`, [serialNumbers, invoice.id]);
            }
          }
        }
      }

      if (hasMovements) {
        await client.query(
          `INSERT INTO inventory_movements (movement_type, item_id, warehouse_id, quantity, unit_price, total_amount, reference_type, reference_id, notes, created_by)
           VALUES ('out', $1, $2, $3, $4, $5, 'sales_invoice', $6, 'صرف بموجب فاتورة مبيعات', $7)`,
          [line.item_id, line.warehouse_id, line.quantity, line.unit_price, line.quantity * line.unit_price, invoice.id, req.user.id]
        );
      }

      if (hasBalances) {
        await client.query(
          `UPDATE inventory_balances SET quantity = quantity - $1, last_movement_date = CURRENT_DATE, updated_at = NOW()
           WHERE item_id = $2 AND warehouse_id = $3`,
          [line.quantity, line.item_id, line.warehouse_id]
        );
      }

      // نسجل نفس الحركة في stock_movements ونحدث stock كمان
      // (عشان تظهر في تقرير الأرصدة اللي بيقرا من الجدول القديم فقط)
      await client.query(
        `INSERT INTO stock_movements 
         (item_id, warehouse_id, movement_type, quantity, reference_type, reference_id, done_by, unit_price) 
         VALUES ($1, $2, 'out', $3, 'sales_invoice', $4, $5, $6)`,
        [line.item_id, line.warehouse_id, line.quantity, invoice.id, req.user.id, line.unit_price || 0]
      );
      const stockCheckLine = await client.query(
        'SELECT * FROM stock WHERE item_id = $1 AND warehouse_id = $2',
        [line.item_id, line.warehouse_id]
      );
      if (stockCheckLine.rows.length > 0) {
        await client.query(
          'UPDATE stock SET quantity = quantity - $1, updated_at = NOW() WHERE item_id = $2 AND warehouse_id = $3',
          [line.quantity, line.item_id, line.warehouse_id]
        );
      } else {
        await client.query(
          'INSERT INTO stock (item_id, warehouse_id, quantity) VALUES ($1, $2, $3)',
          [line.item_id, line.warehouse_id, -line.quantity]
        );
      }

      // نعلّم السطر كـ "متصرف"
      if (hasItemsTable && line.id) {
        const hasIssuedCol = await columnExists('sales_invoice_items', 'issued');
        if (hasIssuedCol) {
          await client.query(
            `UPDATE sales_invoice_items SET issued = TRUE, issued_at = NOW(), issued_by = $1 WHERE id = $2`,
            [req.user.id, line.id]
          );
        }
      }
      processedLines.push(line);
    }

    // ═══ إنشاء إذن صرف مخزن (voucher) للمخزن ده — مستند قابل للطباعة ═══
    let voucherNumber = null;
    if (processedLines.length > 0 && (await tableExists('warehouse_issue_vouchers'))) {
      const issueWarehouseId = bodyWarehouseId || processedLines[0].warehouse_id;
      const vnRes = await client.query(
        `SELECT voucher_number FROM warehouse_issue_vouchers WHERE voucher_number LIKE 'ISS-%' ORDER BY id DESC LIMIT 1`
      );
      voucherNumber = 'ISS-0001';
      if (vnRes.rows.length > 0) {
        const last = parseInt(vnRes.rows[0].voucher_number.split('-')[1]);
        voucherNumber = `ISS-${String(last + 1).padStart(4, '0')}`;
      }

      const wCols = (await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'warehouse_issue_vouchers'`)).rows.map(r => r.column_name);
      const vCols = ['voucher_number', 'voucher_date', 'customer_id', 'status', 'created_by'];
      const vVals = [voucherNumber, new Date(), invoice.customer_id, 'posted', req.user.id];
      const addV = (c, v) => { if (wCols.includes(c)) { vCols.push(c); vVals.push(v); } };
      addV('reference_type', 'sales_invoice');
      addV('reference_id', invoice.id);
      addV('reference_number', invoice.invoice_number);
      addV('warehouse_id', issueWarehouseId);
      addV('total_items', processedLines.length);
      addV('notes', `صرف تلقائي بموجب فاتورة ${invoice.invoice_number}`);
      addV('warehouse_approved', true);
      addV('warehouse_approved_by', req.user.id);
      addV('warehouse_approved_at', new Date());
      addV('quality_approved', true);
      addV('quality_approved_by', invoice.quality_approved_by || null);
      addV('quality_approved_at', invoice.quality_approved_at || null);

      const vPlaceholders = vVals.map((_, i) => `$${i + 1}`).join(', ');
      const voucherRes = await client.query(
        `INSERT INTO warehouse_issue_vouchers (${vCols.join(', ')}) VALUES (${vPlaceholders}) RETURNING id`,
        vVals
      );
      const voucherId = voucherRes.rows[0].id;

      if (await tableExists('warehouse_issue_items')) {
        for (const line of processedLines) {
          const iName = line.item_name || (await client.query('SELECT name FROM items WHERE id = $1', [line.item_id])).rows[0]?.name || '';
          await client.query(
            `INSERT INTO warehouse_issue_items (voucher_id, item_id, item_name, quantity, unit_price, total_price, serial_numbers, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [voucherId, line.item_id, iName, line.quantity, line.unit_price || 0,
             (line.quantity * (line.unit_price || 0)),
             line.resolved_serials ? line.resolved_serials.join(', ') : null, line.notes || null]
          );
        }
      }
    }

    // ═══ هل باقي أسطر مش متصرفة؟ يبقى الفاتورة لسه quality_approved ═══
    let remaining = 0;
    if (hasItemsTable && (await columnExists('sales_invoice_items', 'issued'))) {
      const remRes = await client.query(
        `SELECT COUNT(*) AS c FROM sales_invoice_items WHERE invoice_id = $1 AND (issued IS NULL OR issued = FALSE)`,
        [invoice.id]
      );
      remaining = parseInt(remRes.rows[0].c);
    }

    if (remaining === 0) {
      const hasWarehouseCols = await columnExists('sales_invoices', 'warehouse_approved_by');
      if (hasWarehouseCols) {
        await client.query(
          `UPDATE sales_invoices SET status = 'warehouse_approved', warehouse_approved_by = $1, warehouse_approved_at = NOW()
           WHERE id = $2`,
          [req.user.id, req.params.id]
        );
      } else {
        await client.query(
          `UPDATE sales_invoices SET status = 'warehouse_approved' WHERE id = $1`,
          [req.params.id]
        );
      }
    }

    await client.query('COMMIT');
    res.json({
      message: remaining === 0
        ? 'تم اعتماد المخزن وصرف البضاعة بنجاح — الفاتورة اتصرفت بالكامل'
        : `تم صرف أصناف المخزن بنجاح — تبقى ${remaining} صنف في مخازن أخرى`,
      voucher_number: voucherNumber,
      remaining_lines: remaining
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// FINANCE APPROVAL
// ═══════════════════════════════════════════════════════════════

router.put('/:id/finance-approve', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const invoiceResult = await client.query(
      `UPDATE sales_invoices SET status = 'approved_finance', finance_approved_by = $1, finance_approved_at = NOW()
       WHERE id = $2 AND status = 'warehouse_approved'
       RETURNING *`,
      [req.user.id, req.params.id]
    );

    if (invoiceResult.rows.length === 0) {
      throw new Error('الفاتورة غير موجودة أو لم يتم اعتماد المخزن لها');
    }

    const invoice = invoiceResult.rows[0];

    if (invoice.customer_id && invoice.total_amount > 0) {
      await client.query(`UPDATE customers SET balance = COALESCE(balance, 0) + $1 WHERE id = $2`, [invoice.total_amount, invoice.customer_id]);
    }

    if (invoice.invoice_type === 'tax' && invoice.tax_14_percent > 0) {
      await client.query(`UPDATE customers SET tax_balance = COALESCE(tax_balance, 0) + $1 WHERE id = $2`, [invoice.tax_14_percent, invoice.customer_id]);
    }

    const hasTransactions = await columnExists('customer_transactions', 'transaction_type');
    if (hasTransactions) {
      await client.query(
        `INSERT INTO customer_transactions (customer_id, invoice_id, transaction_date, transaction_type, amount, description, reference_number, created_by)
         VALUES ($1, $2, CURRENT_DATE, 'debit', $3, $4, $5, $6)`,
        [invoice.customer_id, invoice.id, invoice.total_amount, `فاتورة ${invoice.invoice_number}`, invoice.invoice_number, req.user.id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'تم اعتماد الفاتورة من المالية وتحديث أرصدة العميل', data: invoice });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// CANCEL FINANCE APPROVAL
// ═══════════════════════════════════════════════════════════════

router.put('/:id/cancel-finance', verifyToken, requireRole('finance', 'admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const invoiceResult = await client.query(
      `SELECT * FROM sales_invoices WHERE id = $1 AND status = 'approved_finance'`,
      [req.params.id]
    );

    if (invoiceResult.rows.length === 0) {
      throw new Error('الفاتورة غير موجودة أو لم يتم اعتمادها من المالية');
    }

    const invoice = invoiceResult.rows[0];

    if (invoice.customer_id && invoice.total_amount > 0) {
      await pool.query(`UPDATE customers SET balance = COALESCE(balance, 0) - $1 WHERE id = $2`, [invoice.total_amount, invoice.customer_id]);
    }

    if (invoice.invoice_type === 'tax' && invoice.tax_14_percent > 0) {
      await pool.query(`UPDATE customers SET tax_balance = COALESCE(tax_balance, 0) - $1 WHERE id = $2`, [invoice.tax_14_percent, invoice.customer_id]);
    }

    const hasTransactions = await columnExists('customer_transactions', 'transaction_type');
    if (hasTransactions) {
      await pool.query(
        `INSERT INTO customer_transactions (customer_id, invoice_id, transaction_date, transaction_type, amount, description, reference_number, created_by)
         VALUES ($1, $2, CURRENT_DATE, 'credit', $3, $4, $5, $6)`,
        [invoice.customer_id, invoice.id, invoice.total_amount, `إلغاء فاتورة ${invoice.invoice_number}`, invoice.invoice_number, req.user.id]
      );
    }

    await pool.query(
      `UPDATE sales_invoices SET status = 'warehouse_approved', finance_approved_by = NULL, finance_approved_at = NULL WHERE id = $1`,
      [req.params.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'تم إلغاء اعتماد المالية وإرجاع الأرصدة' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// CANCEL MANAGER APPROVAL
// ═══════════════════════════════════════════════════════════════

router.put('/:id/cancel-manager', verifyToken, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE sales_invoices SET status = 'draft', manager_approved_by = NULL, manager_approved_at = NULL
       WHERE id = $1 AND status = 'approved_manager'
       RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'الفاتورة غير موجودة أو لم يتم اعتمادها من المدير' });
    }
    res.json({ message: 'تم إلغاء اعتماد المدير', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// CANCEL ALL — إلغاء شامل: يرجّع الفاتورة لحالة "مسودة" ويلغي كل
// المستندات التابعة (أمر شغل، إذن تسليم، إذن صرف) ويرجّع الرصيد والسريالات
// ═══════════════════════════════════════════════════════════════
router.put('/:id/cancel-all', verifyToken, requireRole('admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const invoiceResult = await client.query(`SELECT * FROM sales_invoices WHERE id = $1 FOR UPDATE`, [req.params.id]);
    if (invoiceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'الفاتورة غير موجودة' });
    }
    const invoice = invoiceResult.rows[0];

    // ═══ 1) عكس اعتماد المالية (لو حصل) — إرجاع أرصدة العميل ═══
    if (invoice.status === 'approved_finance' && invoice.customer_id) {
      if (invoice.total_amount > 0) {
        await client.query(`UPDATE customers SET balance = COALESCE(balance, 0) - $1 WHERE id = $2`, [invoice.total_amount, invoice.customer_id]);
      }
      if (invoice.invoice_type === 'tax' && invoice.tax_14_percent > 0) {
        await client.query(`UPDATE customers SET tax_balance = COALESCE(tax_balance, 0) - $1 WHERE id = $2`, [invoice.tax_14_percent, invoice.customer_id]);
      }
      if (await columnExists('customer_transactions', 'transaction_type')) {
        await client.query(
          `INSERT INTO customer_transactions (customer_id, invoice_id, transaction_date, transaction_type, amount, description, reference_number, created_by)
           VALUES ($1, $2, CURRENT_DATE, 'credit', $3, $4, $5, $6)`,
          [invoice.customer_id, invoice.id, invoice.total_amount, `إلغاء كامل لفاتورة ${invoice.invoice_number}`, invoice.invoice_number, req.user.id]
        );
      }
    }

    // ═══ 2) عكس إذونات الصرف (المرتبطة بالفاتورة) — إرجاع الرصيد والسريالات ═══
    if (await tableExists('warehouse_issue_vouchers')) {
      const vouchers = await client.query(
        `SELECT * FROM warehouse_issue_vouchers WHERE reference_type = 'sales_invoice' AND reference_id = $1`,
        [invoice.id]
      );
      for (const voucher of vouchers.rows) {
        if (await tableExists('warehouse_issue_items')) {
          const vItems = await client.query('SELECT * FROM warehouse_issue_items WHERE voucher_id = $1', [voucher.id]);
          for (const vi of vItems.rows) {
            // نرجع الرصيد (الأنظمة الجديدة والقديمة مع بعض)
            if (await columnExists('inventory_balances', 'quantity')) {
              await client.query(
                `UPDATE inventory_balances SET quantity = quantity + $1, updated_at = NOW() WHERE item_id = $2 AND warehouse_id = $3`,
                [vi.quantity, vi.item_id, voucher.warehouse_id]
              );
            }
            const stockChk = await client.query('SELECT * FROM stock WHERE item_id = $1 AND warehouse_id = $2', [vi.item_id, voucher.warehouse_id]);
            if (stockChk.rows.length > 0) {
              await client.query('UPDATE stock SET quantity = quantity + $1, updated_at = NOW() WHERE item_id = $2 AND warehouse_id = $3', [vi.quantity, vi.item_id, voucher.warehouse_id]);
            } else {
              await client.query('INSERT INTO stock (item_id, warehouse_id, quantity) VALUES ($1, $2, $3)', [vi.item_id, voucher.warehouse_id, vi.quantity]);
            }
            // نرجع السريالات لـ available
            if (vi.serial_numbers) {
              const serialsArr = vi.serial_numbers.split(',').map(s => s.trim()).filter(Boolean);
              if (serialsArr.length > 0) {
                await client.query(
                  `UPDATE item_serials SET status = 'available', sold_invoice_id = NULL, sold_at = NULL, updated_at = NOW()
                   WHERE item_id = $1 AND serial_number = ANY($2::text[]) AND status IN ('sold', 'reserved', 'delivered')`,
                  [vi.item_id, serialsArr]
                );
              }
            }
          }
          await client.query('DELETE FROM warehouse_issue_items WHERE voucher_id = $1', [voucher.id]);
        }
        await client.query('DELETE FROM warehouse_issue_vouchers WHERE id = $1', [voucher.id]);
      }
    }

    // ═══ 2ب) مسح سجل حركات المخزن (صرف/إضافة) المرتبطة بهذه الفاتورة — عشان لو اتصرفت تاني
    // بعد ما ترجع مسودة، ميتسجّلش صرف مضاعف في سجل الحركات (الرصيد بيرجع صح بس السجل كان بيفضل مكرر) ═══
    if (await columnExists('inventory_movements', 'movement_type')) {
      await client.query(
        `DELETE FROM inventory_movements WHERE reference_type = 'sales_invoice' AND reference_id = $1`,
        [invoice.id]
      );
    }

    // ═══ 3) عكس أي سريالات لسه متسجلة على أسطر الفاتورة نفسها (احتياط) ═══
    if (await tableExists('sales_invoice_items')) {
      const invItems = await client.query('SELECT * FROM sales_invoice_items WHERE invoice_id = $1', [invoice.id]);
      for (const it of invItems.rows) {
        if (it.serial_numbers && Array.isArray(it.serial_numbers) && it.serial_numbers.length > 0) {
          await client.query(
            `UPDATE item_serials SET status = 'available', sold_invoice_id = NULL, sold_at = NULL, updated_at = NOW()
             WHERE item_id = $1 AND serial_number = ANY($2::text[]) AND status IN ('sold', 'reserved', 'delivered')`,
            [it.item_id, it.serial_numbers]
          );
        }
      }
      // نصفّر علامات الصرف على مستوى السطر عشان الفاتورة تبقى قابلة للتعديل من الأول
      if (await columnExists('sales_invoice_items', 'issued')) {
        await client.query(`UPDATE sales_invoice_items SET issued = FALSE, issued_at = NULL, issued_by = NULL WHERE invoice_id = $1`, [invoice.id]);
      }
      if (await columnExists('sales_invoice_items', 'serial_numbers')) {
        await client.query(`UPDATE sales_invoice_items SET serial_numbers = NULL WHERE invoice_id = $1`, [invoice.id]);
      }
    }

    // ═══ 4) إلغاء إذن التسليم المرتبط (وأي سريالات محجوزة/مسلّمة تابعة له) ═══
    if (await tableExists('delivery_notes')) {
      const dnRows = await client.query('SELECT * FROM delivery_notes WHERE invoice_id = $1', [invoice.id]);
      for (const dn of dnRows.rows) {
        if (await tableExists('delivery_note_items')) {
          const dnItems = await client.query('SELECT * FROM delivery_note_items WHERE delivery_note_id = $1', [dn.id]);
          for (const di of dnItems.rows) {
            if (di.serial_numbers) {
              const serialsArr = Array.isArray(di.serial_numbers) ? di.serial_numbers
                : String(di.serial_numbers).split(',').map(s => s.trim()).filter(Boolean);
              if (serialsArr.length > 0) {
                await client.query(
                  `UPDATE item_serials SET status = 'available', sold_invoice_id = NULL, sold_at = NULL, updated_at = NOW()
                   WHERE item_id = $1 AND serial_number = ANY($2::text[]) AND status IN ('sold', 'reserved', 'delivered')`,
                  [di.item_id, serialsArr]
                );
              }
            }
          }
          await client.query('DELETE FROM delivery_note_items WHERE delivery_note_id = $1', [dn.id]);
        }
        await client.query('DELETE FROM delivery_notes WHERE id = $1', [dn.id]);
      }
    }

    // ═══ 5) إلغاء أمر الشغل المرتبط (وأي سريالات محجوزة تابعة له) ═══
    if (await tableExists('work_orders')) {
      const woRows = await client.query('SELECT * FROM work_orders WHERE invoice_id = $1', [invoice.id]);
      for (const wo of woRows.rows) {
        if (await tableExists('work_order_items')) {
          const woItems = await client.query('SELECT * FROM work_order_items WHERE work_order_id = $1', [wo.id]);
          for (const wi of woItems.rows) {
            if (wi.serial_numbers && wi.serial_numbers.length > 0) {
              await client.query(
                `UPDATE item_serials SET status = 'available', sold_invoice_id = NULL, sold_at = NULL, updated_at = NOW()
                 WHERE item_id = $1 AND serial_number = ANY($2::text[]) AND status IN ('sold', 'reserved', 'delivered')`,
                [wi.item_id, wi.serial_numbers]
              );
            }
          }
          await client.query('DELETE FROM work_order_items WHERE work_order_id = $1', [wo.id]);
        }
        await client.query('DELETE FROM work_orders WHERE id = $1', [wo.id]);
      }
    }

    // ═══ 6) فك ارتباط بيانات التسليم المسعرة (DQ) عشان تبقى متاحة لفاتورة تانية ═══
    if (await tableExists('sales_invoice_dqs')) {
      const links = await client.query('SELECT dq_id FROM sales_invoice_dqs WHERE invoice_id = $1', [invoice.id]);
      for (const l of links.rows) {
        await client.query(`UPDATE delivery_quotes SET converted_to_invoice_id = NULL WHERE id = $1`, [l.dq_id]);
      }
      await client.query('DELETE FROM sales_invoice_dqs WHERE invoice_id = $1', [invoice.id]);
    }

    // ═══ 6ب) فك ارتباط أمر البيع المصدر عشان يبقى متاح تاني في القائمة ═══
    if (invoice.so_id) {
      await client.query(
        `UPDATE sales_orders SET converted_to_invoice_id = NULL, converted_to_invoice_type = NULL WHERE id = $1`,
        [invoice.so_id]
      );
    }

    // ═══ 7) رجوع الفاتورة نفسها لحالة مسودة كاملة ═══
    const clearableCols = [
      'manager_approved_by', 'manager_approved_at',
      'quality_approved_by', 'quality_approved_at',
      'finance_approved_by', 'finance_approved_at',
      'work_order_id', 'delivery_note_id'
    ];
    let setClauses = [`status = 'draft'`];
    for (const col of clearableCols) {
      if (await columnExists('sales_invoices', col)) setClauses.push(`${col} = NULL`);
    }
    await client.query(`UPDATE sales_invoices SET ${setClauses.join(', ')} WHERE id = $1`, [invoice.id]);

    await client.query('COMMIT');
    res.json({ message: 'تم الإلغاء الشامل بنجاح — الفاتورة رجعت لحالة مسودة وكل المستندات التابعة اتلغت والرصيد والسريالات رجعوا' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Cancel-all invoice error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// ATTACHMENTS
// ═══════════════════════════════════════════════════════════════

router.post('/:id/attachments', verifyToken, async (req, res) => {
  const { file_name, file_url } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO invoice_attachments (invoice_id, file_name, file_url, uploaded_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, file_name, file_url, req.user.id]
    );
    res.status(201).json({ message: 'تم إضافة المرفق', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/:id/attachments', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, u.username as uploaded_by_name
       FROM invoice_attachments a
       LEFT JOIN users u ON a.uploaded_by = u.id
       WHERE a.invoice_id = $1 ORDER BY a.created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/attachments/:attachmentId', verifyToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM invoice_attachments WHERE id = $1', [req.params.attachmentId]);
    res.json({ message: 'تم حذف المرفق' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// PRINT INVOICE
// ═══════════════════════════════════════════════════════════════

router.get('/:id/print', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT si.*, i.name as item_name, i.code as item_code, 
        c.name as customer_name_display,
        c.address as customer_address,
        c.phone as customer_phone,
        c.tax_number as customer_tax_number,
        p.name as parent_customer_name,
        so.order_number as sales_order_number,
        so.delivery_location as so_delivery_location,
        si.pricing_sheet_number,
        u.full_name as created_by_name,
        COALESCE(u2.full_name, u2.username) as manager_approved_by_name,
        COALESCE(u3.full_name, u3.username) as finance_approved_by_name
       FROM sales_invoices si
       LEFT JOIN items i ON si.item_id = i.id
       LEFT JOIN customers c ON si.customer_id = c.id
       LEFT JOIN customers p ON c.parent_id = p.id
       LEFT JOIN sales_orders so ON si.so_id = so.id
       LEFT JOIN employees e ON si.salesperson_id = e.id
       LEFT JOIN users u ON si.created_by = u.id
       LEFT JOIN users u2 ON si.manager_approved_by = u2.id
       LEFT JOIN users u3 ON si.finance_approved_by = u3.id
       WHERE si.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'الفاتورة غير موجودة' });
    }

    const attachmentsResult = await pool.query(
      `SELECT * FROM invoice_attachments WHERE invoice_id = $1`,
      [req.params.id]
    );

    let printItems = [];
    const hasItemsTable = await tableExists('sales_invoice_items');
    if (hasItemsTable) {
      const itemsResult = await pool.query(
        `SELECT sii.*, i.name as item_name_lookup, i.code as item_code
         FROM sales_invoice_items sii
         LEFT JOIN items i ON sii.item_id = i.id
         WHERE sii.invoice_id = $1 ORDER BY sii.id`,
        [req.params.id]
      );
      printItems = itemsResult.rows;
    }

    // أرقام بيانات التسليم المسعرة المرتبطة (لو الفاتورة متجمعة من بيانات)
    const invoiceRow = result.rows[0];
    if (await tableExists('sales_invoice_dqs')) {
      try {
        const dqRes = await pool.query(
          `SELECT dq.dq_number FROM sales_invoice_dqs sid JOIN delivery_quotes dq ON sid.dq_id = dq.id WHERE sid.invoice_id = $1 ORDER BY dq.dq_number`,
          [req.params.id]
        );
        if (dqRes.rows.length > 0) invoiceRow.dq_numbers = dqRes.rows.map(r => r.dq_number).join('، ');
      } catch (e) { /* ignore */ }
    }

    res.json({ 
      invoice: invoiceRow, 
      items: printItems,
      attachments: attachmentsResult.rows,
      print_date: new Date().toISOString() 
    });
  } catch (err) {
    console.error('Print invoice error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// SALES REPORTS — تقارير المبيعات
// ═══════════════════════════════════════════════════════════════

// GET /sales-invoices/reports/sales - كل الفواتير مع فلترة
router.get('/reports/sales', verifyToken, async (req, res) => {
  const { start_date, end_date, customer_id, invoice_type, status } = req.query;

  try {
    let query = `
      SELECT 
        si.id,
        si.invoice_number,
        si.invoice_date,
        si.invoice_type,
        si.customer_id,
        si.customer_name,
        si.total_amount,
        si.commission_rate,
        si.commission_amount,
        si.status,
        si.created_at,
        si.created_by,
        c.name as customer_name_display,
        u.full_name as created_by_name
      FROM sales_invoices si
      LEFT JOIN customers c ON si.customer_id = c.id
      LEFT JOIN users u ON si.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (start_date) {
      query += ` AND si.invoice_date >= $${idx}`;
      params.push(start_date);
      idx++;
    }
    if (end_date) {
      query += ` AND si.invoice_date <= $${idx}`;
      params.push(end_date);
      idx++;
    }
    if (customer_id) {
      query += ` AND si.customer_id = $${idx}`;
      params.push(customer_id);
      idx++;
    }
    if (invoice_type) {
      query += ` AND si.invoice_type = $${idx}`;
      params.push(invoice_type);
      idx++;
    }
    if (status) {
      query += ` AND si.status = $${idx}`;
      params.push(status);
      idx++;
    }

    query += ` ORDER BY si.invoice_date DESC, si.id DESC`;

    const result = await pool.query(query, params);
    const rows = await attachItemsToInvoices(result.rows);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching sales report:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /sales-invoices/reports/commissions - عمولات
router.get('/reports/commissions', verifyToken, async (req, res) => {
  const { start_date, end_date, customer_id, salesperson_id } = req.query;

  try {
    let query = `
      SELECT 
        si.id,
        si.invoice_number,
        si.invoice_date,
        si.customer_id,
        si.customer_name,
        si.total_amount,
        si.commission_rate,
        si.commission_amount,
        si.salesperson_id,
        si.status,
        si.created_at,
         c.name as customer_name_display,
        u.full_name as created_by_name
      FROM sales_invoices si
      LEFT JOIN customers c ON si.customer_id = c.id
      LEFT JOIN users u ON si.created_by = u.id
      WHERE si.commission_amount > 0
    `;
    const params = [];
    let idx = 1;

    if (start_date) {
      query += ` AND si.invoice_date >= $${idx}`;
      params.push(start_date);
      idx++;
    }
    if (end_date) {
      query += ` AND si.invoice_date <= $${idx}`;
      params.push(end_date);
      idx++;
    }
    if (customer_id) {
      query += ` AND si.customer_id = $${idx}`;
      params.push(customer_id);
      idx++;
    }
    if (salesperson_id) {
      query += ` AND si.created_by = $${idx}`;
      params.push(salesperson_id);
      idx++;
    }

    query += ` ORDER BY si.invoice_date DESC, si.id DESC`;

    const result = await pool.query(query, params);
    const rows = await attachItemsToInvoices(result.rows);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching commissions report:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /sales-invoices/reports/pending - فواتير معلقة
router.get('/reports/pending', verifyToken, async (req, res) => {
  const { start_date, end_date, customer_id } = req.query;

  try {
    let query = `
      SELECT 
        si.id,
        si.invoice_number,
        si.invoice_date,
        si.customer_id,
        si.customer_name,
        si.total_amount,
        si.remaining_amount,
        si.status,
        si.created_at,
        c.name as customer_name_display
      FROM sales_invoices si
      LEFT JOIN customers c ON si.customer_id = c.id
      WHERE si.status NOT IN ('posted', 'cancelled')
        AND si.remaining_amount > 0
    `;
    const params = [];
    let idx = 1;

    if (start_date) {
      query += ` AND si.invoice_date >= $${idx}`;
      params.push(start_date);
      idx++;
    }
    if (end_date) {
      query += ` AND si.invoice_date <= $${idx}`;
      params.push(end_date);
      idx++;
    }
    if (customer_id) {
      query += ` AND si.customer_id = $${idx}`;
      params.push(customer_id);
      idx++;
    }

    query += ` ORDER BY si.invoice_date DESC, si.id DESC`;

    const result = await pool.query(query, params);
    const rows = await attachItemsToInvoices(result.rows);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching pending report:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// GET INVOICE BY ID (MUST BE LAST)
// ═══════════════════════════════════════════════════════════════

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT si.*, i.name as item_name, i.code as item_code, 
        c.name as customer_name_display,
        c.address as customer_address,
        c.phone as customer_phone,
        c.tax_number as customer_tax_number,
        p.name as parent_customer_name,
        so.order_number as sales_order_number,
        u.full_name as created_by_name
       FROM sales_invoices si
       LEFT JOIN items i ON si.item_id = i.id
       LEFT JOIN customers c ON si.customer_id = c.id
       LEFT JOIN customers p ON c.parent_id = p.id
       LEFT JOIN sales_orders so ON si.so_id = so.id
       LEFT JOIN users u ON si.created_by = u.id
       WHERE si.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'الفاتورة غير موجودة' });
    }

    const invoice = result.rows[0];
    const hasItemsTable = await tableExists('sales_invoice_items');
    if (hasItemsTable) {
      const itemsResult = await pool.query(
        `SELECT sii.*, i.name as item_name_lookup, i.code as item_code, i.has_serial as item_has_serial,
          w.name as warehouse_name
         FROM sales_invoice_items sii
         LEFT JOIN items i ON sii.item_id = i.id
         LEFT JOIN warehouses w ON sii.warehouse_id = w.id
         WHERE sii.invoice_id = $1 ORDER BY sii.id`,
        [req.params.id]
      );
      invoice.items = itemsResult.rows;
    } else {
      invoice.items = [];
    }

    // أرقام بيانات التسليم المرتبطة
    if (await tableExists('sales_invoice_dqs')) {
      const dqRes = await pool.query(
        `SELECT dq.id, dq.dq_number FROM sales_invoice_dqs sid
         JOIN delivery_quotes dq ON sid.dq_id = dq.id
         WHERE sid.invoice_id = $1`,
        [req.params.id]
      );
      invoice.dq_links = dqRes.rows;
    }

    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
