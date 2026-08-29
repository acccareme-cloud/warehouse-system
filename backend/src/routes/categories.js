const express = require('express');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// Get all categories
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create category
router.post('/', verifyToken, async (req, res) => {
  const { code, name, description } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO categories (code, name, description) VALUES ($1, $2, $3) RETURNING *',
      [code, name, description]
    );
    res.status(201).json({ message: 'تم إضافة التصنيف', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update category
router.put('/:id', verifyToken, async (req, res) => {
  const { code, name, description } = req.body;
  try {
    const result = await pool.query(
      'UPDATE categories SET code=$1, name=$2, description=$3 WHERE id=$4 RETURNING *',
      [code, name, description, req.params.id]
    );
    res.json({ message: 'تم تحديث التصنيف', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete category
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM categories WHERE id=$1', [req.params.id]);
    res.json({ message: 'تم حذف التصنيف' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
