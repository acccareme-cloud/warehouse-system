const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Create stock movement
router.post('/', verifyToken, requireRole('storekeeper', 'admin'), async (req, res) => {
  const { item_id, warehouse_id, movement_type, quantity, reference_type, reference_id, unit_price, tax_discount_percent } = req.body;
  
  try {
    // حساب الضرائب
    const qty = parseFloat(quantity);
    const price = parseFloat(unit_price || 0);
    const subtotal = qty * price;
    const tax14 = subtotal * 0.14;
    const taxDiscountRate = parseFloat(tax_discount_percent || 0);
    const taxDiscount = subtotal * (taxDiscountRate / 100);
    const total = subtotal + tax14 - taxDiscount;

    // Insert movement
    const movementResult = await pool.query(
      `INSERT INTO stock_movements 
       (item_id, warehouse_id, movement_type, quantity, reference_type, reference_id, done_by, unit_price, tax_14_percent, tax_discount_percent, tax_discount_amount, total_amount) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
       RETURNING *`,
      [item_id, warehouse_id, movement_type, quantity, reference_type, reference_id, req.user.id, price, tax14, taxDiscountRate, taxDiscount, total]
    );
    
    // Update stock
    const stockCheck = await pool.query(
      'SELECT * FROM stock WHERE item_id = $1 AND warehouse_id = $2',
      [item_id, warehouse_id]
    );
    
    if (stockCheck.rows.length > 0) {
      const currentQty = parseFloat(stockCheck.rows[0].quantity);
      const newQty = movement_type === 'in' ? currentQty + qty : currentQty - qty;
      await pool.query(
        'UPDATE stock SET quantity = $1, updated_at = NOW() WHERE item_id = $2 AND warehouse_id = $3',
        [newQty, item_id, warehouse_id]
      );
    } else {
      await pool.query(
        'INSERT INTO stock (item_id, warehouse_id, quantity) VALUES ($1, $2, $3)',
        [item_id, warehouse_id, qty]
      );
    }
    
    res.status(201).json(movementResult.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all movements
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, i.name as item_name, w.name as warehouse_name, u.full_name as done_by_name
      FROM stock_movements m
      JOIN items i ON m.item_id = i.id
      JOIN warehouses w ON m.warehouse_id = w.id
      LEFT JOIN users u ON m.done_by = u.id
      ORDER BY m.moved_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// كارت صنف - تقرير مفصل
router.get('/card', verifyToken, async (req, res) => {
  const { item_id, warehouse_id, from_date, to_date } = req.query;
  
  try {
    // 1. رصيد أول (قبل التاريخ المحدد)
    const openingResult = await pool.query(`
      SELECT COALESCE(SUM(CASE WHEN movement_type = 'in' THEN quantity ELSE -quantity END), 0) as opening_balance
      FROM stock_movements
      WHERE item_id = $1 AND warehouse_id = $2 AND moved_at < $3
    `, [item_id, warehouse_id, from_date]);
    
    const openingBalance = parseFloat(openingResult.rows[0].opening_balance);

    

    // 3. الحركات من stock_movements في الفترة
    const movementsResult = await pool.query(`
      SELECT 
        m.*,
        i.name as item_name,
        w.name as warehouse_name,
        u.full_name as done_by_name
      FROM stock_movements m
      JOIN items i ON m.item_id = i.id
      JOIN warehouses w ON m.warehouse_id = w.id
      LEFT JOIN users u ON m.done_by = u.id
      WHERE m.item_id = $1 AND m.warehouse_id = $2 
      AND m.moved_at >= $3 AND m.moved_at <= $4
      ORDER BY m.moved_at ASC
    `, [item_id, warehouse_id, from_date, to_date + ' 23:59:59']);

    // دمج الحركات وترتيبها
     const allMovements = movementsResult.rows;
    // 4. حساب الرصيد التراكمي
    let runningBalance = openingBalance;
    const movementsWithBalance = allMovements.map((mov, index) => {
      const qty = parseFloat(mov.quantity);
      if (mov.movement_type === 'in') {
        runningBalance += qty;
      } else {
        runningBalance -= qty;
      }
      return {
        ...mov,
        running_balance: runningBalance.toFixed(3),
        unique_key: `${mov.id}-${mov.reference_type}-${index}` // مفتاح فريد
      };
    });

    res.json({
      opening_balance: openingBalance.toFixed(3),
      movements: movementsWithBalance,
      closing_balance: runningBalance.toFixed(3)
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;