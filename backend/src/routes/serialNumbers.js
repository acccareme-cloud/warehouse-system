const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Get available serials for item in warehouse
router.get('/available', verifyToken, async (req, res) => {
  const { item_id, warehouse_id } = req.query;
  try {
    const result = await pool.query(`
      SELECT s.*, i.name as item_name, w.name as warehouse_name
      FROM item_serials s
      JOIN items i ON s.item_id = i.id
      JOIN warehouses w ON s.warehouse_id = w.id
      WHERE s.item_id = $1 AND s.warehouse_id = $2 AND s.status = 'available'
      ORDER BY s.serial_number
    `, [item_id, warehouse_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create serials for receipt
router.post('/batch', verifyToken, requireRole('storekeeper', 'admin'), async (req, res) => {
  const { item_id, warehouse_id, receipt_voucher_id, serials } = req.body;
  
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const createdSerials = [];
      for (const serial of serials) {
        const result = await client.query(`
          INSERT INTO item_serials (item_id, warehouse_id, serial_number, receipt_voucher_id, status)
          VALUES ($1, $2, $3, $4, 'available')
          RETURNING *
        `, [item_id, warehouse_id, serial, receipt_voucher_id]);
        createdSerials.push(result.rows[0]);
      }
      
      await client.query('COMMIT');
      res.status(201).json(createdSerials);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update serial status
router.put('/:id/status', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  try {
    const result = await pool.query(`
      UPDATE item_serials 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [status, id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;