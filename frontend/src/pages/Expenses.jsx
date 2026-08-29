import { useState, useEffect } from 'react';
import api from '../services/api';

function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [expenseTypes, setExpenseTypes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    expense_type_id: '',
    expense_number: '',
    amount: 0,
    description: '',
    receipt_number: '',
    supplier_name: ''
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchExpenses();
    fetchExpenseTypes();
  }, []);

  const fetchExpenses = async () => {
    try {
      const response = await api.get('/expenses');
      setExpenses(response.data);
    } catch (err) {
      console.error('خطأ في تحميل المصاريف');
    }
  };

  const fetchExpenseTypes = async () => {
    try {
      const response = await api.get('/expenses/types');
      setExpenseTypes(response.data);
    } catch (err) {
      console.error('خطأ في تحميل أنواع المصاريف');
    }
  };

  const fetchNextNumber = async () => {
    try {
      const response = await api.get('/expenses/next-number');
      setFormData(prev => ({...prev, expense_number: response.data.nextNumber}));
    } catch (err) {
      console.error('خطأ في توليد الرقم');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/expenses', formData);
      setMessage('تم تسجيل المصروف بنجاح');
      setShowForm(false);
      setFormData({ expense_type_id: '', expense_number: '', amount: 0, description: '', receipt_number: '', supplier_name: '' });
      fetchExpenses();
    } catch (err) {
      setMessage('خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const thStyle = { padding: '12px', border: '1px solid #ddd' };
  const tdStyle = { padding: '10px', border: '1px solid #ddd' };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>المصاريف</h1>
      
      <button onClick={() => window.location.href = '/dashboard'} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', marginBottom: '20px', cursor: 'pointer' }}>
        رجوع للوحة التحكم
      </button>

      {message && <p style={{ padding: '10px', backgroundColor: message.includes('نجاح') ? '#d4edda' : '#f8d7da', borderRadius: '4px' }}>{message}</p>}

      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => { setShowForm(!showForm); if (!showForm) fetchNextNumber(); }} style={{ padding: '12px 25px', backgroundColor: showForm ? '#dc3545' : '#fd7e14', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
          {showForm ? '❌ إلغاء' : '➕ مصروف جديد'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
          <h3>مصروف جديد</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            <div>
              <label>رقم المصروف (تلقائي):</label>
              <input type="text" value={formData.expense_number} readOnly style={{ width: '100%', padding: '8px', backgroundColor: '#e2e8f0' }} />
            </div>
            <div>
              <label>نوع المصروف:</label>
              <select value={formData.expense_type_id} onChange={(e) => setFormData({...formData, expense_type_id: e.target.value})} required style={{ width: '100%', padding: '8px' }}>
                <option value="">اختر النوع</option>
                {expenseTypes.map(et => (
                  <option key={et.id} value={et.id}>{et.code} - {et.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>المبلغ:</label>
              <input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} required style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label>رقم الإيصال:</label>
              <input type="text" value={formData.receipt_number} onChange={(e) => setFormData({...formData, receipt_number: e.target.value})} style={{ width: '100%', padding: '8px' }} placeholder="رقم فاتورة أو إيصال" />
            </div>
            <div>
              <label>المورد/الجهة:</label>
              <input type="text" value={formData.supplier_name} onChange={(e) => setFormData({...formData, supplier_name: e.target.value})} style={{ width: '100%', padding: '8px' }} placeholder="اسم المورد أو الجهة" />
            </div>
            <div>
              <label>البيان:</label>
              <input type="text" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} style={{ width: '100%', padding: '8px' }} placeholder="تفاصيل المصروف" />
            </div>
          </div>
          <button type="submit" style={{ marginTop: '15px', padding: '12px 40px', backgroundColor: '#fd7e14', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
            💾 حفظ المصروف
          </button>
        </form>
      )}

      <h3>قائمة المصاريف</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
        <thead>
          <tr style={{ backgroundColor: '#fd7e14', color: 'white' }}>
            <th style={thStyle}>رقم المصروف</th>
            <th style={thStyle}>النوع</th>
            <th style={thStyle}>المبلغ</th>
            <th style={thStyle}>رقم الإيصال</th>
            <th style={thStyle}>المورد</th>
            <th style={thStyle}>البيان</th>
            <th style={thStyle}>التاريخ</th>
          </tr>
        </thead>
        <tbody>
          {expenses.length === 0 ? (
            <tr><td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>لا يوجد مصاريف</td></tr>
          ) : (
            expenses.map(e => (
              <tr key={e.id} style={{ backgroundColor: e.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                <td style={tdStyle}><strong>{e.expense_number}</strong></td>
                <td style={tdStyle}>{e.expense_type_name}</td>
                <td style={tdStyle}><strong style={{ color: '#dc3545' }}>{e.amount} ج.م</strong></td>
                <td style={tdStyle}>{e.receipt_number || '-'}</td>
                <td style={tdStyle}>{e.supplier_name || '-'}</td>
                <td style={tdStyle}>{e.description || '-'}</td>
                <td style={tdStyle}>{new Date(e.created_at).toLocaleDateString('ar-EG')}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Expenses;