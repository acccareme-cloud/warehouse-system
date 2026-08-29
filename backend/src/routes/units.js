const express = require('express');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// Get all units
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM units ORDER BY unit_name');
    res.json(result.rows);
  } catch (err) {
    console.error('Get units error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create unit
router.post('/', verifyToken, async (req, res) => {
  const { unit_name, unit_code, conversion_rate, is_base_unit } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO units (unit_name, unit_code, conversion_rate, is_base_unit)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [unit_name, unit_code, conversion_rate || 1, is_base_unit || false]
    );
    res.status(201).json({ message: 'تم إضافة الوحدة', data: result.rows[0] });
  } catch (err) {
    console.error('Create unit error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update unit
router.put('/:id', verifyToken, async (req, res) => {
  const { unit_name, unit_code, conversion_rate, is_base_unit } = req.body;
  try {
    const result = await pool.query(
      `UPDATE units SET unit_name=$1, unit_code=$2, conversion_rate=$3, is_base_unit=$4 WHERE id=$5 RETURNING *`,
      [unit_name, unit_code, conversion_rate, is_base_unit, req.params.id]
    );
    res.json({ message: 'تم تحديث الوحدة', data: result.rows[0] });
  } catch (err) {
    console.error('Update unit error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete unit
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM units WHERE id=$1', [req.params.id]);
    res.json({ message: 'تم حذف الوحدة' });
  } catch (err) {
    console.error('Delete unit error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;