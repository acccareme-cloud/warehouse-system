import { useState, useEffect } from 'react';
import api from '../services/api';

function PriceQuotes() {
  const [quotes, setQuotes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [userRole, setUserRole] = useState('');

  const [formData, setFormData] = useState({
    quote_number: '',
    quote_date: new Date().toISOString().split('T')[0],
    customer_id: '',
    customer_name: '',
    discount_amount: 0,
    notes: ''
  });

  const [quoteItems, setQuoteItems] = useState([{
    item_id: '',
    item_name: '',
    quantity: 1,
    unit_price: 0,
    notes: ''
  }]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserRole(user.role || '');
    fetchQuotes();
    fetchCustomers();
    fetchItems();
  }, []);

  const fetchQuotes = async () => {
    try {
      const res = await api.get('/price-quotes');
      setQuotes(res.data);
    } catch (err) {
      console.error('خطأ في تحميل البيانات');
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

  const fetchItems = async () => {
    try {
      const res = await api.get('/items');
      setItems(res.data);
    } catch (err) {
      console.error('خطأ في تحميل الأصناف');
    }
  };

  const fetchNextNumber = async () => {
    try {
      const res = await api.get('/price-quotes/next-number');
      setFormData(prev => ({...prev, quote_number: res.data.nextNumber}));
    } catch (err) {
      console.error('خطأ في توليد الرقم');
    }
  };

  const handleShowForm = () => {
    setShowForm(true);
    fetchNextNumber();
    setFormData({
      quote_number: '',
      quote_date: new Date().toISOString().split('T')[0],
      customer_id: '',
      customer_name: '',
      discount_amount: 0,
      notes: ''
    });
    setQuoteItems([{ item_id: '', item_name: '', quantity: 1, unit_price: 0, notes: '' }]);
  };

  const addItemRow = () => {
    setQuoteItems([...quoteItems, { item_id: '', item_name: '', quantity: 1, unit_price: 0, notes: '' }]);
  };

  const removeItemRow = (index) => {
    if (quoteItems.length > 1) {
      setQuoteItems(quoteItems.filter((_, i) => i !== index));
    }
  };

  const updateItemRow = (index, field, value) => {
    const updated = [...quoteItems];
    updated[index][field] = value;
    if (field === 'item_id') {
      const item = items.find(i => i.id == value);
      updated[index].item_name = item?.name || '';
    }
    setQuoteItems(updated);
  };

  const calculateTotals = () => {
    const subtotal = quoteItems.reduce((sum, item) => sum + (parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0)), 0);
    const discount = parseFloat(formData.discount_amount || 0);
    const total = subtotal - discount;
    return { subtotal, discount, total };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/price-quotes', {
        ...formData,
        items: quoteItems.filter(i => i.item_id)
      });
      setMessage('✅ تم إنشاء بيان السعر بنجاح');
      setShowForm(false);
      fetchQuotes();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.put(`/price-quotes/${id}/approve`);
      setMessage('✅ تم اعتماد بيان السعر');
      fetchQuotes();
    } catch (err) {
      setMessage('❌ خطأ في الاعتماد');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    try {
      await api.delete(`/price-quotes/${id}`);
      setMessage('✅ تم الحذف بنجاح');
      fetchQuotes();
    } catch (err) {
      setMessage('❌ خطأ في الحذف');
    }
  };

  const getStatusText = (status) => {
    const statuses = {
      'draft': '✏️ مسودة',
      'approved': '✓ معتمد',
      'posted': '✓ مرحل'
    };
    return statuses[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      'draft': '#6c757d',
      'approved': '#28a745',
      'posted': '#0d9488'
    };
    return colors[status] || '#6c757d';
  };

  const { subtotal, discount, total } = calculateTotals();

  const thStyle = { padding: '12px', border: '1px solid #ddd', textAlign: 'right' };
  const tdStyle = { padding: '10px', border: '1px solid #ddd', color: '#1e293b' };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
        <button onClick={() => window.location.href = '/dashboard'} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          ← رجوع
        </button>
        <h1 style={{ color: '#7c3aed', margin: 0 }}>📋 بيانات السعر (غير ضريبي)</h1>
      </div>

      {message && (
        <p style={{ padding: '12px', backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da', borderRadius: '8px', fontWeight: 'bold', marginBottom: '20px' }}>
          {message}
        </p>
      )}

      <div style={{ marginBottom: '20px' }}>
        <button onClick={handleShowForm} style={{ padding: '12px 30px', backgroundColor: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
          ➕ بيان سعر جديد
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ color: '#1e293b', backgroundColor: '#f8f9fa', padding: '25px', borderRadius: '12px', marginBottom: '20px', border: '3px solid #7c3aed' }}>
          <h3 style={{ color: '#7c3aed', marginBottom: '20px' }}>➕ بيان سعر جديد</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div>
              <label>رقم البيان (تلقائي):</label>
              <input type="text" value={formData.quote_number} readOnly style={{ color: '#1e293b', width: '100%', padding: '8px', backgroundColor: '#e2e8f0' }} />
            </div>
            <div>
              <label>تاريخ البيان:</label>
              <input type="date" value={formData.quote_date} onChange={(e) => setFormData({...formData, quote_date: e.target.value})} required style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label>العميل:</label>
              <select value={formData.customer_id} onChange={(e) => {
                const customer = customers.find(c => c.id == e.target.value);
                setFormData({...formData, customer_id: e.target.value, customer_name: customer?.name || ''});
              }} required style={{ width: '100%', padding: '8px' }}>
                <option value="">اختر العميل</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>خصم:</label>
              <input type="number" step="0.01" value={formData.discount_amount} onChange={(e) => setFormData({...formData, discount_amount: e.target.value})} style={{ width: '100%', padding: '8px' }} />
            </div>
          </div>

          <h4 style={{ color: '#374151', marginBottom: '10px' }}>📦 الأصناف</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
            <thead>
              <tr style={{ backgroundColor: '#7c3aed', color: 'white' }}>
                <th style={thStyle}>الصنف</th>
                <th style={thStyle}>العدد</th>
                <th style={thStyle}>السعر</th>
                <th style={thStyle}>القيمة</th>
                <th style={thStyle}>ملاحظات</th>
                <th style={thStyle}>حذف</th>
              </tr>
            </thead>
            <tbody>
              {quoteItems.map((item, index) => (
                <tr key={index}>
                  <td style={tdStyle}>
                    <select value={item.item_id} onChange={(e) => updateItemRow(index, 'item_id', e.target.value)} required style={{ width: '100%', padding: '6px' }}>
                      <option value="">اختر الصنف</option>
                      {items.map(i => (
                        <option key={i.id} value={i.id}>{i.code} - {i.name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={tdStyle}>
                    <input type="number" step="0.001" min="0.001" value={item.quantity} onChange={(e) => updateItemRow(index, 'quantity', e.target.value)} required style={{ width: '100%', padding: '6px' }} />
                  </td>
                  <td style={tdStyle}>
                    <input type="number" step="0.01" value={item.unit_price} onChange={(e) => updateItemRow(index, 'unit_price', e.target.value)} required style={{ width: '100%', padding: '6px' }} />
                  </td>
                  <td style={tdStyle}>
                    {(parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0)).toLocaleString()} ج.م
                  </td>
                  <td style={tdStyle}>
                    <input type="text" value={item.notes} onChange={(e) => updateItemRow(index, 'notes', e.target.value)} style={{ width: '100%', padding: '6px' }} />
                  </td>
                  <td style={tdStyle}>
                    <button type="button" onClick={() => removeItemRow(index)} style={{ padding: '4px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button type="button" onClick={addItemRow} style={{ padding: '8px 20px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', marginBottom: '15px' }}>
            ➕ إضافة صنف
          </button>

          <div style={{ color: '#1e293b', backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '2px solid #e5e7eb', marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>الإجمالي:</span>
              <strong>{subtotal.toLocaleString()} ج.م</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#dc3545' }}>
              <span>الخصم:</span>
              <strong>-{discount.toLocaleString()} ج.م</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', color: '#7c3aed' }}>
              <strong>الصافي:</strong>
              <strong>{total.toLocaleString()} ج.م</strong>
            </div>
          </div>

          <div>
            <label>ملاحظات:</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} style={{ width: '100%', padding: '8px', minHeight: '60px' }} />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="submit" style={{ padding: '12px 40px', backgroundColor: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
              💾 حفظ البيان
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: '12px 40px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>
              ❌ إلغاء
            </button>
          </div>
        </form>
      )}

      <h3>📋 قائمة بيانات السعر ({quotes.length})</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
        <thead>
          <tr style={{ backgroundColor: '#7c3aed', color: 'white' }}>
            <th style={thStyle}>رقم البيان</th>
            <th style={thStyle}>التاريخ</th>
            <th style={thStyle}>العميل</th>
            <th style={thStyle}>الإجمالي</th>
            <th style={thStyle}>الخصم</th>
            <th style={thStyle}>الصافي</th>
            <th style={thStyle}>الحالة</th>
            <th style={thStyle}>إجراء</th>
          </tr>
        </thead>
        <tbody>
          {quotes.length === 0 ? (
            <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>لا يوجد بيانات</td></tr>
          ) : (
            quotes.map(q => (
              <tr key={q.id} style={{ backgroundColor: q.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                <td style={tdStyle}><strong>{q.quote_number}</strong></td>
                <td style={tdStyle}>{new Date(q.quote_date).toLocaleDateString('ar-EG')}</td>
                <td style={tdStyle}>{q.customer_name || q.customer_name_display}</td>
                <td style={tdStyle}>{parseFloat(q.subtotal).toLocaleString()} ج.م</td>
                <td style={tdStyle}>{parseFloat(q.discount_amount).toLocaleString()} ج.م</td>
                <td style={tdStyle}><strong>{parseFloat(q.total_amount).toLocaleString()} ج.م</strong></td>
                <td style={tdStyle}>
                  <span style={{ color: getStatusColor(q.status), fontWeight: 'bold', padding: '4px 12px', borderRadius: '12px', backgroundColor: getStatusColor(q.status) + '20' }}>
                    {getStatusText(q.status)}
                  </span>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {q.status === 'draft' && ['admin', 'sales'].includes(userRole) && (
                      <button onClick={() => handleApprove(q.id)} style={{ padding: '5px 10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✓ اعتماد</button>
                    )}
                    <button onClick={() => handleDelete(q.id)} style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>🗑️ حذف</button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default PriceQuotes;
