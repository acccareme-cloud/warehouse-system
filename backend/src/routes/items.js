const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Get all items with warehouse and category names
router.get('/', verifyToken, async (req, res) => {
  try {
    const { only_in_stock } = req.query;
    
    let query = `
      SELECT i.*, w.name as warehouse_name, c.name as category_name, COALESCE(s.quantity, 0) as quantity
      FROM items i
      LEFT JOIN warehouses w ON i.warehouse_id = w.id
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN stock s ON i.id = s.item_id
      WHERE (i.is_active = true OR i.is_active IS NULL)
    `;
    
    // الأصناف بتظهر دايمًا (حتى لو رصيدها صفر) — الإخفاء بيبقى فقط لو طُلب صراحة
    if (only_in_stock === 'true') {
      query += ` AND COALESCE(s.quantity, 0) > 0`;
    }
    
    query += ` ORDER BY i.created_at DESC`;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get soft-deleted (inactive) items
router.get('/deleted', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.*, w.name as warehouse_name, c.name as category_name, COALESCE(s.quantity, 0) as quantity
      FROM items i 
      LEFT JOIN warehouses w ON i.warehouse_id = w.id 
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN stock s ON i.id = s.item_id 
      WHERE i.is_active = false
      ORDER BY i.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Restore a soft-deleted item
router.put('/:id/restore', verifyToken, requireRole('admin', 'storekeeper'), async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE items SET is_active = true WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'الصنف غير موجود' });
    }
    res.json({ message: 'تم استرجاع الصنف', item: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create item
router.post('/', verifyToken, requireRole('admin', 'storekeeper'), async (req, res) => {
  const { code, name, category_id, unit, warehouse_id, reorder_level, unit_cost, has_serial } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO items (code, name, category_id, unit, warehouse_id, reorder_level, unit_cost, has_serial, created_by, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [code, name, category_id || null, unit || 'عدد', warehouse_id || null, reorder_level || 0, unit_cost || 0, has_serial || false, req.user.id, true]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create item error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update item
router.put('/:id', verifyToken, requireRole('admin', 'storekeeper'), async (req, res) => {
  const { id } = req.params;
  const { name, category_id, unit, warehouse_id, reorder_level, unit_cost, has_serial, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE items 
       SET name=$1, category_id=$2, unit=$3, warehouse_id=$4, reorder_level=$5, unit_cost=$6, has_serial=$7, is_active=$8 
       WHERE id=$9 
       RETURNING *`,
      [name, category_id || null, unit, warehouse_id || null, reorder_level, unit_cost, has_serial, is_active !== false, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete item (soft delete)
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    await pool.query('UPDATE items SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ message: 'تم حذف الصنف' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get next item code
router.get('/next-code', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT code 
      FROM items 
      WHERE code ~ '^[0-9]+$' AND (is_active = true OR is_active IS NULL)
      ORDER BY CAST(code AS INTEGER) DESC 
      LIMIT 1
    `);

    let nextCode = '0001';

    if (result.rows.length > 0) {
      const lastCode = parseInt(result.rows[0].code);
      nextCode = String(lastCode + 1).padStart(4, '0');
    }

    res.json({ nextCode });
  } catch (err) {
    console.error('Error generating next code:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
