const express = require('express');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// Helper: Get existing columns
async function getCustomerColumns() {
  const result = await pool.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'customers'
  `);
  return result.rows.map(r => r.column_name);
}

// ============================================
// Get all customers with locations
// ============================================
router.get('/', verifyToken, async (req, res) => {
  const { customer_type, parent_id, search } = req.query;
  try {
    const columns = await getCustomerColumns();
    const hasCustomerType = columns.includes('customer_type');
    const hasParentId = columns.includes('parent_id');
    const hasCountry = columns.includes('country_id');
    const hasGovernorate = columns.includes('governorate_id');
    const hasCity = columns.includes('city_id');

    let query = `SELECT c.*`;

    if (hasCountry) {
      query += `, co.name as country_name`;
    }
    if (hasGovernorate) {
      query += `, g.name as governorate_name`;
    }
    if (hasCity) {
      query += `, ci.name as city_name, ci.area as city_area`;
    }
    if (hasParentId) {
      query += `, p.name as parent_name, p.code as parent_code`;
    }

    query += ` FROM customers c`;

    if (hasCountry) {
      query += ` LEFT JOIN countries co ON c.country_id = co.id`;
    }
    if (hasGovernorate) {
      query += ` LEFT JOIN governorates g ON c.governorate_id = g.id`;
    }
    if (hasCity) {
      query += ` LEFT JOIN cities ci ON c.city_id = ci.id`;
    }
    if (hasParentId) {
      query += ` LEFT JOIN customers p ON c.parent_id = p.id`;
    }

    query += ` WHERE 1=1`;

    const params = [];
    let paramIndex = 1;

    if (hasCustomerType && customer_type) {
      query += ` AND c.customer_type = $${paramIndex}`;
      params.push(customer_type);
      paramIndex++;
    }

    if (hasParentId && parent_id) {
      query += ` AND c.parent_id = $${paramIndex}`;
      params.push(parent_id);
      paramIndex++;
    }

    if (search) {
      query += ` AND (c.name ILIKE $${paramIndex} OR c.code ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY c.id DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get customers error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ============================================
// Print All Customers Report
// ============================================
router.get('/print/all', verifyToken, async (req, res) => {
  try {
    const columns = await getCustomerColumns();
    const hasCustomerType = columns.includes('customer_type');
    const hasParentId = columns.includes('parent_id');
    const hasCountry = columns.includes('country_id');
    const hasGovernorate = columns.includes('governorate_id');
    const hasCity = columns.includes('city_id');

    // Get all main customers (regular)
    let mainQuery = `SELECT c.*`;
    if (hasCountry) mainQuery += `, co.name as country_name`;
    if (hasGovernorate) mainQuery += `, g.name as governorate_name`;
    if (hasCity) mainQuery += `, ci.name as city_name, ci.area as city_area`;
    mainQuery += ` FROM customers c`;
    if (hasCountry) mainQuery += ` LEFT JOIN countries co ON c.country_id = co.id`;
    if (hasGovernorate) mainQuery += ` LEFT JOIN governorates g ON c.governorate_id = g.id`;
    if (hasCity) mainQuery += ` LEFT JOIN cities ci ON c.city_id = ci.id`;
    mainQuery += ` WHERE 1=1`;
    if (hasCustomerType) {
      mainQuery += ` AND c.customer_type = 'regular'`;
    }
    if (hasParentId) {
      mainQuery += ` AND (c.parent_id IS NULL OR c.parent_id = 0)`;
    }
    mainQuery += ` ORDER BY c.id DESC`;

    const mainResult = await pool.query(mainQuery);
    const mainCustomers = mainResult.rows;

    // Get sub customers (hospitals)
    let subQuery = `SELECT c.*`;
    if (hasCountry) subQuery += `, co.name as country_name`;
    if (hasGovernorate) subQuery += `, g.name as governorate_name`;
    if (hasCity) subQuery += `, ci.name as city_name, ci.area as city_area`;
    if (hasParentId) subQuery += `, p.name as parent_name, p.code as parent_code`;
    subQuery += ` FROM customers c`;
    if (hasCountry) subQuery += ` LEFT JOIN countries co ON c.country_id = co.id`;
    if (hasGovernorate) subQuery += ` LEFT JOIN governorates g ON c.governorate_id = g.id`;
    if (hasCity) subQuery += ` LEFT JOIN cities ci ON c.city_id = ci.id`;
    if (hasParentId) subQuery += ` LEFT JOIN customers p ON c.parent_id = p.id`;
    subQuery += ` WHERE 1=1`;
    if (hasCustomerType) {
      subQuery += ` AND c.customer_type = 'hospital'`;
    } else if (hasParentId) {
      subQuery += ` AND c.parent_id IS NOT NULL AND c.parent_id != 0`;
    }
    subQuery += ` ORDER BY c.id DESC`;

    const subResult = await pool.query(subQuery);
    const subCustomers = subResult.rows;

    // Try to get invoices data (if invoices table exists)
    let invoicesByCustomer = {};
    try {
      const invResult = await pool.query(`
        SELECT customer_id, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total
        FROM invoices
        WHERE status != 'cancelled'
        GROUP BY customer_id
      `);
      invResult.rows.forEach(r => {
        invoicesByCustomer[r.customer_id] = {
          count: parseInt(r.count),
          total: parseFloat(r.total)
        };
      });
    } catch (invErr) {
      // invoices table may not exist
    }

    // Build response
    const customers = mainCustomers.map(main => {
      const mainInv = invoicesByCustomer[main.id] || { count: 0, total: 0 };
      const subs = subCustomers.filter(sub => 
        hasParentId ? String(sub.parent_id) === String(main.id) : false
      ).map(sub => ({
        id: sub.id,
        code: sub.code,
        name: sub.name,
        phone: sub.phone || '',
        tax_number: sub.tax_number || '',
        city_name: sub.city_name || '',
        country_name: sub.country_name || '',
        governorate_name: sub.governorate_name || '',
        address: sub.address || '',
        email: sub.email || '',
        notes: sub.notes || ''
      }));

      return {
        id: main.id,
        code: main.code,
        name: main.name,
        phone: main.phone || '',
        tax_number: main.tax_number || '',
        city_name: main.city_name || '',
        country_name: main.country_name || '',
        governorate_name: main.governorate_name || '',
        address: main.address || '',
        email: main.email || '',
        notes: main.notes || '',
        invoices_count: mainInv.count,
        invoices_total: mainInv.total,
        subCustomers: subs
      };
    });

    res.json({
      report_date: new Date().toISOString(),
      total_main: mainCustomers.length,
      total_sub: subCustomers.length,
      customers
    });
  } catch (err) {
    console.error('Print all customers error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ============================================
// Create customer with locations
// ============================================
router.post('/', verifyToken, async (req, res) => {
  const { 
    code, name, phone, email, address, tax_number, 
    customer_type, parent_id, notes,
    country_id, governorate_id, city_id
  } = req.body;

  try {
    const columns = await getCustomerColumns();
    const hasCustomerType = columns.includes('customer_type');
    const hasParentId = columns.includes('parent_id');
    const hasNotes = columns.includes('notes');
    const hasStatus = columns.includes('status');
    const hasCreatedBy = columns.includes('created_by');
    const hasCountry = columns.includes('country_id');
    const hasGovernorate = columns.includes('governorate_id');
    const hasCity = columns.includes('city_id');

    const insertColumns = ['code', 'name'];
    const insertValues = [code, name];
    let paramIndex = 3;

    if (columns.includes('phone')) { insertColumns.push('phone'); insertValues.push(phone || null); }
    if (columns.includes('email')) { insertColumns.push('email'); insertValues.push(email || null); }
    if (columns.includes('address')) { insertColumns.push('address'); insertValues.push(address || null); }
    if (columns.includes('tax_number')) { insertColumns.push('tax_number'); insertValues.push(tax_number || null); }
    if (hasCustomerType) { insertColumns.push('customer_type'); insertValues.push(customer_type || 'regular'); }
    if (hasParentId) { insertColumns.push('parent_id'); insertValues.push(parent_id || null); }
    if (hasNotes) { insertColumns.push('notes'); insertValues.push(notes || null); }
    if (hasStatus) { insertColumns.push('status'); insertValues.push('active'); }
    if (hasCreatedBy) { insertColumns.push('created_by'); insertValues.push(req.user.id); }
    if (hasCountry) { insertColumns.push('country_id'); insertValues.push(country_id || null); }
    if (hasGovernorate) { insertColumns.push('governorate_id'); insertValues.push(governorate_id || null); }
    if (hasCity) { insertColumns.push('city_id'); insertValues.push(city_id || null); }

    const placeholders = insertValues.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO customers (${insertColumns.join(', ')}) VALUES (${placeholders}) RETURNING *`;

    const result = await pool.query(query, insertValues);

    res.status(201).json({
      message: 'تم إنشاء العميل بنجاح',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Create customer error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ============================================
// Update customer with locations
// ============================================
router.put('/:id', verifyToken, async (req, res) => {
  const { 
    code, name, phone, email, address, tax_number, 
    customer_type, parent_id, notes, status,
    country_id, governorate_id, city_id
  } = req.body;

  try {
    const columns = await getCustomerColumns();

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (code !== undefined && columns.includes('code')) { updates.push(`code = $${paramIndex++}`); values.push(code); }
    if (name !== undefined && columns.includes('name')) { updates.push(`name = $${paramIndex++}`); values.push(name); }
    if (phone !== undefined && columns.includes('phone')) { updates.push(`phone = $${paramIndex++}`); values.push(phone); }
    if (email !== undefined && columns.includes('email')) { updates.push(`email = $${paramIndex++}`); values.push(email); }
    if (address !== undefined && columns.includes('address')) { updates.push(`address = $${paramIndex++}`); values.push(address); }
    if (tax_number !== undefined && columns.includes('tax_number')) { updates.push(`tax_number = $${paramIndex++}`); values.push(tax_number); }
    if (customer_type !== undefined && columns.includes('customer_type')) { updates.push(`customer_type = $${paramIndex++}`); values.push(customer_type); }
    if (parent_id !== undefined && columns.includes('parent_id')) { updates.push(`parent_id = $${paramIndex++}`); values.push(parent_id || null); }
    if (notes !== undefined && columns.includes('notes')) { updates.push(`notes = $${paramIndex++}`); values.push(notes); }
    if (status !== undefined && columns.includes('status')) { updates.push(`status = $${paramIndex++}`); values.push(status); }
    if (country_id !== undefined && columns.includes('country_id')) { updates.push(`country_id = $${paramIndex++}`); values.push(country_id || null); }
    if (governorate_id !== undefined && columns.includes('governorate_id')) { updates.push(`governorate_id = $${paramIndex++}`); values.push(governorate_id || null); }
    if (city_id !== undefined && columns.includes('city_id')) { updates.push(`city_id = $${paramIndex++}`); values.push(city_id || null); }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'لا يوجد بيانات للتحديث' });
    }

    values.push(req.params.id);
    const query = `UPDATE customers SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'العميل غير موجود' });
    }

    res.json({ message: 'تم تحديث العميل', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ============================================
// Delete customer
// ============================================
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM customers WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'العميل غير موجود' });
    }
    res.json({ message: 'تم حذف العميل بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ============================================
// Get Next Customer Code
// ============================================
router.get('/next-code', verifyToken, async (req, res) => {
  const { customer_type } = req.query;
  try {
    let prefix = 'CUST';
    if (customer_type === 'authority') prefix = 'AUTH';
    else if (customer_type === 'hospital') prefix = 'HOSP';

    const result = await pool.query(
      `SELECT code FROM customers 
       WHERE code LIKE $1 
       ORDER BY id DESC LIMIT 1`,
      [`${prefix}-%`]
    );

    let nextNumber = 1;
    if (result.rows.length > 0 && result.rows[0].code) {
      const parts = result.rows[0].code.split('-');
      if (parts.length === 2) {
        const last = parseInt(parts[1]);
        if (!isNaN(last)) nextNumber = last + 1;
      }
    }

    const nextCode = `${prefix}-${String(nextNumber).padStart(4, '0')}`;
    res.json({ nextCode });
  } catch (err) {
    console.error('Next code error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
