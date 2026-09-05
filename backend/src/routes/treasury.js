const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// المرفقات — تخزين محلي على السيرفر
// ═══════════════════════════════════════════════════════════════
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'treasury');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new Error('نوع الملف غير مسموح — يُسمح فقط بصور (JPG/PNG/WEBP) أو PDF'));
    }
    cb(null, true);
  }
});

// رفع مرفق لسند
router.post('/:id/attachments', verifyToken, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || 'خطأ في رفع الملف' });
    next();
  });
}, async (req, res) => {
  try {
    const treasuryCheck = await pool.query('SELECT id FROM treasury WHERE id = $1', [req.params.id]);
    if (treasuryCheck.rows.length === 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'السند غير موجود' });
    }
    if (!req.file) return res.status(400).json({ message: 'لم يتم اختيار ملف' });
    const result = await pool.query(
      `INSERT INTO treasury_attachments (treasury_id, file_name, stored_name, file_path, file_type, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.params.id, req.file.originalname, req.file.filename, req.file.path, req.file.mimetype, req.file.size, req.user.id]
    );
    res.status(201).json({ message: 'تم رفع المرفق بنجاح', data: result.rows[0] });
  } catch (err) {
    if (req.file) { try { fs.unlinkSync(req.file.path); } catch (e) {} }
    console.error('Upload attachment error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// قائمة مرفقات سند
router.get('/:id/attachments', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ta.*, u.full_name as uploaded_by_name FROM treasury_attachments ta LEFT JOIN users u ON ta.uploaded_by = u.id WHERE ta.treasury_id = $1 ORDER BY ta.uploaded_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
});

// عرض/تحميل ملف مرفق
router.get('/attachments/:attachmentId/file', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM treasury_attachments WHERE id = $1', [req.params.attachmentId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'المرفق غير موجود' });
    const att = result.rows[0];
    if (!fs.existsSync(att.file_path)) return res.status(404).json({ message: 'الملف مفقود من السيرفر' });
    res.setHeader('Content-Type', att.file_type);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(att.file_name)}"`);
    fs.createReadStream(att.file_path).pipe(res);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
});

// حذف مرفق
router.delete('/attachments/:attachmentId', verifyToken, requireRole('entry_accountant', 'treasury_accountant', 'finance', 'admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM treasury_attachments WHERE id = $1', [req.params.attachmentId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'المرفق غير موجود' });
    const att = result.rows[0];
    const canDelete = ['admin', 'finance'].includes(req.user.role) || att.uploaded_by === req.user.id;
    if (!canDelete) return res.status(403).json({ message: 'مش مسموح لك تحذف المرفق ده' });
    await pool.query('DELETE FROM treasury_attachments WHERE id = $1', [req.params.attachmentId]);
    if (fs.existsSync(att.file_path)) fs.unlinkSync(att.file_path);
    res.json({ message: 'تم حذف المرفق بنجاح' });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
// STATIC ROUTES (قبل /:id)
// ═══════════════════════════════════════════════════════════════

// توليد الرقم التسلسلي
// ملحوظة: الرقم هنا للعرض فقط (preview) في الفورم قبل الحفظ.
// الرقم النهائي الفعلي بيتولد تاني بشكل atomic جوه transaction الحفظ نفسه
// (POST '/', /duplicate, /import) عشان نضمن مفيش تكرار حتى لو طلبين
// جم على next-number في نفس اللحظة.
router.get('/next-number', verifyToken, async (req, res) => {
  const { type } = req.query;
  try {
    const prefix = TYPE_PREFIX_MAP[type] || 'TRX';
    const result = await pool.query(`SELECT transaction_number FROM treasury WHERE transaction_number LIKE $1 ORDER BY id DESC LIMIT 1`, [`${prefix}-%`]);
    let nextNumber = `${prefix}-0001`;
    if (result.rows.length > 0) { const last = parseInt(result.rows[0].transaction_number.split('-')[1]); nextNumber = `${prefix}-${String(last + 1).padStart(4, '0')}`; }
    res.json({ nextNumber });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
});

// قائمة الموظفين
router.get('/for-treasury', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`SELECT e.id, e.employee_number, e.full_name, d.name as department_name, s.name as section_name, e.status FROM employees e LEFT JOIN departments d ON e.department_id = d.id LEFT JOIN sections s ON e.section_id = s.id ORDER BY (e.status = 'active') DESC, e.full_name`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
});

// قائمة العملات
router.get('/currencies', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`SELECT code, name, symbol, is_default, exchange_rate FROM currencies WHERE is_active = true ORDER BY is_default DESC, code`).catch(() => null);
    if (result && result.rows.length > 0) res.json(result.rows);
    else res.json([{ code: 'EGP', name: 'جنيه مصري', symbol: 'ج.م', is_default: true, exchange_rate: 1 },{ code: 'USD', name: 'دولار أمريكي', symbol: '$', is_default: false, exchange_rate: 50.5 },{ code: 'EUR', name: 'يورو', symbol: '€', is_default: false, exchange_rate: 55.2 }]);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
});

// الرصيد — مجمع حسب cash/bank لكل عملة
// FIX: custody_settlement أضيف لـ outTypes عشان يخصم من الرصيد
// FIX: treasury_funding أضيف في حسابات cash in و bank out
// FIX: inTypesBank منفصل عن inTypes (مش بيحتوي treasury_funding)
router.get('/balance', verifyToken, async (req, res) => {
  try {
    const inTypes = `('customer_payment','advance_return','custody_return','treasury_funding','partner_financing','other_income')`;
    const inTypesBank = `('customer_payment','advance_return','custody_return','partner_financing','other_income')`;
    const outTypes = `('customer_refund','expense','other_outcome','custody_payment','salary_advance','supplier_payment','non_employee_advance','custody_settlement','partner_payment')`;
    const result = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN payment_method='cash' AND transaction_type IN ${inTypes} AND currency='EGP' THEN amount_local ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_to='cash' AND transfer_to_currency='EGP' THEN amount_local ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='treasury_funding' AND payment_method IN ('bank','check') AND currency='EGP' THEN amount_local ELSE 0 END),0) as cash_in_egp,
        COALESCE(SUM(CASE WHEN payment_method='cash' AND transaction_type IN ${outTypes} AND currency='EGP' THEN amount_local ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_from='cash' AND transfer_from_currency='EGP' THEN amount_local ELSE 0 END),0) as cash_out_egp,
        COALESCE(SUM(CASE WHEN payment_method='cash' AND transaction_type IN ${inTypes} AND currency='EGP' THEN amount_local ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_to='cash' AND transfer_to_currency='EGP' THEN amount_local ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='treasury_funding' AND payment_method IN ('bank','check') AND currency='EGP' THEN amount_local ELSE 0 END),0)-
        COALESCE(SUM(CASE WHEN payment_method='cash' AND transaction_type IN ${outTypes} AND currency='EGP' THEN amount_local ELSE 0 END),0)-
        COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_from='cash' AND transfer_from_currency='EGP' THEN amount_local ELSE 0 END),0) as cash_balance_egp,
        COALESCE(SUM(CASE WHEN payment_method='cash' AND transaction_type IN ${inTypes} AND currency='USD' THEN amount ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_to='cash' AND transfer_to_currency='USD' THEN amount ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='treasury_funding' AND payment_method IN ('bank','check') AND currency='USD' THEN amount ELSE 0 END),0) as cash_in_usd,
        COALESCE(SUM(CASE WHEN payment_method='cash' AND transaction_type IN ${outTypes} AND currency='USD' THEN amount ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_from='cash' AND transfer_from_currency='USD' THEN amount ELSE 0 END),0) as cash_out_usd,
        COALESCE(SUM(CASE WHEN payment_method='cash' AND transaction_type IN ${inTypes} AND currency='USD' THEN amount ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_to='cash' AND transfer_to_currency='USD' THEN amount ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='treasury_funding' AND payment_method IN ('bank','check') AND currency='USD' THEN amount ELSE 0 END),0)-
        COALESCE(SUM(CASE WHEN payment_method='cash' AND transaction_type IN ${outTypes} AND currency='USD' THEN amount ELSE 0 END),0)-
        COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_from='cash' AND transfer_from_currency='USD' THEN amount ELSE 0 END),0) as cash_balance_usd,
        COALESCE(SUM(CASE WHEN payment_method='cash' AND transaction_type IN ${inTypes} AND currency='EUR' THEN amount ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_to='cash' AND transfer_to_currency='EUR' THEN amount ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='treasury_funding' AND payment_method IN ('bank','check') AND currency='EUR' THEN amount ELSE 0 END),0) as cash_in_eur,
        COALESCE(SUM(CASE WHEN payment_method='cash' AND transaction_type IN ${outTypes} AND currency='EUR' THEN amount ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_from='cash' AND transfer_from_currency='EUR' THEN amount ELSE 0 END),0) as cash_out_eur,
        COALESCE(SUM(CASE WHEN payment_method='cash' AND transaction_type IN ${inTypes} AND currency='EUR' THEN amount ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_to='cash' AND transfer_to_currency='EUR' THEN amount ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='treasury_funding' AND payment_method IN ('bank','check') AND currency='EUR' THEN amount ELSE 0 END),0)-
        COALESCE(SUM(CASE WHEN payment_method='cash' AND transaction_type IN ${outTypes} AND currency='EUR' THEN amount ELSE 0 END),0)-
        COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_from='cash' AND transfer_from_currency='EUR' THEN amount ELSE 0 END),0) as cash_balance_eur,
        COALESCE(SUM(CASE WHEN payment_method IN ('bank','check') AND transaction_type IN ${inTypesBank} AND currency='EGP' THEN amount_local ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_to IN ('bank','check') AND transfer_to_currency='EGP' THEN amount_local ELSE 0 END),0) as bank_in_egp,
        COALESCE(SUM(CASE WHEN payment_method IN ('bank','check') AND transaction_type IN ${outTypes} AND currency='EGP' THEN amount_local ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_from IN ('bank','check') AND transfer_from_currency='EGP' THEN amount_local ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='treasury_funding' AND payment_method IN ('bank','check') AND currency='EGP' THEN amount_local ELSE 0 END),0) as bank_out_egp,
        COALESCE(SUM(CASE WHEN payment_method IN ('bank','check') AND transaction_type IN ${inTypesBank} AND currency='EGP' THEN amount_local ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_to IN ('bank','check') AND transfer_to_currency='EGP' THEN amount_local ELSE 0 END),0)-
        COALESCE(SUM(CASE WHEN payment_method IN ('bank','check') AND transaction_type IN ${outTypes} AND currency='EGP' THEN amount_local ELSE 0 END),0)-
        COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_from IN ('bank','check') AND transfer_from_currency='EGP' THEN amount_local ELSE 0 END),0)-
        COALESCE(SUM(CASE WHEN transaction_type='treasury_funding' AND payment_method IN ('bank','check') AND currency='EGP' THEN amount_local ELSE 0 END),0) as bank_balance_egp,
        COALESCE(SUM(CASE WHEN payment_method IN ('bank','check') AND transaction_type IN ${inTypesBank} AND currency='USD' THEN amount ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_to IN ('bank','check') AND transfer_to_currency='USD' THEN amount ELSE 0 END),0) as bank_in_usd,
        COALESCE(SUM(CASE WHEN payment_method IN ('bank','check') AND transaction_type IN ${outTypes} AND currency='USD' THEN amount ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_from IN ('bank','check') AND transfer_from_currency='USD' THEN amount ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='treasury_funding' AND payment_method IN ('bank','check') AND currency='USD' THEN amount ELSE 0 END),0) as bank_out_usd,
        COALESCE(SUM(CASE WHEN payment_method IN ('bank','check') AND transaction_type IN ${inTypesBank} AND currency='USD' THEN amount ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_to IN ('bank','check') AND transfer_to_currency='USD' THEN amount ELSE 0 END),0)-
        COALESCE(SUM(CASE WHEN payment_method IN ('bank','check') AND transaction_type IN ${outTypes} AND currency='USD' THEN amount ELSE 0 END),0)-
        COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_from IN ('bank','check') AND transfer_from_currency='USD' THEN amount ELSE 0 END),0)-
        COALESCE(SUM(CASE WHEN transaction_type='treasury_funding' AND payment_method IN ('bank','check') AND currency='USD' THEN amount ELSE 0 END),0) as bank_balance_usd,
        COALESCE(SUM(CASE WHEN payment_method IN ('bank','check') AND transaction_type IN ${inTypesBank} AND currency='EUR' THEN amount ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_to IN ('bank','check') AND transfer_to_currency='EUR' THEN amount ELSE 0 END),0) as bank_in_eur,
        COALESCE(SUM(CASE WHEN payment_method IN ('bank','check') AND transaction_type IN ${outTypes} AND currency='EUR' THEN amount ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_from IN ('bank','check') AND transfer_from_currency='EUR' THEN amount ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='treasury_funding' AND payment_method IN ('bank','check') AND currency='EUR' THEN amount ELSE 0 END),0) as bank_out_eur,
        COALESCE(SUM(CASE WHEN payment_method IN ('bank','check') AND transaction_type IN ${inTypesBank} AND currency='EUR' THEN amount ELSE 0 END),0)+
        COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_to IN ('bank','check') AND transfer_to_currency='EUR' THEN amount ELSE 0 END),0)-
        COALESCE(SUM(CASE WHEN payment_method IN ('bank','check') AND transaction_type IN ${outTypes} AND currency='EUR' THEN amount ELSE 0 END),0)-
        COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_from IN ('bank','check') AND transfer_from_currency='EUR' THEN amount ELSE 0 END),0)-
        COALESCE(SUM(CASE WHEN transaction_type='treasury_funding' AND payment_method IN ('bank','check') AND currency='EUR' THEN amount ELSE 0 END),0) as bank_balance_eur,
        COALESCE(SUM(CASE WHEN transaction_type IN ${inTypes} THEN amount_local ELSE 0 END),0) as total_in,
        COALESCE(SUM(CASE WHEN transaction_type IN ${outTypes} THEN amount_local ELSE 0 END),0) as total_out,
        COALESCE(SUM(CASE WHEN transaction_type IN ${inTypes} THEN amount_local ELSE 0 END),0)-
        COALESCE(SUM(CASE WHEN transaction_type IN ${outTypes} THEN amount_local ELSE 0 END),0) as total_balance
       FROM treasury WHERE status='active'`
    );
    const row = result.rows[0];
    res.json({
      cash: {
        EGP: { in: parseFloat(row.cash_in_egp), out: parseFloat(row.cash_out_egp), balance: parseFloat(row.cash_balance_egp) },
        USD: { in: parseFloat(row.cash_in_usd), out: parseFloat(row.cash_out_usd), balance: parseFloat(row.cash_balance_usd) },
        EUR: { in: parseFloat(row.cash_in_eur), out: parseFloat(row.cash_out_eur), balance: parseFloat(row.cash_balance_eur) }
      },
      bank: {
        EGP: { in: parseFloat(row.bank_in_egp), out: parseFloat(row.bank_out_egp), balance: parseFloat(row.bank_balance_egp) },
        USD: { in: parseFloat(row.bank_in_usd), out: parseFloat(row.bank_out_usd), balance: parseFloat(row.bank_balance_usd) },
        EUR: { in: parseFloat(row.bank_in_eur), out: parseFloat(row.bank_out_eur), balance: parseFloat(row.bank_balance_eur) }
      },
      total: { in: parseFloat(row.total_in), out: parseFloat(row.total_out), balance: parseFloat(row.total_balance) }
    });
  } catch (err) { console.error('Balance error:', err); res.status(500).json({ message: 'Server error', error: err.message }); }
});

// قائمة الحركات مع فلترة
router.get('/', verifyToken, async (req, res) => {
  try {
    const { status, type, from, to, currency } = req.query;
    let whereClause = ''; const params = []; let paramIndex = 1;
    if (status) { whereClause += ` AND t.status = $${paramIndex}`; params.push(status); paramIndex++; }
    if (type) { whereClause += ` AND t.transaction_type = $${paramIndex}`; params.push(type); paramIndex++; }
    if (from) { whereClause += ` AND t.transaction_date >= $${paramIndex}`; params.push(from); paramIndex++; }
    if (to) { whereClause += ` AND t.transaction_date <= $${paramIndex}`; params.push(to); paramIndex++; }
    if (currency) { whereClause += ` AND t.currency = $${paramIndex}`; params.push(currency); paramIndex++; }
    const result = await pool.query(
      `SELECT t.*, c.name as customer_name, s.supplier_name, ec.category_name as expense_name,
        cc.center_name as cost_center_name, ba.bank_name as bank_account_name,
        ba.account_number as bank_account_number, cu.full_name as created_by_name
       FROM treasury t
       LEFT JOIN customers c ON t.customer_id = c.id
       LEFT JOIN suppliers s ON t.supplier_id = s.id
       LEFT JOIN expense_categories ec ON t.expense_category_id = ec.id
       LEFT JOIN cost_centers cc ON t.cost_center_id = cc.id
       LEFT JOIN bank_accounts ba ON t.bank_account_id = ba.id
       LEFT JOIN users cu ON t.created_by = cu.id
       WHERE 1=1 ${whereClause} ORDER BY t.created_at DESC`, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
// PARAMETERIZED ROUTES
// ═══════════════════════════════════════════════════════════════

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, c.name as customer_name, s.supplier_name,
        ec.category_name as expense_name, cc.center_name as cost_center_name,
        ba.bank_name as bank_account_name, ba.account_number as bank_account_number
       FROM treasury t
       LEFT JOIN customers c ON t.customer_id = c.id
       LEFT JOIN suppliers s ON t.supplier_id = s.id
       LEFT JOIN expense_categories ec ON t.expense_category_id = ec.id
       LEFT JOIN cost_centers cc ON t.cost_center_id = cc.id
       LEFT JOIN bank_accounts ba ON t.bank_account_id = ba.id
       WHERE t.id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'السند غير موجود' });
    const record = result.rows[0];
    const itemsResult = await pool.query(
      `SELECT ti.*, ec.category_name as expense_category_name, cc.center_name as cost_center_name
       FROM treasury_items ti
       LEFT JOIN expense_categories ec ON ti.expense_category_id = ec.id
       LEFT JOIN cost_centers cc ON ti.cost_center_id = cc.id
       WHERE ti.treasury_id = $1 ORDER BY ti.sort_order, ti.id`, [req.params.id]);
    record.items = itemsResult.rows;
    res.json(record);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
// FIX: custody_settlement أضيف لـ OUT_TYPES
const OUT_TYPES = ['customer_refund','expense','other_outcome','custody_payment','salary_advance','supplier_payment','non_employee_advance','custody_settlement','partner_payment'];
// FIX: canSkipWorkflow بيدعم skip_workflow parameter
const canSkipWorkflow = (role, skipWorkflow=false) => ['finance','admin'].includes(role) && skipWorkflow;

// ═══════════════════════════════════════════════════════════════
// FIX: توليد رقم السند بشكل atomic — بيمنع تكرار الرقم لو حصل طلبين
// في نفس اللحظة (كان سبب duplicate key على custody_number)
// ═══════════════════════════════════════════════════════════════
const TYPE_PREFIX_MAP = {
  custody_payment: 'CPAY', custody_settlement: 'CSET', salary_advance: 'SADV',
  supplier_payment: 'SPAY', customer_payment: 'CUST', expense: 'EXP',
  bank_transfer: 'TRF', non_employee_advance: 'NEAD', customer_refund: 'TRX',
  other_income: 'TRX', other_outcome: 'TRX', advance_return: 'TRX',
  custody_return: 'TRX', treasury_funding: 'TRF'
};

// لازم تتنادى جوه client transaction (BEGIN...COMMIT) عشان الـ lock يفضل شغال
// لحد ما الـ transaction تخلص. أي طلب تاني بيحاول ياخد نفس الـ lock هيستنى.
async function generateTransactionNumber(client, transactionType) {
  const prefix = TYPE_PREFIX_MAP[transactionType] || 'TRX';
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [prefix]);
  const result = await client.query(
    `SELECT transaction_number FROM treasury WHERE transaction_number LIKE $1 ORDER BY id DESC LIMIT 1`,
    [`${prefix}-%`]
  );
  let nextNumber = `${prefix}-0001`;
  if (result.rows.length > 0) {
    const last = parseInt(result.rows[0].transaction_number.split('-')[1]);
    nextNumber = `${prefix}-${String(last + 1).padStart(4, '0')}`;
  }
  return nextNumber;
}

// FIX: checkBalance بيستخدم inTypesBank منفصل + treasury_funding في cash in + custody_settlement في out
async function checkBalance(client, paymentMethod, amount, currency, force=false, transactionType=null, transferFrom=null, transferFromCurrency=null) {
  const inTypesCash = `('customer_payment','advance_return','custody_return','treasury_funding','partner_financing','other_income')`;
  const inTypesBank = `('customer_payment','advance_return','custody_return','partner_financing','other_income')`;
  const outTypes = `('customer_refund','expense','other_outcome','custody_payment','salary_advance','supplier_payment','non_employee_advance','custody_settlement','partner_payment')`;
  let targetMethod = paymentMethod;
  let targetCurrency = currency;
  if (transactionType === 'bank_transfer' && transferFrom) {
    targetMethod = transferFrom;
    targetCurrency = transferFromCurrency || currency;
  }
  let balanceQuery;
  const qParams = [];
  if (targetMethod === 'cash') {
    balanceQuery = `SELECT
      COALESCE(SUM(CASE WHEN payment_method='cash' AND transaction_type IN ${inTypesCash} AND currency=$1 THEN amount ELSE 0 END),0)+
      COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_to='cash' AND transfer_to_currency=$1 THEN amount ELSE 0 END),0)+
      COALESCE(SUM(CASE WHEN transaction_type='treasury_funding' AND payment_method IN ('bank','check') AND currency=$1 THEN amount ELSE 0 END),0)-
      COALESCE(SUM(CASE WHEN payment_method='cash' AND transaction_type IN ${outTypes} AND currency=$1 THEN amount ELSE 0 END),0)-
      COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_from='cash' AND transfer_from_currency=$1 THEN amount ELSE 0 END),0) as available_balance
      FROM treasury WHERE status='active'`;
    qParams.push(targetCurrency);
  } else {
    balanceQuery = `SELECT
      COALESCE(SUM(CASE WHEN payment_method IN ('bank','check') AND transaction_type IN ${inTypesBank} AND currency=$1 THEN amount ELSE 0 END),0)+
      COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_to IN ('bank','check') AND transfer_to_currency=$1 THEN amount ELSE 0 END),0)-
      COALESCE(SUM(CASE WHEN payment_method IN ('bank','check') AND transaction_type IN ${outTypes} AND currency=$1 THEN amount ELSE 0 END),0)-
      COALESCE(SUM(CASE WHEN transaction_type='bank_transfer' AND transfer_from IN ('bank','check') AND transfer_from_currency=$1 THEN amount ELSE 0 END),0)-
      COALESCE(SUM(CASE WHEN transaction_type='treasury_funding' AND payment_method IN ('bank','check') AND currency=$1 THEN amount ELSE 0 END),0) as available_balance
      FROM treasury WHERE status='active'`;
    qParams.push(targetCurrency);
  }
  const result = await client.query(balanceQuery, qParams);
  const available = parseFloat(result.rows[0].available_balance);
  if (available < amount && !force) {
    return { ok: false, available, required: amount,
      message: `الرصيد غير كافي! المتاح: ${available.toFixed(2)} ${currency} | المطلوب: ${amount.toFixed(2)} ${currency}` };
  }
  return { ok: true };
}

// FIX: custody_payment بيدعم supplier_id (مورد خدمة)
async function applyFundMovementEffects(client, treasuryRecord, data, actingUserId) {
  const { transaction_type, transaction_number, transaction_date, employee_id, employee_name,
    numericAmount, amountLocal, curr, rate, payment_method, bank_name, check_number,
    purpose, description, supplier_id, customer_id, shipment_id,
    transfer_from, transfer_to, party_type, party_name, custody_id } = data;

  // FIX: تسوية عهدة (صرف فرق) أو رد عهدة يدوي
  if (['custody_settlement', 'custody_return'].includes(transaction_type) && custody_id) {
    const custodyRes = await client.query('SELECT amount, remaining_amount, settled_amount FROM custodies WHERE id=$1 FOR UPDATE', [custody_id]);
    if (custodyRes.rows.length > 0) {
      const c = custodyRes.rows[0];
      const currentRemaining = parseFloat(c.remaining_amount) || 0;
      const currentSettled = parseFloat(c.settled_amount) || 0;

      // ✅ CSET و CRED الاتنين بيخصموا من remaining
      // CSET = الشركة تدفع فرق زيادة (ممكن remaining يبقى سالب)
      // CRED = الموظف يرد فلوس (remaining بيقل)
      const newRemaining = currentRemaining - numericAmount;
      const newSettled = currentSettled + numericAmount;

      // status: active لو remaining > 0 (فيه فلوس مع الموظف)
      // fully_settled لو remaining <= 0 (اتسوى بالكامل أو زيادة على الشركة)
      const newStatus = newRemaining > 0.01 ? 'active' : 'fully_settled';

      await client.query(
        `UPDATE custodies SET remaining_amount=$1, settled_amount=$2, status=$3, updated_at=NOW() WHERE id=$4`,
        [newRemaining, newSettled, newStatus, custody_id]
      );
    }
  }

  // FIX: حماية إضافية — ميعملش عهدة جديدة لو السند ده أصلاً مربوط بعهدة
  // (بيمنع duplicate custody_number لو execute اتنادى مرتين على نفس السند)
  if (transaction_type === 'custody_payment' && (employee_id || supplier_id) && !treasuryRecord.custody_id) {
    let supplierName = '';
    if (!employee_id && supplier_id) {
      const supRes = await client.query('SELECT name FROM suppliers WHERE id=$1', [supplier_id]);
      supplierName = supRes.rows[0]?.name || '';
    }
    const resolvedPartyType = employee_id ? 'employee' : 'service_provider';
    const custodyResult = await client.query(
      `INSERT INTO custodies (custody_number,custody_date,employee_id,employee_name,supplier_id,supplier_name,party_type,amount,amount_local,currency,exchange_rate,payment_method,bank_name,check_number,purpose,remaining_amount,settled_amount,status,treasury_id,payment_voucher_number,created_by,created_at,shipment_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW(),$22) RETURNING *`,
      [transaction_number, transaction_date||new Date(), employee_id||null, employee_name||'',
       supplier_id||null, supplierName, resolvedPartyType,
       numericAmount, amountLocal, curr, rate, payment_method, bank_name||null, check_number||null,
       purpose||description||null, numericAmount, 0, 'active',
       treasuryRecord.id, transaction_number, actingUserId, shipment_id||null]);
    await client.query(`UPDATE treasury SET custody_id=$1 WHERE id=$2`, [custodyResult.rows[0].id, treasuryRecord.id]);
  }

  if (transaction_type === 'non_employee_advance' && !treasuryRecord.custody_id) {
    const custodyResult = await client.query(
      `INSERT INTO custodies (custody_number,custody_date,employee_id,employee_name,amount,amount_local,currency,exchange_rate,payment_method,bank_name,check_number,purpose,remaining_amount,settled_amount,status,treasury_id,payment_voucher_number,created_by,created_at,party_type,party_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW(),$19,$20) RETURNING *`,
      [transaction_number, transaction_date||new Date(), employee_id||null, employee_name||party_name||'',
       numericAmount, amountLocal, curr, rate, payment_method, bank_name||null, check_number||null,
       purpose||description||null, numericAmount, 0, 'active',
       treasuryRecord.id, transaction_number, actingUserId, party_type||'non_employee', party_name||'']);
    await client.query(`UPDATE treasury SET custody_id=$1 WHERE id=$2`, [custodyResult.rows[0].id, treasuryRecord.id]);
  }

  if (transaction_type === 'supplier_payment' && supplier_id) {
    await client.query(`SELECT update_supplier_ledger($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [supplier_id, 'payment', treasuryRecord.id, 'treasury', transaction_number, 0, amountLocal, description, actingUserId]);
  }
  if (transaction_type === 'customer_payment' && customer_id) {
    await client.query(`SELECT update_customer_ledger($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [customer_id, 'payment', treasuryRecord.id, 'treasury', transaction_number, amountLocal, 0, description, actingUserId]);
  }
}

// ═══════════════════════════════════════════════════════════════
// WORKFLOW
// ═══════════════════════════════════════════════════════════════

router.put('/:id/review', verifyToken, requireRole('review_accountant','finance','admin'), async (req, res) => {
  const { action, rejection_reason } = req.body;
  try {
    const existing = await pool.query('SELECT * FROM treasury WHERE id=$1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'السند غير موجود' });
    const t = existing.rows[0];
    if (t.status !== 'pending_review') return res.status(400).json({ message: `لا يمكن المراجعة - الحالة: ${t.status}` });
    if (action === 'approve') {
      const result = await pool.query(
        `UPDATE treasury SET status='pending_approval',reviewed_by=$1,reviewed_at=NOW(),rejection_reason=NULL,return_reason=NULL WHERE id=$2 RETURNING *`,
        [req.user.id, req.params.id]);
      return res.json({ message: 'تمت الموافقة، السند للاعتماد', data: result.rows[0] });
    } else if (action === 'reject') {
      if (!rejection_reason || !rejection_reason.trim()) return res.status(400).json({ message: 'اكتب سبب الرفض' });
      const result = await pool.query(
        `UPDATE treasury SET status='rejected_by_review',reviewed_by=$1,reviewed_at=NOW(),rejection_reason=$2,return_reason=$2 WHERE id=$3 RETURNING *`,
        [req.user.id, rejection_reason, req.params.id]);
      return res.json({ message: 'تم الرفض', data: result.rows[0] });
    }
    return res.status(400).json({ message: 'action يجب أن تكون approve أو reject' });
  } catch (err) { console.error('Review error:', err); res.status(500).json({ message: 'Server error', error: err.message }); }
});

router.put('/:id/approve', verifyToken, requireRole('finance','admin'), async (req, res) => {
  const { action, rejection_reason } = req.body;
  try {
    const existing = await pool.query('SELECT * FROM treasury WHERE id=$1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'السند غير موجود' });
    const t = existing.rows[0];
    if (t.status !== 'pending_approval') return res.status(400).json({ message: `لا يمكن الاعتماد - الحالة: ${t.status}` });
    if (action === 'approve') {
      const result = await pool.query(
        `UPDATE treasury SET status='approved',approved_by=$1,approved_at=NOW(),rejection_reason=NULL,return_reason=NULL WHERE id=$2 RETURNING *`,
        [req.user.id, req.params.id]);
      return res.json({ message: 'تم الاعتماد، جاهز للصرف', data: result.rows[0] });
    } else if (action === 'reject') {
      if (!rejection_reason || !rejection_reason.trim()) return res.status(400).json({ message: 'اكتب سبب الرفض' });
      const result = await pool.query(
        `UPDATE treasury SET status='rejected_by_finance',approved_by=$1,approved_at=NOW(),rejection_reason=$2,return_reason=$2 WHERE id=$3 RETURNING *`,
        [req.user.id, rejection_reason, req.params.id]);
      return res.json({ message: 'تم الرفض', data: result.rows[0] });
    }
    return res.status(400).json({ message: 'action يجب أن تكون approve أو reject' });
  } catch (err) { console.error('Approve error:', err); res.status(500).json({ message: 'Server error', error: err.message }); }
});

router.put('/:id/execute', verifyToken, requireRole('treasury_accountant','finance','admin'), async (req, res) => {
  const { force } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM treasury WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (existing.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'السند غير موجود' }); }
    const t = existing.rows[0];
    const allowedStatuses = ['finance','admin'].includes(req.user.role) ? ['approved','return_requested'] : ['approved'];
    if (!allowedStatuses.includes(t.status)) { await client.query('ROLLBACK'); return res.status(400).json({ message: `لا يمكن الصرف - الحالة: ${t.status}` }); }
    const numericAmount = parseFloat(t.amount) || 0;
    if (OUT_TYPES.includes(t.transaction_type)) {
      const check = await checkBalance(client, t.payment_method, numericAmount, t.currency, force);
      if (!check.ok) { await client.query('ROLLBACK'); return res.status(400).json({ message: check.message, code: 'INSUFFICIENT_BALANCE', available: check.available, required: check.required }); }
    }
    if (t.transaction_type === 'bank_transfer') {
      const check = await checkBalance(client, t.payment_method, numericAmount, t.currency, force, t.transaction_type, t.transfer_from, t.transfer_from_currency);
      if (!check.ok) { await client.query('ROLLBACK'); return res.status(400).json({ message: check.message, code: 'INSUFFICIENT_BALANCE', available: check.available, required: check.required }); }
    }
    const result = await client.query(
      `UPDATE treasury SET status='active',executed_by=$1,executed_at=NOW(),rejection_reason=NULL,return_reason=NULL WHERE id=$2 RETURNING *`,
      [req.user.id, req.params.id]);
    const treasuryRecord = result.rows[0];
    await applyFundMovementEffects(client, treasuryRecord, {
      transaction_type: t.transaction_type, transaction_number: t.transaction_number,
      transaction_date: t.transaction_date, employee_id: t.employee_id, employee_name: t.employee_name,
      numericAmount, amountLocal: t.amount_local, curr: t.currency, rate: t.exchange_rate,
      payment_method: t.payment_method, bank_name: t.bank_name, check_number: t.check_number,
      purpose: t.description, description: t.description, supplier_id: t.supplier_id,
      customer_id: t.customer_id, shipment_id: t.shipment_id,
      transfer_from: t.transfer_from, transfer_to: t.transfer_to,
      party_type: t.party_type, party_name: t.party_name, custody_id: t.custody_id
    }, req.user.id);
    await client.query('COMMIT');
    res.json({ message: 'تم الصرف بنجاح', data: treasuryRecord });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Execute error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ message: 'رقم السند اتكرر مع سند تاني — جرب تاني، ولو المشكلة استمرت كلم الدعم الفني', error: err.detail });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
  finally { client.release(); }
});

router.put('/:id/return-request', verifyToken, requireRole('treasury_accountant','finance','admin'), async (req, res) => {
  const { rejection_reason } = req.body;
  try {
    if (!rejection_reason || !rejection_reason.trim()) return res.status(400).json({ message: 'اكتب المشكلة' });
    const existing = await pool.query('SELECT * FROM treasury WHERE id=$1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'السند غير موجود' });
    const t = existing.rows[0];
    if (t.status !== 'approved') return res.status(400).json({ message: `لا يمكن الإبلاغ - الحالة: ${t.status}` });
    const result = await pool.query(
      `UPDATE treasury SET status='return_requested',return_reason=$1,rejection_reason=$1 WHERE id=$2 RETURNING *`,
      [rejection_reason, req.params.id]);
    res.json({ message: 'تم رفع المشكلة', data: result.rows[0] });
  } catch (err) { console.error('Return-request error:', err); res.status(500).json({ message: 'Server error', error: err.message }); }
});

router.put('/:id/resolve-return', verifyToken, requireRole('finance','admin'), async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM treasury WHERE id=$1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'السند غير موجود' });
    const t = existing.rows[0];
    if (t.status !== 'return_requested') return res.status(400).json({ message: `لا يوجد مشكلة - الحالة: ${t.status}` });
    const result = await pool.query(
      `UPDATE treasury SET status='pending_review',reviewed_by=NULL,reviewed_at=NULL,approved_by=NULL,approved_at=NULL,return_reason=NULL,rejection_reason=NULL WHERE id=$1 RETURNING *`,
      [req.params.id]);
    res.json({ message: 'تم الإرجاع لمحاسب الإدخالات', data: result.rows[0] });
  } catch (err) { console.error('Resolve-return error:', err); res.status(500).json({ message: 'Server error', error: err.message }); }
});

router.put('/:id/cancel', verifyToken, requireRole('finance','admin'), async (req, res) => {
  const { cancel_reason } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM treasury WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (existing.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'السند غير موجود' }); }
    const t = existing.rows[0];
    if (t.status !== 'active') { await client.query('ROLLBACK'); return res.status(400).json({ message: `لا يمكن الإلغاء - الحالة: ${t.status}` }); }
    if (!cancel_reason || !cancel_reason.trim()) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'اكتب سبب الإلغاء' }); }

    // FIX: إلغاء سند تسوية/رد عهدة لازم يرجع رصيد العهدة بدل ما يلغيها بالكامل
    if (['custody_settlement', 'custody_return'].includes(t.transaction_type) && t.custody_id) {
      if (t.submission_id) {
        const settlementRows = await client.query(`SELECT * FROM custody_settlements WHERE submission_id = $1`, [t.submission_id]);
        for (const row of settlementRows.rows) {
          if (row.cost_center_id) {
            await client.query(
              `UPDATE cost_centers SET spent_amount = spent_amount - $1, remaining_budget = budget_amount - (spent_amount - $1), updated_at = NOW() WHERE id = $2`,
              [row.amount, row.cost_center_id]
            );
          }
        }
        await client.query(`DELETE FROM custody_settlements WHERE submission_id = $1`, [t.submission_id]);
        const remainingBefore = t.custody_remaining_before !== null && t.custody_remaining_before !== undefined ? parseFloat(t.custody_remaining_before) : null;
        const custodyRes = await client.query('SELECT amount, settled_amount FROM custodies WHERE id = $1', [t.custody_id]);
        const custodyAmount = parseFloat(custodyRes.rows[0]?.amount || 0);
        const currentSettled = parseFloat(custodyRes.rows[0]?.settled_amount || 0);
        const submissionRes = await client.query('SELECT total_amount FROM custody_submissions WHERE id = $1', [t.submission_id]);
        const settlementTotal = parseFloat(submissionRes.rows[0]?.total_amount || 0);
        const newRemaining = remainingBefore !== null ? remainingBefore : custodyAmount;
        const newSettled = Math.max(0, currentSettled - settlementTotal);
        const newStatus = newRemaining > 0 ? (newRemaining < custodyAmount ? 'partially_settled' : 'active') : 'active';
        await client.query(`UPDATE custodies SET remaining_amount=$1, settled_amount=$2, status=$3, updated_at=NOW() WHERE id=$4`, [newRemaining, newSettled, newStatus, t.custody_id]);
        await client.query(`UPDATE custody_submissions SET status='approved', settled_at=NULL, updated_at=NOW() WHERE id=$1`, [t.submission_id]);
      } else {
        const amt = parseFloat(t.amount) || 0;
        const custodyRes = await client.query('SELECT amount, remaining_amount, settled_amount FROM custodies WHERE id = $1', [t.custody_id]);
        if (custodyRes.rows.length > 0) {
          const c = custodyRes.rows[0];
          const custodyAmount = parseFloat(c.amount) || 0;
          const newRemaining = Math.min(custodyAmount, (parseFloat(c.remaining_amount) || 0) + amt);
          const newSettled = Math.max(0, (parseFloat(c.settled_amount) || 0) - amt);
          const newStatus = newRemaining >= custodyAmount ? 'active' : (newRemaining > 0 ? 'partially_settled' : 'fully_settled');
          await client.query(`UPDATE custodies SET remaining_amount=$1, settled_amount=$2, status=$3, updated_at=NOW() WHERE id=$4`, [newRemaining, newSettled, newStatus, t.custody_id]);
        }
      }
    } else if (t.custody_id) {
  await client.query(
    `UPDATE custodies SET status='cancelled',remaining_amount=0,settled_amount=amount,treasury_id=NULL WHERE id=$1`,
    [t.custody_id]
  );
}
    if (t.transaction_type === 'supplier_payment' && t.supplier_id) {
      const amountLocal = parseFloat(t.amount_local) || 0;
      await client.query(`SELECT update_supplier_ledger($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [t.supplier_id, 'adjustment', t.id, 'treasury', t.transaction_number, amountLocal, 0, `إلغاء سند - ${cancel_reason}`, req.user.id]);
    }
    if (t.transaction_type === 'customer_payment' && t.customer_id) {
      const amountLocal = parseFloat(t.amount_local) || 0;
      await client.query(`SELECT update_customer_ledger($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [t.customer_id, 'adjustment', t.id, 'treasury', t.transaction_number, 0, amountLocal, `إلغاء سند - ${cancel_reason}`, req.user.id]);
    }
    const result = await client.query(
      `UPDATE treasury SET status='cancelled',rejection_reason=$1,return_reason=$1,updated_at=NOW() WHERE id=$2 RETURNING *`,
      [cancel_reason, req.params.id]);
    await client.query('COMMIT');
    res.json({ message: 'تم الإلغاء بنجاح', data: result.rows[0] });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ message: 'Server error', error: err.message }); }
  finally { client.release(); }
});

// ═══════════════════════════════════════════════════════════════
// REPORTS & EXPORTS
// ═══════════════════════════════════════════════════════════════

router.get('/report/statement', verifyToken, async (req, res) => {
  const { from, to, currency, payment_method } = req.query;
  try {
    let whereClause = `WHERE t.status='active'`;
    const params = []; let paramIndex = 1;
    if (from) { whereClause += ` AND t.transaction_date>=$${paramIndex}`; params.push(from); paramIndex++; }
    if (to) { whereClause += ` AND t.transaction_date<=$${paramIndex}`; params.push(to); paramIndex++; }
    if (currency) { whereClause += ` AND t.currency=$${paramIndex}`; params.push(currency); paramIndex++; }
    if (payment_method) { whereClause += ` AND t.payment_method=$${paramIndex}`; params.push(payment_method); paramIndex++; }
    let openingBalance = 0;
    if (from) {
      let openingWhere = `WHERE status='active' AND transaction_date < $1`;
      const openingParams = [from];
      let opIdx = 2;
      if (currency) { openingWhere += ` AND currency = $${opIdx}`; openingParams.push(currency); opIdx++; }
      if (payment_method) { openingWhere += ` AND payment_method = $${opIdx}`; openingParams.push(payment_method); opIdx++; }
      // FIX: custody_settlement أضيف في outTypes
      const openingResult = await pool.query(
        `SELECT COALESCE(SUM(CASE WHEN transaction_type IN ('customer_payment','advance_return','custody_return','treasury_funding','partner_financing','other_income') THEN amount_local WHEN transaction_type='bank_transfer' AND transfer_to IN ('cash','bank') THEN amount_local ELSE 0 END),0)-
         COALESCE(SUM(CASE WHEN transaction_type IN ('customer_refund','expense','other_outcome','custody_payment','salary_advance','supplier_payment','non_employee_advance','custody_settlement','partner_payment') THEN amount_local WHEN transaction_type='bank_transfer' AND transfer_from IN ('cash','bank') THEN amount_local ELSE 0 END),0) as opening
         FROM treasury ${openingWhere}`, openingParams);
      openingBalance = parseFloat(openingResult.rows[0].opening) || 0;
    }
    const result = await pool.query(
      `SELECT t.*, c.name as customer_name, s.supplier_name, cu.full_name as created_by_name
       FROM treasury t LEFT JOIN customers c ON t.customer_id=c.id LEFT JOIN suppliers s ON t.supplier_id=s.id LEFT JOIN users cu ON t.created_by=cu.id
       ${whereClause} ORDER BY t.transaction_date ASC, t.id ASC`, params);
    let runningBalance = openingBalance;
    // FIX: custody_settlement أضيف في outTypes
    const inTypes = ['customer_payment','advance_return','custody_return','treasury_funding','partner_financing','other_income'];
    const outTypes = ['customer_refund','expense','other_outcome','custody_payment','salary_advance','supplier_payment','non_employee_advance','custody_settlement','partner_payment'];
    const rows = result.rows.map(row => {
      const amountLocal = parseFloat(row.amount_local) || 0;
      let debit = 0, credit = 0;
      if (inTypes.includes(row.transaction_type)) { debit = amountLocal; runningBalance += debit; }
      else if (outTypes.includes(row.transaction_type)) { credit = amountLocal; runningBalance -= credit; }
      else if (row.transaction_type === 'bank_transfer') {
        if (row.transfer_to==='cash' || row.transfer_to==='bank') { debit = amountLocal; runningBalance += debit; }
        if (row.transfer_from==='cash' || row.transfer_from==='bank') { credit = amountLocal; runningBalance -= credit; }
      }
      return { ...row, debit, credit, balance: runningBalance };
    });
    res.json({ opening_balance: openingBalance, closing_balance: runningBalance, count: rows.length, data: rows });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
});

router.get('/export/csv', verifyToken, async (req, res) => {
  const { from, to, status, type } = req.query;
  try {
    let whereClause = ''; const params = []; let paramIndex = 1;
    if (status) { whereClause += ` AND t.status=$${paramIndex}`; params.push(status); paramIndex++; }
    if (type) { whereClause += ` AND t.transaction_type=$${paramIndex}`; params.push(type); paramIndex++; }
    if (from) { whereClause += ` AND t.transaction_date>=$${paramIndex}`; params.push(from); paramIndex++; }
    if (to) { whereClause += ` AND t.transaction_date<=$${paramIndex}`; params.push(to); paramIndex++; }
    const result = await pool.query(
      `SELECT t.transaction_number,t.transaction_date,t.transaction_type,t.status,t.amount,t.currency,t.amount_local,t.payment_method,t.description,c.name as customer_name,s.supplier_name,t.employee_name,t.party_name,cu.full_name as created_by_name,t.created_at
       FROM treasury t LEFT JOIN customers c ON t.customer_id=c.id LEFT JOIN suppliers s ON t.supplier_id=s.id LEFT JOIN users cu ON t.created_by=cu.id
       WHERE 1=1 ${whereClause} ORDER BY t.created_at DESC`, params);
    let csv = '\uFEFFرقم السند,التاريخ,النوع,الحالة,المبلغ,العملة,المبلغ بالجنيه,طريقة الدفع,البيان,العميل,المورد,الجهة,أنشئ بواسطة,تاريخ الإنشاء\n';
    const typeMap = { 'customer_payment':'سداد عميل','customer_refund':'رد عميل','advance_return':'رد سلفة','custody_return':'رد عهدة','treasury_funding':'تمويل خزينة','partner_financing':'تمويل من شريك','partner_payment':'صرف لشريك','other_income':'إيراد آخر','expense':'مصروف','other_outcome':'صرف آخر','custody_payment':'عهدة موظف','custody_settlement':'تسوية عهدة','salary_advance':'سلفة راتب','supplier_payment':'دفع مورد','bank_transfer':'تحويل بنكي','non_employee_advance':'سلف غير عاملين' };
    const statusMap = { 'pending_review':'إعداد','pending_approval':'انتظار مراجعة','approved':'معتمد','active':'تم التنفيذ','rejected_by_review':'مرفوض مراجعة','rejected_by_finance':'مرفوض مالية','return_requested':'مشكلة بعد الاعتماد','cancelled':'ملغي' };
    result.rows.forEach(row => {
      const party = row.employee_name || row.party_name || row.customer_name || row.supplier_name || '';
      csv += `${row.transaction_number},${row.transaction_date?new Date(row.transaction_date).toLocaleDateString('ar-EG'):''},${typeMap[row.transaction_type]||row.transaction_type},${statusMap[row.status]||row.status},${row.amount},${row.currency},${row.amount_local},${row.payment_method},"${(row.description||'').replace(/"/g,'""')}",${row.customer_name||''},${row.supplier_name||''},${party},${row.created_by_name||''},${row.created_at?new Date(row.created_at).toLocaleDateString('ar-EG'):''}\n`;
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=treasury_export.csv');
    res.send(csv);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
});

// DUPLICATE
router.post('/:id/duplicate', verifyToken, requireRole('finance','admin'), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const original = await client.query('SELECT * FROM treasury WHERE id=$1', [id]);
    if (original.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'السند غير موجود' }); }
    const t = original.rows[0];
    // FIX: توليد الرقم atomic (نفس الدالة المستخدمة في POST '/') بدل الحساب اليدوي
    // اللي كان ممكن يدي نفس الرقم لو اتنادى مرتين قريب من بعض
    const nextNumber = await generateTransactionNumber(client, t.transaction_type);
    const numericAmount = parseFloat(t.amount) || 0;
    const exchangeRate = parseFloat(t.exchange_rate) || 1;
    const amountLocal = numericAmount * exchangeRate;
    const result = await client.query(
      `INSERT INTO treasury (transaction_type,transaction_number,transaction_date,customer_id,supplier_id,employee_id,employee_name,amount,amount_local,currency,exchange_rate,payment_method,bank_name,check_number,description,expense_category_id,cost_center_id,status,created_by,bank_account_id,account_number,shipment_id,transfer_from,transfer_to,transfer_from_currency,transfer_to_currency,party_type,party_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28) RETURNING *`,
      [t.transaction_type, nextNumber, new Date(), t.customer_id, t.supplier_id, t.employee_id, t.employee_name,
       numericAmount, amountLocal, t.currency||'EGP', exchangeRate, t.payment_method, t.bank_name, t.check_number,
       `نسخة من ${t.transaction_number} - ${t.description||''}`, t.expense_category_id, t.cost_center_id,
       'active', req.user.id, t.bank_account_id, t.account_number, t.shipment_id,
       t.transfer_from, t.transfer_to, t.transfer_from_currency, t.transfer_to_currency, t.party_type, t.party_name]);
    const treasuryRecord = result.rows[0];
    // FIX: custody_payment بيدعم supplier_id
    if (t.transaction_type === 'custody_payment' && (t.employee_id || t.supplier_id)) {
      let supplierName = '';
      if (!t.employee_id && t.supplier_id) {
        const supRes = await client.query('SELECT name FROM suppliers WHERE id=$1', [t.supplier_id]);
        supplierName = supRes.rows[0]?.name || '';
      }
      const custodyResult = await client.query(
        `INSERT INTO custodies (custody_number,custody_date,employee_id,employee_name,supplier_id,supplier_name,party_type,amount,amount_local,currency,exchange_rate,payment_method,bank_name,check_number,purpose,remaining_amount,settled_amount,status,treasury_id,payment_voucher_number,created_by,created_at,shipment_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW(),$22) RETURNING *`,
        [nextNumber, new Date(), t.employee_id||null, t.employee_name||'', t.supplier_id||null, supplierName,
         t.employee_id ? 'employee' : 'service_provider', numericAmount, amountLocal, t.currency||'EGP', exchangeRate,
         t.payment_method, t.bank_name||null, t.check_number||null, t.description||null, numericAmount, 0, 'active',
         treasuryRecord.id, nextNumber, req.user.id, t.shipment_id||null]);
      await client.query(`UPDATE treasury SET custody_id=$1 WHERE id=$2`, [custodyResult.rows[0].id, treasuryRecord.id]);
    }
    if (t.transaction_type === 'non_employee_advance') {
      const custodyResult = await client.query(
        `INSERT INTO custodies (custody_number,custody_date,employee_id,employee_name,amount,amount_local,currency,exchange_rate,payment_method,bank_name,check_number,purpose,remaining_amount,settled_amount,status,treasury_id,payment_voucher_number,created_by,created_at,party_type,party_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW(),$19,$20) RETURNING *`,
        [nextNumber, new Date(), t.employee_id||null, t.employee_name||t.party_name||'', numericAmount, amountLocal, t.currency||'EGP', exchangeRate,
         t.payment_method, t.bank_name||null, t.check_number||null, t.description||null, numericAmount, 0, 'active',
         treasuryRecord.id, nextNumber, req.user.id, t.party_type||'non_employee', t.party_name||'']);
      await client.query(`UPDATE treasury SET custody_id=$1 WHERE id=$2`, [custodyResult.rows[0].id, treasuryRecord.id]);
    }
    if (t.transaction_type === 'supplier_payment' && t.supplier_id) {
      await client.query(`SELECT update_supplier_ledger($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [t.supplier_id, 'payment', treasuryRecord.id, 'treasury', nextNumber, 0, amountLocal, `نسخة من ${t.transaction_number}`, req.user.id]);
    }
    if (t.transaction_type === 'customer_payment' && t.customer_id) {
      await client.query(`SELECT update_customer_ledger($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [t.customer_id, 'payment', treasuryRecord.id, 'treasury', nextNumber, amountLocal, 0, `نسخة من ${t.transaction_number}`, req.user.id]);
    }
    await client.query('COMMIT');
    res.status(201).json({ message: `تم التكرار برقم ${nextNumber}`, data: treasuryRecord });
  } catch (err) { await client.query('ROLLBACK'); console.error('Duplicate error:', err); res.status(500).json({ message: 'Server error', error: err.message }); }
  finally { client.release(); }
});

// CREATE
router.post('/', verifyToken, requireRole('entry_accountant','finance','admin'), async (req, res) => {
  const { transaction_type, transaction_number, transaction_date, customer_id, supplier_id, employee_id, employee_name,
    amount, currency, exchange_rate, payment_method, bank_name, check_number, description, purpose,
    expense_category_id, cost_center_id, shipment_id, bank_account_id, account_number,
    transfer_from, transfer_to, transfer_from_currency, transfer_to_currency, party_type, party_name, force,
    items, custody_id, commission_amount, bank_fees
  } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const numericAmount = parseFloat(amount) || 0;
    if (numericAmount <= 0) return res.status(400).json({ message: 'المبلغ يجب أن يكون أكبر من صفر' });
    // FIX: تسوية/رد عهدة يدوي لازم يكون مربوط بعهدة موجودة فعلاً
    if (['custody_settlement', 'custody_return'].includes(transaction_type) && !custody_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'لازم تختار الموظف وعهدته النشطة أولاً' });
    }

    const hasItems = transaction_type === 'expense' && Array.isArray(items) && items.length > 0;
    if (hasItems) {
      const itemsSum = items.reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0);
      if (Math.abs(itemsSum - numericAmount) > 0.01) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `مجموع بنود المصروف (${itemsSum.toFixed(2)}) لازم يساوي المبلغ الكلي (${numericAmount.toFixed(2)})` });
      }
      for (const it of items) {
        if (!it.expense_category_id || !(parseFloat(it.amount) > 0)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: 'كل بند لازم يكون له نوع مصروف ومبلغ أكبر من صفر' });
        }
      }
    }

    const curr = currency || 'EGP';
    const rate = parseFloat(exchange_rate) || 1;
    const amountLocal = numericAmount * rate;
    // FIX: بنولّد الرقم الفعلي هنا atomic جوه نفس الـ transaction، مش بنستخدم
    // الرقم اللي جاي من الفرونت زي ما هو — عشان لو حصل تضارب (طلبين قريبين من
    // بعض) الرقم يتحسب صح من غير تكرار. لو الرقم مش من الأنواع اللي بيتولد لها
    // رقم تسلسلي (مثلاً تسوية عهدة بتاخد رقمها من مكان تاني) بنستخدم اللي جاي.
    const finalTransactionNumber = TYPE_PREFIX_MAP[transaction_type]
      ? await generateTransactionNumber(client, transaction_type)
      : (transaction_number || await generateTransactionNumber(client, transaction_type));
    // FIX: canSkipWorkflow بيدعم skip_workflow
    const skip = canSkipWorkflow(req.user.role, req.body.skip_workflow);
    const initialStatus = skip ? 'active' : 'pending_review';
    if (skip && OUT_TYPES.includes(transaction_type)) {
      const check = await checkBalance(client, payment_method, numericAmount, curr, force);
      if (!check.ok) { await client.query('ROLLBACK'); return res.status(400).json({ message: check.message, code: 'INSUFFICIENT_BALANCE', available: check.available, required: check.required }); }
    }
    if (skip && transaction_type === 'bank_transfer') {
      const check = await checkBalance(client, payment_method, numericAmount, curr, force, transaction_type, transfer_from, transfer_from_currency);
      if (!check.ok) { await client.query('ROLLBACK'); return res.status(400).json({ message: check.message, code: 'INSUFFICIENT_BALANCE', available: check.available, required: check.required }); }
    }
    // FIX: employee check على employees table مش users
    let treasuryEmployeeId = employee_id || null;
    if (employee_id) { try { const empCheck = await client.query('SELECT id FROM employees WHERE id=$1', [employee_id]); if (empCheck.rows.length === 0) treasuryEmployeeId = null; } catch (e) { treasuryEmployeeId = null; } }
    // FIX: نتأكد إن العهدة دي فعلاً بتاعة نفس الموظف قبل ما نربطها
    let linkedCustodyId = null;
    if (['custody_settlement', 'custody_return'].includes(transaction_type) && custody_id) {
      const custodyCheck = await client.query('SELECT id FROM custodies WHERE id=$1 AND employee_id=$2', [custody_id, treasuryEmployeeId]);
      if (custodyCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'العهدة المختارة لا تخص هذا الموظف' });
      }
      linkedCustodyId = custody_id;
    }
    const treasuryResult = await client.query(
      `INSERT INTO treasury (transaction_type,transaction_number,transaction_date,customer_id,supplier_id,employee_id,employee_name,amount,amount_local,currency,exchange_rate,payment_method,bank_name,check_number,description,expense_category_id,cost_center_id,status,created_by,bank_account_id,account_number,shipment_id,transfer_from,transfer_to,transfer_from_currency,transfer_to_currency,party_type,party_name,custody_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29) RETURNING *`,
      [transaction_type, finalTransactionNumber, transaction_date||new Date(), customer_id||null, supplier_id||null, treasuryEmployeeId, employee_name || '',
       numericAmount, amountLocal, curr, rate, payment_method, bank_name||null, check_number||null,
       description||purpose||null, expense_category_id||null, cost_center_id||null,
       initialStatus, req.user.id, bank_account_id||null, account_number||null, shipment_id||null,
       transfer_from||null, transfer_to||null, transfer_from_currency||null, transfer_to_currency||null, party_type||null, party_name||null, linkedCustodyId]);
    const treasuryRecord = treasuryResult.rows[0];

    if (hasItems) {
      let sortOrder = 0;
      for (const it of items) {
        await client.query(
          `INSERT INTO treasury_items (treasury_id, expense_category_id, cost_center_id, description, amount, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [treasuryRecord.id, it.expense_category_id, it.cost_center_id || null, it.description || null, parseFloat(it.amount), sortOrder++]
        );
      }
    }

    if (initialStatus === 'active') {
      await applyFundMovementEffects(client, treasuryRecord, {
        transaction_type, transaction_number: finalTransactionNumber, transaction_date, employee_id: treasuryEmployeeId, employee_name,
        numericAmount, amountLocal, curr, rate, payment_method, bank_name, check_number, purpose, description,
        supplier_id, customer_id, shipment_id, transfer_from, transfer_to, party_type, party_name, custody_id: linkedCustodyId
      }, req.user.id);
    }

    // ═══ عمولة ومصاريف البنك على تحويل مرتبط بشحنة: بتتسجل تلقائيًا كمصروف شحنة ═══
    // (نفس فكرة "استدعاء مصروف" بس هنا التسجيل بيحصل فورًا لحظة التحويل نفسه بدل ما تستنى تربطها لاحقًا)
    const commissionTotal = (parseFloat(commission_amount) || 0) + (parseFloat(bank_fees) || 0);
    if (transaction_type === 'bank_transfer' && shipment_id && commissionTotal > 0) {
      await client.query(
        `INSERT INTO shipment_expenses (
          shipment_id, expense_date, expense_type, description,
          amount_egp, amount_usd, amount_eur, amount_other, exchange_rate_usd, exchange_rate_eur, exchange_rate_other,
          total_egp, treasury_id, has_tax_invoice, notes, payment_method, created_by
        ) VALUES ($1, $2, 'عمولة ومصاريف بنك', $3, $4, 0, 0, 0, 0, 0, 0, $4, $5, false, $6, 'bank', $7)`,
        [
          shipment_id,
          transaction_date || new Date(),
          `عمولة/مصاريف تحويل بنكي ${finalTransactionNumber}`,
          commissionTotal,
          treasuryRecord.id,
          `عمولة: ${parseFloat(commission_amount) || 0} + مصاريف بنك: ${parseFloat(bank_fees) || 0} — تحويل ${finalTransactionNumber}`,
          req.user.id
        ]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ message: skip ? 'تم إنشاء السند بنجاح' : 'تم الإنشاء وإرساله للمراجعة', data: treasuryRecord });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating:', err);
    if (err.code === '23505') {
      return res.status(409).json({ message: 'رقم السند اتكرر — جرب تاني', error: err.detail });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
  finally { client.release(); }
});

// UPDATE
router.put('/:id', verifyToken, requireRole('entry_accountant','finance','admin'), async (req, res) => {
  const { transaction_type, transaction_number, transaction_date, customer_id, supplier_id, employee_id, employee_name,
    amount, currency, exchange_rate, payment_method, bank_name, check_number, description, purpose,
    expense_category_id, cost_center_id, bank_account_id, account_number,
    transfer_from, transfer_to, transfer_from_currency, transfer_to_currency, party_type, party_name, force,
    items
  } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM treasury WHERE id=$1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'السند غير موجود' });
    const oldRecord = existing.rows[0];
    if (req.user.role === 'entry_accountant') {
      const editableStatuses = ['pending_review','rejected_by_review','rejected_by_finance'];
      if (!editableStatuses.includes(oldRecord.status) || oldRecord.created_by !== req.user.id) {
        await client.query('ROLLBACK'); return res.status(403).json({ message: 'لا يمكنك التعديل في هذه الحالة' });
      }
    }
    const isResubmit = req.user.role === 'entry_accountant' && ['rejected_by_review','rejected_by_finance'].includes(oldRecord.status);
    const numericAmount = parseFloat(amount) || 0;
    if (numericAmount <= 0) return res.status(400).json({ message: 'المبلغ يجب أن يكون أكبر من صفر' });

    const hasItems = transaction_type === 'expense' && Array.isArray(items) && items.length > 0;
    if (hasItems) {
      const itemsSum = items.reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0);
      if (Math.abs(itemsSum - numericAmount) > 0.01) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `مجموع بنود المصروف (${itemsSum.toFixed(2)}) لازم يساوي المبلغ الكلي (${numericAmount.toFixed(2)})` });
      }
    }

    const curr = currency || oldRecord.currency || 'EGP';
    const rate = parseFloat(exchange_rate) || parseFloat(oldRecord.exchange_rate) || 1;
    const amountLocal = numericAmount * rate;
    // FIX: custody_settlement أضيف في outTypes
    const outTypes = ['customer_refund','expense','other_outcome','custody_payment','salary_advance','supplier_payment','non_employee_advance','custody_settlement','partner_payment'];
    if (oldRecord.status === 'active' && outTypes.includes(transaction_type)) {
      const oldAmount = parseFloat(oldRecord.amount) || 0;
      const amountDiff = numericAmount - oldAmount;
      if (amountDiff > 0 && payment_method === oldRecord.payment_method && curr === oldRecord.currency) {
        const check = await checkBalance(client, payment_method, amountDiff, curr, force);
        if (!check.ok) { await client.query('ROLLBACK'); return res.status(400).json({ message: check.message, code: 'INSUFFICIENT_BALANCE', available: check.available, required: check.required }); }
      } else if (payment_method !== oldRecord.payment_method || curr !== oldRecord.currency) {
        const check = await checkBalance(client, payment_method, numericAmount, curr, force);
        if (!check.ok) { await client.query('ROLLBACK'); return res.status(400).json({ message: check.message, code: 'INSUFFICIENT_BALANCE', available: check.available, required: check.required }); }
      }
    }
    if (oldRecord.status === 'active' && transaction_type === 'bank_transfer') {
      const check = await checkBalance(client, payment_method, numericAmount, curr, force, transaction_type, transfer_from, transfer_from_currency);
      if (!check.ok) { await client.query('ROLLBACK'); return res.status(400).json({ message: check.message, code: 'INSUFFICIENT_BALANCE', available: check.available, required: check.required }); }
    }
    // FIX: employee check على employees table مش users
    let treasuryEmployeeId = employee_id || null;
    if (employee_id) { try { const empCheck = await client.query('SELECT id FROM employees WHERE id=$1', [employee_id]); if (empCheck.rows.length === 0) treasuryEmployeeId = null; } catch (e) { treasuryEmployeeId = null; } }
    const result = await client.query(
      `UPDATE treasury SET
        transaction_type=$1,transaction_number=$2,transaction_date=$3,customer_id=$4,supplier_id=$5,employee_id=$6,employee_name=$7,
        amount=$8,amount_local=$9,currency=$10,exchange_rate=$11,payment_method=$12,bank_name=$13,check_number=$14,
        description=$15,expense_category_id=$16,cost_center_id=$17,bank_account_id=$18,account_number=$19,
        transfer_from=$22,transfer_to=$23,transfer_from_currency=$24,transfer_to_currency=$25,party_type=$26,party_name=$27,
        status=CASE WHEN $21 THEN 'pending_review' ELSE status END,
        reviewed_by=CASE WHEN $21 THEN NULL ELSE reviewed_by END,
        reviewed_at=CASE WHEN $21 THEN NULL ELSE reviewed_at END,
        approved_by=CASE WHEN $21 THEN NULL ELSE approved_by END,
        approved_at=CASE WHEN $21 THEN NULL ELSE approved_at END,
        rejection_reason=CASE WHEN $21 THEN NULL ELSE rejection_reason END,
        return_reason=CASE WHEN $21 THEN NULL ELSE return_reason END,
        updated_at=NOW()
      WHERE id=$20 RETURNING *`,
      [transaction_type, transaction_number, transaction_date||new Date(), customer_id||null, supplier_id||null, treasuryEmployeeId, employee_name || '',
       numericAmount, amountLocal, curr, rate, payment_method, bank_name||null, check_number||null,
       description||purpose||null, expense_category_id||null, cost_center_id||null, bank_account_id||null, account_number||null,
       req.params.id, isResubmit, transfer_from||null, transfer_to||null, transfer_from_currency||null, transfer_to_currency||null, party_type||null, party_name||null]);

    await client.query('DELETE FROM treasury_items WHERE treasury_id = $1', [req.params.id]);
    if (hasItems) {
      let sortOrder = 0;
      for (const it of items) {
        await client.query(
          `INSERT INTO treasury_items (treasury_id, expense_category_id, cost_center_id, description, amount, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [req.params.id, it.expense_category_id, it.cost_center_id || null, it.description || null, parseFloat(it.amount), sortOrder++]
        );
      }
    }

    if (oldRecord.custody_id) {
      await client.query(
        `UPDATE custodies SET custody_number=$1,custody_date=$2,employee_id=$3,employee_name=$4,amount=$5,amount_local=$6,currency=$7,exchange_rate=$8,payment_method=$9,bank_name=$10,check_number=$11,purpose=$12,remaining_amount=$13,party_type=$14,party_name=$15 WHERE id=$16`,
        [transaction_number, transaction_date||new Date(), treasuryEmployeeId, employee_name||'', numericAmount, amountLocal, curr, rate,
         payment_method, bank_name||null, check_number||null, purpose||description||null, numericAmount, party_type||null, party_name||null, oldRecord.custody_id]);
    }
    if (oldRecord.transaction_type === 'supplier_payment' && oldRecord.supplier_id) {
      const oldAmountLocal = parseFloat(oldRecord.amount_local) || 0;
      await client.query(`SELECT update_supplier_ledger($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [oldRecord.supplier_id, 'adjustment', oldRecord.id, 'treasury', oldRecord.transaction_number, oldAmountLocal, 0, 'عكس سند قديم - تعديل', req.user.id]);
    }
    if (transaction_type === 'supplier_payment' && supplier_id) {
      await client.query(`SELECT update_supplier_ledger($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [supplier_id, 'payment', req.params.id, 'treasury', transaction_number, 0, amountLocal, description, req.user.id]);
    }
    if (oldRecord.transaction_type === 'customer_payment' && oldRecord.customer_id) {
      const oldAmountLocal = parseFloat(oldRecord.amount_local) || 0;
      await client.query(`SELECT update_customer_ledger($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [oldRecord.customer_id, 'adjustment', oldRecord.id, 'treasury', oldRecord.transaction_number, 0, oldAmountLocal, 'عكس سند قديم - تعديل', req.user.id]);
    }
    if (transaction_type === 'customer_payment' && customer_id) {
      await client.query(`SELECT update_customer_ledger($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [customer_id, 'payment', req.params.id, 'treasury', transaction_number, amountLocal, 0, description, req.user.id]);
    }
    await client.query('COMMIT');
    res.json({ message: 'تم التعديل بنجاح', data: result.rows[0] });
  } catch (err) { await client.query('ROLLBACK'); console.error('Error updating:', err); res.status(500).json({ message: 'Server error', error: err.message }); }
  finally { client.release(); }
});

// DELETE
router.delete('/:id', verifyToken, requireRole('entry_accountant','finance','admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM treasury WHERE id=$1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'السند غير موجود' });
    const oldRecord = existing.rows[0];
    if (req.user.role === 'entry_accountant') {
      if (oldRecord.status !== 'pending_review' || oldRecord.created_by !== req.user.id) {
        await client.query('ROLLBACK'); return res.status(403).json({ message: 'لا يمكنك الحذف في هذه الحالة' });
      }
    }
    // FIX: حذف سند تسوية/رد عهدة (custody_settlement / custody_return) لازم يرجع التسوية الأساسية
    // بدل ما يلغي العهدة بالكامل — بيفك التسوية، يرجع بنودها من مراكز التكلفة، ويرجع
    // التقديم (submission) لحالة "معتمد" تاني عشان المالية تقدر تسوّيه من جديد.
    if (['custody_settlement', 'custody_return'].includes(oldRecord.transaction_type) && oldRecord.custody_id) {
      // FIX: مسموح تحذف سند التسوية في أي مرحلة (إعداد/مراجعة/اعتماد/حتى بعد الصرف)
      // ما عدا لو كان اتلغى قبل كده. حساب الخزينة بيتحسب لحظيًا من السجلات status='active'،
      // فحذف سند نشط بيرجع الرصيد لوضعه صح تلقائيًا من غير ما نلمس أي جدول تاني.
      if (oldRecord.status === 'cancelled') {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'السند اتلغى بالفعل' });
      }

      const submissionId = oldRecord.submission_id;
      if (submissionId) {
        // نرجع كل بنود التسوية المرتبطة بالتقديم ده من مراكز التكلفة
        const settlementRows = await client.query(
          `SELECT * FROM custody_settlements WHERE submission_id = $1`,
          [submissionId]
        );
        for (const row of settlementRows.rows) {
          if (row.cost_center_id) {
            await client.query(
              `UPDATE cost_centers 
               SET spent_amount = spent_amount - $1,
                   remaining_budget = budget_amount - (spent_amount - $1),
                   updated_at = NOW()
               WHERE id = $2`,
              [row.amount, row.cost_center_id]
            );
          }
        }
        // نحذف قيود التسوية نفسها
        await client.query(`DELETE FROM custody_settlements WHERE submission_id = $1`, [submissionId]);

        // نرجع العهدة لحالتها قبل التسوية (remaining_amount اللي كان قبل ما نعمل التسوية)
        const remainingBefore = oldRecord.custody_remaining_before !== null && oldRecord.custody_remaining_before !== undefined
          ? parseFloat(oldRecord.custody_remaining_before)
          : null;

        const custodyRes = await client.query('SELECT amount, settled_amount FROM custodies WHERE id = $1', [oldRecord.custody_id]);
        const custodyAmount = parseFloat(custodyRes.rows[0]?.amount || 0);
        const currentSettled = parseFloat(custodyRes.rows[0]?.settled_amount || 0);
        const submissionRes = await client.query('SELECT total_amount FROM custody_submissions WHERE id = $1', [submissionId]);
        const settlementTotal = parseFloat(submissionRes.rows[0]?.total_amount || 0);

        const newRemaining = remainingBefore !== null ? remainingBefore : custodyAmount;
        const newSettled = Math.max(0, currentSettled - settlementTotal);
        const newStatus = newRemaining > 0 ? (newRemaining < custodyAmount ? 'partially_settled' : 'active') : 'active';

        await client.query(
          `UPDATE custodies SET remaining_amount = $1, settled_amount = $2, status = $3, updated_at = NOW() WHERE id = $4`,
          [newRemaining, newSettled, newStatus, oldRecord.custody_id]
        );

        // نرجع التقديم لحالة "معتمد" تاني عشان يترفع للمالية من جديد
        await client.query(
          `UPDATE custody_submissions SET status = 'approved', settled_at = NULL, updated_at = NOW() WHERE id = $1`,
          [submissionId]
        );
      } else if (oldRecord.custody_id && oldRecord.status === 'active') {
        // سند تسوية/رد عهدة مُدخل يدويًا من الخزينة (مش ناتج عن تقديم تسوية) —
        // بيرجع رصيد العهدة بس لو السند كان اتصرف فعلاً (active)، لأن العهدة
        // بتتحدث بس وقت التنفيذ. لو لسه إعداد/مراجعة/اعتماد، العهدة أصلاً ما اتلمستش.
        const amt = parseFloat(oldRecord.amount) || 0;
        const custodyRes = await client.query('SELECT amount, remaining_amount, settled_amount FROM custodies WHERE id = $1', [oldRecord.custody_id]);
        if (custodyRes.rows.length > 0) {
          const c = custodyRes.rows[0];
          const custodyAmount = parseFloat(c.amount) || 0;
          const newRemaining = Math.min(custodyAmount, (parseFloat(c.remaining_amount) || 0) + amt);
          const newSettled = Math.max(0, (parseFloat(c.settled_amount) || 0) - amt);
          const newStatus = newRemaining >= custodyAmount ? 'active' : (newRemaining > 0 ? 'partially_settled' : 'fully_settled');
          await client.query(
            `UPDATE custodies SET remaining_amount = $1, settled_amount = $2, status = $3, updated_at = NOW() WHERE id = $4`,
            [newRemaining, newSettled, newStatus, oldRecord.custody_id]
          );
        }
      }

      await client.query('DELETE FROM treasury WHERE id=$1', [req.params.id]);
      await client.query('COMMIT');
      return res.json({ message: 'تم حذف سند التسوية وإرجاع رصيد العهدة' });
    }

    // FIX: soft delete للـ custody بدل hard delete
    // FIX: soft delete للـ custody + فك الارتباط بـ treasury_id
    // FIX: لازم نغيّر custody_number وقت الحذف — لو سبنا الرقم زي ما هو،
    // هيفضل "محجوز" للأبد في custodies حتى بعد ما treasury row نفسه يتمسح،
    // فأي سند جديد ياخد نفس الرقم بعدين هيصطدم بيه وقت التنفيذ (execute)
if (oldRecord.custody_id) {
  await client.query(
    `UPDATE custodies SET status='cancelled', remaining_amount=0, settled_amount=amount,
     treasury_id=NULL, custody_number = custody_number || '-DEL-' || id WHERE id=$1`,
    [oldRecord.custody_id]
  );
}
    if (oldRecord.transaction_type === 'supplier_payment' && oldRecord.supplier_id) {
      const oldAmountLocal = parseFloat(oldRecord.amount_local) || 0;
      await client.query(`SELECT update_supplier_ledger($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [oldRecord.supplier_id, 'adjustment', oldRecord.id, 'treasury', oldRecord.transaction_number, oldAmountLocal, 0, 'حذف سند', req.user.id]);
    }
    if (oldRecord.transaction_type === 'customer_payment' && oldRecord.customer_id) {
      const oldAmountLocal = parseFloat(oldRecord.amount_local) || 0;
      await client.query(`SELECT update_customer_ledger($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [oldRecord.customer_id, 'adjustment', oldRecord.id, 'treasury', oldRecord.transaction_number, 0, oldAmountLocal, 'حذف سند', req.user.id]);
    }
    await client.query('DELETE FROM treasury WHERE id=$1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ message: 'تم الحذف بنجاح' });
  } catch (err) { await client.query('ROLLBACK'); console.error('Error deleting:', err); res.status(500).json({ message: 'Server error', error: err.message }); }
  finally { client.release(); }
});

// ═══════════════════════════════════════════════════════════════
// PDF — بيفتح نفس صفحة الطباعة في متصفح مخفي (Puppeteer) ويحوّلها PDF
// ═══════════════════════════════════════════════════════════════
const puppeteer = require('puppeteer');
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';

async function renderPageToPdf(url) {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForTimeout(500);
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '15mm', bottom: '15mm', left: '10mm', right: '10mm' } });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

router.get('/:id/pdf', verifyToken, async (req, res) => {
  try {
    const url = `${FRONTEND_BASE_URL}/treasury/${req.params.id}/print?token=${encodeURIComponent(req.headers.authorization?.split(' ')[1] || '')}`;
    const pdfBuffer = await renderPageToPdf(url);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="voucher-${req.params.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ message: 'تعذر توليد ملف PDF', error: err.message });
  }
});

router.get('/report/statement/pdf', verifyToken, async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const token = req.headers.authorization?.split(' ')[1] || '';
    const url = `${FRONTEND_BASE_URL}/treasury/print-statement?${qs}&token=${encodeURIComponent(token)}`;
    const pdfBuffer = await renderPageToPdf(url);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="statement.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ message: 'تعذر توليد ملف PDF', error: err.message });
  }
});

const xlsx = require('xlsx');

// ═══════════════════════════════════════════════════════════════
// EXCEL IMPORT / TEMPLATE
// ═══════════════════════════════════════════════════════════════

router.get('/import/template', verifyToken, async (req, res) => {
  try {
    const wb = xlsx.utils.book_new();
    const headers = [
      'transaction_type','transaction_number','transaction_date','amount','currency',
      'exchange_rate','payment_method','bank_name','check_number','description',
      'employee_id','supplier_id','customer_id','cost_center_id','expense_category_id',
      'transfer_from','transfer_to','party_type','party_name'
    ];
    const exampleRows = [
      ['expense','','2026-08-02',1000,'EGP',1,'cash','','','مصاريف بوفيه ونظافة','','','','','','','','other',''],
      ['supplier_payment','','2026-08-02',5000,'EGP',1,'bank','CIB','','دفع مورد خامات','','5','','','','','','',''],
      ['salary_advance','','2026-08-02',2000,'EGP',1,'cash','','','سلفة موظف','3','','','','','','','employee','']
    ];
    const ws1 = xlsx.utils.aoa_to_sheet([headers, ...exampleRows]);
    xlsx.utils.book_append_sheet(wb, ws1, 'Treasury');
    const itemHeaders = ['row_index','description','amount','expense_category_id','cost_center_id'];
    const itemExample = [
      [1,'بوفيه - عمومية وإدارية',500,2,1],
      [1,'نظافة - تشغيلية',200,3,2],
      [1,'بوفيه - تسويقية',100,2,3]
    ];
    const ws2 = xlsx.utils.aoa_to_sheet([itemHeaders, ...itemExample]);
    xlsx.utils.book_append_sheet(wb, ws2, 'Items');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=treasury_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
});

router.post('/import', verifyToken, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'اختر ملف Excel' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const wb = xlsx.readFile(req.file.path);
    const ws = wb.Sheets['Treasury'] || wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws);
    const wsItems = wb.Sheets['Items'] || (wb.SheetNames[1] ? wb.Sheets[wb.SheetNames[1]] : null);
    const itemRows = wsItems ? xlsx.utils.sheet_to_json(wsItems) : [];
    const results = { imported: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const type = row.transaction_type;
        if (!type) throw new Error('نوع السند مطلوب');
        // FIX: توليد الرقم atomic بنفس دالة POST '/' بدل الحساب اليدوي
        const nextNumber = await generateTransactionNumber(client, type);
        const amount = parseFloat(row.amount) || 0;
        if (amount <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر');
        const curr = row.currency || 'EGP';
        const rate = parseFloat(row.exchange_rate) || 1;
        const amountLocal = amount * rate;
        const date = row.transaction_date ? new Date(row.transaction_date) : new Date();
        const rowItems = itemRows.filter(it => parseInt(it.row_index) === (i + 1))
          .map(it => ({
            expense_category_id: it.expense_category_id ? parseInt(it.expense_category_id) : null,
            cost_center_id: it.cost_center_id ? parseInt(it.cost_center_id) : null,
            description: it.description || '',
            amount: parseFloat(it.amount) || 0
          })).filter(it => it.amount > 0);
        if (type === 'expense' && rowItems.length > 0) {
          const totalItems = rowItems.reduce((s, it) => s + it.amount, 0);
          if (Math.abs(totalItems - amount) > 0.01) throw new Error(`مجموع البنود (${totalItems}) لا يساوي المبلغ (${amount})`);
        }
        const tResult = await client.query(
          `INSERT INTO treasury (transaction_type,transaction_number,transaction_date,amount,amount_local,currency,exchange_rate,payment_method,bank_name,check_number,description,employee_id,supplier_id,customer_id,cost_center_id,expense_category_id,transfer_from,transfer_to,party_type,party_name,status,created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`,
          [type, nextNumber, date, amount, amountLocal, curr, rate, row.payment_method||'cash', row.bank_name||null, row.check_number||null,
           row.description||'', row.employee_id ? parseInt(row.employee_id) : null, row.supplier_id ? parseInt(row.supplier_id) : null,
           row.customer_id ? parseInt(row.customer_id) : null, row.cost_center_id ? parseInt(row.cost_center_id) : null,
           row.expense_category_id ? parseInt(row.expense_category_id) : null, row.transfer_from||null, row.transfer_to||null,
           row.party_type||'employee', row.party_name||'', 'active', req.user.id]
        );
        if (type === 'expense' && rowItems.length > 0) {
          for (const it of rowItems) {
            await client.query(
              `INSERT INTO treasury_items (treasury_id,expense_category_id,cost_center_id,description,amount,sort_order)
               VALUES ($1,$2,$3,$4,$5,$6)`,
              [tResult.rows[0].id, it.expense_category_id, it.cost_center_id, it.description, it.amount, 0]);
          }
        }
        if (['custody_payment','non_employee_advance'].includes(type)) {
          await client.query(
            `INSERT INTO custodies (custody_number,custody_date,employee_id,employee_name,amount,amount_local,currency,exchange_rate,payment_method,bank_name,check_number,purpose,remaining_amount,settled_amount,status,treasury_id,payment_voucher_number,created_by,created_at,party_type,party_name)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW(),$19,$20)`,
            [nextNumber, date, row.employee_id ? parseInt(row.employee_id) : null, row.party_name||'',
             amount, amountLocal, curr, rate, row.payment_method||'cash', row.bank_name||null, row.check_number||null,
             row.description||'', amount, 0, 'active', tResult.rows[0].id, nextNumber, req.user.id,
             row.party_type||'non_employee', row.party_name||'']);
        }
        if (type === 'supplier_payment' && row.supplier_id) {
          await client.query(`SELECT update_supplier_ledger($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [parseInt(row.supplier_id), 'payment', tResult.rows[0].id, 'treasury', nextNumber, 0, amountLocal, row.description||'', req.user.id]);
        }
        if (type === 'customer_payment' && row.customer_id) {
          await client.query(`SELECT update_customer_ledger($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [parseInt(row.customer_id), 'payment', tResult.rows[0].id, 'treasury', nextNumber, amountLocal, 0, row.description||'', req.user.id]);
        }
        results.imported++;
      } catch (err) { results.errors.push({ row: i+2, message: err.message }); }
    }
    await client.query('COMMIT');
    res.json({ message: `تم استيراد ${results.imported} من ${rows.length} سند`, ...results });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ message: 'Server error', error: err.message }); }
  finally { client.release(); if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); }
});

module.exports = router;
