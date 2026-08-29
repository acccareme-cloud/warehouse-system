const pool = require('../config/db');
const bcrypt = require('bcryptjs');

async function seedAll() {
  try {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    console.log('=== Starting Seed ===');
    
    // ============================================
    // 1. نمسح البيانات القديمة
    // ============================================
    console.log('1. Clearing old data...');
    await pool.query('DELETE FROM stock_movements');
    await pool.query('DELETE FROM receipt_vouchers');
    await pool.query('DELETE FROM stock');
    await pool.query('DELETE FROM items');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM warehouses');
    
    // ============================================
    // 2. نضيف الـ Admin
    // ============================================
    console.log('2. Adding Admin...');
    await pool.query(`
      INSERT INTO users (username, password_hash, full_name, role, is_active) 
      VALUES ($1, $2, $3, $4, $5)
    `, ['admin', hashedPassword, 'مدير النظام', 'admin', true]);
    
    // ============================================
    // 3. نضيف المخازن (مع code و type)
    // ============================================
    console.log('3. Adding Warehouses...');
    await pool.query('TRUNCATE TABLE warehouses RESTART IDENTITY CASCADE');

    await pool.query(`
      INSERT INTO warehouses (id, code, name, type, created_at) VALUES 
      (1, 'WH01', 'مخزن قطع غيار', 'spare_parts', NOW()),
      (2, 'WH02', 'مخزن منتج تام', 'finished_product', NOW()),
      (3, 'WH03', 'مخزن خامات', 'general', NOW())
    `);
    
    // ============================================
    // 4. نضيف الأصناف
    // ============================================
    console.log('4. Adding Items...');
    await pool.query(`
      INSERT INTO items (code, name, unit, warehouse_id, reorder_level, unit_cost, is_active, created_at) VALUES 
      ('0101', 'تجربة', 'عدد', 1, 10, 0, true, NOW()),
      ('0102', 'محرك كهربائي', 'عدد', 1, 5, 0, true, NOW()),
      ('0103', 'بطارية', 'عدد', 1, 20, 0, true, NOW())
    `);
    
    // ============================================
    // 5. نضيف الموظفين
    // ============================================
    console.log('5. Adding Users...');
    const users = [
      { username: 'purchasing1', full_name: 'أحمد محمد - مشتريات', role: 'purchasing' },
      { username: 'finance1', full_name: 'محمد علي - مالية', role: 'finance' },
      { username: 'store1', full_name: 'خالد حسن - مخازن', role: 'storekeeper' },
      { username: 'quality1', full_name: 'سامي عبدالله - جودة', role: 'quality' }
    ];
    
    for (const user of users) {
      await pool.query(`
        INSERT INTO users (username, password_hash, full_name, role, is_active) 
        VALUES ($1, $2, $3, $4, $5)
      `, [user.username, hashedPassword, user.full_name, user.role, true]);
    }
    
    console.log('=== Seed Complete ===');
    console.log('Login with: admin / admin123');
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

seedAll();