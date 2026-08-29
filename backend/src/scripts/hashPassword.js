const bcrypt = require('bcryptjs');

async function hashPassword() {
  const password = 'admin123';
  const hashed = await bcrypt.hash(password, 10);
  console.log('Password:', password);
  console.log('Hashed:', hashed);
}

hashPassword();