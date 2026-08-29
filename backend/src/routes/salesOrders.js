const express = require('express');
const router = express.Router();

let pool, verifyToken;
try {
  const dbModule = require('../config/db');
  pool = dbModule.pool || dbModule;
} catch (e) {
  console.error('DB import error:', e.message);
  pool = null;
}

try {
  const authModule = require('../middleware/auth');
  verifyToken = authModule.verifyToken || authModule;
  if (typeof verifyToken !== 'function') verifyToken = (req, res, next) => next();
} catch (e) {
  console.error('Auth import error:', e.message);
  verifyToken = (req, res, next) => next();
}

// ==================== COLUMN DETECTION ====================
const columnCache = {};

async function getTableColumns(tableName) {
  if (columnCache[tableName]) return columnCache[tableName];
  if (!pool) return [];
  try {
    const result = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = $1 AND table_schema = 'public'
    `, [tableName]);
    const cols = result.rows.map(r => r.column_name);
    columnCache[tableName] = cols;
    return cols;
  } catch (err) {
    console.error('Column detection error for', tableName, err.message);
    return [];
  }
}

function hasCol(cols, name) { return cols.includes(name); }

async function safeQuery(query, params) {
  if (!pool) throw new Error('Database not connected');
  return await pool.query(query, params);
}

// ==================== LIST ====================
router.get('/', verifyToken, async (req, res) => {
  try {
    const soCols = await getTableColumns('sales_orders');
    const empCols = await getTableColumns('employees');

    const { page = 1, limit = 20, status, delivery_status, customer_id, sales_rep_id, order_type, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let selectFields = ['so.id', 'so.order_number', 'so.order_date', 'so.customer_id', 'so.total_amount', 'so.currency', 'so.status', 'so.order_type', 'c.name AS customer_name'];

    if (hasCol(soCols, 'customer_branch_id')) selectFields.push('so.customer_branch_id');
    if (hasCol(soCols, 'sales_rep_id')) selectFields.push('so.sales_rep_id');
    if (hasCol(soCols, 'is_virtual')) selectFields.push('so.is_virtual');
    if (hasCol(soCols, 'is_converted')) selectFields.push('so.is_converted');
    if (hasCol(soCols, 'delivery_status')) selectFields.push('so.delivery_status');
    if (hasCol(soCols, 'total_amount_currency')) selectFields.push('so.total_amount_currency');
    if (hasCol(soCols, 'notes')) selectFields.push('so.notes');

    let empNameField = null;
    if (hasCol(empCols, 'full_name')) empNameField = 'e.full_name';
    else if (hasCol(empCols, 'name')) empNameField = 'e.name';
    else if (hasCol(empCols, 'employee_name')) empNameField = 'e.employee_name';

    if (empNameField) selectFields.push(`${empNameField} AS sales_rep_name`);

    let branchJoin = '';
    if (hasCol(soCols, 'customer_branch_id')) {
      selectFields.push('cb.name AS branch_name');
      branchJoin = 'LEFT JOIN customers cb ON so.customer_branch_id = cb.id';
    }

    let whereClause = 'WHERE so.order_type = $1 OR so.order_type IS NULL';
    const params = ['sales_order'];
    let pIdx = 2;

    if (status) { whereClause += ` AND so.status = $${pIdx++}`; params.push(status); }
    if (delivery_status && hasCol(soCols, 'delivery_status')) { whereClause += ` AND so.delivery_status = $${pIdx++}`; params.push(delivery_status); }
    if (customer_id) { whereClause += ` AND so.customer_id = $${pIdx++}`; params.push(customer_id); }
    if (sales_rep_id && hasCol(soCols, 'sales_rep_id')) { whereClause += ` AND so.sales_rep_id = $${pIdx++}`; params.push(sales_rep_id); }
    if (search) { whereClause += ` AND (so.order_number ILIKE $${pIdx} OR c.name ILIKE $${pIdx})`; params.push(`%${search}%`); pIdx++; }

    const countRes = await safeQuery(`SELECT COUNT(*) FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id ${whereClause}`, params);
    const total = parseInt(countRes.rows[0].count);

    const listParams = [...params, parseInt(limit), offset];
    let empJoin = '';
    if (hasCol(soCols, 'sales_rep_id') && empNameField) {
      empJoin = 'LEFT JOIN employees e ON so.sales_rep_id = e.id';
    }

    const result = await safeQuery(`
      SELECT ${selectFields.join(', ')} FROM sales_orders so
      LEFT JOIN customers c ON so.customer_id = c.id
      ${branchJoin}
      ${empJoin}
      ${whereClause}
      ORDER BY so.id DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++}
    `, listParams);

    res.json({ data: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) {
    console.error('List error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// DELIVERY QUOTES (بيانات التسليم المسعر)
// ═══════════════════════════════════════════════════════════════

// Helper: Generate next DQ number (monthly sequence: 01 + MM + YYYY)
// Example: 01082026, 02082026, ... resets to 01 each month
async function getNextDQNumber() {
  const now = new Date();
  const yearMonth = String(now.getMonth() + 1).padStart(2, '0') + String(now.getFullYear());

  // Ensure table exists
  await safeQuery(`
    CREATE TABLE IF NOT EXISTS dq_sequences (
      id SERIAL PRIMARY KEY,
      year_month VARCHAR(6) UNIQUE NOT NULL,
      last_number INTEGER DEFAULT 0
    )
  `);

  const result = await safeQuery(
    `INSERT INTO dq_sequences (year_month, last_number) VALUES ($1, 1)
     ON CONFLICT (year_month) DO UPDATE SET last_number = dq_sequences.last_number + 1
     RETURNING last_number`,
    [yearMonth]
  );

  const seq = result.rows[0].last_number;
  return `${String(seq).padStart(2, '0')}${yearMonth}`;
}

// GET /delivery-quotes
router.get('/delivery-quotes', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const dqCols = await getTableColumns('delivery_quotes');
    const empCols = await getTableColumns('employees');

    let selectFields = [
      'dq.id', 'dq.dq_number', 'dq.order_date', 'dq.customer_id',
      'dq.total_amount', 'dq.currency', 'dq.status', 'dq.delivery_status',
      'c.name AS customer_name'
    ];

    if (hasCol(dqCols, 'customer_branch_id')) selectFields.push('dq.customer_branch_id');
    if (hasCol(dqCols, 'sales_rep_id')) selectFields.push('dq.sales_rep_id');
    if (hasCol(dqCols, 'total_amount_currency')) selectFields.push('dq.total_amount_currency');
    if (hasCol(dqCols, 'notes')) selectFields.push('dq.notes');
    if (hasCol(dqCols, 'department_id')) selectFields.push('dq.department_id');
    if (hasCol(dqCols, 'delivery_note_id')) selectFields.push('dq.delivery_note_id');
    if (hasCol(dqCols, 'work_order_id')) selectFields.push('dq.work_order_id');
    if (hasCol(dqCols, 'converted_to_invoice_id')) selectFields.push('dq.converted_to_invoice_id');

    let empNameField = null;
    if (hasCol(empCols, 'full_name')) empNameField = 'e.full_name';
    else if (hasCol(empCols, 'name')) empNameField = 'e.name';
    else if (hasCol(empCols, 'employee_name')) empNameField = 'e.employee_name';
    if (empNameField) selectFields.push(`${empNameField} AS sales_rep_name`);

    let branchJoin = '';
    if (hasCol(dqCols, 'customer_branch_id')) {
      selectFields.push('cb.name AS branch_name');
      branchJoin = 'LEFT JOIN customers cb ON dq.customer_branch_id = cb.id';
    }

    let whereClause = 'WHERE 1=1';
    const params = [];
    let pIdx = 1;

    if (status) { whereClause += ` AND dq.status = $${pIdx++}`; params.push(status); }
    if (search) { whereClause += ` AND (dq.dq_number ILIKE $${pIdx} OR c.name ILIKE $${pIdx})`; params.push(`%${search}%`); pIdx++; }

    const countRes = await safeQuery(`SELECT COUNT(*) FROM delivery_quotes dq LEFT JOIN customers c ON dq.customer_id = c.id ${whereClause}`, params);
    const total = parseInt(countRes.rows[0].count);

    const listParams = [...params, parseInt(limit), offset];
    let empJoin = '';
    if (hasCol(dqCols, 'sales_rep_id') && empNameField) {
      empJoin = 'LEFT JOIN employees e ON dq.sales_rep_id = e.id';
    }

    const result = await safeQuery(`
      SELECT ${selectFields.join(', ')} FROM delivery_quotes dq
      LEFT JOIN customers c ON dq.customer_id = c.id
      ${branchJoin}
      ${empJoin}
      ${whereClause}
      ORDER BY dq.id DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++}
    `, listParams);

    res.json({ data: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) {
    console.error('DQ List error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /delivery-quotes/next-number
router.get('/delivery-quotes/next-number', verifyToken, async (req, res) => {
  try {
    const nextNumber = await getNextDQNumber();
    res.json({ nextNumber });
  } catch (err) {
    console.error('DQ Next number error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /delivery-quotes/:id
router.get('/delivery-quotes/:id', verifyToken, async (req, res) => {
  try {
    const dqCols = await getTableColumns('delivery_quotes');
    const dqiCols = await getTableColumns('delivery_quote_items');
    const empCols = await getTableColumns('employees');

    let selectFields = [
      'dq.id', 'dq.dq_number', 'dq.order_date', 'dq.customer_id',
      'dq.total_amount', 'dq.currency', 'dq.status', 'dq.delivery_status',
      'c.name AS customer_name'
    ];

    if (hasCol(dqCols, 'customer_branch_id')) selectFields.push('dq.customer_branch_id');
    if (hasCol(dqCols, 'sales_rep_id')) selectFields.push('dq.sales_rep_id');
    if (hasCol(dqCols, 'total_amount_currency')) selectFields.push('dq.total_amount_currency');
    if (hasCol(dqCols, 'notes')) selectFields.push('dq.notes');
    if (hasCol(dqCols, 'exchange_rate')) selectFields.push('dq.exchange_rate');
    if (hasCol(dqCols, 'delivery_date')) selectFields.push('dq.delivery_date');
    if (hasCol(dqCols, 'department_id')) selectFields.push('dq.department_id');

    let empNameField = null;
    if (hasCol(empCols, 'full_name')) empNameField = 'e.full_name';
    else if (hasCol(empCols, 'name')) empNameField = 'e.name';
    if (empNameField) selectFields.push(`${empNameField} AS sales_rep_name`);

    let branchJoin = '';
    if (hasCol(dqCols, 'customer_branch_id')) {
      selectFields.push('cb.name AS branch_name');
      branchJoin = 'LEFT JOIN customers cb ON dq.customer_branch_id = cb.id';
    }

    let empJoin = '';
    if (hasCol(dqCols, 'sales_rep_id') && empNameField) {
      empJoin = 'LEFT JOIN employees e ON dq.sales_rep_id = e.id';
    }

    const orderRes = await safeQuery(`
      SELECT ${selectFields.join(', ')} FROM delivery_quotes dq
      LEFT JOIN customers c ON dq.customer_id = c.id
      ${branchJoin}
      ${empJoin}
      WHERE dq.id = $1
    `, [req.params.id]);

    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Delivery quote not found' });
    const order = orderRes.rows[0];

    let itemFields = ['dqi.id', 'dqi.item_id', 'dqi.quantity', 'dqi.unit_price', 'i.name AS item_name', 'i.code AS item_code', 'i.has_serial', 'i.warehouse_id AS item_warehouse_id'];
    if (hasCol(dqiCols, 'discount_percent')) itemFields.push('dqi.discount_percent');
    if (hasCol(dqiCols, 'discount_amount')) itemFields.push('dqi.discount_amount');
    if (hasCol(dqiCols, 'notes')) itemFields.push('dqi.notes');
    if (hasCol(dqiCols, 'unit')) itemFields.push('dqi.unit');
    if (hasCol(dqiCols, 'serial_numbers')) itemFields.push('dqi.serial_numbers');
    if (hasCol(dqiCols, 'warehouse_id')) itemFields.push('dqi.warehouse_id');

    const itemsRes = await safeQuery(`
      SELECT ${itemFields.join(', ')} FROM delivery_quote_items dqi
      LEFT JOIN items i ON dqi.item_id = i.id
      WHERE dqi.delivery_quote_id = $1
    `, [req.params.id]);

    order.items = itemsRes.rows;
    res.json(order);
  } catch (err) {
    console.error('DQ Get single error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /delivery-quotes
router.post('/delivery-quotes', verifyToken, async (req, res) => {
  try {
    const dqCols = await getTableColumns('delivery_quotes');
    const dqiCols = await getTableColumns('delivery_quote_items');

    const { customer_id, customer_branch_id, sales_rep_id, department_id, order_date, delivery_date, currency, exchange_rate, notes, items, total_amount, total_amount_currency } = req.body;

    if (!customer_id || !items || items.length === 0) {
      return res.status(400).json({ error: 'Customer and items are required' });
    }
    if (!customer_branch_id) {
      return res.status(400).json({ error: 'Customer branch is required for delivery quotes' });
    }

    const dqNumber = await getNextDQNumber();

    let insertCols = ['dq_number', 'customer_id', 'order_date', 'status', 'delivery_status'];
    let insertVals = [dqNumber, customer_id, order_date || new Date(), 'draft', 'pending'];

    const addCol = (col, val) => {
      if (hasCol(dqCols, col) && val !== undefined && val !== null && val !== '') {
        insertCols.push(col);
        insertVals.push(val);
      }
    };

    addCol('customer_branch_id', customer_branch_id);
    addCol('sales_rep_id', sales_rep_id);
    addCol('department_id', department_id);
    addCol('delivery_date', delivery_date);
    addCol('currency', currency || 'EGP');
    addCol('exchange_rate', exchange_rate || 1);
    addCol('notes', notes);
    addCol('total_amount', total_amount);
    addCol('total_amount_currency', total_amount_currency);

    const placeholders = insertVals.map((_, i) => `$${i + 1}`).join(', ');
    const orderRes = await safeQuery(`INSERT INTO delivery_quotes (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING id`, insertVals);
    const orderId = orderRes.rows[0].id;

    for (const item of items) {
      if (!item.item_id || !item.quantity) continue;
      let itemCols = ['delivery_quote_id', 'item_id', 'quantity', 'unit_price'];
      let itemVals = [orderId, item.item_id, item.quantity, item.unit_price || 0];
      if (hasCol(dqiCols, 'item_name')) { itemCols.push('item_name'); itemVals.push(item.item_name || ''); }
      if (hasCol(dqiCols, 'discount_percent') && item.discount_percent) { itemCols.push('discount_percent'); itemVals.push(item.discount_percent); }
      if (hasCol(dqiCols, 'discount_amount') && item.discount_amount) { itemCols.push('discount_amount'); itemVals.push(item.discount_amount); }
      if (hasCol(dqiCols, 'notes') && item.notes) { itemCols.push('notes'); itemVals.push(item.notes); }
      const ip = itemVals.map((_, i) => `$${i + 1}`).join(', ');
      await safeQuery(`INSERT INTO delivery_quote_items (${itemCols.join(', ')}) VALUES (${ip})`, itemVals);
    }

    res.status(201).json({ id: orderId, dq_number: dqNumber, message: 'تم إنشاء بيان التسليم المسعر بنجاح' });
  } catch (err) {
    console.error('DQ Create error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /delivery-quotes/:id
router.put('/delivery-quotes/:id', verifyToken, async (req, res) => {
  try {
    const dqCols = await getTableColumns('delivery_quotes');
    const dqiCols = await getTableColumns('delivery_quote_items');
    const { customer_id, customer_branch_id, sales_rep_id, department_id, order_date, delivery_date, currency, exchange_rate, notes, items, total_amount, total_amount_currency } = req.body;

    let updates = [];
    let values = [];
    let pIdx = 1;

    const addUpdate = (col, val) => {
      if (hasCol(dqCols, col) && val !== undefined) {
        updates.push(`${col} = $${pIdx++}`);
        values.push(val === '' ? null : val);
      }
    };

    addUpdate('customer_id', customer_id);
    addUpdate('customer_branch_id', customer_branch_id);
    addUpdate('sales_rep_id', sales_rep_id);
    addUpdate('department_id', department_id);
    addUpdate('order_date', order_date);
    addUpdate('delivery_date', delivery_date);
    addUpdate('currency', currency);
    addUpdate('exchange_rate', exchange_rate);
    addUpdate('notes', notes);
    addUpdate('total_amount', total_amount);
    addUpdate('total_amount_currency', total_amount_currency);

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(req.params.id);
    await safeQuery(`UPDATE delivery_quotes SET ${updates.join(', ')} WHERE id = $${pIdx}`, values);

    if (items && items.length > 0) {
      await safeQuery('DELETE FROM delivery_quote_items WHERE delivery_quote_id = $1', [req.params.id]);
      for (const item of items) {
        if (!item.item_id || !item.quantity) continue;
        let itemCols = ['delivery_quote_id', 'item_id', 'quantity', 'unit_price'];
        let itemVals = [req.params.id, item.item_id, item.quantity, item.unit_price || 0];
        if (hasCol(dqiCols, 'item_name')) { itemCols.push('item_name'); itemVals.push(item.item_name || ''); }
        if (hasCol(dqiCols, 'discount_percent') && item.discount_percent) { itemCols.push('discount_percent'); itemVals.push(item.discount_percent); }
        if (hasCol(dqiCols, 'discount_amount') && item.discount_amount) { itemCols.push('discount_amount'); itemVals.push(item.discount_amount); }
        if (hasCol(dqiCols, 'notes') && item.notes) { itemCols.push('notes'); itemVals.push(item.notes); }
        const ip = itemVals.map((_, i) => `$${i + 1}`).join(', ');
        await safeQuery(`INSERT INTO delivery_quote_items (${itemCols.join(', ')}) VALUES (${ip})`, itemVals);
      }
    }
    res.json({ message: 'تم تحديث بيان التسليم بنجاح' });
  } catch (err) {
    console.error('DQ Update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /delivery-quotes/:id
router.delete('/delivery-quotes/:id', verifyToken, async (req, res) => {
  try {
    await safeQuery('DELETE FROM delivery_quote_items WHERE delivery_quote_id = $1', [req.params.id]);
    await safeQuery('DELETE FROM delivery_quotes WHERE id = $1', [req.params.id]);
    res.json({ message: 'تم الحذف بنجاح' });
  } catch (err) {
    console.error('DQ Delete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /delivery-quotes/:id/approve
router.post('/delivery-quotes/:id/approve', verifyToken, async (req, res) => {
  try {
    await safeQuery("UPDATE delivery_quotes SET status = 'approved' WHERE id = $1", [req.params.id]);
    res.json({ message: 'تم اعتماد بيان التسليم بنجاح' });
  } catch (err) {
    console.error('DQ Approve error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /delivery-quotes/:id/cancel
router.post('/delivery-quotes/:id/cancel', verifyToken, async (req, res) => {
  try {
    const dqCols = await getTableColumns('delivery_quotes');
    const { cancel_reason } = req.body;
    if (hasCol(dqCols, 'cancel_reason') && hasCol(dqCols, 'cancelled_at')) {
      await safeQuery(`UPDATE delivery_quotes SET status = 'cancelled', cancel_reason = $1, cancelled_at = NOW() WHERE id = $2`, [cancel_reason, req.params.id]);
    } else {
      await safeQuery("UPDATE delivery_quotes SET status = 'cancelled' WHERE id = $1", [req.params.id]);
    }
    res.json({ message: 'تم إلغاء بيان التسليم بنجاح' });
  } catch (err) {
    console.error('DQ Cancel error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /delivery-quotes/:id/print
router.get('/delivery-quotes/:id/print', verifyToken, async (req, res) => {
  try {
    const dqCols = await getTableColumns('delivery_quotes');
    const dqiCols = await getTableColumns('delivery_quote_items');
    const empCols = await getTableColumns('employees');

    let selectFields = [
      'dq.id', 'dq.dq_number', 'dq.order_date', 'dq.customer_id',
      'dq.total_amount', 'dq.currency', 'dq.status', 'dq.delivery_status',
      'c.name AS customer_name'
    ];
    if (hasCol(dqCols, 'notes')) selectFields.push('dq.notes');
    if (hasCol(dqCols, 'exchange_rate')) selectFields.push('dq.exchange_rate');

    let empNameField = null;
    if (hasCol(empCols, 'full_name')) empNameField = 'e.full_name';
    else if (hasCol(empCols, 'name')) empNameField = 'e.name';
    if (empNameField) selectFields.push(`${empNameField} AS sales_rep_name`);

    let branchJoin = '';
    if (hasCol(dqCols, 'customer_branch_id')) {
      selectFields.push('cb.name AS branch_name');
      branchJoin = 'LEFT JOIN customers cb ON dq.customer_branch_id = cb.id';
    }

    let empJoin = '';
    if (hasCol(dqCols, 'sales_rep_id') && empNameField) {
      empJoin = 'LEFT JOIN employees e ON dq.sales_rep_id = e.id';
    }

    const orderRes = await safeQuery(`
      SELECT ${selectFields.join(', ')} FROM delivery_quotes dq
      LEFT JOIN customers c ON dq.customer_id = c.id
      ${branchJoin}
      ${empJoin}
      WHERE dq.id = $1
    `, [req.params.id]);

    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Delivery quote not found' });

    let itemFields = ['dqi.id', 'dqi.item_id', 'dqi.quantity', 'dqi.unit_price', 'i.name AS item_name', 'i.code AS item_code', 'i.unit'];
    if (hasCol(dqiCols, 'discount_percent')) itemFields.push('dqi.discount_percent');
    if (hasCol(dqiCols, 'discount_amount')) itemFields.push('dqi.discount_amount');

    const itemsRes = await safeQuery(`
      SELECT ${itemFields.join(', ')} FROM delivery_quote_items dqi
      LEFT JOIN items i ON dqi.item_id = i.id
      WHERE dqi.delivery_quote_id = $1
    `, [req.params.id]);

    let company = { name: 'CareMed', address: '', phone: '' };
    try {
      const compRes = await safeQuery('SELECT * FROM company_settings LIMIT 1');
      if (compRes.rows.length > 0) company = compRes.rows[0];
    } catch (e) {}

    res.json({ order: orderRes.rows[0], items: itemsRes.rows, company });
  } catch (err) {
    console.error('DQ Print error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// إصدار إذن تسليم من بيان التسليم المسعر (التسليم قبل الفوترة)
// body اختياري: { line_serials: [{line_id, serial_numbers}] }
// ═══════════════════════════════════════════════════════════════
router.post('/delivery-quotes/:id/create-delivery-note', verifyToken, async (req, res) => {
  try {
    const dqId = req.params.id;
    const { line_serials } = req.body || {};

    const dqRes = await safeQuery(
      `SELECT dq.*, c.name AS customer_name, cb.name AS branch_name
       FROM delivery_quotes dq
       LEFT JOIN customers c ON dq.customer_id = c.id
       LEFT JOIN customers cb ON dq.customer_branch_id = cb.id
       WHERE dq.id = $1 AND dq.status = 'approved'`,
      [dqId]
    );
    if (dqRes.rows.length === 0) {
      return res.status(400).json({ error: 'بيان التسليم غير موجود أو غير معتمد' });
    }
    const dq = dqRes.rows[0];

    const dqCols = await getTableColumns('delivery_quotes');
    if (hasCol(dqCols, 'delivery_note_id') && dq.delivery_note_id) {
      return res.status(400).json({ error: 'تم إصدار إذن تسليم لهذا البيان من قبل' });
    }

    const itemsRes = await safeQuery(
      `SELECT dqi.*, i.name AS item_name_lookup, i.has_serial, i.warehouse_id AS item_warehouse_id
       FROM delivery_quote_items dqi
       LEFT JOIN items i ON dqi.item_id = i.id
       WHERE dqi.delivery_quote_id = $1 ORDER BY dqi.id`,
      [dqId]
    );
    if (itemsRes.rows.length === 0) {
      return res.status(400).json({ error: 'بيان التسليم لا يحتوي على أصناف' });
    }

    // خريطة السريالات المختارة لكل سطر
    const serialsMap = {};
    if (Array.isArray(line_serials)) {
      line_serials.forEach(ls => {
        if (ls && ls.line_id != null) {
          serialsMap[String(ls.line_id)] = Array.isArray(ls.serial_numbers) ? ls.serial_numbers.filter(Boolean) : [];
        }
      });
    }

    // التحقق من السريالات لكل سطر بصنف بسريال
    for (const line of itemsRes.rows) {
      const whId = line.warehouse_id || line.item_warehouse_id;
      const serials = serialsMap[String(line.id)] || [];
      if (line.has_serial) {
        if (serials.length !== Number(line.quantity)) {
          return res.status(400).json({
            error: `الصنف "${line.item_name || line.item_name_lookup}" يُصرف بالسريال - حدد ${line.quantity} سريال بالظبط (اخترت ${serials.length})`
          });
        }
        const avail = await safeQuery(
          `SELECT serial_number FROM item_serials
           WHERE item_id = $1 AND warehouse_id = $2 AND status IN ('available','reserved') AND serial_number = ANY($3::text[])`,
          [line.item_id, whId, serials]
        );
        if (avail.rows.length !== serials.length) {
          return res.status(400).json({ error: `بعض سريالات الصنف "${line.item_name || line.item_name_lookup}" غير متاحة في المخزن` });
        }
      }
    }

    // رقم إذن التسليم
    const nnRes = await safeQuery(`SELECT note_number FROM delivery_notes WHERE note_number LIKE 'DN-%' ORDER BY id DESC LIMIT 1`);
    let nextDn = 'DN-0001';
    if (nnRes.rows.length > 0) {
      const last = parseInt(nnRes.rows[0].note_number.split('-')[1]);
      if (!isNaN(last)) nextDn = `DN-${String(last + 1).padStart(4, '0')}`;
    }

    const firstLine = itemsRes.rows[0];
    const dnCols = await getTableColumns('delivery_notes');
    const insCols = ['note_number', 'customer_id', 'customer_name', 'item_id', 'item_name', 'quantity', 'status', 'created_by'];
    const insVals = [nextDn, dq.customer_branch_id || dq.customer_id, dq.branch_name || dq.customer_name,
      firstLine.item_id, firstLine.item_name || firstLine.item_name_lookup, firstLine.quantity, 'pending', req.user ? req.user.id : null];
    const addDn = (c, v) => { if (hasCol(dnCols, c)) { insCols.push(c); insVals.push(v); } };
    addDn('dq_id', dqId);
    addDn('warehouse_id', firstLine.warehouse_id || firstLine.item_warehouse_id || null);
    addDn('delivery_date', dq.delivery_date || null);
    addDn('notes', `إذن تسليم من بيان مسعر ${dq.dq_number}`);

    const dnRes = await safeQuery(
      `INSERT INTO delivery_notes (${insCols.join(', ')}) VALUES (${insVals.map((_, i) => '$' + (i + 1)).join(', ')}) RETURNING id`,
      insVals
    );
    const dnId = dnRes.rows[0].id;

    // نسخ الأصناف + حجز السريالات
    for (const line of itemsRes.rows) {
      const whId = line.warehouse_id || line.item_warehouse_id;
      const serials = serialsMap[String(line.id)] || null;
      await safeQuery(
        `INSERT INTO delivery_note_items (delivery_note_id, item_id, item_name, quantity, unit_price, warehouse_id, serial_numbers, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [dnId, line.item_id, line.item_name || line.item_name_lookup, line.quantity, line.unit_price || 0, whId, serials, line.notes || null]
      );
      if (line.has_serial && serials && serials.length > 0) {
        await safeQuery(
          `UPDATE item_serials SET status = 'reserved', updated_at = NOW()
           WHERE item_id = $1 AND warehouse_id = $2 AND serial_number = ANY($3::text[])`,
          [line.item_id, whId, serials]
        );
        await safeQuery(`UPDATE delivery_quote_items SET serial_numbers = $1 WHERE id = $2`, [serials, line.id]);
      }
    }

    if (hasCol(dqCols, 'delivery_note_id')) {
      await safeQuery(`UPDATE delivery_quotes SET delivery_note_id = $1, updated_at = NOW() WHERE id = $2`, [dnId, dqId]);
    }
if (hasCol(dqCols, 'delivery_status')) {
      await safeQuery(`UPDATE delivery_quotes SET delivery_status = 'delivered' WHERE id = $1`, [dqId]);
    }

    res.status(201).json({ message: 'تم إصدار إذن التسليم بنجاح', note_number: nextDn, delivery_note_id: dnId });
  } catch (err) {
    console.error('DQ create delivery note error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// إصدار أمر شغل من بيان التسليم المسعر
// ═══════════════════════════════════════════════════════════════
router.post('/delivery-quotes/:id/create-work-order', verifyToken, async (req, res) => {
  try {
    const dqId = req.params.id;

    const dqRes = await safeQuery(
      `SELECT dq.*, c.name AS customer_name, cb.name AS branch_name
       FROM delivery_quotes dq
       LEFT JOIN customers c ON dq.customer_id = c.id
       LEFT JOIN customers cb ON dq.customer_branch_id = cb.id
       WHERE dq.id = $1 AND dq.status = 'approved'`,
      [dqId]
    );
    if (dqRes.rows.length === 0) {
      return res.status(400).json({ error: 'بيان التسليم غير موجود أو غير معتمد' });
    }
    const dq = dqRes.rows[0];

    const dqCols = await getTableColumns('delivery_quotes');
    if (hasCol(dqCols, 'work_order_id') && dq.work_order_id) {
      return res.status(400).json({ error: 'تم إصدار أمر شغل لهذا البيان من قبل' });
    }

    const itemsRes = await safeQuery(
      `SELECT dqi.*, i.name AS item_name_lookup, i.warehouse_id AS item_warehouse_id
       FROM delivery_quote_items dqi
       LEFT JOIN items i ON dqi.item_id = i.id
       WHERE dqi.delivery_quote_id = $1 ORDER BY dqi.id`,
      [dqId]
    );
    if (itemsRes.rows.length === 0) {
      return res.status(400).json({ error: 'بيان التسليم لا يحتوي على أصناف' });
    }

    const wnRes = await safeQuery(`SELECT work_order_number FROM work_orders WHERE work_order_number LIKE 'WO-%' ORDER BY id DESC LIMIT 1`);
    let nextWo = 'WO-0001';
    if (wnRes.rows.length > 0) {
      const last = parseInt(wnRes.rows[0].work_order_number.split('-')[1]);
      if (!isNaN(last)) nextWo = `WO-${String(last + 1).padStart(4, '0')}`;
    }

    const firstLine = itemsRes.rows[0];
    const woCols = await getTableColumns('work_orders');
    const insCols = ['work_order_number', 'customer_id', 'customer_name', 'item_id', 'item_name', 'quantity', 'status', 'created_by'];
    const insVals = [nextWo, dq.customer_branch_id || dq.customer_id, dq.branch_name || dq.customer_name,
      firstLine.item_id, firstLine.item_name || firstLine.item_name_lookup, firstLine.quantity, 'pending', req.user ? req.user.id : null];
    const addWo = (c, v) => { if (hasCol(woCols, c)) { insCols.push(c); insVals.push(v); } };
    addWo('dq_id', dqId);
    addWo('warehouse_id', firstLine.warehouse_id || firstLine.item_warehouse_id || null);
    addWo('description', `أمر شغل من بيان مسعر ${dq.dq_number}`);

    const woRes = await safeQuery(
      `INSERT INTO work_orders (${insCols.join(', ')}) VALUES (${insVals.map((_, i) => '$' + (i + 1)).join(', ')}) RETURNING id`,
      insVals
    );
    const woId = woRes.rows[0].id;

    for (const line of itemsRes.rows) {
      await safeQuery(
        `INSERT INTO work_order_items (work_order_id, item_id, item_name, quantity, unit_price, warehouse_id, serial_numbers, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [woId, line.item_id, line.item_name || line.item_name_lookup, line.quantity, line.unit_price || 0,
         line.warehouse_id || line.item_warehouse_id, line.serial_numbers || null, line.notes || null]
      );
    }

    if (hasCol(dqCols, 'work_order_id')) {
      await safeQuery(`UPDATE delivery_quotes SET work_order_id = $1, updated_at = NOW() WHERE id = $2`, [woId, dqId]);
    }
if (hasCol(dqCols, 'delivery_status')) {
      await safeQuery(`UPDATE delivery_quotes SET delivery_status = 'in_progress' WHERE id = $1`, [dqId]);
    }

    res.status(201).json({ message: 'تم إصدار أمر الشغل بنجاح', work_order_number: nextWo, work_order_id: woId });
  } catch (err) {
    console.error('DQ create work order error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// ==================== GET SINGLE ====================
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const soCols = await getTableColumns('sales_orders');
    const soiCols = await getTableColumns('sales_order_items');
    const empCols = await getTableColumns('employees');

    let selectFields = ['so.id', 'so.order_number', 'so.order_date', 'so.customer_id', 'so.total_amount', 'so.currency', 'so.status', 'so.order_type', 'c.name AS customer_name'];

    if (hasCol(soCols, 'customer_branch_id')) selectFields.push('so.customer_branch_id');
    if (hasCol(soCols, 'sales_rep_id')) selectFields.push('so.sales_rep_id');
    if (hasCol(soCols, 'is_virtual')) selectFields.push('so.is_virtual');
    if (hasCol(soCols, 'is_converted')) selectFields.push('so.is_converted');
    if (hasCol(soCols, 'delivery_status')) selectFields.push('so.delivery_status');
    if (hasCol(soCols, 'total_amount_currency')) selectFields.push('so.total_amount_currency');
    if (hasCol(soCols, 'notes')) selectFields.push('so.notes');
    if (hasCol(soCols, 'exchange_rate')) selectFields.push('so.exchange_rate');
    if (hasCol(soCols, 'delivery_date')) selectFields.push('so.delivery_date');

    let empNameField = null;
    if (hasCol(empCols, 'full_name')) empNameField = 'e.full_name';
    else if (hasCol(empCols, 'name')) empNameField = 'e.name';
    else if (hasCol(empCols, 'employee_name')) empNameField = 'e.employee_name';
    if (empNameField) selectFields.push(`${empNameField} AS sales_rep_name`);

    let branchJoin = '';
    if (hasCol(soCols, 'customer_branch_id')) {
      selectFields.push('cb.name AS branch_name');
      branchJoin = 'LEFT JOIN customers cb ON so.customer_branch_id = cb.id';
    }

    let empJoin = '';
    if (hasCol(soCols, 'sales_rep_id') && empNameField) {
      empJoin = 'LEFT JOIN employees e ON so.sales_rep_id = e.id';
    }

    const orderRes = await safeQuery(`
      SELECT ${selectFields.join(', ')} FROM sales_orders so
      LEFT JOIN customers c ON so.customer_id = c.id
      ${branchJoin}
      ${empJoin}
      WHERE so.id = $1 AND (so.order_type = 'sales_order' OR so.order_type IS NULL)
    `, [req.params.id]);

    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = orderRes.rows[0];

    let itemFields = ['soi.id', 'soi.item_id', 'soi.quantity', 'soi.unit_price', 'i.name AS item_name', 'i.code AS item_code'];
    if (hasCol(soiCols, 'discount_percent')) itemFields.push('soi.discount_percent');
    if (hasCol(soiCols, 'discount_amount')) itemFields.push('soi.discount_amount');
    if (hasCol(soiCols, 'tax_percent')) itemFields.push('soi.tax_percent');
    if (hasCol(soiCols, 'notes')) itemFields.push('soi.notes');
    if (hasCol(soiCols, 'unit')) itemFields.push('soi.unit');

    const itemsRes = await safeQuery(`
      SELECT ${itemFields.join(', ')} FROM sales_order_items soi
      LEFT JOIN items i ON soi.item_id = i.id
      WHERE soi.sales_order_id = $1
    `, [req.params.id]);

    order.items = itemsRes.rows;
    res.json(order);
  } catch (err) {
    console.error('Get single error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== CREATE ====================
router.post('/', verifyToken, async (req, res) => {
  try {
    const soCols = await getTableColumns('sales_orders');
    const soiCols = await getTableColumns('sales_order_items');

    const { customer_id, customer_branch_id, sales_rep_id, order_date, delivery_date, currency, exchange_rate, is_virtual, order_type, notes, items, total_amount, total_amount_currency } = req.body;

    if (!customer_id || !items || items.length === 0) {
      return res.status(400).json({ error: 'Customer and items are required' });
    }

    const now = new Date();
    const monthPrefix = String(now.getMonth() + 1).padStart(2, '0') + String(now.getFullYear());
    const countRes = await safeQuery(`SELECT COUNT(*) FROM sales_orders WHERE order_number LIKE $1`, [`${monthPrefix}%`]);
    const seq = parseInt(countRes.rows[0].count) + 1;
    const orderNumber = `${monthPrefix}${String(seq).padStart(4, '0')}`;

    let insertCols = ['order_number', 'customer_id', 'order_date', 'status', 'order_type'];
    let insertVals = [orderNumber, customer_id, order_date || now, 'draft', 'sales_order'];

    const addCol = (col, val) => {
      if (hasCol(soCols, col) && val !== undefined && val !== null && val !== '') {
        insertCols.push(col);
        insertVals.push(val);
      }
    };

    addCol('customer_branch_id', customer_branch_id);
    addCol('sales_rep_id', sales_rep_id);
    addCol('delivery_date', delivery_date);
    addCol('currency', currency || 'EGP');
    addCol('exchange_rate', exchange_rate || 1);
    addCol('is_virtual', is_virtual);
    addCol('notes', notes);
    addCol('total_amount', total_amount);
    addCol('total_amount_currency', total_amount_currency);

    const placeholders = insertVals.map((_, i) => `$${i + 1}`).join(', ');
    const orderRes = await safeQuery(`INSERT INTO sales_orders (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING id`, insertVals);
    const orderId = orderRes.rows[0].id;

    for (const item of items) {
      if (!item.item_id || !item.quantity) continue;
      let itemCols = ['sales_order_id', 'item_id', 'quantity', 'unit_price'];
      let itemVals = [orderId, item.item_id, item.quantity, item.unit_price || 0];
      if (hasCol(soiCols, 'item_name')) { itemCols.push('item_name'); itemVals.push(item.item_name || ''); }
      if (hasCol(soiCols, 'discount_percent') && item.discount_percent) { itemCols.push('discount_percent'); itemVals.push(item.discount_percent); }
      if (hasCol(soiCols, 'discount_amount') && item.discount_amount) { itemCols.push('discount_amount'); itemVals.push(item.discount_amount); }
      if (hasCol(soiCols, 'tax_percent') && item.tax_percent) { itemCols.push('tax_percent'); itemVals.push(item.tax_percent); }
      if (hasCol(soiCols, 'notes') && item.notes) { itemCols.push('notes'); itemVals.push(item.notes); }
      const ip = itemVals.map((_, i) => `$${i + 1}`).join(', ');
      await safeQuery(`INSERT INTO sales_order_items (${itemCols.join(', ')}) VALUES (${ip})`, itemVals);
    }

    res.status(201).json({ id: orderId, order_number: orderNumber, message: 'تم الإنشاء بنجاح' });
  } catch (err) {
    console.error('Create error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== UPDATE ====================
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const soCols = await getTableColumns('sales_orders');
    const soiCols = await getTableColumns('sales_order_items');
    const { customer_id, customer_branch_id, sales_rep_id, order_date, delivery_date, currency, exchange_rate, is_virtual, order_type, notes, items, total_amount, total_amount_currency } = req.body;

    let updates = [];
    let values = [];
    let pIdx = 1;

    const addUpdate = (col, val) => {
      if (hasCol(soCols, col) && val !== undefined) {
        updates.push(`${col} = $${pIdx++}`);
        values.push(val === '' ? null : val);
      }
    };

    addUpdate('customer_id', customer_id);
    addUpdate('customer_branch_id', customer_branch_id);
    addUpdate('sales_rep_id', sales_rep_id);
    addUpdate('order_date', order_date);
    addUpdate('delivery_date', delivery_date);
    addUpdate('currency', currency);
    addUpdate('exchange_rate', exchange_rate);
    addUpdate('is_virtual', is_virtual);
    addUpdate('order_type', 'sales_order');
    addUpdate('notes', notes);
    addUpdate('total_amount', total_amount);
    addUpdate('total_amount_currency', total_amount_currency);

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(req.params.id);
    await safeQuery(`UPDATE sales_orders SET ${updates.join(', ')} WHERE id = $${pIdx} AND (order_type = 'sales_order' OR order_type IS NULL)`, values);

    if (items && items.length > 0) {
      await safeQuery('DELETE FROM sales_order_items WHERE sales_order_id = $1', [req.params.id]);
      for (const item of items) {
        if (!item.item_id || !item.quantity) continue;
        let itemCols = ['sales_order_id', 'item_id', 'quantity', 'unit_price'];
        let itemVals = [req.params.id, item.item_id, item.quantity, item.unit_price || 0];
        if (hasCol(soiCols, 'item_name')) { itemCols.push('item_name'); itemVals.push(item.item_name || ''); }
        if (hasCol(soiCols, 'discount_percent') && item.discount_percent) { itemCols.push('discount_percent'); itemVals.push(item.discount_percent); }
        if (hasCol(soiCols, 'discount_amount') && item.discount_amount) { itemCols.push('discount_amount'); itemVals.push(item.discount_amount); }
        if (hasCol(soiCols, 'tax_percent') && item.tax_percent) { itemCols.push('tax_percent'); itemVals.push(item.tax_percent); }
        if (hasCol(soiCols, 'notes') && item.notes) { itemCols.push('notes'); itemVals.push(item.notes); }
        const ip = itemVals.map((_, i) => `$${i + 1}`).join(', ');
        await safeQuery(`INSERT INTO sales_order_items (${itemCols.join(', ')}) VALUES (${ip})`, itemVals);
      }
    }
    res.json({ message: 'تم التحديث بنجاح' });
  } catch (err) {
    console.error('Update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== DELETE ====================
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await safeQuery('DELETE FROM sales_order_items WHERE sales_order_id = $1', [req.params.id]);
    await safeQuery("DELETE FROM sales_orders WHERE id = $1 AND (order_type = 'sales_order' OR order_type IS NULL)", [req.params.id]);
    res.json({ message: 'تم الحذف بنجاح' });
  } catch (err) {
    console.error('Delete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== APPROVE ====================
router.post('/:id/approve', verifyToken, async (req, res) => {
  try {
    await safeQuery("UPDATE sales_orders SET status = 'approved' WHERE id = $1 AND (order_type = 'sales_order' OR order_type IS NULL)", [req.params.id]);
    res.json({ message: 'تم الاعتماد بنجاح' });
  } catch (err) {
    console.error('Approve error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== CANCEL ====================
router.post('/:id/cancel', verifyToken, async (req, res) => {
  try {
    const soCols = await getTableColumns('sales_orders');
    const { cancel_reason } = req.body;
    if (hasCol(soCols, 'cancel_reason') && hasCol(soCols, 'cancelled_at')) {
      await safeQuery(`UPDATE sales_orders SET status = 'cancelled', cancel_reason = $1, cancelled_at = NOW() WHERE id = $2 AND (order_type = 'sales_order' OR order_type IS NULL)`, [cancel_reason, req.params.id]);
    } else {
      await safeQuery("UPDATE sales_orders SET status = 'cancelled' WHERE id = $1 AND (order_type = 'sales_order' OR order_type IS NULL)", [req.params.id]);
    }
    res.json({ message: 'تم الإلغاء بنجاح' });
  } catch (err) {
    console.error('Cancel error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== CONVERT TO INVOICE ====================
router.post('/:id/convert-to-invoice', verifyToken, async (req, res) => {
  try {
    const soCols = await getTableColumns('sales_orders');
    const { invoice_type } = req.body;
    let newType = 'sales_order';
    let message = '';
    if (invoice_type === 'tax') { newType = 'tax_invoice'; message = 'تم التحويل إلى فاتورة ضريبية'; }
    else if (invoice_type === 'price') { newType = 'price_quote'; message = 'تم التحويل إلى بيان سعر'; }
    else if (invoice_type === 'virtual_tax') { newType = 'virtual_tax_invoice'; message = 'تم التحويل إلى فاتورة ضريبية وهمية'; }

    let updateQuery = `UPDATE sales_orders SET order_type = $1`;
    let params = [newType];
    if (hasCol(soCols, 'is_converted')) updateQuery += `, is_converted = true`;
    if (hasCol(soCols, 'converted_at')) updateQuery += `, converted_at = NOW()`;
    updateQuery += ` WHERE id = $${params.length + 1} AND (order_type = 'sales_order' OR order_type IS NULL)`;
    params.push(req.params.id);
    await safeQuery(updateQuery, params);
    res.json({ message });
  } catch (err) {
    console.error('Convert error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== CREATE WORK ORDER ====================
router.post('/:id/create-work-order', verifyToken, async (req, res) => {
  try {
    const woCols = await getTableColumns('work_orders');
    const soCols = await getTableColumns('sales_orders');

    const orderRes = await safeQuery(`SELECT so.*, c.name AS customer_name FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id WHERE so.id = $1 AND (so.order_type = 'sales_order' OR so.order_type IS NULL)`, [req.params.id]);
    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = orderRes.rows[0];

    const now = new Date();
    const prefix = 'WO-' + String(now.getMonth() + 1).padStart(2, '0') + String(now.getFullYear()).slice(2);
    const countRes = await safeQuery(`SELECT COUNT(*) FROM work_orders`, []);
    const seq = parseInt(countRes.rows[0].count) + 1;
    const woNumber = `${prefix}-${String(seq).padStart(4, '0')}`;

    let insertCols = [];
    let insertVals = [];
    if (hasCol(woCols, 'wo_number')) { insertCols.push('wo_number'); insertVals.push(woNumber); }
    if (hasCol(woCols, 'sales_order_id')) { insertCols.push('sales_order_id'); insertVals.push(req.params.id); }
    if (hasCol(woCols, 'customer_id')) { insertCols.push('customer_id'); insertVals.push(order.customer_id); }
    if (hasCol(woCols, 'status')) { insertCols.push('status'); insertVals.push('pending'); }
    if (hasCol(woCols, 'created_at')) { insertCols.push('created_at'); insertVals.push(now); }
    if (hasCol(woCols, 'notes') && order.notes) { insertCols.push('notes'); insertVals.push(order.notes); }

    if (insertCols.length === 0) return res.status(500).json({ error: 'work_orders table has no recognized columns' });

    const placeholders = insertVals.map((_, i) => `$${i + 1}`).join(', ');
    const woResult = await safeQuery(`INSERT INTO work_orders (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING id${hasCol(woCols, 'wo_number') ? ', wo_number' : ''}`, insertVals);
    res.json({ message: 'تم إنشاء أمر الشغل', work_order: woResult.rows[0] });
  } catch (err) {
    console.error('Work order error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== DELIVERY TRACKING ====================
router.post('/:id/delivery-tracking', verifyToken, async (req, res) => {
  try {
    const dtCols = await getTableColumns('sales_order_delivery_tracking');
    const soCols = await getTableColumns('sales_orders');
    const { status, notes, delivery_date, received_by } = req.body;

    let insertCols = ['sales_order_id'];
    let insertVals = [req.params.id];
    if (hasCol(dtCols, 'status')) { insertCols.push('status'); insertVals.push(status || 'delivered'); }
    if (hasCol(dtCols, 'notes')) { insertCols.push('notes'); insertVals.push(notes); }
    if (hasCol(dtCols, 'delivery_date')) { insertCols.push('delivery_date'); insertVals.push(delivery_date || new Date()); }
    if (hasCol(dtCols, 'received_by')) { insertCols.push('received_by'); insertVals.push(received_by); }
    if (hasCol(dtCols, 'created_at')) { insertCols.push('created_at'); insertVals.push(new Date()); }

    if (hasCol(dtCols, 'created_by')) {
      try {
        const empCheck = await safeQuery('SELECT id FROM employees WHERE id = $1 LIMIT 1', [req.user?.id || 1]);
        if (empCheck.rows.length > 0) { insertCols.push('created_by'); insertVals.push(req.user?.id || 1); }
      } catch (e) {}
    }

    const placeholders = insertVals.map((_, i) => `$${i + 1}`).join(', ');
    await safeQuery(`INSERT INTO sales_order_delivery_tracking (${insertCols.join(', ')}) VALUES (${placeholders})`, insertVals);

    if (hasCol(soCols, 'delivery_status')) {
      await safeQuery(`UPDATE sales_orders SET delivery_status = $1 WHERE id = $2 AND (order_type = 'sales_order' OR order_type IS NULL)`, [status || 'delivered', req.params.id]);
    }
    res.json({ message: 'تم تحديث حالة التسليم' });
  } catch (err) {
    console.error('Delivery tracking error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== PRINT DELIVERY ====================
router.get('/:id/print-delivery', verifyToken, async (req, res) => {
  try {
    const soCols = await getTableColumns('sales_orders');
    const soiCols = await getTableColumns('sales_order_items');
    const empCols = await getTableColumns('employees');

    let selectFields = ['so.id', 'so.order_number', 'so.order_date', 'so.customer_id', 'so.total_amount', 'so.currency', 'so.status', 'so.order_type', 'c.name AS customer_name'];
    if (hasCol(soCols, 'is_virtual')) selectFields.push('so.is_virtual');
    if (hasCol(soCols, 'total_amount_currency')) selectFields.push('so.total_amount_currency');
    if (hasCol(soCols, 'notes')) selectFields.push('so.notes');

    let empNameField = null;
    if (hasCol(empCols, 'full_name')) empNameField = 'e.full_name';
    else if (hasCol(empCols, 'name')) empNameField = 'e.name';
    if (empNameField) selectFields.push(`${empNameField} AS sales_rep_name`);

    let branchJoin = '';
    if (hasCol(soCols, 'customer_branch_id')) {
      selectFields.push('cb.name AS branch_name');
      branchJoin = 'LEFT JOIN customers cb ON so.customer_branch_id = cb.id';
    }
    let empJoin = '';
    if (hasCol(soCols, 'sales_rep_id') && empNameField) empJoin = 'LEFT JOIN employees e ON so.sales_rep_id = e.id';

    const orderRes = await safeQuery(`SELECT ${selectFields.join(', ')} FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id ${branchJoin} ${empJoin} WHERE so.id = $1 AND (so.order_type = 'sales_order' OR so.order_type IS NULL)`, [req.params.id]);
    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    let itemFields = ['soi.id', 'soi.item_id', 'soi.quantity', 'soi.unit_price', 'i.name AS item_name', 'i.code AS item_code', 'i.unit'];
    if (hasCol(soiCols, 'discount_percent')) itemFields.push('soi.discount_percent');
    if (hasCol(soiCols, 'discount_amount')) itemFields.push('soi.discount_amount');
    if (hasCol(soiCols, 'tax_percent')) itemFields.push('soi.tax_percent');

    const itemsRes = await safeQuery(`SELECT ${itemFields.join(', ')} FROM sales_order_items soi LEFT JOIN items i ON soi.item_id = i.id WHERE soi.sales_order_id = $1`, [req.params.id]);

    let company = { name: 'CareMed', address: '', phone: '' };
    try {
      const compRes = await safeQuery('SELECT * FROM company_settings LIMIT 1');
      if (compRes.rows.length > 0) company = compRes.rows[0];
    } catch (e) {}

    res.json({ order: orderRes.rows[0], items: itemsRes.rows, company });
  } catch (err) {
    console.error('Print delivery error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
