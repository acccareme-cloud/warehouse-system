const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Get all expense categories (active only)
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ec.*, cc.center_name as cost_center_name
       FROM expense_categories ec
       LEFT JOIN cost_centers cc ON ec.cost_center_id = cc.id
       WHERE ec.status = 'active' OR ec.status IS NULL
       ORDER BY ec.category_code`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get MAIN categories only (parent_id IS NULL)
router.get('/main', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ec.*, cc.center_name as cost_center_name
       FROM expense_categories ec
       LEFT JOIN cost_centers cc ON ec.cost_center_id = cc.id
       WHERE ec.parent_id IS NULL 
         AND (ec.status = 'active' OR ec.status IS NULL)
       ORDER BY ec.category_code`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get sub categories for a parent
router.get('/sub/:parentId', verifyToken, async (req, res) => {
  try {
    const { parentId } = req.params;
    const result = await pool.query(
      `SELECT ec.*, cc.center_name as cost_center_name
       FROM expense_categories ec
       LEFT JOIN cost_centers cc ON ec.cost_center_id = cc.id
       WHERE ec.parent_id = $1 AND (ec.status = 'active' OR ec.status IS NULL)
       ORDER BY ec.category_code`,
      [parentId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Generate next code
router.get('/next-code', verifyToken, async (req, res) => {
  try {
    const { type } = req.query;
    const prefix = type ? `EXP-${type.toUpperCase().substring(0,3)}` : 'EXP-GEN';

    const result = await pool.query(
      `SELECT category_code FROM expense_categories 
       WHERE category_code LIKE $1 AND (status = 'active' OR status IS NULL)
       ORDER BY id DESC LIMIT 1`,
      [`${prefix}-%`]
    );

    let nextNumber = `${prefix}-001`;
    if (result.rows.length > 0) {
      const lastCode = result.rows[0].category_code;
      const lastNum = parseInt(lastCode.split('-').pop());
      nextNumber = `${prefix}-${String(lastNum + 1).padStart(3, '0')}`;
    }

    res.json({ nextCode: nextNumber });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create expense category
router.post('/', verifyToken, requireRole('admin', 'finance'), async (req, res) => {
  const { category_code, category_name, category_type, parent_id, cost_center_id, account_number } = req.body;

  if (!category_code || !category_name) {
    return res.status(400).json({ message: 'الكود والاسم مطلوبين' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const codeExists = await client.query(
      `SELECT id FROM expense_categories WHERE category_code = $1 AND (status = 'active' OR status IS NULL)`,
      [category_code]
    );
    if (codeExists.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'كود البند موجود مسبقاً' });
    }

    const result = await client.query(
      `INSERT INTO expense_categories (category_code, category_name, category_type, parent_id, cost_center_id, account_number, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
       RETURNING *`,
      [category_code, category_name, category_type || 'main', parent_id || null, cost_center_id || null, account_number || null, req.user.id]
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

// Update expense category
router.put('/:id', verifyToken, requireRole('admin', 'finance'), async (req, res) => {
  const { id } = req.params;
  const { category_code, category_name, category_type, parent_id, cost_center_id, account_number, status } = req.body;

  if (!category_code || !category_name) {
    return res.status(400).json({ message: 'الكود والاسم مطلوبين' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const codeExists = await client.query(
      `SELECT id FROM expense_categories WHERE category_code = $1 AND id != $2 AND (status = 'active' OR status IS NULL)`,
      [category_code, id]
    );
    if (codeExists.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'كود البند موجود مسبقاً' });
    }

    const result = await client.query(
      `UPDATE expense_categories 
       SET category_code = $1, category_name = $2, category_type = $3, parent_id = $4, 
           cost_center_id = $5, account_number = $6, status = $7, updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [category_code, category_name, category_type || 'main', parent_id || null, cost_center_id || null, account_number || null, status || 'active', id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'البند غير موجود' });
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

// SOFT DELETE - change status to inactive
router.delete('/:id', verifyToken, requireRole('admin', 'finance'), async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if this is a main category with sub-categories
    const hasSubCategories = await client.query(
      `SELECT id FROM expense_categories WHERE parent_id = $1 AND (status = 'active' OR status IS NULL)`,
      [id]
    );

    if (hasSubCategories.rows.length > 0) {
      // Delete sub-categories too
      await client.query(
        `UPDATE expense_categories SET status = 'inactive', updated_at = NOW() WHERE parent_id = $1`,
        [id]
      );
    }

    // Soft delete the category
    const result = await client.query(
      `UPDATE expense_categories SET status = 'inactive', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'البند غير موجود' });
    }

    await client.query('COMMIT');
    res.json({ message: 'تم الحذف بنجاح' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

// Get pending approvals (for finance manager)
router.get('/pending-approvals', verifyToken, requireRole('finance_manager', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ec.*, cc.center_name as cost_center_name
       FROM expense_categories ec
       LEFT JOIN cost_centers cc ON ec.cost_center_id = cc.id
       WHERE ec.status = 'pending_approval'
       ORDER BY ec.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Approve expense category
router.put('/approve/:id', verifyToken, requireRole('finance_manager', 'admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE expense_categories 
       SET status = 'active', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND status = 'pending_approval'
       RETURNING *`,
      [req.user.id, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'البند غير موجود أو تم اعتماده مسبقاً' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Reject expense category
router.put('/reject/:id', verifyToken, requireRole('finance_manager', 'admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE expense_categories 
       SET status = 'rejected', updated_at = NOW()
       WHERE id = $1 AND status = 'pending_approval'
       RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'البند غير موجود أو تم اعتماده مسبقاً' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
