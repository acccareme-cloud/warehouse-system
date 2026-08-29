const express = require('express');
const multer = require('multer');
const path = require('path');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/attachments/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF allowed.'));
    }
  }
});

router.post('/upload', verifyToken, upload.single('file'), async (req, res) => {
  try {
    const { reference_type, reference_id, description } = req.body;
    
    const result = await pool.query(`
      INSERT INTO attachments (reference_type, reference_id, file_name, file_path, file_type, description, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      reference_type, reference_id,
      req.file.originalname, req.file.path, req.file.mimetype,
      description, req.user.id
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/:reference_type/:reference_id', verifyToken, async (req, res) => {
  const { reference_type, reference_id } = req.params;
  try {
    const result = await pool.query(`
      SELECT a.*, u.full_name as uploaded_by_name
      FROM attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.reference_type = $1 AND a.reference_id = $2
      ORDER BY a.created_at DESC
    `, [reference_type, reference_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;