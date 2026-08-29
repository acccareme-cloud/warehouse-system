import { useState, useEffect } from 'react';
import api from '../services/api';

function SalesCommissions() {
  const [commissions, setCommissions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState([]);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [dateRange, setDateRange] = useState({
    from_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to_date: new Date().toISOString().split('T')[0]
  });

  const [formData, setFormData] = useState({
    employee_id: '',
    invoice_id: '',
    commission_type: 'percentage',
    commission_rate: 0,
    base_amount: 0,
    notes: ''
  });

  useEffect(() => {
    fetchCommissions();
    fetchEmployees();
    fetchInvoices();
    fetchSummary();
  }, []);

  const fetchCommissions = async () => {
    try {
      const res = await api.get('/sales-commissions');
      setCommissions(res.data);
    } catch (err) {
      console.error('خطأ في تحميل العمولات');
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/employees');
      setEmployees(res.data.filter(e => e.job_title?.includes('مبيع') || e.job_title?.includes('sales')));
    } catch (err) {
      console.error('خطأ في تحميل الموظفين');
    }
  };

  const fetchInvoices = async () => {
    try {
      const res = await api.get('/tax-invoices');
      setInvoices(res.data.filter(i => i.status === 'approved_finance' || i.status === 'posted'));
    } catch (err) {
      console.error('خطأ في تحميل الفواتير');
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await api.get(`/sales-commissions/report/summary?from_date=${dateRange.from_date}&to_date=${dateRange.to_date}`);
      setSummary(res.data);
    } catch (err) {
      console.error('خطأ في تحميل الملخص');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/sales-commissions', formData);
      setMessage('✅ تم إنشاء العمولة بنجاح');
      setShowForm(false);
      fetchCommissions();
      fetchSummary();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const handlePay = async (id) => {
    const amount = prompt('أدخل مبلغ الدفع:');
    if (!amount) return;

    try {
      await api.put(`/sales-commissions/${id}/pay`, {
        paid_amount: parseFloat(amount),
        payment_date: new Date().toISOString().split('T')[0]
      });
      setMessage('✅ تم دفع العمولة');
      fetchCommissions();
      fetchSummary();
    } catch (err) {
      setMessage('❌ خطأ في الدفع');
    }
  };

  const calculateCommission = () => {
    const base = parseFloat(formData.base_amount || 0);
    const rate = parseFloat(formData.commission_rate || 0);
    if (formData.commission_type === 'percentage') {
      return base * (rate / 100);
    }
    return rate;
  };

  const thStyle = { padding: '12px', border: '1px solid #ddd', textAlign: 'right' };
  const tdStyle = { padding: '10px', border: '1px solid #ddd' };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
        <button onClick={() => window.location.href = '/dashboard'} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          ← رجوع
        </button>
        <h1 style={{ color: '#059669', margin: 0 }}>💰 عمولات رجال البيع</h1>
      </div>

      {message && (
        <p style={{ padding: '12px', backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da', borderRadius: '8px', fontWeight: 'bold', marginBottom: '20px' }}>
          {message}
        </p>
      )}

      {/* ملخص العمولات */}
      <div style={{ color: '#1e293b', backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '12px', border: '2px solid #059669', marginBottom: '20px' }}>
        <h3 style={{ color: '#059669', marginBottom: '15px' }}>📊 ملخص العمولات</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          {summary.map(s => (
            <div key={s.employee_id} style={{ color: '#1e293b', backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #059669' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#059669' }}>{s.employee_name}</h4>
              <p style={{ margin: '5px 0', fontSize: '14px' }}>عدد العمولات: {s.total_commissions}</p>
              <p style={{ margin: '5px 0', fontSize: '14px' }}>إجمالي العمولات: {parseFloat(s.total_commission_amount).toLocaleString()} ج.م</p>
              <p style={{ margin: '5px 0', fontSize: '14px' }}>تم دفع: {parseFloat(s.total_paid).toLocaleString()} ج.م</p>
              <p style={{ margin: '5px 0', fontSize: '14px', color: '#dc3545' }}>متبقي: {parseFloat(s.total_remaining).toLocaleString()} ج.م</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={() => setShowForm(true)} style={{ padding: '12px 30px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
          ➕ عمولة جديدة
        </button>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input type="date" value={dateRange.from_date} onChange={(e) => setDateRange({...dateRange, from_date: e.target.value})} style={{ padding: '8px' }} />
          <span>إلى</span>
          <input type="date" value={dateRange.to_date} onChange={(e) => setDateRange({...dateRange, to_date: e.target.value})} style={{ padding: '8px' }} />
          <button onClick={fetchSummary} style={{ padding: '8px 20px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            🔍 بحث
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ color: '#1e293b', backgroundColor: '#f8f9fa', padding: '25px', borderRadius: '12px', marginBottom: '20px', border: '3px solid #059669' }}>
          <h3 style={{ color: '#059669', marginBottom: '20px' }}>➕ عمولة جديدة</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
            <div>
              <label>البائع:</label>
              <select value={formData.employee_id} onChange={(e) => setFormData({...formData, employee_id: e.target.value})} required style={{ width: '100%', padding: '8px' }}>
                <option value="">اختر البائع</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.employee_number} - {e.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>الفاتورة:</label>
              <select value={formData.invoice_id} onChange={(e) => {
                const inv = invoices.find(i => i.id == e.target.value);
                setFormData({
                  ...formData,
                  invoice_id: e.target.value,
                  base_amount: inv?.total_amount || 0
                });
              }} style={{ width: '100%', padding: '8px' }}>
                <option value="">اختر الفاتورة</option>
                {invoices.map(i => (
                  <option key={i.id} value={i.id}>{i.invoice_number} - {i.customer_name} ({parseFloat(i.total_amount).toLocaleString()} ج.م)</option>
                ))}
              </select>
            </div>
            <div>
              <label>نوع العمولة:</label>
              <select value={formData.commission_type} onChange={(e) => setFormData({...formData, commission_type: e.target.value})} style={{ width: '100%', padding: '8px' }}>
                <option value="percentage">نسبة (%)</option>
                <option value="fixed">مبلغ ثابت</option>
              </select>
            </div>
            <div>
              <label>{formData.commission_type === 'percentage' ? 'نسبة العمولة (%)' : 'مبلغ العمولة'}:</label>
              <input type="number" step="0.01" value={formData.commission_rate} onChange={(e) => setFormData({...formData, commission_rate: e.target.value})} required style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label>المبلغ الأساسي:</label>
              <input type="number" step="0.01" value={formData.base_amount} onChange={(e) => setFormData({...formData, base_amount: e.target.value})} style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label>العمولة المحسوبة:</label>
              <input type="text" value={calculateCommission().toLocaleString() + ' ج.م'} readOnly style={{ color: '#1e293b', width: '100%', padding: '8px', backgroundColor: '#e2e8f0' }} />
            </div>
          </div>

          <div style={{ marginTop: '15px' }}>
            <label>ملاحظات:</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} style={{ width: '100%', padding: '8px', minHeight: '60px' }} />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="submit" style={{ padding: '12px 40px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
              💾 حفظ
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: '12px 40px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>
              ❌ إلغاء
            </button>
          </div>
        </form>
      )}

      <h3>📋 قائمة العمولات ({commissions.length})</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
        <thead>
          <tr style={{ backgroundColor: '#059669', color: 'white' }}>
            <th style={thStyle}>البائع</th>
            <th style={thStyle}>الفاتورة</th>
            <th style={thStyle}>النوع</th>
            <th style={thStyle}>النسبة/المبلغ</th>
            <th style={thStyle}>العمولة</th>
            <th style={thStyle}>الأساس</th>
            <th style={thStyle}>الحالة</th>
            <th style={thStyle}>إجراء</th>
          </tr>
        </thead>
        <tbody>
          {commissions.length === 0 ? (
            <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>لا يوجد عمولات</td></tr>
          ) : (
            commissions.map(c => (
              <tr key={c.id} style={{ backgroundColor: c.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                <td style={tdStyle}>{c.employee_name}</td>
                <td style={tdStyle}>{c.tax_invoice_number || c.price_quote_number || '-'}</td>
                <td style={tdStyle}>{c.commission_type === 'percentage' ? 'نسبة' : 'ثابت'}</td>
                <td style={tdStyle}>{c.commission_rate}{c.commission_type === 'percentage' ? '%' : ' ج.م'}</td>
                <td style={tdStyle}><strong>{parseFloat(c.commission_amount).toLocaleString()} ج.م</strong></td>
                <td style={tdStyle}>{parseFloat(c.base_amount).toLocaleString()} ج.م</td>
                <td style={tdStyle}>
                  <span style={{
                    color: c.status === 'paid' ? '#28a745' : c.status === 'pending' ? '#ffc107' : '#6c757d',
                    fontWeight: 'bold',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    backgroundColor: c.status === 'paid' ? '#d4edda' : c.status === 'pending' ? '#fff3cd' : '#f8f9fa'
                  }}>
                    {c.status === 'paid' ? '✅ مدفوع' : c.status === 'pending' ? '⏳ معلق' : c.status}
                  </span>
                </td>
                <td style={tdStyle}>
                  {c.status === 'pending' && (
                    <button onClick={() => handlePay(c.id)} style={{ padding: '5px 10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                      💰 دفع
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

export default SalesCommissions;
