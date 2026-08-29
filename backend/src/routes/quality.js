const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Create quality check
router.post('/', verifyToken, requireRole('quality', 'admin'), async (req, res) => {
  const { reference_type, reference_id, result, notes } = req.body;
  try {
    const checkResult = await pool.query(
      'INSERT INTO quality_checks (reference_type, reference_id, result, notes, checked_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [reference_type, reference_id, result, notes, req.user.id]
    );
    
    // Update request status
    if (reference_type === 'request') {
      const newStatus = result === 'passed' ? 'pending_finance' : 'rejected';
      await pool.query('UPDATE requests SET status = $1 WHERE id = $2', [newStatus, reference_id]);
    }
    
    res.status(201).json(checkResult.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;