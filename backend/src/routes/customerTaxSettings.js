const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Get customer tax settings
router.get('/:customerId', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM customer_tax_settings WHERE customer_id = $1`,
      [req.params.customerId]
    );

    if (result.rows.length === 0) {
      // إرجاع إعدادات افتراضية
      return res.json({
        customer_id: parseInt(req.params.customerId),
        has_vat: true,
        vat_rate: 14.00,
        has_withholding: false,
        withholding_rate: 20.00,
        has_refundable_deposit: false,
        deposit_rate: 0,
        has_warranty: false,
        warranty_rate: 0
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create or update customer tax settings
router.post('/', verifyToken, requireRole('admin', 'finance'), async (req, res) => {
  const {
    customer_id, has_vat, vat_rate, has_withholding, withholding_rate,
    has_refundable_deposit, deposit_rate, has_warranty, warranty_rate
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO customer_tax_settings (
        customer_id, has_vat, vat_rate, has_withholding, withholding_rate,
        has_refundable_deposit, deposit_rate, has_warranty, warranty_rate
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (customer_id) DO UPDATE SET
        has_vat = $2, vat_rate = $3, has_withholding = $4, withholding_rate = $5,
        has_refundable_deposit = $6, deposit_rate = $7, has_warranty = $8, warranty_rate = $9,
        updated_at = NOW()
      RETURNING *`,
      [
        customer_id, has_vat, vat_rate, has_withholding, withholding_rate,
        has_refundable_deposit, deposit_rate, has_warranty, warranty_rate
      ]
    );

    res.json({
      message: 'تم تحديث إعدادات العميل بنجاح',
      data: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
