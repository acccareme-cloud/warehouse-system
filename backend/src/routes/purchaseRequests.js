const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// PURCHASE REQUESTS API (محدث - مع exchange_rate)
// ═══════════════════════════════════════════════════════════════

// GET /purchase-requests/next-number
router.get('/next-number', verifyToken, async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const gapResult = await pool.query(
      `SELECT t1.request_number + 1 as next_num
       FROM purchase_requests t1
       WHERE t1.request_year = $1
         AND t1.status != 'cancelled'
         AND NOT EXISTS (
           SELECT 1 FROM purchase_requests t2 
           WHERE t2.request_number = t1.request_number + 1 
           AND t2.request_year = $1
           AND t2.status != 'cancelled'
         )
       ORDER BY t1.request_number
       LIMIT 1`,
      [year]
    );
    if (gapResult.rows.length > 0 && gapResult.rows[0].next_num > 0) {
      return res.json({ nextNumber: gapResult.rows[0].next_num });
    }
    const maxResult = await pool.query(
      `SELECT COALESCE(MAX(request_number), 0) + 1 as next_num 
       FROM purchase_requests 
       WHERE request_year = $1 AND status != 'cancelled'`,
      [year]
    );
    res.json({ nextNumber: maxResult.rows[0].next_num });
  } catch (err) {
    console.error('[GET /next-number] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /purchase-requests
router.get('/', verifyToken, async (req, res) => {
  const { year, status, department, requester } = req.query;
  try {
    let query = `
      SELECT pr.*, d.name as department_name, u.full_name as requester_name, c.name as currency_name
      FROM purchase_requests pr
      LEFT JOIN departments d ON pr.department_id = d.id
      LEFT JOIN users u ON pr.requested_by = u.id
      LEFT JOIN currencies c ON pr.currency_id = c.id
      WHERE pr.status != 'cancelled'
    `;
    const params = [];
    if (year) { params.push(year); query += ` AND pr.request_year = $${params.length}`; }
    if (status) { params.push(status); query += ` AND pr.status = $${params.length}`; }
    if (department) { params.push(department); query += ` AND pr.department_id = $${params.length}`; }
    if (requester) { params.push(requester); query += ` AND pr.requested_by = $${params.length}`; }
    query += ` ORDER BY pr.request_year DESC, pr.request_number DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /purchase-requests] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /purchase-requests/:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const requestResult = await pool.query(
      `SELECT pr.*, d.name as department_name, u.full_name as requester_name, c.name as currency_name, c.code as currency_code, c.exchange_rate as currency_exchange_rate
      FROM purchase_requests pr
      LEFT JOIN departments d ON pr.department_id = d.id
      LEFT JOIN users u ON pr.requested_by = u.id
      LEFT JOIN currencies c ON pr.currency_id = c.id
      WHERE pr.id = $1`, [req.params.id]
    );
    if (requestResult.rows.length === 0) return res.status(404).json({ message: 'طلب الشراء غير موجود' });
    const request = requestResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT pri.*, i.name as item_name, i.code as item_code, i.unit_of_measure, i.is_vat_exempt, i.is_profit_tax_exempt
      FROM purchase_request_items pri
      LEFT JOIN items i ON pri.item_id = i.id
      WHERE pri.purchase_request_id = $1`, [req.params.id]
    );

    res.json({ ...request, items: itemsResult.rows });
  } catch (err) {
    console.error('[GET /purchase-requests/:id] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /purchase-requests
router.post('/', verifyToken, async (req, res) => {
  const { request_number, request_year, department_id, requested_by, request_date, required_date, priority, notes, currency_id, exchange_rate, items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'يجب إضافة بنود للطلب' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // جيب معامل التحويل من العملة لو مش مدخل
    let finalExchangeRate = exchange_rate;
    if (!finalExchangeRate && currency_id) {
      const currencyResult = await client.query(`SELECT exchange_rate FROM currencies WHERE id = $1`, [currency_id]);
      if (currencyResult.rows.length > 0) {
        finalExchangeRate = currencyResult.rows[0].exchange_rate;
      }
    }
    if (!finalExchangeRate) finalExchangeRate = 1;

    const requestResult = await client.query(
      `INSERT INTO purchase_requests (request_number, request_year, department_id, requested_by, request_date, required_date, priority, status, notes, currency_id, exchange_rate, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10, $11) RETURNING *`,
      [request_number, request_year || new Date().getFullYear(), department_id || null, requested_by || req.user.id, request_date || new Date(), required_date || null, priority || 'normal', notes || null, currency_id || null, finalExchangeRate, req.user.id]
    );
    const requestId = requestResult.rows[0].id;

    let totalAmount = 0;
    for (const item of items) {
      const itemTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.estimated_price) || 0);
      totalAmount += itemTotal;
      await client.query(
        `INSERT INTO purchase_request_items (purchase_request_id, item_id, quantity, unit_of_measure, estimated_price, total_price, notes, is_vat_exempt, is_profit_tax_exempt)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [requestId, item.item_id, item.quantity, item.unit_of_measure || null, item.estimated_price || 0, itemTotal, item.notes || null, item.is_vat_exempt || false, item.is_profit_tax_exempt || false]
      );
    }

    await client.query(`UPDATE purchase_requests SET total_amount = $1 WHERE id = $2`, [totalAmount, requestId]);
    await client.query('COMMIT');
    res.status(201).json({ message: 'تم إنشاء طلب الشراء بنجاح', data: { ...requestResult.rows[0], total_amount: totalAmount } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /purchase-requests] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally { client.release(); }
});

// PUT /purchase-requests/:id
router.put('/:id', verifyToken, async (req, res) => {
  const { department_id, requested_by, request_date, required_date, priority, notes, currency_id, exchange_rate, items } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const requestResult = await client.query(`SELECT status FROM purchase_requests WHERE id = $1`, [req.params.id]);
    if (requestResult.rows.length === 0) throw new Error('طلب الشراء غير موجود');
    if (requestResult.rows[0].status !== 'pending') throw new Error('لا يمكن تعديل طلب غير معلق');

    let finalExchangeRate = exchange_rate;
    if (!finalExchangeRate && currency_id) {
      const currencyResult = await client.query(`SELECT exchange_rate FROM currencies WHERE id = $1`, [currency_id]);
      if (currencyResult.rows.length > 0) finalExchangeRate = currencyResult.rows[0].exchange_rate;
    }

    await client.query(
      `UPDATE purchase_requests SET department_id = $1, requested_by = $2, request_date = $3, required_date = $4, priority = $5, notes = $6, currency_id = $7, exchange_rate = $8, updated_at = NOW() WHERE id = $9`,
      [department_id || null, requested_by || req.user.id, request_date || new Date(), required_date || null, priority || 'normal', notes || null, currency_id || null, finalExchangeRate || 1, req.params.id]
    );

    if (items && Array.isArray(items)) {
      await client.query(`DELETE FROM purchase_request_items WHERE purchase_request_id = $1`, [req.params.id]);
      let totalAmount = 0;
      for (const item of items) {
        const itemTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.estimated_price) || 0);
        totalAmount += itemTotal;
        await client.query(
          `INSERT INTO purchase_request_items (purchase_request_id, item_id, quantity, unit_of_measure, estimated_price, total_price, notes, is_vat_exempt, is_profit_tax_exempt)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [req.params.id, item.item_id, item.quantity, item.unit_of_measure || null, item.estimated_price || 0, itemTotal, item.notes || null, item.is_vat_exempt || false, item.is_profit_tax_exempt || false]
        );
      }
      await client.query(`UPDATE purchase_requests SET total_amount = $1 WHERE id = $2`, [totalAmount, req.params.id]);
    }

    await client.query('COMMIT');
    res.json({ message: 'تم تحديث طلب الشراء' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[PUT /purchase-requests/:id] Error:', err);
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  } finally { client.release(); }
});

// DELETE /purchase-requests/:id
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const checkResult = await pool.query(`SELECT status FROM purchase_requests WHERE id = $1`, [req.params.id]);
    if (checkResult.rows.length === 0) return res.status(404).json({ message: 'طلب الشراء غير موجود' });
    if (checkResult.rows[0].status !== 'pending') return res.status(400).json({ message: 'لا يمكن حذف طلب غير معلق' });
    await pool.query(`DELETE FROM purchase_requests WHERE id = $1`, [req.params.id]);
    res.json({ message: 'تم حذف طلب الشراء' });
  } catch (err) {
    console.error('[DELETE /purchase-requests/:id] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /purchase-requests/:id/approve
router.put('/:id/approve', verifyToken, requireRole('admin', 'purchasing_manager'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE purchase_requests SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2 AND status = 'pending' RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (result.rows.length === 0) return res.status(400).json({ message: 'لا يمكن اعتماد الطلب' });
    res.json({ message: 'تم اعتماد طلب الشراء', data: result.rows[0] });
  } catch (err) {
    console.error('[PUT /purchase-requests/:id/approve] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /purchase-requests/:id/reject
router.put('/:id/reject', verifyToken, requireRole('admin', 'purchasing_manager'), async (req, res) => {
  const { rejection_reason } = req.body;
  try {
    const result = await pool.query(
      `UPDATE purchase_requests SET status = 'rejected', rejection_reason = $1, updated_at = NOW() WHERE id = $2 AND status = 'pending' RETURNING *`,
      [rejection_reason || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(400).json({ message: 'لا يمكن رفض الطلب' });
    res.json({ message: 'تم رفض طلب الشراء', data: result.rows[0] });
  } catch (err) {
    console.error('[PUT /purchase-requests/:id/reject] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /purchase-requests/approved
router.get('/approved', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pr.*, d.name as department_name, u.full_name as requester_name, c.name as currency_name
      FROM purchase_requests pr
      LEFT JOIN departments d ON pr.department_id = d.id
      LEFT JOIN users u ON pr.requested_by = u.id
      LEFT JOIN currencies c ON pr.currency_id = c.id
      WHERE pr.status = 'approved'
      ORDER BY pr.request_year DESC, pr.request_number DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /purchase-requests/approved] Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
