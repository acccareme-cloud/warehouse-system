import { useState, useEffect } from 'react';
import api from '../services/api';

function WorkWarranties() {
  const [warranties, setWarranties] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');

  const [formData, setFormData] = useState({
    customer_id: '',
    invoice_id: '',
    warranty_type: 'before_sale',
    warranty_amount: 0,
    warranty_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    bank_name: '',
    bank_account: '',
    reference_number: '',
    notes: ''
  });

  useEffect(() => {
    fetchWarranties();
    fetchCustomers();
    fetchInvoices();
  }, []);

  const fetchWarranties = async () => {
    try {
      const res = await api.get('/work-warranties');
      setWarranties(res.data);
    } catch (err) {
      console.error('خطأ في تحميل خطابات الضمان');
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/customers');
      setCustomers(res.data);
    } catch (err) {
      console.error('خطأ في تحميل العملاء');
    }
  };

  const fetchInvoices = async () => {
    try {
      const res = await api.get('/tax-invoices');
      setInvoices(res.data);
    } catch (err) {
      console.error('خطأ في تحميل الفواتير');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/work-warranties', formData);
      setMessage('✅ تم إنشاء خطاب الضمان بنجاح');
      setShowForm(false);
      fetchWarranties();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const handleRelease = async (id) => {
    const amount = prompt('أدخل مبلغ الإخلاء:');
    if (!amount) return;

    try {
      await api.put(`/work-warranties/${id}/release`, {
        released_amount: parseFloat(amount),
        released_date: new Date().toISOString().split('T')[0],
        notes: 'إخلاء ضمان'
      });
      setMessage('✅ تم إخلاء خطاب الضمان');
      fetchWarranties();
    } catch (err) {
      setMessage('❌ خطأ في الإخلاء');
    }
  };

  const thStyle = { padding: '12px', border: '1px solid #ddd', textAlign: 'right' };
  const tdStyle = { padding: '10px', border: '1px solid #ddd' };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
        <button onClick={() => window.location.href = '/dashboard'} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          ← رجوع
        </button>
        <h1 style={{ color: '#f59e0b', margin: 0 }}>📜 خطابات ضمان أعمال</h1>
      </div>

      {message && (
        <p style={{ padding: '12px', backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da', borderRadius: '8px', fontWeight: 'bold', marginBottom: '20px' }}>
          {message}
        </p>
      )}

      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => setShowForm(true)} style={{ padding: '12px 30px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
          ➕ خطاب ضمان جديد
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ color: '#1e293b', backgroundColor: '#f8f9fa', padding: '25px', borderRadius: '12px', marginBottom: '20px', border: '3px solid #f59e0b' }}>
          <h3 style={{ color: '#f59e0b', marginBottom: '20px' }}>➕ خطاب ضمان جديد</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
            <div>
              <label>العميل:</label>
              <select value={formData.customer_id} onChange={(e) => setFormData({...formData, customer_id: e.target.value})} required style={{ width: '100%', padding: '8px' }}>
                <option value="">اختر العميل</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>الفاتورة (اختياري):</label>
              <select value={formData.invoice_id} onChange={(e) => setFormData({...formData, invoice_id: e.target.value})} style={{ width: '100%', padding: '8px' }}>
                <option value="">بدون فاتورة</option>
                {invoices.map(i => (
                  <option key={i.id} value={i.id}>{i.invoice_number} - {i.customer_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>نوع الضمان:</label>
              <select value={formData.warranty_type} onChange={(e) => setFormData({...formData, warranty_type: e.target.value})} style={{ width: '100%', padding: '8px' }}>
                <option value="before_sale">قبل البيع</option>
                <option value="after_sale">بعد البيع</option>
              </select>
            </div>
            <div>
              <label>مبلغ الضمان:</label>
              <input type="number" step="0.01" value={formData.warranty_amount} onChange={(e) => setFormData({...formData, warranty_amount: e.target.value})} required style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label>تاريخ الضمان:</label>
              <input type="date" value={formData.warranty_date} onChange={(e) => setFormData({...formData, warranty_date: e.target.value})} required style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label>تاريخ الانتهاء:</label>
              <input type="date" value={formData.expiry_date} onChange={(e) => setFormData({...formData, expiry_date: e.target.value})} style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label>اسم البنك:</label>
              <input type="text" value={formData.bank_name} onChange={(e) => setFormData({...formData, bank_name: e.target.value})} style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label>رقم الحساب:</label>
              <input type="text" value={formData.bank_account} onChange={(e) => setFormData({...formData, bank_account: e.target.value})} style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label>رقم المرجع:</label>
              <input type="text" value={formData.reference_number} onChange={(e) => setFormData({...formData, reference_number: e.target.value})} style={{ width: '100%', padding: '8px' }} />
            </div>
          </div>

          <div style={{ marginTop: '15px' }}>
            <label>ملاحظات:</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} style={{ width: '100%', padding: '8px', minHeight: '60px' }} />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="submit" style={{ padding: '12px 40px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
              💾 حفظ
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: '12px 40px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>
              ❌ إلغاء
            </button>
          </div>
        </form>
      )}

      <h3>📋 قائمة خطابات الضمان ({warranties.length})</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f59e0b', color: 'white' }}>
            <th style={thStyle}>العميل</th>
            <th style={thStyle}>الفاتورة</th>
            <th style={thStyle}>النوع</th>
            <th style={thStyle}>المبلغ</th>
            <th style={thStyle}>التاريخ</th>
            <th style={thStyle}>الانتهاء</th>
            <th style={thStyle}>الحالة</th>
            <th style={thStyle}>إجراء</th>
          </tr>
        </thead>
        <tbody>
          {warranties.length === 0 ? (
            <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>لا يوجد خطابات ضمان</td></tr>
          ) : (
            warranties.map(w => (
              <tr key={w.id} style={{ backgroundColor: w.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                <td style={tdStyle}>{w.customer_name}</td>
                <td style={tdStyle}>{w.tax_invoice_number || '-'}</td>
                <td style={tdStyle}>{w.warranty_type === 'before_sale' ? 'قبل البيع' : 'بعد البيع'}</td>
                <td style={tdStyle}><strong>{parseFloat(w.warranty_amount).toLocaleString()} ج.م</strong></td>
                <td style={tdStyle}>{new Date(w.warranty_date).toLocaleDateString('ar-EG')}</td>
                <td style={tdStyle}>{w.expiry_date ? new Date(w.expiry_date).toLocaleDateString('ar-EG') : '-'}</td>
                <td style={tdStyle}>
                  <span style={{
                    color: w.status === 'released' ? '#28a745' : new Date(w.expiry_date) < new Date() ? '#dc3545' : '#2563eb',
                    fontWeight: 'bold',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    backgroundColor: w.status === 'released' ? '#d4edda' : new Date(w.expiry_date) < new Date() ? '#f8d7da' : '#e0e7ff'
                  }}>
                    {w.status === 'released' ? '✅ مخلى' : new Date(w.expiry_date) < new Date() ? '⚠️ منتهي' : '🔒 نشط'}
                  </span>
                </td>
                <td style={tdStyle}>
                  {w.status === 'active' && (
                    <button onClick={() => handleRelease(w.id)} style={{ padding: '5px 10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                      🔓 إخلاء
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default WorkWarranties;
