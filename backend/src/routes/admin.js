const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

// Helper: جلب أسماء أعمدة الجدول
async function getTableColumns(tableName) {
  const result = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = $1 AND table_schema = 'public'
  `, [tableName]);
  return result.rows.map(r => r.column_name);
}

// Helper: جلب الـ valid roles
async function getValidRoles() {
  try {
    const result = await pool.query(`
      SELECT pg_get_constraintdef(oid) as def
      FROM pg_constraint 
      WHERE conrelid = 'users'::regclass AND contype = 'c' AND conname LIKE '%role%'
    `);
    if (result.rows.length > 0) {
      const def = result.rows[0].def;
      const match = def.match(/ARRAY\[(.*?)\]/);
      if (match) {
        return match[1].split(',').map(r => r.replace(/::character varying|::text|'/g, '').trim());
      }
    }
    return ['admin', 'purchasing', 'storekeeper', 'finance', 'quality', 'maintenance','entry_accountant','review_accountant','treasury_accountant' ];
  } catch (e) {
    return ['admin', 'purchasing', 'storekeeper', 'finance', 'quality', 'maintenance','entry_accountant','review_accountant','treasury_accountant'];
  }
}

// ============================================
// Database Backup
// ============================================
router.get('/backup', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    let backupSQL = `-- Backup generated at ${new Date().toISOString()}\n\n`;

    for (const table of tablesResult.rows) {
      const tableName = table.table_name;
      const dataResult = await pool.query(`SELECT * FROM "${tableName}"`);

      if (dataResult.rows.length > 0) {
        backupSQL += `\n-- Table: ${tableName}\n`;
        for (const row of dataResult.rows) {
          const columns = Object.keys(row).join(', ');
          const values = Object.values(row).map(v => {
            if (v === null) return 'NULL';
            if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
            if (v instanceof Date) return `'${v.toISOString()}'`;
            return v;
          }).join(', ');
          backupSQL += `INSERT INTO "${tableName}" (${columns}) VALUES (${values});\n`;
        }
      }
    }

    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="backup_${new Date().toISOString().split('T')[0]}.sql"`);
    res.send(backupSQL);
  } catch (err) {
    res.status(500).json({ message: 'Backup failed', error: err.message });
  }
});

// ============================================
// Full Program Backup
// ============================================
// ============================================
// Full Program Backup (FIXED - لا يقع أبداً)
// ============================================
router.get('/backup-full', verifyToken, requireRole('admin'), async (req, res) => {
  let backupDir = null;
  let zipFile = null;

  try {
    const { spawn } = require('child_process');
    

        const timestamp = new Date().toISOString().split('T')[0] + '_' + Date.now();
    const projectRoot = path.join(__dirname, '..', '..', '..');  // ← warehouse-system/
    backupDir = path.join(projectRoot, `backup_${timestamp}`);
    zipFile = `${backupDir}.zip`;

    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    // ─── 1. نسخ Backend ───
    const backendSrc = path.join(projectRoot, 'backend');  // ← صح
    if (fs.existsSync(backendSrc)) {
      copyFolderSync(backendSrc, path.join(backupDir, 'backend'));
    }

    // ─── 2. نسخ Frontend ───
    const frontendSrc = path.join(projectRoot, 'frontend');  // ← صح
    if (fs.existsSync(frontendSrc)) {
      copyFolderSync(frontendSrc, path.join(backupDir, 'frontend'));
    }
    // ─── 3. نسخ Database ───
    const dbBackupPath = path.join(backupDir, 'database_backup.sql');
    let pgDumpWorked = false;

    // أولاً: جرّب pg_dump
    await new Promise((resolve, reject) => {
      const env = { ...process.env };
      if (process.env.DB_PASSWORD) env.PGPASSWORD = process.env.DB_PASSWORD;

      const pgDump = spawn('pg_dump', [
        '-h', process.env.DB_HOST || 'localhost',
        '-p', process.env.DB_PORT || '5432',
        '-U', process.env.DB_USER || 'postgres',
        '-d', process.env.DB_NAME || 'warehouse_db'
      ], { env });

      const writeStream = fs.createWriteStream(dbBackupPath);
      pgDump.stdout.pipe(writeStream);

      let errorOutput = '';
      pgDump.stderr.on('data', (data) => { errorOutput += data.toString(); });

      // ⚠️ ده السطر اللي كان ناقص — بيمنع الـ Crash
      pgDump.on('error', (err) => {
        reject(err); // pg_dump مش موجود
      });

      pgDump.on('close', (code) => {
        if (code === 0) {
          pgDumpWorked = true;
          resolve();
        } else {
          reject(new Error(`pg_dump exit ${code}: ${errorOutput}`));
        }
      });
    }).catch(() => { pgDumpWorked = false; });

    // لو pg_dump فشل، استخدم الطريقة اليدوية (نفس /backup)
    if (!pgDumpWorked) {
      const tablesResult = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      let backupSQL = `-- Backup generated at ${new Date().toISOString()}\n`;
      backupSQL += `-- NOTE: pg_dump not found, using manual backup\n\n`;

      for (const table of tablesResult.rows) {
        const tableName = table.table_name;
        const dataResult = await pool.query(`SELECT * FROM "${tableName}"`);
        if (dataResult.rows.length > 0) {
          backupSQL += `\n-- Table: ${tableName}\n`;
          for (const row of dataResult.rows) {
            const columns = Object.keys(row).join(', ');
            const values = Object.values(row).map(v => {
              if (v === null) return 'NULL';
              if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
              if (v instanceof Date) return `'${v.toISOString()}'`;
              return v;
            }).join(', ');
            backupSQL += `INSERT INTO "${tableName}" (${columns}) VALUES (${values});\n`;
          }
        }
      }
      fs.writeFileSync(dbBackupPath, backupSQL);
    }

    // ─── 4. ضغط كل حاجة ───
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipFile);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      archive.on('error', reject);
      archive.on('warning', (err) => { if (err.code !== 'ENOENT') reject(err); });

      archive.pipe(output);
      archive.directory(backupDir, false);
      archive.finalize();
    });

    // ─── 5. إرسال الملف ───
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="warehouse_backup_${timestamp}.zip"`);
    
    const fileStream = fs.createReadStream(zipFile);
    fileStream.pipe(res);

    // امسح الملفات المؤقتة بعد الإرسال
    fileStream.on('close', () => {
      setTimeout(() => {
        try { if (backupDir) fs.rmSync(backupDir, { recursive: true, force: true }); } catch(e) {}
        try { if (zipFile) fs.unlinkSync(zipFile); } catch(e) {}
      }, 30000);
    });

  } catch (err) {
    console.error('Full backup error:', err);
    
    // امسح الملفات المؤقتة لو حصل خطأ
    try { if (backupDir) fs.rmSync(backupDir, { recursive: true, force: true }); } catch(e) {}
    try { if (zipFile) fs.unlinkSync(zipFile); } catch(e) {}

    if (!res.headersSent) {
      res.status(500).json({ message: 'Backup failed: ' + err.message });
    }
  }
});

function copyFolderSync(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
        copyFolderSync(srcPath, destPath);
      }
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ============================================
// Reset Database - لا يصفر المستخدمين والصلاحيات
// ============================================
router.post('/reset-database', verifyToken, requireRole('admin'), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SET session_replication_role = replica');

    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    // ✅ استبعد المستخدمين والصلاحيات والموظفين والأقسام
    const excludeTables = [
      'users',              // ← لا تمسح المستخدمين
      'roles',              // ← لا تمسح الصلاحيات
      'employees',          // ← لا تمسح الموظفين
      'departments',        // ← لا تمسح الأقسام
      'sections',           // ← لا تمسح الأقسام الفرعية
      'migrations',         // ← لا تمسح المigrations
      'sequelizemeta'       // ← لا تمسح Sequelize meta
    ];

    let resetCount = 0;

    for (const table of tablesResult.rows) {
      const tableName = table.table_name;
      if (!excludeTables.includes(tableName)) {
        try {
          await client.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
          resetCount++;
        } catch (e) {
          console.log(`Could not truncate ${tableName}:`, e.message);
        }
      }
    }

    await client.query('SET session_replication_role = origin');
    await client.query('COMMIT');

    res.json({ 
      message: `تم تصفير ${resetCount} جدول بنجاح. المستخدمين والصلاحيات والموظفين لم يتم تصفيرها.`,
      resetTables: resetCount,
      excludedTables: excludeTables
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Reset failed', error: err.message });
  } finally {
    client.release();
  }
});

// ============================================
// Create User (FIXED)
// ============================================
router.post('/users', verifyToken, requireRole('admin'), async (req, res) => {
  const { username, password, role, full_name } = req.body;

  try {
    const columns = await getTableColumns('users');
    const validRoles = await getValidRoles();

    console.log('Valid roles:', validRoles);

    // التحقق من الـ role
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        message: `الـ role "${role}" غير مقبول. الـ roles المقبولة: ${validRoles.join(', ')}` 
      });
    }

    // التحقق من وجود username
    const usernameCol = columns.find(c => c.toLowerCase() === 'username') || 'username';
    const checkResult = await pool.query(`SELECT ${usernameCol} FROM users WHERE ${usernameCol} = $1`, [username]);
    if (checkResult.rows.length > 0) {
      return res.status(400).json({ message: 'اسم المستخدم موجود بالفعل' });
    }

    // بناء البيانات
    const userData = {};

    if (columns.includes('username')) userData.username = username;
    if (columns.includes('user_name')) userData.user_name = username;

    const passCol = columns.find(c => c.toLowerCase().includes('password')) || 
                   columns.find(c => c.toLowerCase().includes('pass')) ||
                   columns.find(c => c.toLowerCase().includes('hash'));

    if (passCol) {
      const bcrypt = require('bcryptjs');
      userData[passCol] = await bcrypt.hash(password, 10);
    }

    if (columns.includes('role')) userData.role = role;
    if (columns.includes('full_name')) userData.full_name = full_name || username;
    if (columns.includes('created_at')) userData.created_at = new Date();
    if (columns.includes('is_active')) userData.is_active = true;

    // employee_id - نبحث عن موظف موجود
    if (columns.includes('employee_id')) {
      const empResult = await pool.query('SELECT id FROM employees LIMIT 1');
      if (empResult.rows.length > 0) {
        userData.employee_id = empResult.rows[0].id;
      } else {
        // ننشئ موظف جديد
        const newEmp = await pool.query(
          `INSERT INTO employees (employee_number, full_name, national_id, phone, email, 
           address, department_id, section_id, job_title, hire_date, salary, status, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
          [
            'EMP-' + Date.now(), 
            full_name || username, 
            '12345678901234',
            '01234567890',
            username + '@system.com',
            'Headquarters',
            null, null,
            role,
            new Date().toISOString().split('T')[0],
            0,
            'active',
            new Date(),
            new Date()
          ]
        );
        userData.employee_id = newEmp.rows[0].id;
      }
    }

    const validColumns = Object.keys(userData);
    const placeholders = validColumns.map((_, i) => `$${i + 1}`).join(', ');
    const values = Object.values(userData);

    const query = `INSERT INTO users (${validColumns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await pool.query(query, values);

    res.status(201).json({ 
      message: 'تم إنشاء المستخدم بنجاح', 
      user: result.rows[0] 
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ message: 'Failed to create user', error: err.message });
  }
});

// ============================================
// Change Password
// ============================================
router.put('/users/change-password', verifyToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user.id;

  try {
    const columns = await getTableColumns('users');
    const idCol = columns.find(c => c.toLowerCase() === 'id') || 'id';
    const passCol = columns.find(c => c.toLowerCase().includes('password')) || 
                   columns.find(c => c.toLowerCase().includes('pass')) ||
                   columns.find(c => c.toLowerCase().includes('hash'));

    if (!passCol) {
      return res.status(500).json({ message: 'لم يتم العثور على عمود كلمة المرور' });
    }

    const userResult = await pool.query(`SELECT ${passCol} FROM users WHERE ${idCol} = $1`, [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    const bcrypt = require('bcryptjs');
    const validPassword = await bcrypt.compare(oldPassword, userResult.rows[0][passCol]);
    if (!validPassword) {
      return res.status(400).json({ message: 'كلمة المرور الحالية غير صحيحة' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE users SET ${passCol} = $1 WHERE ${idCol} = $2`, [hashedPassword, userId]);

    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to change password', error: err.message });
  }
});

// ============================================
// Get All Users
// ============================================
router.get('/users', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const columns = await getTableColumns('users');
    const safeColumns = columns.filter(c => !c.toLowerCase().includes('password') && !c.toLowerCase().includes('pass') && !c.toLowerCase().includes('hash'));

    const result = await pool.query(`SELECT ${safeColumns.join(', ')} FROM users ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to get users', error: err.message });
  }
});

// ============================================
// Debug: Valid Roles
// ============================================
router.get('/debug/roles', async (req, res) => {
  try {
    const validRoles = await getValidRoles();
    res.json({ validRoles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ============================================
// Admin Reset Any User's Password
// ============================================
router.put('/users/:id/reset-password', verifyToken, requireRole('admin'), async (req, res) => {
  const { newPassword } = req.body;
  const userId = req.params.id;

  try {
    const columns = await getTableColumns('users');
    const idCol = columns.find(c => c.toLowerCase() === 'id') || 'id';
    const passCol = columns.find(c => c.toLowerCase().includes('password')) || 
                   columns.find(c => c.toLowerCase().includes('pass')) ||
                   columns.find(c => c.toLowerCase().includes('hash'));

    if (!passCol) {
      return res.status(500).json({ message: 'لم يتم العثور على عمود كلمة المرور' });
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE users SET ${passCol} = $1 WHERE ${idCol} = $2`, [hashedPassword, userId]);

    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reset password', error: err.message });
  }
});

module.exports = router;
