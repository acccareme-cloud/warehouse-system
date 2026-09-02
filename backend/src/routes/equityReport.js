// backend/src/routes/equityReport.js
const express = require('express');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// Get equity report
router.get('/', verifyToken, async (req, res) => {
  try {
    // Total assets
    const treasuryResult = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'in' THEN amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN type = 'out' THEN amount ELSE 0 END), 0) as treasury_balance
      FROM treasury_transactions
    `);
    
    const bankResult = await pool.query(`
      SELECT COALESCE(SUM(balance), 0) as total_bank_balance
      FROM bank_accounts
    `);
    
    const inventoryResult = await pool.query(`
      SELECT COALESCE(SUM(quantity * unit_cost), 0) as inventory_value
      FROM items
      WHERE is_active = true
    `);
    
    const treasuryBalance = parseFloat(treasuryResult.rows[0].treasury_balance || 0);
    const bankBalance = parseFloat(bankResult.rows[0].total_bank_balance || 0);
    const inventoryValue = parseFloat(inventoryResult.rows[0].inventory_value || 0);
    const totalAssets = treasuryBalance + bankBalance + inventoryValue;
    
    // Total liabilities (partner financing - partner payments)
    const liabilitiesResult = await pool.query(`
      SELECT 
        COALESCE(SUM(pf.amount), 0) - COALESCE(SUM(pp.amount), 0) as partner_balance
      FROM partner_financing pf
      LEFT JOIN partner_payments pp ON pp.partner_id = pf.partner_id
    `);
    
    const totalLiabilities = parseFloat(liabilitiesResult.rows[0].partner_balance || 0);
    
    // Total equity
    const totalEquity = totalAssets - totalLiabilities;
    
    // Partner capital
    const partnerCapitalResult = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total_capital
      FROM partner_financing
    `);
    
    const partnerCapital = parseFloat(partnerCapitalResult.rows[0].total_capital || 0);
    
    // Retained earnings
    const retainedEarnings = totalEquity - partnerCapital;
    
    res.json({
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      total_equity: totalEquity,
      partner_capital: partnerCapital,
      retained_earnings: retainedEarnings,
      treasury_balance: treasuryBalance,
      bank_balance: bankBalance,
      inventory_value: inventoryValue,
    });
  } catch (err) {
    console.error('[GET /equity-report] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;