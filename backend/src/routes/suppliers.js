const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// ============================================
// Get Next Supplier Code
// ============================================
router.get('/next-code', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT code FROM suppliers 
      WHERE code ~ '^SUP-[0-9]+$'
      ORDER BY 
        CAST(SUBSTRING(code FROM 5) AS INTEGER) DESC
      LIMIT 1
    `);
    
    let nextCode = 'SUP-001';
    if (result.rows.length > 0) {
      const lastCode = result.rows[0].code;
      const lastNum = parseInt(lastCode.split('-')[1]);
      nextCode = `SUP-${String(lastNum + 1).padStart(3, '0')}`;
    }
    
    res.json({ code: nextCode });
  } catch (err) {
    console.error('Next code error:', err);
    res.status(500).json({ message: 'Failed to get next code', error: err.message });
  }
});

// Get all suppliers (?service=1 يرجع موردين الخدمة بس)
router.get('/', verifyToken, async (req, res) => {
  try {
    const onlyService = req.query.service === '1' || req.query.service === 'true';
    const result = await pool.query(
      `SELECT * FROM suppliers 
       WHERE (is_active = true OR is_active IS NULL)
       ${onlyService ? 'AND is_service_provider = true' : ''}
       ORDER BY name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching suppliers:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create supplier
router.post('/', verifyToken, requireRole('admin', 'purchasing'), async (req, res) => {
  const { 
    supplier_code, supplier_name, supplier_type, is_service_provider,
    phone, email, address, tax_number, 
    contact_person, credit_limit, commercial_registration,
    country_id, governorate_id, city_id
  } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO suppliers (
        code, supplier_code, name, supplier_type, is_service_provider,
        phone, email, address, tax_number, 
        contact_person, credit_limit, commercial_registration,
        country_id, governorate_id, city_id,
        status, is_active, created_at
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'active', true, NOW()) 
      RETURNING *`,
      [
        supplier_code, supplier_code, supplier_name, supplier_type, !!is_service_provider,
        phone, email, address, tax_number,
        contact_person, credit_limit || 0, commercial_registration,
        country_id || null, governorate_id || null, city_id || null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating supplier:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update supplier - ✅ واحد بس مع locations و is_active صح
router.put('/:id', verifyToken, requireRole('admin', 'purchasing'), async (req, res) => {
  const { id } = req.params;
  const { 
    supplier_name, supplier_type, is_service_provider, phone, email, address, 
    tax_number, contact_person, credit_limit, commercial_registration, 
    is_active,
    country_id, governorate_id, city_id
  } = req.body;
  
  try {
    // ✅ نتأكد إن is_active مش null
    const activeStatus = is_active === false ? false : true;
    
    const result = await pool.query(
      `UPDATE suppliers SET 
        name=$1, 
        supplier_type=$2, 
        phone=$3, 
        email=$4, 
        address=$5, 
        tax_number=$6, 
        contact_person=$7, 
        credit_limit=$8, 
        commercial_registration=$9, 
        is_active=$10,
        country_id=$11, 
        governorate_id=$12, 
        city_id=$13,
        is_service_provider=$15,
        updated_at=NOW()
       WHERE id=$14 
       RETURNING *`,
      [
        supplier_name, 
        supplier_type, 
        phone, 
        email, 
        address, 
        tax_number, 
        contact_person, 
        credit_limit, 
        commercial_registration,
        activeStatus,  // ✅ true أو false، مفيش null
        country_id || null, 
        governorate_id || null, 
        city_id || null,
        id,
        !!is_service_provider
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating supplier:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete supplier (soft delete)
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    await pool.query('UPDATE suppliers SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ message: 'تم حذف المورد' });
  } catch (err) {
    console.error('Error deleting supplier:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;