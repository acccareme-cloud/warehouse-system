import { useState, useEffect } from 'react';
import api from '../services/api';

function BankAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    bank_code: '',
    bank_name: '',
    account_number: '',
    branch: '',
    opening_balance: 0
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const response = await api.get('/bank-accounts');
      setAccounts(response.data);
    } catch (err) {
      console.error('خطأ في تحميل البنوك');
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      bank_code: '',
      bank_name: '',
      account_number: '',
      branch: '',
      opening_balance: 0
    });
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/bank-accounts/${editingId}`, formData);
        setMessage('✅ تم التعديل بنجاح');
      } else {
        await api.post('/bank-accounts', formData);
        setMessage('✅ تم الإضافة بنجاح');
      }
      setShowForm(false);
      resetForm();
      fetchAccounts();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const handleEdit = (account) => {
    setFormData({
      bank_code: account.bank_code,
      bank_name: account.bank_name,
      account_number: account.account_number,
      branch: account.branch,
      opening_balance: account.opening_balance
    });
    setEditingId(account.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من الحذف؟')) return;
    try {
      await api.delete(`/bank-accounts/${id}`);
      setMessage('✅ تم الحذف بنجاح');
      fetchAccounts();
    } catch (err) {
      setMessage('❌ خطأ في الحذف');
    }
  };

  const thStyle = { padding: '12px', border: '1px solid #ddd', backgroundColor: '#6c757d', color: 'white' };
  const tdStyle = { padding: '10px', border: '1px solid #ddd', color: '#1e293b' };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', direction: 'rtl' }}>
      <h1>🏦 حسابات البنوك</h1>

      <button onClick={() => window.location.href = '/treasury'} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', marginBottom: '20px', cursor: 'pointer' }}>
        ⬅️ رجوع للخزينة
      </button>

      {message && <p style={{ padding: '10px', backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da', borderRadius: '4px' }}>{message}</p>}

      <button onClick={() => { setShowForm(true); resetForm(); }} style={{ padding: '12px 30px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginBottom: '20px', fontWeight: 'bold' }}>
        ➕ إضافة حساب بنكي
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ color: '#1e293b', backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '2px solid #28a745' }}>
          <h3>{editingId ? '✏️ تعديل حساب' : '➕ إضافة حساب جديد'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            <div>
              <label>كود البنك:</label>
              <input type="text" value={formData.bank_code} onChange={(e) => setFormData({...formData, bank_code: e.target.value})} required style={{ width: '100%', padding: '8px' }} placeholder="BANK-001" />
            </div>
            <div>
              <label>اسم البنك:</label>
              <input type="text" value={formData.bank_name} onChange={(e) => setFormData({...formData, bank_name: e.target.value})} required style={{ width: '100%', padding: '8px' }} placeholder="البنك الأهلي" />
            </div>
            <div>
              <label>رقم الحساب:</label>
              <input type="text" value={formData.account_number} onChange={(e) => setFormData({...formData, account_number: e.target.value})} required style={{ width: '100%', padding: '8px' }} placeholder="1234567890" />
            </div>
            <div>
              <label>الفرع:</label>
              <input type="text" value={formData.branch} onChange={(e) => setFormData({...formData, branch: e.target.value})} style={{ width: '100%', padding: '8px' }} placeholder="القاهرة" />
            </div>
            <div>
              <label>الرصيد الافتتاحي:</label>
              <input type="number" step="0.01" value={formData.opening_balance} onChange={(e) => setFormData({...formData, opening_balance: e.target.value})} style={{ width: '100%', padding: '8px' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
            <button type="submit" style={{ padding: '12px 30px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              💾 حفظ
            </button>
            <button type="button" onClick={() => { setShowForm(false); resetForm(); }} style={{ padding: '12px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              إلغاء
            </button>
          </div>
        </form>
      )}

      <h3>📋 قائمة الحسابات</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr>
              <th style={thStyle}>كود البنك</th>
              <th style={thStyle}>اسم البنك</th>
              <th style={thStyle}>رقم الحساب</th>
              <th style={thStyle}>الفرع</th>
              <th style={thStyle}>الرصيد</th>
              <th style={thStyle}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>لا يوجد حسابات</td></tr>
            ) : (
              accounts.map(a => (
                <tr key={a.id} style={{ backgroundColor: a.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                  <td style={tdStyle}><strong>{a.bank_code}</strong></td>
                  <td style={tdStyle}>{a.bank_name}</td>
                  <td style={tdStyle}>{a.account_number}</td>
                  <td style={tdStyle}>{a.branch || '-'}</td>
                  <td style={tdStyle}><strong>{parseFloat(a.current_balance || 0).toFixed(2)} ج.م</strong></td>
                  <td style={tdStyle}>
                    <button onClick={() => handleEdit(a)} style={{ color: '#1e293b', padding: '5px 10px', backgroundColor: '#ffc107', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '5px' }}>✏️</button>
                    <button onClick={() => handleDelete(a.id)} style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🗑️</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default BankAccounts;
