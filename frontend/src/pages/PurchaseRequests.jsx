import { useState, useEffect } from 'react';
import api from '../services/api';

function PurchaseRequests() {
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [requests, setRequests] = useState([]);
  const [userRole, setUserRole] = useState('');
  const [currencies, setCurrencies] = useState([]);

  // بيانات الطلب الرئيسية
  const [formData, setFormData] = useState({
    request_number: '',
    department: 'المشتريات',
    warehouse_id: '',
    currency: 'USD',
    exchange_rate: 50.50,
    notes: ''
  });

  // بيانات الأصناف (array)
  const [formItems, setFormItems] = useState([
    { item_id: '', quantity: 1, unit: 'عدد', unit_price_usd: 0, unit_price_egp: 0, notes: '' }
  ]);

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal states
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [viewItems, setViewItems] = useState([]);

  // Edit mode
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserRole(user.role || '');
    fetchItems();
    fetchWarehouses();
    fetchRequests();
    fetchNextNumber();
    fetchCurrencies();
  }, []);

  const fetchCurrencies = async () => {
    try {
      const response = await api.get('/currencies');
      setCurrencies(response.data || []);
    } catch (err) {
      console.error('Error fetching currencies:', err);
    }
  };

  const fetchNextNumber = async () => {
    try {
      const response = await api.get('/purchase-requests/next-number');
      setFormData(prev => ({...prev, request_number: response.data.nextNumber}));
    } catch (err) {
      console.error('خطأ في توليد الرقم:', err);
    }
  };

  const fetchItems = async () => {
    try {
      const response = await api.get('/items');
      setItems(response.data);
    } catch (err) {
      console.error('خطأ في تحميل الأصناف:', err);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const response = await api.get('/warehouses');
      setWarehouses(response.data);
    } catch (err) {
      console.error('خطأ في تحميل المخازن:', err);
    }
  };

  const fetchRequests = async () => {
    try {
      const response = await api.get('/purchase-requests/all');
      setRequests(response.data);
    } catch (err) {
      console.error('خطأ في تحميل الطلبات:', err);
    }
  };

  // إضافة صنف جديد
  const addItem = () => {
    setFormItems([...formItems, { item_id: '', quantity: 1, unit: 'عدد', unit_price_usd: 0, unit_price_egp: 0, notes: '' }]);
  };

  // حذف صنف
  const removeItem = (index) => {
    if (formItems.length > 1) {
      setFormItems(formItems.filter((_, i) => i !== index));
    }
  };

  // تعديل صنف
  const updateItem = (index, field, value) => {
    const newItems = [...formItems];
    newItems[index][field] = value;

    if (field === 'item_id') {
      const selectedItem = items.find(item => item.id == value);
      newItems[index].unit = selectedItem?.unit || 'عدد';
    }

    if (field === 'unit_price_usd') {
      newItems[index].unit_price_egp = (parseFloat(value) * parseFloat(formData.exchange_rate || 1)).toFixed(2);
    }

    if (field === 'exchange_rate') {
      newItems.forEach(item => {
        if (item.unit_price_usd) {
          item.unit_price_egp = (parseFloat(item.unit_price_usd) * parseFloat(value || 1)).toFixed(2);
        }
      });
    }

    setFormItems(newItems);
  };

  // حساب الإجمالي
  const calculateTotals = () => {
    let totalUsd = 0;
    let totalEgp = 0;
    formItems.forEach(item => {
      totalUsd += parseFloat(item.unit_price_usd || 0) * parseFloat(item.quantity || 0);
      totalEgp += parseFloat(item.unit_price_egp || 0) * parseFloat(item.quantity || 0);
    });
    return { totalUsd: totalUsd.toFixed(2), totalEgp: totalEgp.toFixed(2) };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const validItems = formItems.filter(item => item.item_id);
    if (validItems.length === 0) {
      setMessage('❌ يجب اختيار صنف واحد على الأقل');
      setLoading(false);
      return;
    }

    try {
      const totals = calculateTotals();
      const data = {
        ...formData,
        items: validItems,
        total_usd: totals.totalUsd,
        total_egp: totals.totalEgp
      };

      if (editingId) {
        // تعديل
        await api.put(`/purchase-requests/${editingId}`, data);
        setMessage('✅ تم تعديل طلب الشراء بنجاح');
      } else {
        // إنشاء جديد
        await api.post('/purchase-requests', data);
        setMessage('✅ تم إرسال طلب الشراء بنجاح');
      }

      resetForm();
      fetchNextNumber();
      fetchRequests();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ غير متوقع'));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ 
      request_number: '', 
      department: 'المشتريات', 
      warehouse_id: '',
      currency: 'USD',
      exchange_rate: 50.50,
      notes: '' 
    });
    setFormItems([{ item_id: '', quantity: 1, unit: 'عدد', unit_price_usd: 0, unit_price_egp: 0, notes: '' }]);
    setEditingId(null);
  };

  // 👁️ عرض تفاصيل الطلب
  const handleView = async (request) => {
    try {
      const response = await api.get(`/purchase-requests/${request.id}`);
      setSelectedRequest(response.data);
      setViewItems(response.data.items || []);
      setShowViewModal(true);
    } catch (err) {
      console.error('خطأ في تحميل التفاصيل:', err);
    }
  };

  // ✏️ تعديل الطلب
  const handleEdit = (request) => {
    if (request.status !== 'pending') {
      setMessage('❌ لا يمكن تعديل طلب معتمد أو مرفوض');
      return;
    }

    setEditingId(request.id);
    setFormData({
      request_number: request.request_number,
      department: request.department || 'المشتريات',
      warehouse_id: request.warehouse_id || '',
      currency: request.currency || 'USD',
      exchange_rate: request.exchange_rate || 50.50,
      notes: request.notes || ''
    });

    if (request.items && request.items.length > 0) {
      setFormItems(request.items.map(item => ({
        item_id: item.item_id,
        quantity: item.quantity,
        unit: item.unit || 'عدد',
        unit_price_usd: item.unit_price_usd || 0,
        unit_price_egp: item.unit_price_egp || 0,
        notes: item.notes || ''
      })));
    }

    // نسكر الـ Modals ونروح للفورم
    setShowViewModal(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 🖨️ طباعة الطلب
  const handlePrint = (request) => {
    setSelectedRequest(request);
    setViewItems(request.items || []);
    setShowPrintModal(true);
  };

  const handleDuplicate = async (request) => {
    if (!window.confirm(`هل تريد تكرار طلب الشراء ${request.request_number}؟`)) return;
    try {
      const response = await api.post(`/purchase-requests/${request.id}/duplicate`);
      setMessage(`✅ ${response.data.message}`);
      fetchRequests();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const handleApprove = async (id, status) => {
    try {
      await api.put(`/purchase-requests/${id}/approve`, { status });
      setMessage(status === 'approved' ? '✅ تم الاعتماد' : '❌ تم الرفض');
      fetchRequests();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending': return '#ffc107';
      case 'approved': return '#28a745';
      case 'rejected': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'pending': return '⏳ بانتظار الاعتماد';
      case 'approved': return '✓ معتمد';
      case 'rejected': return '✕ مرفوض';
      default: return status;
    }
  };

  const thStyle = { padding: '12px', border: '1px solid #ddd', textAlign: 'right' };
  const tdStyle = { padding: '10px', border: '1px solid #ddd', textAlign: 'right' };
  const totals = calculateTotals();

  // Modal styles
  const modalOverlay = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  };
  const modalContent = {
    backgroundColor: 'white', borderRadius: '8px', padding: '30px',
    maxWidth: '900px', width: '90%', maxHeight: '90vh', overflow: 'auto',
    direction: 'rtl'
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl' }}>
      <h1>📝 طلبات الشراء</h1>

       <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={() => window.location.href = '/purchases-module'}
          style={{ padding: '10px 20px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          ← رجوع للمشتريات
        </button>
        <button 
          onClick={() => window.location.href = '/dashboard'}
          style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          🏠 رجوع للرئيسية
        </button>
      </div>

      {message && (
        <p style={{ 
          padding: '15px', 
          backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da', 
          borderRadius: '4px',
          marginBottom: '20px',
          fontWeight: 'bold'
        }}>
          {message}
        </p>
      )}

      {/* نموذج طلب شراء جديد */}
      <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '2px solid #007bff' }}>
        <h3 style={{ color: '#007bff', marginBottom: '20px' }}>
          {editingId ? '✏️ تعديل طلب شراء' : '➕ طلب شراء جديد'}
        </h3>

        <form onSubmit={handleSubmit}>
          {/* بيانات الطلب الرئيسية */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>رقم الطلب:</label>
              <input 
                type="text" 
                value={formData.request_number} 
                readOnly
                style={{ width: '100%', padding: '10px', backgroundColor: '#e2e8f0', border: '1px solid #ddd', borderRadius: '4px' }} 
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>القسم:</label>
              <select 
                value={formData.department} 
                onChange={(e) => setFormData({...formData, department: e.target.value})}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="المشتريات">المشتريات</option>
                <option value="الصيانة">الصيانة</option>
                <option value="الإنتاج">الإنتاج</option>
                <option value="المخازن">المخازن</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>المخزن:</label>
              <select 
                value={formData.warehouse_id} 
                onChange={(e) => setFormData({...formData, warehouse_id: e.target.value})}
                required
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="">-- اختر المخزن --</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>العملة:</label>
              <select 
                value={formData.currency} 
                onChange={(e) => {
                  const selected = currencies.find(c => c.code === e.target.value);
                  const newRate = selected ? parseFloat(selected.exchange_rate) : formData.exchange_rate;
                  setFormData({...formData, currency: e.target.value, exchange_rate: newRate});
                  updateItem(0, 'exchange_rate', newRate);
                }}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                {currencies.length === 0 ? (
                  <>
                    <option value="USD">💵 دولار أمريكي (USD)</option>
                    <option value="EGP">🇪🇬 جنيه مصري (EGP)</option>
                    <option value="EUR">💶 يورو (EUR)</option>
                  </>
                ) : (
                  currencies.map(c => (
                    <option key={c.id} value={c.code}>{c.symbol ? `${c.symbol} ` : ''}{c.name} ({c.code})</option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>سعر الصرف:</label>
              <input 
                type="number" 
                step="0.01"
                value={formData.exchange_rate} 
                onChange={(e) => {
                  setFormData({...formData, exchange_rate: e.target.value});
                  updateItem(0, 'exchange_rate', e.target.value);
                }}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} 
              />
              <small style={{ color: '#888' }}>معبّأ تلقائيًا من شاشة العملات، وتقدر تعدّله يدويًا لو احتجت</small>
            </div>
          </div>

          {/* جدول الأصناف */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h4 style={{ margin: 0, color: '#333' }}>📦 الأصناف</h4>
              <button 
                type="button"
                onClick={addItem}
                style={{ padding: '8px 16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                ➕ إضافة صنف
              </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' }}>
              <thead>
                <tr style={{ backgroundColor: '#343a40', color: 'white' }}>
                  <th style={{...thStyle, width: '30%'}}>الصنف</th>
                  <th style={{...thStyle, width: '10%'}}>الكمية</th>
                  <th style={{...thStyle, width: '10%'}}>الوحدة</th>
                  <th style={{...thStyle, width: '12%'}}>السعر (USD)</th>
                  <th style={{...thStyle, width: '12%'}}>السعر (EGP)</th>
                  <th style={{...thStyle, width: '12%'}}>الإجمالي (USD)</th>
                  <th style={{...thStyle, width: '12%'}}>ملاحظات</th>
                  <th style={{...thStyle, width: '5%'}}></th>
                </tr>
              </thead>
              <tbody>
                {formItems.map((item, index) => (
                  <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'white' }}>
                    <td style={tdStyle}>
                      <select 
                        value={item.item_id} 
                        onChange={(e) => updateItem(index, 'item_id', e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                      >
                        <option value="">-- اختر الصنف --</option>
                        {items.map(it => (
                          <option key={it.id} value={it.id}>
                            {it.code} - {it.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={tdStyle}>
                      <input 
                        type="number" 
                        min="0.001" 
                        step="0.001"
                        value={item.quantity} 
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} 
                      />
                    </td>
                    <td style={tdStyle}>
                      <input 
                        type="text" 
                        value={item.unit} 
                        readOnly
                        style={{ width: '100%', padding: '8px', backgroundColor: '#e2e8f0', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'center' }} 
                      />
                    </td>
                    <td style={tdStyle}>
                      <input 
                        type="number" 
                        min="0" 
                        step="0.01"
                        value={item.unit_price_usd} 
                        onChange={(e) => updateItem(index, 'unit_price_usd', e.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} 
                      />
                    </td>
                    <td style={tdStyle}>
                      <input 
                        type="number" 
                        min="0" 
                        step="0.01"
                        value={item.unit_price_egp} 
                        onChange={(e) => updateItem(index, 'unit_price_egp', e.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} 
                      />
                    </td>
                    <td style={tdStyle}>
                      <strong>{(parseFloat(item.unit_price_usd || 0) * parseFloat(item.quantity || 0)).toFixed(2)}</strong>
                    </td>
                    <td style={tdStyle}>
                      <input 
                        type="text" 
                        value={item.notes} 
                        onChange={(e) => updateItem(index, 'notes', e.target.value)}
                        placeholder="ملاحظات..."
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} 
                      />
                    </td>
                    <td style={tdStyle}>
                      <button 
                        type="button"
                        onClick={() => removeItem(index)}
                        style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#e3f2fd', fontWeight: 'bold' }}>
                  <td colSpan="5" style={{...tdStyle, textAlign: 'left'}}>الإجمالي:</td>
                  <td style={tdStyle}><strong style={{ color: '#007bff' }}>${totals.totalUsd}</strong></td>
                  <td style={tdStyle}><strong style={{ color: '#28a745' }}>{totals.totalEgp} ج.م</strong></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>ملاحظات الطلب:</label>
            <input 
              type="text" 
              value={formData.notes} 
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="أي ملاحظات إضافية..."
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} 
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              type="submit" 
              disabled={loading}
              style={{ 
                padding: '12px 40px', 
                backgroundColor: loading ? '#6c757d' : '#007bff', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '16px', 
                fontWeight: 'bold'
              }}
            >
              {loading ? '⏳ جاري...' : (editingId ? '💾 حفظ التعديلات' : '📤 إرسال الطلب')}
            </button>

            {editingId && (
              <button 
                type="button"
                onClick={resetForm}
                style={{ 
                  padding: '12px 30px', 
                  backgroundColor: '#6c757d', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px', 
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                ❌ إلغاء
              </button>
            )}
          </div>
        </form>
      </div>

      {/* قائمة طلبات الشراء */}
      <h3>📋 جميع طلبات الشراء</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', backgroundColor: 'white' }}>
          <thead>
            <tr style={{ backgroundColor: '#343a40', color: 'white' }}>
              <th style={thStyle}>رقم الطلب</th>
              <th style={thStyle}>التاريخ</th>
              <th style={thStyle}>القسم</th>
              <th style={thStyle}>المخزن</th>
              <th style={thStyle}>العملة</th>
              <th style={thStyle}>سعر الصرف</th>
              <th style={thStyle}>الإجمالي (USD)</th>
              <th style={thStyle}>الإجمالي (EGP)</th>
              <th style={thStyle}>الحالة</th>
              <th style={thStyle}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '30px', color: '#6c757d' }}>
                  لا يوجد طلبات شراء
                </td>
              </tr>
            ) : (
              requests.map(r => (
                <tr key={r.id} style={{ backgroundColor: r.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                  <td style={tdStyle}><strong>{r.request_number}</strong></td>
                  <td style={tdStyle}>{new Date(r.created_at).toLocaleDateString('ar-EG')}</td>
                  <td style={tdStyle}>{r.department}</td>
                  <td style={tdStyle}>{r.warehouse_name || '-'}</td>
                  <td style={tdStyle}>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      backgroundColor: r.currency === 'USD' ? '#e3f2fd' : r.currency === 'EUR' ? '#fff3e0' : '#e8f5e9'
                    }}>
                      {r.currency === 'USD' ? '💵 USD' : r.currency === 'EUR' ? '💶 EUR' : '🇪🇬 EGP'}
                    </span>
                  </td>
                  <td style={tdStyle}>{r.exchange_rate}</td>
                  <td style={tdStyle}><strong style={{ color: '#007bff' }}>${r.total_usd || 0}</strong></td>
                  <td style={tdStyle}><strong style={{ color: '#28a745' }}>{r.total_egp || 0} ج.م</strong></td>
                  <td style={tdStyle}>
                    <span style={{ 
                      color: getStatusColor(r.status),
                      fontWeight: 'bold',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      backgroundColor: getStatusColor(r.status) + '20'
                    }}>
                      {getStatusText(r.status)}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {/* 👁️ عرض */}
                      <button 
                        onClick={() => handleView(r)}
                        style={{ padding: '5px 10px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        👁️ عرض
                      </button>

                      {/* 📋 تكرار */}
                      <button 
                        onClick={() => handleDuplicate(r)}
                        style={{ padding: '5px 10px', backgroundColor: '#6f42c1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        📋 تكرار
                      </button>

                      {/* ✏️ تعديل (لو pending) */}
                      {r.status === 'pending' && (
                        <button 
                          onClick={() => handleEdit(r)}
                          style={{ padding: '5px 10px', backgroundColor: '#ffc107', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          ✏️ تعديل
                        </button>
                      )}

                      {/* 🖨️ طباعة */}
                      <button 
                        onClick={() => handlePrint(r)}
                        style={{ padding: '5px 10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        🖨️ طباعة
                      </button>

                      {/* اعتماد/رفض */}
                      {r.status === 'pending' && (userRole === 'admin' || userRole === 'purchasing') && (
                        <>
                          <button 
                            onClick={() => handleApprove(r.id, 'approved')}
                            style={{ padding: '5px 10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                          >
                            ✓ اعتماد
                          </button>
                          <button 
                            onClick={() => handleApprove(r.id, 'rejected')}
                            style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                          >
                            ✕ رفض
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 👁️ Modal عرض التفاصيل */}
      {showViewModal && selectedRequest && (
        <div style={modalOverlay} onClick={() => setShowViewModal(false)}>
          <div style={modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>👁️ تفاصيل طلب الشراء</h2>
              <button 
                onClick={() => setShowViewModal(false)}
                style={{ padding: '5px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                ✕ إغلاق
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <div><strong>رقم الطلب:</strong> {selectedRequest.request_number}</div>
              <div><strong>التاريخ:</strong> {new Date(selectedRequest.request_date).toLocaleDateString('ar-EG')}</div>
              <div><strong>القسم:</strong> {selectedRequest.department}</div>
              <div><strong>المخزن:</strong> {selectedRequest.warehouse_name || '-'}</div>
              <div><strong>العملة:</strong> {selectedRequest.currency}</div>
              <div><strong>سعر الصرف:</strong> {selectedRequest.exchange_rate}</div>
              <div><strong>الحالة:</strong> 
                <span style={{ 
                  color: getStatusColor(selectedRequest.status),
                  fontWeight: 'bold',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: getStatusColor(selectedRequest.status) + '20'
                }}>
                  {getStatusText(selectedRequest.status)}
                </span>
              </div>
              <div><strong>طلب بواسطة:</strong> {selectedRequest.requested_by_name}</div>
            </div>

            <h3>📦 الأصناف</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <thead>
                <tr style={{ backgroundColor: '#343a40', color: 'white' }}>
                  <th style={thStyle}>الصنف</th>
                  <th style={thStyle}>الكود</th>
                  <th style={thStyle}>الكمية</th>
                  <th style={thStyle}>الوحدة</th>
                  <th style={thStyle}>السعر (USD)</th>
                  <th style={thStyle}>السعر (EGP)</th>
                  <th style={thStyle}>الإجمالي (USD)</th>
                  <th style={thStyle}>ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {viewItems.map((item, index) => (
                  <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'white' }}>
                    <td style={tdStyle}>{item.item_name}</td>
                    <td style={tdStyle}>{item.item_code}</td>
                    <td style={tdStyle}>{item.quantity}</td>
                    <td style={tdStyle}>{item.unit}</td>
                    <td style={tdStyle}>${item.unit_price_usd}</td>
                    <td style={tdStyle}>{item.unit_price_egp} ج.م</td>
                    <td style={tdStyle}><strong>${item.total_usd}</strong></td>
                    <td style={tdStyle}>{item.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#e3f2fd', fontWeight: 'bold' }}>
                  <td colSpan="6" style={{...tdStyle, textAlign: 'left'}}>الإجمالي:</td>
                  <td style={tdStyle}><strong style={{ color: '#007bff' }}>${selectedRequest.total_usd || 0}</strong></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            <div style={{ marginBottom: '15px' }}>
              <strong>ملاحظات:</strong> {selectedRequest.notes || 'لا يوجد'}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              {selectedRequest.status === 'pending' && (
                <button 
                  onClick={() => { setShowViewModal(false); handleEdit(selectedRequest); }}
                  style={{ padding: '10px 30px', backgroundColor: '#ffc107', color: '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  ✏️ تعديل
                </button>
              )}
              <button 
                onClick={() => { setShowViewModal(false); handlePrint(selectedRequest); }}
                style={{ padding: '10px 30px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                🖨️ طباعة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🖨️ Modal الطباعة */}
      {showPrintModal && selectedRequest && (
        <div style={modalOverlay} onClick={() => setShowPrintModal(false)}>
          <div style={{...modalContent, maxWidth: '800px'}} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>🖨️ معاينة الطباعة</h2>
              <button 
                onClick={() => setShowPrintModal(false)}
                style={{ padding: '5px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                ✕ إغلاق
              </button>
            </div>

            {/* نموذج الطباعة */}
            <div id="print-area" style={{ padding: '30px', border: '2px solid #333', backgroundColor: 'white' }}>
              <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #333', paddingBottom: '20px' }}>
                <h1 style={{ margin: '0', fontSize: '28px' }}>طلب شراء</h1>
                <p style={{ margin: '10px 0', fontSize: '18px' }}>رقم: {selectedRequest.request_number}</p>
                <p style={{ margin: '5px 0', color: '#666' }}>التاريخ: {new Date(selectedRequest.request_date).toLocaleDateString('ar-EG')}</p>
              </div>

              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  <div><strong>القسم:</strong> {selectedRequest.department}</div>
                  <div><strong>المخزن:</strong> {selectedRequest.warehouse_name || '-'}</div>
                  <div><strong>العملة:</strong> {selectedRequest.currency}</div>
                  <div><strong>سعر الصرف:</strong> {selectedRequest.exchange_rate}</div>
                  <div><strong>الحالة:</strong> {getStatusText(selectedRequest.status)}</div>
                  <div><strong>طلب بواسطة:</strong> {selectedRequest.requested_by_name}</div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#333', color: 'white' }}>
                    <th style={{...thStyle, border: '2px solid #333'}}>#</th>
                    <th style={{...thStyle, border: '2px solid #333'}}>الصنف</th>
                    <th style={{...thStyle, border: '2px solid #333'}}>الكمية</th>
                    <th style={{...thStyle, border: '2px solid #333'}}>الوحدة</th>
                    <th style={{...thStyle, border: '2px solid #333'}}>السعر (USD)</th>
                    <th style={{...thStyle, border: '2px solid #333'}}>الإجمالي (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {viewItems.map((item, index) => (
                    <tr key={index}>
                      <td style={{...tdStyle, border: '1px solid #333'}}>{index + 1}</td>
                      <td style={{...tdStyle, border: '1px solid #333'}}>{item.item_name}</td>
                      <td style={{...tdStyle, border: '1px solid #333'}}>{item.quantity}</td>
                      <td style={{...tdStyle, border: '1px solid #333'}}>{item.unit}</td>
                      <td style={{...tdStyle, border: '1px solid #333'}}>${item.unit_price_usd}</td>
                      <td style={{...tdStyle, border: '1px solid #333'}}><strong>${item.total_usd}</strong></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
                    <td colSpan="5" style={{...tdStyle, border: '2px solid #333', textAlign: 'left'}}>الإجمالي:</td>
                    <td style={{...tdStyle, border: '2px solid #333'}}><strong>${selectedRequest.total_usd || 0}</strong></td>
                  </tr>
                  <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
                    <td colSpan="5" style={{...tdStyle, border: '2px solid #333', textAlign: 'left'}}>الإجمالي (EGP):</td>
                    <td style={{...tdStyle, border: '2px solid #333'}}><strong>{selectedRequest.total_egp || 0} ج.م</strong></td>
                  </tr>
                </tfoot>
              </table>

              <div style={{ marginTop: '30px', padding: '15px', border: '1px solid #333', borderRadius: '4px' }}>
                <strong>ملاحظات:</strong><br/>
                {selectedRequest.notes || 'لا يوجد ملاحظات'}
              </div>

              <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ borderTop: '1px solid #333', paddingTop: '10px', width: '200px' }}>توقيع المسؤول</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ borderTop: '1px solid #333', paddingTop: '10px', width: '200px' }}>توقيع المدير</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button 
                onClick={() => window.print()}
                style={{ padding: '12px 40px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
              >
                🖨️ طباعة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PurchaseRequests;