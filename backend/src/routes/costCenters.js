const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Get all cost centers (active only)
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cc.*, 
        (SELECT center_name FROM cost_centers WHERE id = cc.parent_id) as parent_name
       FROM cost_centers cc
       WHERE cc.status = 'active'
       ORDER BY cc.center_code`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get cost center by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, center_code, center_name, center_type, parent_id, budget_amount, remaining_budget, status
       FROM cost_centers WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'مركز التكلفة غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create cost center
router.post('/', verifyToken, requireRole('admin', 'finance'), async (req, res) => {
  const { center_code, center_name, center_type, parent_id, budget_amount } = req.body;

  if (!center_code || !center_name) {
    return res.status(400).json({ message: 'الكود والاسم مطلوبين' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const codeExists = await client.query(
      `SELECT id FROM cost_centers WHERE center_code = $1 AND status = 'active'`,
      [center_code]
    );
    if (codeExists.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'كود المركز موجود مسبقاً' });
    }

    const result = await client.query(
      `INSERT INTO cost_centers (center_code, center_name, center_type, parent_id, budget_amount, remaining_budget, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $5, $6, 'active')
       RETURNING *`,
      [center_code, center_name, center_type || 'general', parent_id || null, budget_amount || 0, req.user.id]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Update cost center
router.put('/:id', verifyToken, requireRole('admin', 'finance'), async (req, res) => {
  const { id } = req.params;
  const { center_code, center_name, center_type, parent_id, budget_amount, status } = req.body;

  if (!center_code || !center_name) {
    return res.status(400).json({ message: 'الكود والاسم مطلوبين' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const codeExists = await client.query(
      `SELECT id FROM cost_centers WHERE center_code = $1 AND id != $2 AND status = 'active'`,
      [center_code, id]
    );
    if (codeExists.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'كود المركز موجود مسبقاً' });
    }

    const result = await client.query(
      `UPDATE cost_centers 
       SET center_code = $1, center_name = $2, center_type = $3, parent_id = $4, 
           budget_amount = $5, status = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [center_code, center_name, center_type || 'general', parent_id || null, budget_amount || 0, status || 'active', id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'مركز التكلفة غير موجود' });
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// SOFT DELETE - change status to inactive instead of deleting
router.delete('/:id', verifyToken, requireRole('admin', 'finance'), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE cost_centers SET status = 'inactive', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'مركز التكلفة غير موجود' });
    }

    res.json({ message: 'تم الحذف بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Generate next code
router.get('/next-code', verifyToken, async (req, res) => {
  const { type } = req.query;
  try {
    const prefix = `CC-${type?.toUpperCase().substring(0,3) || 'GEN'}`;
    const result = await pool.query(
      `SELECT center_code FROM cost_centers WHERE center_code LIKE $1 AND status = 'active' ORDER BY id DESC LIMIT 1`,
      [`${prefix}-%`]
    );
    let nextNumber = `${prefix}-001`;
    if (result.rows.length > 0) {
      const last = parseInt(result.rows[0].center_code.split('-')[2]);
      nextNumber = `${prefix}-${String(last + 1).padStart(3, '0')}`;
    }
    res.json({ nextCode: nextNumber });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
