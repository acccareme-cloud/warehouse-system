const express = require('express');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// ============================================
// COUNTRIES
// ============================================

// Get all countries
router.get('/countries', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM countries ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create country
router.post('/countries', verifyToken, async (req, res) => {
  const { name, code } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO countries (name, code) VALUES ($1, $2) RETURNING *',
      [name, code]
    );
    res.status(201).json({ message: 'تم إضافة الدولة', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update country
router.put('/countries/:id', verifyToken, async (req, res) => {
  const { name, code } = req.body;
  try {
    const result = await pool.query(
      'UPDATE countries SET name=$1, code=$2 WHERE id=$3 RETURNING *',
      [name, code, req.params.id]
    );
    res.json({ message: 'تم تحديث الدولة', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete country
router.delete('/countries/:id', verifyToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM countries WHERE id=$1', [req.params.id]);
    res.json({ message: 'تم حذف الدولة' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ============================================
// GOVERNORATES
// ============================================

// Get all governorates with country names
router.get('/governorates', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT g.*, c.name as country_name FROM governorates g JOIN countries c ON g.country_id = c.id ORDER BY c.name, g.name'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get governorates by country
router.get('/governorates/:countryId', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM governorates WHERE country_id = $1 ORDER BY name',
      [req.params.countryId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create governorate
router.post('/governorates', verifyToken, async (req, res) => {
  const { country_id, name, code } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO governorates (country_id, name, code) VALUES ($1, $2, $3) RETURNING *',
      [country_id, name, code]
    );
    res.status(201).json({ message: 'تم إضافة المحافظة', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update governorate
router.put('/governorates/:id', verifyToken, async (req, res) => {
  const { country_id, name, code } = req.body;
  try {
    const result = await pool.query(
      'UPDATE governorates SET country_id=$1, name=$2, code=$3 WHERE id=$4 RETURNING *',
      [country_id, name, code, req.params.id]
    );
    res.json({ message: 'تم تحديث المحافظة', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete governorate
router.delete('/governorates/:id', verifyToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM governorates WHERE id=$1', [req.params.id]);
    res.json({ message: 'تم حذف المحافظة' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ============================================
// CITIES
// ============================================

// Get all cities with governorate and country names
router.get('/cities', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ci.*, g.name as governorate_name, c.name as country_name 
       FROM cities ci 
       JOIN governorates g ON ci.governorate_id = g.id 
       JOIN countries c ON g.country_id = c.id 
       ORDER BY c.name, g.name, ci.name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get cities by governorate
router.get('/cities/:governorateId', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM cities WHERE governorate_id = $1 ORDER BY name',
      [req.params.governorateId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create city
router.post('/cities', verifyToken, async (req, res) => {
  const { governorate_id, name, area, code } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO cities (governorate_id, name, area, code) VALUES ($1, $2, $3, $4) RETURNING *',
      [governorate_id, name, area, code]
    );
    res.status(201).json({ message: 'تم إضافة المدينة', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update city
router.put('/cities/:id', verifyToken, async (req, res) => {
  const { governorate_id, name, area, code } = req.body;
  try {
    const result = await pool.query(
      'UPDATE cities SET governorate_id=$1, name=$2, area=$3, code=$4 WHERE id=$5 RETURNING *',
      [governorate_id, name, area, code, req.params.id]
    );
    res.json({ message: 'تم تحديث المدينة', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete city
router.delete('/cities/:id', verifyToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM cities WHERE id=$1', [req.params.id]);
    res.json({ message: 'تم حذف المدينة' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
