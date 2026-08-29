const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Generate next custody number
router.get('/next-number', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT custody_number FROM custodies WHERE custody_number LIKE 'CPAY-%' ORDER BY id DESC LIMIT 1`
    );
    let nextNumber = 'CPAY-0001';
    if (result.rows.length > 0) {
      const last = parseInt(result.rows[0].custody_number.split('-')[1]);
      nextNumber = `CPAY-${String(last + 1).padStart(4, '0')}`;
    }
    res.json({ nextNumber });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all custodies (with party info)
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, 
        COALESCE(e.full_name, c.employee_name) as employee_full_name,
        e.employee_number,
        d.name as department_name,
        s.name as section_name,
        COALESCE(sup.name, c.supplier_name) as supplier_full_name,
        sup.supplier_code
       FROM custodies c
       LEFT JOIN employees e ON c.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN sections s ON e.section_id = s.id
       LEFT JOIN suppliers sup ON c.supplier_id = sup.id
       ORDER BY c.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get active custodies
// ✅ بدون parameter: يرجّع بس اللي remaining > 0 (لتقديم التسوية)
// ✅ ?include_settled=true: يرجّع كل العهد (للخزينة CSET/CRED)
router.get('/active', verifyToken, async (req, res) => {
  try {
    const includeSettled = req.query.include_settled === 'true';

    let whereClause;
    if (includeSettled) {
      // للخزينة — كل العهد حتى المقفولة
      whereClause = "c.status IN ('active', 'partially_settled', 'fully_settled')";
    } else {
      // لتقديم التسوية — بس اللي عليهم فلوس
      whereClause = "c.status IN ('active', 'partially_settled') AND c.remaining_amount > 0";
    }

    const result = await pool.query(
      `SELECT c.*, 
        COALESCE(e.full_name, c.employee_name) as employee_full_name,
        e.employee_number,
        d.name as department_name,
        s.name as section_name,
        COALESCE(sup.name, c.supplier_name) as supplier_full_name,
        sup.supplier_code
       FROM custodies c
       LEFT JOIN employees e ON c.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN sections s ON e.section_id = s.id
       LEFT JOIN suppliers sup ON c.supplier_id = sup.id
       WHERE ${whereClause}
       ORDER BY c.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create custody
router.post('/', verifyToken, async (req, res) => {
  const {
    custody_number, custody_date, employee_id, employee_name, supplier_id, supplier_name,
    party_type, amount, amount_local, currency, exchange_rate, payment_method,
    bank_name, check_number, purpose, description, notes, created_by
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO custodies (
        custody_number, custody_date, employee_id, employee_name, supplier_id, supplier_name,
        party_type, amount, amount_local, currency, exchange_rate, payment_method,
        bank_name, check_number, purpose, description, notes, created_by,
        remaining_amount, settled_amount, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING *`,
      [
        custody_number, custody_date, employee_id, employee_name, supplier_id, supplier_name,
        party_type, amount, amount_local, currency, exchange_rate, payment_method,
        bank_name, check_number, purpose, description, notes, created_by,
        amount, 0, 'active'
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
