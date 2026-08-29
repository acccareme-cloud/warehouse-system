import { useState, useEffect } from 'react';
import api from '../services/api';

function PurchaseOrders() {
  const [activeTab, setActiveTab] = useState('local');
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [message, setMessage] = useState('');
  const [userRole, setUserRole] = useState('');

  // Modal states
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [viewItems, setViewItems] = useState([]);

  // Edit mode
  const [editingId, setEditingId] = useState(null);

  // Form data
  const [formData, setFormData] = useState({
    order_number: '',
    order_type: 'local',
    supplier: '',
    warehouse_id: '',
    currency: 'USD',
    exchange_rate: 50.50,
    notes: '',
    purchase_request_id: null
  });

  // Form items (multi-item)
  const [formItems, setFormItems] = useState([
    { item_id: '', quantity: 1, unit: 'عدد', unit_price_usd: 0, unit_price_egp: 0, notes: '' }
  ]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserRole(user.role || '');
    fetchItems();
    fetchWarehouses();
    fetchSuppliers();
    fetchOrders();
    fetchApprovedRequests();
  }, [activeTab]);

  const fetchItems = async () => {
    try {
      const res = await api.get('/items');
      setItems(res.data);
    } catch (err) {
      console.error('خطأ في تحميل الاصناف');
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await api.get('/warehouses');
      setWarehouses(res.data);
    } catch (err) {
      console.error('خطأ في تحميل المخازن');
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/suppliers');
      setSuppliers(res.data);
    } catch (err) {
      console.error('خطأ في تحميل الموردين');
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await api.get('/purchase-orders');
      setOrders(res.data.filter(o => o.order_type === activeTab));
    } catch (err) {
      console.error('خطأ في تحميل اوامر الشراء');
    }
  };

  const fetchApprovedRequests = async () => {
    try {
      const res = await api.get('/purchase-orders/approved-requests');
      setApprovedRequests(res.data);
    } catch (err) {
      console.error('خطأ في تحميل الطلبات المعتمدة');
    }
  };

  const fetchNextNumber = async () => {
    try {
      const res = await api.get(`/purchase-orders/next-number?type=${activeTab}`);
      setFormData(prev => ({...prev, order_number: res.data.nextNumber}));
    } catch (err) {
      console.error('خطأ في توليد الرقم');
    }
  };

  // Add item
  const addItem = () => {
    setFormItems([...formItems, { item_id: '', quantity: 1, unit: 'عدد', unit_price_usd: 0, unit_price_egp: 0, notes: '' }]);
  };

  // Remove item
  const removeItem = (index) => {
    if (formItems.length > 1) {
      setFormItems(formItems.filter((_, i) => i !== index));
    }
  };

  // Update item
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

  // Calculate totals
  const calculateTotals = () => {
    let totalUsd = 0;
    let totalEgp = 0;
    formItems.forEach(item => {
      totalUsd += parseFloat(item.unit_price_usd || 0) * parseFloat(item.quantity || 0);
      totalEgp += parseFloat(item.unit_price_egp || 0) * parseFloat(item.quantity || 0);
    });
    return { totalUsd: totalUsd.toFixed(2), totalEgp: totalEgp.toFixed(2) };
  };

  const handleShowForm = () => {
    setShowForm(true);
    setShowImportForm(false);
    setEditingId(null);
    fetchNextNumber();
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      order_number: '',
      order_type: activeTab,
      supplier: '',
      warehouse_id: '',
      currency: 'USD',
      exchange_rate: 50.50,
      notes: '',
      purchase_request_id: null
    });
    setFormItems([{ item_id: '', quantity: 1, unit: 'عدد', unit_price_usd: 0, unit_price_egp: 0, notes: '' }]);
  };

  // Import from request (with partial quantity)
  const handleImportRequest = (request) => {
    setShowForm(true);
    setShowImportForm(false);
    setEditingId(null);
    fetchNextNumber();

    setFormData({
      order_number: '',
      order_type: activeTab,
      supplier: '',
      warehouse_id: request.warehouse_id || '',
      currency: request.currency || 'USD',
      exchange_rate: request.exchange_rate || 50.50,
      notes: `مستورد من طلب: ${request.request_number}`,
      purchase_request_id: request.id
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validItems = formItems.filter(item => item.item_id);
    if (validItems.length === 0) {
      setMessage('❌ يجب اختيار صنف واحد على الأقل');
      return;
    }

    try {
      const totals = calculateTotals();
      const data = {
        ...formData,
        order_type: activeTab,
        items: validItems,
        total_usd: totals.totalUsd,
        total_egp: totals.totalEgp
      };

      if (editingId) {
        await api.put(`/purchase-orders/${editingId}`, data);
        setMessage('✅ تم تعديل امر الشراء بنجاح');
      } else {
        await api.post('/purchase-orders', data);
        setMessage('✅ تم إنشاء امر الشراء بنجاح');
      }

      setShowForm(false);
      setEditingId(null);
      resetForm();
      fetchOrders();
      fetchApprovedRequests();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  // View order details
  const handleView = async (order) => {
    try {
      const res = await api.get(`/purchase-orders/${order.id}`);
      setSelectedOrder(res.data);
      setViewItems(res.data.items || []);
      setShowViewModal(true);
    } catch (err) {
      console.error('خطأ في تحميل التفاصيل:', err);
    }
  };

  // Edit order
  const handleEdit = (order) => {
    if (order.status !== 'draft') {
      setMessage('❌ لا يمكن تعديل امر معتمد أو مرفوض');
      return;
    }

    setEditingId(order.id);
    setFormData({
      order_number: order.order_number,
      order_type: order.order_type,
      supplier: order.supplier || '',
      warehouse_id: order.warehouse_id || '',
      currency: order.currency || 'USD',
      exchange_rate: order.exchange_rate || 50.50,
      notes: order.notes || '',
      purchase_request_id: order.purchase_request_id
    });

    if (order.items && order.items.length > 0) {
      setFormItems(order.items.map(item => ({
        item_id: item.item_id,
        quantity: item.quantity,
        unit: item.unit || 'عدد',
        unit_price_usd: item.unit_price_usd || 0,
        unit_price_egp: item.unit_price_egp || 0,
        notes: item.notes || ''
      })));
    }

    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDuplicate = async (order) => {
    if (!window.confirm(`هل تريد تكرار امر الشراء ${order.order_number}؟`)) return;
    try {
      const response = await api.post(`/purchase-orders/${order.id}/duplicate`);
      setMessage(`✅ ${response.data.message}`);
      fetchOrders();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  // Cancel approval — إلغاء اعتماد أمر الشراء
const handleCancel = async (order) => {
    if (!window.confirm(`هل تريد إلغاء اعتماد أمر الشراء ${order.order_number} وإرجاعه لحالة مسودة؟`)) return;
    try {
      const response = await api.put(`/purchase-orders/${order.id}/cancel`);
      setMessage('✅ ' + response.data.message);
      fetchOrders();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

// Delete order
const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف امر الشراء؟')) return;

    try {
      await api.delete(`/purchase-orders/${id}`);
      setMessage('✅ تم حذف امر الشراء');
      fetchOrders();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  // Print order
  const handlePrint = (order) => {
    setSelectedOrder(order);
    setViewItems(order.items || []);
    setShowPrintModal(true);
  };

  const handleApprove = async (id, status) => {
    try {
      await api.put(`/purchase-orders/${id}/approve`, { status });
      setMessage(status === 'approved' ? '✅ تم الاعتماد' : '❌ تم الرفض');
      fetchOrders();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const getStatusText = (status) => {
    const statuses = {
      'draft': '✏️ مسودة',
      'approved': '✓ معتمد',
      'rejected': '✕ مرفوض'
    };
    return statuses[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      'draft': '#6c757d',
      'approved': '#28a745',
      'rejected': '#dc3545'
    };
    return colors[status] || '#6c757d';
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
      <h1>📋 أوامر الشراء</h1>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={() => window.location.href = '/purchases-module'}
          style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
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

      {/* Tabs */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={() => { setActiveTab('local'); setShowForm(false); setEditingId(null); }}
          style={{ 
            padding: '12px 30px', 
            backgroundColor: activeTab === 'local' ? '#0d9488' : '#e2e8f0', 
            color: activeTab === 'local' ? 'white' : '#333',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            fontSize: '16px', fontWeight: 'bold'
          }}
        >
          🏠 محلي
        </button>
        <button
          onClick={() => { setActiveTab('import'); setShowForm(false); setEditingId(null); }}
          style={{ 
            padding: '12px 30px', 
            backgroundColor: activeTab === 'import' ? '#92400e' : '#e2e8f0', 
            color: activeTab === 'import' ? 'white' : '#333',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            fontSize: '16px', fontWeight: 'bold'
          }}
        >
          🚢 استيراد
        </button>
        <button
          onClick={handleShowForm}
          style={{ 
            padding: '12px 30px', backgroundColor: '#28a745', color: 'white',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            fontSize: '16px', fontWeight: 'bold'
          }}
        >
          ➕ امر شراء جديد
        </button>
      </div>

      {/* Approved Requests Import */}
      {approvedRequests.length > 0 && !showForm && (
        <div style={{ backgroundColor: '#fff3cd', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '2px solid #ffc107' }}>
          <h3 style={{ color: '#856404', marginBottom: '15px' }}>📥 طلبات شراء معتمدة (مستعدة للتحويل لأوامر شراء)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#ffc107', color: '#333' }}>
                <th style={thStyle}>رقم الطلب</th>
                <th style={thStyle}>القسم</th>
                <th style={thStyle}>العملة</th>
                <th style={thStyle}>سعر الصرف</th>
                <th style={thStyle}>الإجمالي (USD)</th>
                <th style={thStyle}>الإجمالي (EGP)</th>
                <th style={thStyle}>الأصناف</th>
                <th style={thStyle}>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {approvedRequests.map(r => (
                <tr key={r.id} style={{ backgroundColor: 'white' }}>
                  <td style={tdStyle}><strong>{r.request_number}</strong></td>
                  <td style={tdStyle}>{r.department}</td>
                  <td style={tdStyle}>
                    <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', backgroundColor: r.currency === 'USD' ? '#e3f2fd' : r.currency === 'EUR' ? '#fff3e0' : '#e8f5e9' }}>
                      {r.currency === 'USD' ? '💵 USD' : r.currency === 'EUR' ? '💶 EUR' : '🇪🇬 EGP'}
                    </span>
                  </td>
                  <td style={tdStyle}>{r.exchange_rate}</td>
                  <td style={tdStyle}><strong style={{ color: '#007bff' }}>${r.total_usd || 0}</strong></td>
                  <td style={tdStyle}><strong style={{ color: '#28a745' }}>{r.total_egp || 0} ج.م</strong></td>
                  <td style={tdStyle}>{r.items ? r.items.length : 0} صنف</td>
                  <td style={tdStyle}>
                    <button 
                      onClick={() => handleImportRequest(r)}
                      style={{ padding: '8px 15px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      📥 استيراد
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: `3px solid ${activeTab === 'import' ? '#92400e' : '#0d9488'}` }}>
          <h3 style={{ color: activeTab === 'import' ? '#92400e' : '#0d9488' }}>
            {editingId ? '✏️ تعديل امر شراء' : `➕ امر شراء ${activeTab === 'local' ? 'محلي' : 'استيراد'} جديد`}
          </h3>

          {/* Main data */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>رقم الامر:</label>
              <input type="text" value={formData.order_number} readOnly style={{ width: '100%', padding: '10px', backgroundColor: '#e2e8f0', border: '1px solid #ddd', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>المورد:</label>
              <select 
                value={formData.supplier} 
                onChange={e => setFormData({...formData, supplier: e.target.value})} 
                required 
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="">اختر المورد</option>
                {suppliers.filter(s => s.status === 'active' || s.is_active === true).map(s => (
                  <option key={s.id} value={s.supplier_name || s.name}>{s.supplier_code || s.code} - {s.supplier_name || s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>المخزن:</label>
              <select 
                value={formData.warehouse_id} 
                onChange={e => setFormData({...formData, warehouse_id: e.target.value})} 
                required 
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="">اختر المخزن</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>العملة:</label>
              <select 
                value={formData.currency} 
                onChange={e => setFormData({...formData, currency: e.target.value})}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="USD">💵 دولار أمريكي (USD)</option>
                <option value="EGP">🇪🇬 جنيه مصري (EGP)</option>
                <option value="EUR">💶 يورو (EUR)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>سعر الصرف:</label>
              <input 
                type="number" step="0.01"
                value={formData.exchange_rate} 
                onChange={e => {
                  setFormData({...formData, exchange_rate: e.target.value});
                  updateItem(0, 'exchange_rate', e.target.value);
                }}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} 
              />
            </div>
          </div>

          {/* Items table */}
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
                        type="number" min="0.001" step="0.001"
                        value={item.quantity} 
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} 
                      />
                    </td>
                    <td style={tdStyle}>
                      <input 
                        type="text" value={item.unit} readOnly
                        style={{ width: '100%', padding: '8px', backgroundColor: '#e2e8f0', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'center' }} 
                      />
                    </td>
                    <td style={tdStyle}>
                      <input 
                        type="number" min="0" step="0.01"
                        value={item.unit_price_usd} 
                        onChange={(e) => updateItem(index, 'unit_price_usd', e.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} 
                      />
                    </td>
                    <td style={tdStyle}>
                      <input 
                        type="number" min="0" step="0.01"
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
                        type="text" value={item.notes} 
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
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>ملاحظات:</label>
            <input 
              type="text" value={formData.notes} 
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="أي ملاحظات إضافية..."
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} 
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              type="submit" 
              style={{ 
                padding: '12px 40px', backgroundColor: '#007bff', color: 'white',
                border: 'none', borderRadius: '8px', cursor: 'pointer',
                fontSize: '16px', fontWeight: 'bold'
              }}
            >
              💾 {editingId ? 'حفظ التعديلات' : 'حفظ الامر'}
            </button>
            <button 
              type="button"
              onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}
              style={{ 
                padding: '12px 30px', backgroundColor: '#6c757d', color: 'white',
                border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px'
              }}
            >
              ❌ إلغاء
            </button>
          </div>
        </form>
      )}

      {/* Orders List */}
      <h3>📋 {activeTab === 'local' ? 'اوامر الشراء المحلية' : 'اوامر الشراء الاستيرادية'} ({orders.length})</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', backgroundColor: 'white' }}>
          <thead>
            <tr style={{ backgroundColor: activeTab === 'local' ? '#0d9488' : '#92400e', color: 'white' }}>
              <th style={thStyle}>رقم الامر</th>
              <th style={thStyle}>المورد</th>
              <th style={thStyle}>المخزن</th>
              <th style={thStyle}>العملة</th>
              <th style={thStyle}>سعر الصرف</th>
              <th style={thStyle}>الإجمالي (USD)</th>
              <th style={thStyle}>الإجمالي (EGP)</th>
              <th style={thStyle}>الأصناف</th>
              <th style={thStyle}>الحالة</th>
              <th style={thStyle}>إجراء</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '30px', color: '#6c757d' }}>
                  لا يوجد اوامر شراء
                </td>
              </tr>
            ) : (
              orders.map(o => (
                <tr key={o.id} style={{ backgroundColor: o.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                  <td style={tdStyle}><strong>{o.order_number}</strong></td>
                  <td style={tdStyle}>{o.supplier}</td>
                  <td style={tdStyle}>{o.warehouse_name || '-'}</td>
                  <td style={tdStyle}>
                    <span style={{ 
                      padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold',
                      backgroundColor: o.currency === 'USD' ? '#e3f2fd' : o.currency === 'EUR' ? '#fff3e0' : '#e8f5e9'
                    }}>
                      {o.currency === 'USD' ? '💵 USD' : o.currency === 'EUR' ? '💶 EUR' : '🇪🇬 EGP'}
                    </span>
                  </td>
                  <td style={tdStyle}>{o.exchange_rate}</td>
                  <td style={tdStyle}><strong style={{ color: '#007bff' }}>${o.total_usd || 0}</strong></td>
                  <td style={tdStyle}><strong style={{ color: '#28a745' }}>{o.total_egp || 0} ج.م</strong></td>
                  <td style={tdStyle}>{o.items ? o.items.length : 0} صنف</td>
                  <td style={tdStyle}>
                    <span style={{ 
                      color: getStatusColor(o.status), fontWeight: 'bold',
                      padding: '4px 12px', borderRadius: '12px',
                      backgroundColor: getStatusColor(o.status) + '20'
                    }}>
                      {getStatusText(o.status)}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      <button 
                        onClick={() => handleView(o)}
                        style={{ padding: '5px 10px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        👁️ عرض
                      </button>
                      <button 
                        onClick={() => handleDuplicate(o)}
                        style={{ padding: '5px 10px', backgroundColor: '#6f42c1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        📋 تكرار
                      </button>

                      {o.status === 'approved' && (userRole === 'admin' || userRole === 'purchasing') && (
                        <button 
                          onClick={() => handleCancel(o)}
                          style={{ padding: '5px 10px', backgroundColor: '#fd7e14', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          ↩️ إلغاء الاعتماد
                        </button>
                      )}

                      {o.status === 'draft' && (
                        <>
                          <button 
                            onClick={() => handleEdit(o)}
                            style={{ padding: '5px 10px', backgroundColor: '#ffc107', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                          >
                            ✏️ تعديل
                          </button>
                          <button 
                            onClick={() => handleDelete(o.id)}
                            style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                          >
                            🗑️ حذف
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => handlePrint(o)}
                        style={{ padding: '5px 10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        🖨️ طباعة
                      </button>
                      {o.status === 'draft' && (userRole === 'admin' || userRole === 'purchasing') && (
                        <>
                          <button 
                            onClick={() => handleApprove(o.id, 'approved')}
                            style={{ padding: '5px 10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                          >
                            ✓ اعتماد
                          </button>
                          <button 
                            onClick={() => handleApprove(o.id, 'rejected')}
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

      {/* View Modal */}
      {showViewModal && selectedOrder && (
        <div style={modalOverlay} onClick={() => setShowViewModal(false)}>
          <div style={modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>👁️ تفاصيل امر الشراء</h2>
              <button 
                onClick={() => setShowViewModal(false)}
                style={{ padding: '5px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                ✕ إغلاق
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <div><strong>رقم الامر:</strong> {selectedOrder.order_number}</div>
              <div><strong>التاريخ:</strong> {new Date(selectedOrder.created_at).toLocaleDateString('ar-EG')}</div>
              <div><strong>المورد:</strong> {selectedOrder.supplier}</div>
              <div><strong>المخزن:</strong> {selectedOrder.warehouse_name || '-'}</div>
              <div><strong>العملة:</strong> {selectedOrder.currency}</div>
              <div><strong>سعر الصرف:</strong> {selectedOrder.exchange_rate}</div>
              <div><strong>الحالة:</strong> {getStatusText(selectedOrder.status)}</div>
              <div><strong>الأصناف:</strong> {viewItems.length} صنف</div>
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
                  <td style={tdStyle}><strong style={{ color: '#007bff' }}>${selectedOrder.total_usd || 0}</strong></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            <div style={{ marginBottom: '15px' }}>
              <strong>ملاحظات:</strong> {selectedOrder.notes || 'لا يوجد'}
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {showPrintModal && selectedOrder && (
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

            <div id="print-area" style={{ padding: '30px', border: '2px solid #333', backgroundColor: 'white' }}>
              <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #333', paddingBottom: '20px' }}>
                <h1 style={{ margin: '0', fontSize: '28px' }}>أمر شراء</h1>
                <p style={{ margin: '10px 0', fontSize: '18px' }}>رقم: {selectedOrder.order_number}</p>
                <p style={{ margin: '5px 0', color: '#666' }}>التاريخ: {new Date(selectedOrder.created_at).toLocaleDateString('ar-EG')}</p>
              </div>

              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  <div><strong>المورد:</strong> {selectedOrder.supplier}</div>
                  <div><strong>المخزن:</strong> {selectedOrder.warehouse_name || '-'}</div>
                  <div><strong>العملة:</strong> {selectedOrder.currency}</div>
                  <div><strong>سعر الصرف:</strong> {selectedOrder.exchange_rate}</div>
                  <div><strong>الحالة:</strong> {getStatusText(selectedOrder.status)}</div>
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
                    <td style={{...tdStyle, border: '2px solid #333'}}><strong>${selectedOrder.total_usd || 0}</strong></td>
                  </tr>
                  <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
                    <td colSpan="5" style={{...tdStyle, border: '2px solid #333', textAlign: 'left'}}>الإجمالي (EGP):</td>
                    <td style={{...tdStyle, border: '2px solid #333'}}><strong>{selectedOrder.total_egp || 0} ج.م</strong></td>
                  </tr>
                </tfoot>
              </table>

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

export default PurchaseOrders;