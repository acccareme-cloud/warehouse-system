const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Create request
router.post('/', verifyToken, requireRole('purchasing', 'maintenance'), async (req, res) => {
  const { request_number, department, item_id, warehouse_id, quantity, work_order } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO requests (request_number, department, item_id, warehouse_id, quantity, work_order, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [request_number, department, item_id, warehouse_id, quantity, work_order, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get pending requests
router.get('/pending', verifyToken, requireRole('quality', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, i.name as item_name, w.name as warehouse_name 
      FROM requests r
      JOIN items i ON r.item_id = i.id
      JOIN warehouses w ON r.warehouse_id = w.id
      WHERE r.status = 'pending_quality'
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
// Get available serials for item in warehouse
router.get('/available-serials', verifyToken, async (req, res) => {
  const { item_id, warehouse_id } = req.query;
  try {
    const result = await pool.query(`
      SELECT id, serial_number 
      FROM item_serials 
      WHERE item_id = $1 AND warehouse_id = $2 AND status = 'available'
      ORDER BY serial_number
    `, [item_id, warehouse_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;