import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';

function Settings() {
  const navigate = useNavigate();
  const { theme, setDark, setLight } = useTheme();
  const [user, setUser] = useState({});
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(false);
  const [resetUsers, setResetUsers] = useState(false);

  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'purchasing', full_name: '' });
  const [passwordData, setPasswordData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

  // ⬇️ جديد: قائمة المستخدمين + تغيير باسورد
  const [usersList, setUsersList] = useState([]);
  const [resetUserId, setResetUserId] = useState(null);
  const [resetPassword, setResetPassword] = useState('');

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(u);
    if (u.role !== 'admin') navigate('/dashboard');
  }, [navigate]);

  // ⬇️ جديد: جلب المستخدمين لما نفتح التاب
  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
  }, [activeTab]);

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 5000);
  };

  // ⬇️ جديد: جلب المستخدمين من الباك
  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsersList(res.data);
    } catch (err) {
      showMessage('❌ خطأ في جلب المستخدمين');
    }
  };

  // ⬇️ جديد: الأدمن يغير باسورد أي مستخدم
  const handleAdminResetPassword = async (userId) => {
    if (!resetPassword || resetPassword.length < 4) {
      showMessage('❌ الباسورد لازم يكون 4 أحرف على الأقل');
      return;
    }
    setLoading(true);
    try {
      await api.put(`/admin/users/${userId}/reset-password`, { newPassword: resetPassword });
      showMessage('✅ تم تغيير الباسورد بنجاح');
      setResetUserId(null);
      setResetPassword('');
    } catch (err) {
      showMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/admin/users', newUser);
      showMessage('✅ تم إنشاء المستخدم بنجاح');
      setNewUser({ username: '', password: '', role: 'purchasing', full_name: '' });
      fetchUsers(); // ⬇️ جديد: تحديث القائمة بعد الإنشاء
    } catch (err) {
      showMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showMessage('❌ كلمة المرور الجديدة غير متطابقة');
      return;
    }
    setLoading(true);
    try {
      await api.put('/admin/users/change-password', {
        oldPassword: passwordData.oldPassword,
        newPassword: passwordData.newPassword
      });
      showMessage('✅ تم تغيير كلمة المرور بنجاح');
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      showMessage('❌ خطأ: ' + (err.response?.data?.message || 'كلمة المرور الحالية غير صحيحة'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetData = async () => {
    if (!window.confirm('⚠️ هل أنت متأكد من تصفير كل البيانات؟ لا يمكن التراجع!')) return;
    if (!window.confirm('⚠️ تأكيد نهائي: سيتم حذف ALL البيانات!')) return;
    
    setLoading(true);
    try {
      await api.post('/admin/reset-database', { includeUsers: resetUsers });
      showMessage('✅ تم تصفير كل البيانات بنجاح');
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      showMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/backup', { responseType: 'blob' });
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: `backup_database_${new Date().toISOString().split('T')[0]}.sql`,
          types: [{ description: 'SQL Files', accept: { 'application/sql': ['.sql'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(res.data);
        await writable.close();
        showMessage('✅ تم حفظ النسخة في المكان اللي اخترته');
      } else {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_database_${new Date().toISOString().split('T')[0]}.sql`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showMessage('✅ تم تحميل نسخة قاعدة البيانات');
      }
    } catch (err) {
      if (err.name === 'AbortError') { showMessage('❌ تم إلغاء الحفظ'); return; }
      showMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    } finally {
      setLoading(false);
    }
  };

  const handleFullBackup = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/backup-full', { responseType: 'blob', timeout: 120000 });
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: `warehouse_system_backup_${new Date().toISOString().split('T')[0]}.zip`,
          types: [{ description: 'ZIP Files', accept: { 'application/zip': ['.zip'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(res.data);
        await writable.close();
        showMessage('✅ تم حفظ النسخة الكاملة في المكان اللي اخترته');
      } else {
        const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/zip' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `warehouse_system_backup_${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showMessage('✅ تم تحميل نسخة البرنامج كامل');
      }
    } catch (err) {
      if (err.name === 'AbortError') { showMessage('❌ تم إلغاء الحفظ'); return; }
      console.error('Full backup error:', err);
      showMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ في النسخة الكاملة'));
    } finally {
      setLoading(false);
    }
  };

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';

  const tabStyle = (tab) => ({
    padding: '12px 25px',
    background: activeTab === tab ? '#3b82f6' : isDark ? '#1e293b' : '#e2e8f0',
    color: activeTab === tab ? 'white' : textColor,
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '15px'
  });

  const inputStyle = { 
    width: '100%', 
    padding: '12px', 
    borderRadius: '8px', 
    border: '1px solid ' + (isDark ? '#334155' : '#cbd5e1'), 
    background: isDark ? '#0f172a' : '#ffffff', 
    color: textColor, 
    fontSize: '15px' 
  };

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '1200px', 
      margin: '0 auto', 
      direction: 'rtl', 
      background: bgColor, 
      minHeight: '100vh', 
      color: textColor,
      transition: 'all 0.3s ease'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
        <button 
          onClick={() => navigate('/dashboard')} 
          style={{ padding: '10px 20px', background: isDark ? '#334155' : '#6b7280', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
        >
          ← رجوع
        </button>
        <h1 style={{ margin: 0 }}>⚙️ الإعدادات</h1>
      </div>

      {message && (
        <p style={{ 
          padding: '15px', 
          background: message.includes('✅') ? '#065f46' : '#7f1d1d', 
          borderRadius: '8px', 
          fontWeight: 'bold', 
          marginBottom: '20px' 
        }}>
          {message}
        </p>
      )}

      {/* Theme Toggle */}
      <div style={{ 
        background: cardBg, 
        padding: '20px', 
        borderRadius: '12px', 
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <h3 style={{ margin: '0 0 5px 0' }}>🎨 الوضع اللوني</h3>
          <p style={{ margin: 0, color: subTextColor, fontSize: '14px' }}>
            اختر الوضع اللوني للبرنامج (يؤثر على كل الشاشات)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={setDark} style={{ padding: '10px 20px', background: theme === 'dark' ? '#3b82f6' : isDark ? '#334155' : '#e2e8f0', color: theme === 'dark' ? 'white' : textColor, border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            🌙 Dark
          </button>
          <button onClick={setLight} style={{ padding: '10px 20px', background: theme === 'light' ? '#f59e0b' : isDark ? '#334155' : '#e2e8f0', color: theme === 'light' ? 'white' : textColor, border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            ☀️ Light
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('users')} style={tabStyle('users')}>👤 مستخدمين</button>
        <button onClick={() => setActiveTab('password')} style={tabStyle('password')}>🔒 تغيير باسورد</button>
        <button onClick={() => setActiveTab('tax')} style={tabStyle('tax')}>🏛️ ضرائب</button>
        <button onClick={() => setActiveTab('backup')} style={tabStyle('backup')}>💾 Backup</button>
        <button onClick={() => setActiveTab('reset')} style={tabStyle('reset')}>⚠️ تصفير</button>
      </div>

      {/* ⬇️⬇️⬇️ تاب المستخدمين الجديد بالكامل ⬇️⬇️⬇️ */}
      {activeTab === 'users' && (
        <div style={{ background: cardBg, padding: '25px', borderRadius: '12px' }}>
          
          {/* ➕ إنشاء مستخدم جديد */}
          <h3>➕ إنشاء مستخدم جديد</h3>
          <form onSubmit={handleCreateUser} style={{ display: 'grid', gap: '15px', maxWidth: '500px', marginBottom: '30px' }}>
            <input type="text" placeholder="اسم المستخدم" value={newUser.username} onChange={(e) => setNewUser({...newUser, username: e.target.value})} required style={inputStyle} />
            <input type="password" placeholder="كلمة المرور" value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} required style={inputStyle} />
            <input type="text" placeholder="الاسم الكامل" value={newUser.full_name} onChange={(e) => setNewUser({...newUser, full_name: e.target.value})} style={inputStyle} />
            <select value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value})} style={inputStyle}>
              <option value="purchasing">مشتريات (purchasing)</option>
              <option value="storekeeper">مخازن (storekeeper)</option>
              <option value="finance">مالية (finance)</option>
              <option value="quality">جودة (quality)</option>
              <option value="maintenance">صيانة (maintenance)</option>
              <option value="entry_accountant">محاسب إدخالات (entry_accountant)</option>
              <option value="review_accountant">محاسب مراجعة (review_accountant)</option>
              <option value="treasury_accountant">محاسب خزينة (treasury_accountant)</option>
              <option value="admin">أدمن (admin)</option>
            </select>
            <button type="submit" disabled={loading} style={{ padding: '12px', background: loading ? '#6b7280' : '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
              {loading ? '⏳ جاري...' : '💾 إنشاء مستخدم'}
            </button>
          </form>

          {/* 👥 جدول المستخدمين */}
          <h3>👥 المستخدمين الحاليين</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: isDark ? '#334155' : '#e2e8f0', textAlign: 'right' }}>
                  <th style={{ padding: '12px', borderBottom: '2px solid ' + (isDark ? '#475569' : '#cbd5e1') }}>المستخدم</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid ' + (isDark ? '#475569' : '#cbd5e1') }}>الاسم الكامل</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid ' + (isDark ? '#475569' : '#cbd5e1') }}>الدور</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid ' + (isDark ? '#475569' : '#cbd5e1') }}>الحالة</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid ' + (isDark ? '#475569' : '#cbd5e1') }}>تاريخ الإنشاء</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid ' + (isDark ? '#475569' : '#cbd5e1') }}>تغيير باسورد</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid ' + (isDark ? '#334155' : '#e2e8f0') }}>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{u.username || u.user_name}</td>
                    <td style={{ padding: '10px' }}>{u.full_name || '-'}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: '12px', background: u.role === 'admin' ? '#dc2626' : '#3b82f6', color: 'white', fontSize: '12px' }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>{u.is_active ? '✅ نشط' : '❌ غير نشط'}</td>
                    <td style={{ padding: '10px', color: subTextColor }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('ar-EG') : '-'}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {resetUserId === u.id ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input type="password" placeholder="باسورد جديد" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} style={{ ...inputStyle, width: '120px', padding: '6px' }} />
                          <button onClick={() => handleAdminResetPassword(u.id)} disabled={loading} style={{ padding: '6px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✓</button>
                          <button onClick={() => { setResetUserId(null); setResetPassword(''); }} style={{ padding: '6px 12px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                        </div>
                      ) : (
                        <button onClick={() => setResetUserId(u.id)} style={{ padding: '6px 14px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>🔑 تغيير</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {usersList.length === 0 && <p style={{ textAlign: 'center', color: subTextColor, padding: '20px' }}>لا يوجد مستخدمين</p>}
          </div>
        </div>
      )}

      {/* Password Tab */}
      {activeTab === 'password' && (
        <div style={{ background: cardBg, padding: '25px', borderRadius: '12px' }}>
          <h3>🔒 تغيير كلمة المرور</h3>
          <form onSubmit={handleChangePassword} style={{ display: 'grid', gap: '15px', maxWidth: '500px' }}>
            <input type="password" placeholder="كلمة المرور الحالية" value={passwordData.oldPassword} onChange={(e) => setPasswordData({...passwordData, oldPassword: e.target.value})} required style={inputStyle} />
            <input type="password" placeholder="كلمة المرور الجديدة" value={passwordData.newPassword} onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})} required style={inputStyle} />
            <input type="password" placeholder="تأكيد كلمة المرور" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})} required style={inputStyle} />
            <button type="submit" disabled={loading} style={{ padding: '12px', background: loading ? '#6b7280' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
              {loading ? '⏳ جاري...' : '🔒 تغيير الباسورد'}
            </button>
          </form>
        </div>
      )}

      {/* Backup Tab */}
      {activeTab === 'backup' && (
        <div style={{ background: cardBg, padding: '25px', borderRadius: '12px' }}>
          <h3>💾 نسخ احتياطي</h3>
          <div style={{ display: 'grid', gap: '15px', maxWidth: '500px' }}>
            <button onClick={handleBackup} disabled={loading} style={{ padding: '15px', background: loading ? '#6b7280' : '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
              📥 نسخة قاعدة البيانات (.sql)
            </button>
            <button onClick={handleFullBackup} disabled={loading} style={{ padding: '15px', background: loading ? '#6b7280' : '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
              📦 نسخة البرنامج كامل (Backend + Frontend + DB)
            </button>
            <p style={{ color: subTextColor, fontSize: '14px' }}>💡 النسخة الكاملة تحتوي على: Backend + Frontend + Database</p>
          </div>
        </div>
      )}

      {/* Reset Tab */}
      {activeTab === 'reset' && (
        <div style={{ background: cardBg, padding: '25px', borderRadius: '12px' }}>
          <h3>⚠️ تصفير البيانات</h3>
          <div style={{ display: 'grid', gap: '15px', maxWidth: '500px' }}>
            <div style={{ background: '#7f1d1d', padding: '15px', borderRadius: '8px', marginBottom: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={resetUsers} onChange={(e) => setResetUsers(e.target.checked)} />
                <span>تصفير المستخدمين كمان (حذف كل المستخدمين)</span>
              </label>
            </div>
            <button onClick={handleResetData} disabled={loading} style={{ padding: '15px', background: loading ? '#6b7280' : '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
              ⚠️ تصفير كل البيانات
            </button>
            <ul style={{ color: '#fca5a5', fontSize: '14px', margin: '0', paddingRight: '20px' }}>
              <li>كل الفواتير (مبيعات + مشتريات)</li>
              <li>كل العملاء والموردين</li>
              <li>كل الموظفين والتسويات</li>
              <li>كل الأصناف والمخازن</li>
              <li>كل الحركات والمدفوعات</li>
              <li>{resetUsers ? '✓ المستخدمين كمان' : '✗ المستخدمين مش هيتمسحوا'}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;