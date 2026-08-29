import { useState, useEffect } from 'react';
import api from '../services/api';

function Purchases() {
  const [activeTab, setActiveTab] = useState('local');
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [approvedOrders, setApprovedOrders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [userRole, setUserRole] = useState('');
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [message, setMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);

  const [taxControls, setTaxControls] = useState({
    has_vat: true,
    has_discount_tax: true
  });

  // Main form data (without item-specific fields)
  const [formData, setFormData] = useState({
    purchase_number: '',
    supplier: '',
    warehouse_id: '',
    tax_discount_percent: 0,
    shipment_id: '',
    notes: ''
  });

  // Multi-item form items
  const [formItems, setFormItems] = useState([
    { item_id: '', quantity: 1, unit: 'عدد', unit_price: 0, notes: '' }
  ]);

  const [calculations, setCalculations] = useState({
    subtotal: 0,
    tax14: 0,
    taxDiscount: 0,
    netAmount: 0
  });

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserRole(user.role || '');
    fetchItems();
    fetchWarehouses();
    fetchPurchases();
  }, [activeTab]);

  useEffect(() => {
    calculateTotals();
  }, [formItems, taxControls, formData.tax_discount_percent]);

  const fetchItems = async () => {
    try {
      const response = await api.get('/items');
      setItems(response.data);
    } catch (err) {
      console.error('خطأ في تحميل الاصناف');
    }
  };

  const fetchWarehouses = async () => {
    try {
      const response = await api.get('/warehouses');
      setWarehouses(response.data);
    } catch (err) {
      console.error('خطأ في تحميل المخازن');
    }
  };

  const fetchPurchases = async () => {
    try {
      const response = await api.get('/purchases');
      setPurchases(response.data.filter(p => p.purchase_type === activeTab));
    } catch (err) {
      console.error('خطأ في تحميل المشتريات');
    }
  };

  const fetchApprovedOrders = async () => {
    try {
      const response = await api.get('/purchase-orders/approved-orders');
      setApprovedOrders(response.data.filter(o => o.order_type === activeTab));
    } catch (err) {
      console.error('خطأ في تحميل أوامر الشراء');
    }
  };

  const fetchNextNumber = async () => {
    try {
      const type = activeTab === 'import' ? 'import' : 'local';
      const response = await api.get(`/purchases/next-number?type=${type}`);
      setFormData(prev => ({...prev, purchase_number: response.data.nextNumber}));
    } catch (err) {
      console.error('خطأ في توليد الرقم');
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setShowForm(false);
    setEditingId(null);
    fetchPurchases();
  };

  const handleShowForm = () => {
    setEditingId(null);
    setShowForm(true);
    setShowImportForm(false);
    fetchNextNumber();
    resetForm();
  };

  const handleShowImport = () => {
    setShowForm(false);
    setShowImportForm(true);
    fetchApprovedOrders();
  };

  const handleShowList = () => {
    setShowForm(false);
    setEditingId(null);
    fetchPurchases();
  };

  const handleImportFromPO = async (order) => {
    try {
      const response = await api.post('/purchases/from-po', {
        purchase_order_id: order.id
      });
      setMessage('✅ تم إنشاء الفاتورة من أمر الشراء بنجاح');
      setShowImportForm(false);
      fetchPurchases();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const handleView = async (purchase) => {
    try {
      const response = await api.get(`/purchases/${purchase.id}/items`);
      setSelectedPurchase({ ...purchase, items: response.data || [] });
      setShowViewModal(true);
    } catch (err) {
      setSelectedPurchase(purchase);
      setShowViewModal(true);
    }
  };

  const handlePrint = (purchase) => {
    setSelectedPurchase(purchase);
    setShowPrintModal(true);
  };

  const handleDuplicate = async (purchase) => {
    if (!window.confirm(`هل تريد تكرار الفاتورة ${purchase.purchase_number}؟`)) return;
    try {
      const response = await api.post(`/purchases/${purchase.id}/duplicate`);
      setMessage(`✅ ${response.data.message}`);
      fetchPurchases();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const handleCancel = async (purchase) => {
    if (!window.confirm(`هل تريد إلغاء اعتماد الفاتورة ${purchase.purchase_number} وإرجاعها لحالة مسودة؟`)) return;
    try {
      const response = await api.put(`/purchases/${purchase.id}/cancel`);
      setMessage('✅ ' + response.data.message);
      fetchPurchases();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  // Multi-item handlers
  const addItem = () => {
    setFormItems([...formItems, { item_id: '', quantity: 1, unit: 'عدد', unit_price: 0, notes: '' }]);
  };

  const removeItem = (index) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formItems];
    newItems[index][field] = value;

    if (field === 'item_id') {
      const selectedItem = items.find(item => item.id == value);
      newItems[index].unit = selectedItem?.unit || 'عدد';
    }

    setFormItems(newItems);
  };

  const calculateTotals = () => {
    let subtotal = 0;
    formItems.forEach(item => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      subtotal += qty * price;
    });

    const tax14 = taxControls.has_vat ? subtotal * 0.14 : 0;
    const taxDiscountRate = taxControls.has_discount_tax ? (parseFloat(formData.tax_discount_percent || 0)) : 0;
    const taxDiscount = subtotal * (taxDiscountRate / 100);
    const netAmount = subtotal + tax14 - taxDiscount;

    setCalculations({
      subtotal: subtotal.toFixed(2),
      tax14: tax14.toFixed(2),
      taxDiscount: taxDiscount.toFixed(2),
      netAmount: netAmount.toFixed(2)
    });
  };

  const handleFileChange = (e) => {
    setSelectedFiles(Array.from(e.target.files));
  };

  const uploadAttachments = async (purchaseId, type) => {
    for (const file of selectedFiles) {
      const formDataFile = new FormData();
      formDataFile.append('file', file);
      formDataFile.append('reference_type', type);
      formDataFile.append('reference_id', purchaseId);
      formDataFile.append('description', file.name);
      try {
        await api.post('/attachments/upload', formDataFile, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } catch (err) {
        console.error('Error uploading file:', err);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validItems = formItems.filter(item => item.item_id && parseFloat(item.quantity) > 0);
    if (validItems.length === 0) {
      setMessage('❌ يجب إضافة صنف واحد على الأقل بكمية صحيحة');
      return;
    }

    try {
      const dataToSend = {
        ...formData,
        purchase_type: activeTab,
        has_vat: taxControls.has_vat,
        has_discount_tax: taxControls.has_discount_tax,
        items: validItems.map(item => ({
          item_id: item.item_id,
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price) || 0,
          unit: item.unit,
          notes: item.notes || ''
        }))
      };

      if (editingId) {
        await api.put(`/purchases/${editingId}`, dataToSend);
        setMessage('✅ تم تحديث الفاتورة بنجاح');
      } else {
        const response = await api.post('/purchases', dataToSend);
        if (selectedFiles.length > 0) {
          await uploadAttachments(response.data.id, 'purchase');
        }
        setMessage('✅ تم إنشاء الفاتورة بنجاح');
      }

      setShowForm(false);
      setEditingId(null);
      setSelectedFiles([]);
      resetForm();
      fetchPurchases();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const handleSendForApproval = async (id) => {
    try {
      await api.put(`/purchases/${id}/approve`, { status: 'pending' });
      setMessage('✅ تم إرسال الفاتورة للاعتماد');
      fetchPurchases();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.put(`/purchases/${id}/approve`, { status: 'approved' });
      setMessage('✅ تم الاعتماد وإنشاء سند الاستلام');
      fetchPurchases();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const handleQualityApprove = async (id) => {
    try {
      await api.put(`/purchases/${id}/quality-approve`);
      setMessage('✅ تم اعتماد الجودة');
      fetchPurchases();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const handleWarehouseReceive = (purchase) => {
    if (purchase.receipt_voucher_id) {
      window.location.href = `/receipts?voucher_id=${purchase.receipt_voucher_id}`;
    } else {
      window.location.href = '/receipts';
    }
  };

  const handlePost = async (id) => {
    try {
      await api.put(`/purchases/${id}/post`);
      setMessage('✅ تم ترحيل الإذن بنجاح');
      fetchPurchases();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) return;
    try {
      await api.delete(`/purchases/${id}`);
      setMessage('✅ تم حذف الفاتورة');
      fetchPurchases();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || ''));
    }
  };

  const handleEdit = async (purchase) => {
    setEditingId(purchase.id);
    setFormData({
      purchase_number: purchase.purchase_number,
      supplier: purchase.supplier || '',
      warehouse_id: purchase.warehouse_id || '',
      tax_discount_percent: purchase.tax_discount_percent || 0,
      shipment_id: purchase.shipment_id || '',
      notes: purchase.notes || ''
    });

    // Load items if available
    try {
      const response = await api.get(`/purchases/${purchase.id}/items`);
      if (response.data && response.data.length > 0) {
        setFormItems(response.data.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
          unit: item.unit || 'عدد',
          unit_price: item.unit_price || 0,
          notes: item.notes || ''
        })));
      } else {
        setFormItems([{ item_id: '', quantity: 1, unit: 'عدد', unit_price: 0, notes: '' }]);
      }
    } catch (err) {
      // Fallback: if API doesn't support /items, use single item from purchase
      if (purchase.item_id) {
        setFormItems([{
          item_id: purchase.item_id,
          quantity: purchase.quantity || 1,
          unit: purchase.unit || purchase.item_unit || 'عدد',
          unit_price: purchase.unit_price || 0,
          notes: ''
        }]);
      } else {
        setFormItems([{ item_id: '', quantity: 1, unit: 'عدد', unit_price: 0, notes: '' }]);
      }
    }

    setTaxControls({
      has_vat: purchase.has_vat !== false,
      has_discount_tax: purchase.has_discount_tax !== false
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      purchase_number: '',
      supplier: '',
      warehouse_id: '',
      tax_discount_percent: 0,
      shipment_id: '',
      notes: ''
    });
    setFormItems([{ item_id: '', quantity: 1, unit: 'عدد', unit_price: 0, notes: '' }]);
    setTaxControls({ has_vat: true, has_discount_tax: true });
  };

  const getStatusText = (status) => {
    const statuses = {
      'draft': '✏️ مسودة',
      'pending': '⏳ بانتظار الاعتماد',
      'approved': '✓ معتمد',
      'quality_passed': '✓ جودة معتمدة',
      'warehouse_received': '📦 تم الاستلام',
      'posted': '✅ مرحل',
      'rejected': '✕ مرفوض'
    };
    return statuses[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      'draft': '#6c757d',
      'pending': '#ffc107',
      'approved': '#17a2b8',
      'quality_passed': '#28a745',
      'warehouse_received': '#6f42c1',
      'posted': '#198754',
      'rejected': '#dc3545'
    };
    return colors[status] || '#6c757d';
  };

  const thStyle = { padding: '12px', border: '1px solid #ddd' };
  const tdStyle = { padding: '10px', border: '1px solid #ddd' };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl' }}>
      <h1>🧾 فواتير المشتريات</h1>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={() => window.location.href = '/purchases-module'}
          style={{ padding: '10px 20px', backgroundColor: '#92400e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          ← رجوع للمشتريات
        </button>
        <button onClick={() => window.location.href = '/dashboard'}
          style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          🏠 رجوع للرئيسية
        </button>
      </div>

      {message && <p style={{ padding: '10px', backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da', borderRadius: '4px', fontWeight: 'bold' }}>{message}</p>}

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={() => handleTabChange('local')}
          style={{ padding: '12px 30px', backgroundColor: activeTab === 'local' ? '#0d9488' : '#e2e8f0', color: activeTab === 'local' ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
          🏠 فاتورة محلية
        </button>
        <button onClick={() => handleTabChange('import')}
          style={{ padding: '12px 30px', backgroundColor: activeTab === 'import' ? '#92400e' : '#e2e8f0', color: activeTab === 'import' ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
          🚢 فاتورة استيراد
        </button>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={handleShowList}
          style={{ padding: '12px 25px', backgroundColor: !showForm && !showImportForm ? '#6c757d' : '#e2e8f0', color: !showForm && !showImportForm ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
          📋 عرض الفواتير
        </button>
        <button onClick={handleShowForm}
          style={{ padding: '12px 25px', backgroundColor: showForm ? '#28a745' : '#e2e8f0', color: showForm ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
          ➕ فاتورة {activeTab === 'local' ? 'محلية' : 'استيراد'} جديدة
        </button>
        <button onClick={handleShowImport}
          style={{ padding: '12px 25px', backgroundColor: showImportForm ? '#17a2b8' : '#e2e8f0', color: showImportForm ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
          📥 استيراد من أمر شراء
        </button>
      </div>

      {showImportForm && (
        <div style={{ color: '#1e293b', backgroundColor: '#fff3cd', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '2px solid #ffc107' }}>
          <h3 style={{ color: '#856404', marginBottom: '15px' }}>📥 أوامر شراء معتمدة</h3>
          {approvedOrders.length === 0 ? (
            <p>لا يوجد أوامر شراء معتمدة</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#ffc107', color: '#333' }}>
                  <th style={thStyle}>رقم الأمر</th>
                  <th style={thStyle}>المورد</th>
                  <th style={thStyle}>الأصناف</th>
                  <th style={thStyle}>الكمية</th>
                  <th style={thStyle}>الوحدة</th>
                  <th style={thStyle}>السعر</th>
                  <th style={thStyle}>الإجمالي</th>
                  <th style={thStyle}>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {approvedOrders.map(o => (
                  <tr key={o.id} style={{ color: '#1e293b', backgroundColor: 'white' }}>
                    <td style={tdStyle}><strong>{o.order_number}</strong></td>
                    <td style={tdStyle}>{o.supplier}</td>
                    <td style={tdStyle}>
                      {o.items && o.items.length > 0 ? o.items.map((item, idx) => (
                        <div key={idx}>{item.item_code} - {item.item_name}</div>
                      )) : '-'}
                    </td>
                    <td style={tdStyle}>
                      {o.items && o.items.length > 0 ? o.items.map((item, idx) => (
                        <div key={idx}>{item.quantity}</div>
                      )) : '-'}
                    </td>
                    <td style={tdStyle}>
                      {o.items && o.items.length > 0 ? o.items.map((item, idx) => (
                        <span key={idx} style={{ color: '#1e293b', backgroundColor: '#e3f2fd', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                          {item.unit || 'عدد'}
                        </span>
                      )) : '-'}
                    </td>
                    <td style={tdStyle}>
                      {o.items && o.items.length > 0 ? o.items.map((item, idx) => (
                        <div key={idx}>{item.unit_price_egp} ج.م</div>
                      )) : '-'}
                    </td>
                    <td style={tdStyle}><strong style={{ color: '#28a745' }}>{o.total_egp || o.total_amount || 0} ج.م</strong></td>
                    <td style={tdStyle}>
                      <button onClick={() => handleImportFromPO(o)}
                        style={{ padding: '8px 15px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                        📥 استيراد
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: `3px solid ${activeTab === 'import' ? '#92400e' : '#0d9488'}` }}>
          <h3 style={{ color: activeTab === 'import' ? '#92400e' : '#0d9488' }}>
            {editingId ? '✏️ تعديل فاتورة' : `➕ فاتورة ${activeTab === 'local' ? 'محلية' : 'استيراد'} جديدة`}
          </h3>

          {['finance', 'admin'].includes(userRole) && (
            <div style={{ color: '#1e293b', marginBottom: '20px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '8px', border: '2px solid #ffc107' }}>
              <h4 style={{ marginBottom: '10px', color: '#856404' }}>⚙️ تحكم الضرائب (المدير المالي)</h4>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={taxControls.has_vat}
                    onChange={(e) => setTaxControls({...taxControls, has_vat: e.target.checked})} />
                  <span>تفعيل ضريبة القيمة المضافة (14%)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={taxControls.has_discount_tax}
                    onChange={(e) => setTaxControls({...taxControls, has_discount_tax: e.target.checked})} />
                  <span>تفعيل ضريبة الخصم</span>
                </label>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>رقم الفاتورة:</label>
              <input type="text" value={formData.purchase_number} readOnly style={{ color: '#1e293b', width: '100%', padding: '8px', backgroundColor: '#e2e8f0', border: '1px solid #ddd', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>المورد:</label>
              <input type="text" value={formData.supplier} onChange={(e) => setFormData({...formData, supplier: e.target.value})} required style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>المخزن:</label>
              <select value={formData.warehouse_id} onChange={(e) => setFormData({...formData, warehouse_id: e.target.value})} required style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                <option value="">اختر المخزن</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>ضريبة الخصم (%):</label>
              <select value={formData.tax_discount_percent} onChange={(e) => setFormData({...formData, tax_discount_percent: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                <option value="0">0%</option>
                <option value="1">1%</option>
                <option value="3">3%</option>
              </select>
            </div>
            {activeTab === 'import' && (
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>رقم الشحنة (اختياري):</label>
                <input type="text" value={formData.shipment_id} onChange={(e) => setFormData({...formData, shipment_id: e.target.value})} placeholder="رقم الشحنة المنفصلة" style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
            )}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h4 style={{ margin: 0, color: '#333' }}>📦 الأصناف</h4>
              <button type="button" onClick={addItem}
                style={{ padding: '8px 16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                ➕ إضافة صنف
              </button>
            </div>

            <table style={{ color: '#1e293b', width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' }}>
              <thead>
                <tr style={{ backgroundColor: '#343a40', color: 'white' }}>
                  <th style={{...thStyle, width: '30%'}}>الصنف</th>
                  <th style={{...thStyle, width: '10%'}}>الكمية</th>
                  <th style={{...thStyle, width: '10%'}}>الوحدة</th>
                  <th style={{...thStyle, width: '12%'}}>سعر الوحدة</th>
                  <th style={{...thStyle, width: '12%'}}>الإجمالي</th>
                  <th style={{...thStyle, width: '15%'}}>ملاحظات</th>
                  <th style={{...thStyle, width: '5%'}}></th>
                </tr>
              </thead>
              <tbody>
                {formItems.map((item, index) => (
                  <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'white' }}>
                    <td style={tdStyle}>
                      <select value={item.item_id} onChange={(e) => updateItem(index, 'item_id', e.target.value)} required
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                        <option value="">-- اختر الصنف --</option>
                        {items.map(it => (
                          <option key={it.id} value={it.id}>{it.code} - {it.name}</option>
                        ))}
                      </select>
                    </td>
                    <td style={tdStyle}>
                      <input type="number" step="0.001" min="0.001" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} required
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                    </td>
                    <td style={tdStyle}>
                      <input type="text" value={item.unit} readOnly
                        style={{ color: '#1e293b', width: '100%', padding: '8px', backgroundColor: '#e2e8f0', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'center' }} />
                    </td>
                    <td style={tdStyle}>
                      <input type="number" step="0.01" min="0" value={item.unit_price} onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                    </td>
                    <td style={tdStyle}>
                      <strong>{(parseFloat(item.unit_price || 0) * parseFloat(item.quantity || 0)).toFixed(2)}</strong>
                    </td>
                    <td style={tdStyle}>
                      <input type="text" value={item.notes} onChange={(e) => updateItem(index, 'notes', e.target.value)} placeholder="ملاحظات..."
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                    </td>
                    <td style={tdStyle}>
                      <button type="button" onClick={() => removeItem(index)}
                        style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ color: '#1e293b', backgroundColor: '#e3f2fd', fontWeight: 'bold' }}>
                  <td colSpan="4" style={{...tdStyle, textAlign: 'left'}}>الإجمالي:</td>
                  <td style={tdStyle}><strong style={{ color: '#007bff' }}>{calculations.subtotal} ج.م</strong></td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>ملاحظات الفاتورة:</label>
            <input type="text" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} placeholder="أي ملاحظات..."
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
          </div>

          <div style={{ marginTop: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>المرفقات:</label>
            <input type="file" multiple accept="image/*,.pdf" onChange={handleFileChange} style={{ width: '100%', padding: '8px' }} />
            {selectedFiles.length > 0 && <p style={{ color: '#0d9488', marginTop: '5px' }}>تم اختيار {selectedFiles.length} ملف</p>}
          </div>

          <div style={{ color: '#1e293b', backgroundColor: '#e2e8f0', padding: '15px', borderRadius: '8px', marginTop: '15px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px' }}>الاجمالي</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{calculations.subtotal} ج.م</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px' }}>ضريبة 14%</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: taxControls.has_vat ? '#dc2626' : '#6c757d' }}>
                {taxControls.has_vat ? '+' + calculations.tax14 : '0.00'} ج.م
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px' }}>خصم ضريبي</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: taxControls.has_discount_tax ? '#28a745' : '#6c757d' }}>
                {taxControls.has_discount_tax ? '-' + calculations.taxDiscount : '0.00'} ج.م
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px' }}>الصافي</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#28a745' }}>{calculations.netAmount} ج.م</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="submit" style={{ padding: '12px 40px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
              💾 {editingId ? 'تحديث الفاتورة' : 'حفظ الفاتورة'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}
              style={{ padding: '12px 40px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>
              ❌ إلغاء
            </button>
          </div>
        </form>
      )}

      {!showForm && (
        <>
          <h3>📋 فواتير {activeTab === 'local' ? 'المحلية' : 'الاستيراد'}</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ backgroundColor: activeTab === 'local' ? '#0d9488' : '#92400e', color: 'white' }}>
                <th style={thStyle}>رقم الفاتورة</th>
                <th style={thStyle}>المورد</th>
                <th style={thStyle}>المخزن</th>
                <th style={thStyle}>الأصناف</th>
                <th style={thStyle}>الاجمالي</th>
                <th style={thStyle}>الصافي</th>
                <th style={thStyle}>حالة الفاتورة</th>
                <th style={thStyle}>حالة الإذن</th>
                <th style={thStyle}>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '20px' }}>لا يوجد فواتير</td></tr>
              ) : (
                purchases.map(p => (
                  <tr key={p.id} style={{ backgroundColor: p.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                    <td style={tdStyle}><strong>{p.purchase_number}</strong></td>
                    <td style={tdStyle}>{p.supplier}</td>
                    <td style={tdStyle}>{p.warehouse_name}</td>
                    <td style={tdStyle}>{p.items_count || (p.items ? p.items.length : 1)} صنف</td>
                    <td style={tdStyle}>{p.total_amount} ج.م</td>
                    <td style={tdStyle}><strong>{p.net_amount} ج.م</strong></td>
                    <td style={tdStyle}>
                      <span style={{ color: getStatusColor(p.status), fontWeight: 'bold', padding: '4px 12px', borderRadius: '12px', backgroundColor: getStatusColor(p.status) + '20' }}>
                        {getStatusText(p.status)}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {p.receipt_status === 'pending' && <span style={{color: '#ffc107', fontWeight: 'bold'}}>⏳ بانتظار الجودة</span>}
                      {p.receipt_status === 'approved_quality' && <span style={{color: '#6f42c1', fontWeight: 'bold'}}>✓ معتمد جودة</span>}
                      {p.receipt_status === 'warehouse_received' && <span style={{color: '#17a2b8', fontWeight: 'bold'}}>✓ تم الاستلام</span>}
                      {p.receipt_status === 'posted' && <span style={{color: '#28a745', fontWeight: 'bold'}}>✅ تم الترحيل</span>}
                      {!p.receipt_status && <span style={{color: '#6c757d'}}>-</span>}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        <button onClick={() => handleView(p)}
                          style={{ padding: '5px 10px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                          👁️ عرض
                        </button>
                        <button onClick={() => handlePrint(p)}
                          style={{ padding: '5px 10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                          🖨️ طباعة
                        </button>
                        <button onClick={() => handleDuplicate(p)}
                          style={{ padding: '5px 10px', backgroundColor: '#6f42c1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                          📋 تكرار
                        </button>

                        {p.status === 'draft' && (
                          <>
                            <button onClick={() => handleEdit(p)} style={{ padding: '5px 10px', backgroundColor: '#ffc107', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✏️ تعديل</button>
                            <button onClick={() => handleDelete(p.id)} style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>🗑️ حذف</button>
                            <button onClick={() => handleSendForApproval(p.id)} style={{ padding: '5px 10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>📤 إرسال</button>
                          </>
                        )}

                        {p.status === 'pending' && ['finance', 'admin'].includes(userRole) && (
                          <button onClick={() => handleApprove(p.id)} style={{ padding: '5px 10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✓ اعتماد</button>
                        )}

                        {p.status === 'approved' && (
                          <span style={{ padding: '5px 10px', backgroundColor: '#17a2b8', color: 'white', borderRadius: '4px', fontSize: '12px' }}>🔍 في الجودة</span>
                        )}

                        {p.status === 'pending_quality' && ['quality', 'admin'].includes(userRole) && (
                          <button onClick={() => handleQualityApprove(p.id)} style={{ padding: '5px 10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✓ جودة معتمدة</button>
                        )}

                        {p.status === 'quality_passed' && p.receipt_status !== 'warehouse_received' && p.receipt_status !== 'posted' && ['warehouse', 'admin'].includes(userRole) && (
                          <button onClick={() => handleWarehouseReceive(p)} style={{ padding: '5px 10px', backgroundColor: '#6f42c1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>📦 استلام مخزن</button>
                        )}

                        {(p.receipt_status === 'warehouse_received' || p.receipt_status === 'posted') && (
                          <span style={{color: '#28a745', fontWeight: 'bold', fontSize: '12px'}}>✓ تم استلام المخزن</span>
                        )}

                        {p.status === 'warehouse_received' && ['finance', 'admin'].includes(userRole) && (
                          <button onClick={() => handlePost(p.id)} style={{ padding: '5px 10px', backgroundColor: '#198754', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✅ ترحيل</button>
                        )}

                        {['approved', 'quality_passed', 'warehouse_received', 'posted'].includes(p.status) && ['finance', 'admin'].includes(userRole) && (
                          <button onClick={() => handleCancel(p)} style={{ padding: '5px 10px', backgroundColor: '#fd7e14', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                            ↩️ إلغاء الاعتماد
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </>
      )}

      {showViewModal && selectedPurchase && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setShowViewModal(false)}>
          <div style={{ color: '#1e293b',
            backgroundColor: 'white', borderRadius: '8px', padding: '30px',
            maxWidth: '900px', width: '90%', maxHeight: '90vh', overflow: 'auto', direction: 'rtl'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>👁️ تفاصيل الفاتورة</h2>
              <button onClick={() => setShowViewModal(false)}
                style={{ padding: '5px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                ✕ إغلاق
              </button>
            </div>
            <div style={{ color: '#1e293b', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <div><strong>رقم الفاتورة:</strong> {selectedPurchase.purchase_number}</div>
              <div><strong>التاريخ:</strong> {new Date(selectedPurchase.created_at).toLocaleDateString('ar-EG')}</div>
              <div><strong>المورد:</strong> {selectedPurchase.supplier}</div>
              <div><strong>المخزن:</strong> {selectedPurchase.warehouse_name || '-'}</div>
              <div><strong>الحالة:</strong> {getStatusText(selectedPurchase.status)}</div>
              <div><strong>الأصناف:</strong> {selectedPurchase.items ? selectedPurchase.items.length : 1} صنف</div>
            </div>

            <h3 style={{ marginBottom: '15px' }}>📋 الأصناف</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <thead>
                <tr style={{ backgroundColor: '#92400e', color: 'white' }}>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>الصنف</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>الكود</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>الكمية</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>الوحدة</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>السعر</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {selectedPurchase.items && selectedPurchase.items.length > 0 ? (
                  selectedPurchase.items.map((item, idx) => (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                      <td style={{ padding: '10px', border: '1px solid #ddd' }}>{item.item_name}</td>
                      <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{item.item_code}</td>
                      <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{item.unit}</td>
                      <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{item.unit_price} ج.م</td>
                      <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}><strong>{item.total_amount} ج.م</strong></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>
                      {selectedPurchase.item_name} - {selectedPurchase.quantity} {selectedPurchase.unit}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div style={{ color: '#1e293b', backgroundColor: '#e2e8f0', padding: '15px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>الإجمالي:</span><strong>{selectedPurchase.total_amount} ج.م</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>ضريبة 14%:</span><span>{selectedPurchase.tax_14_percent} ج.م</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #333', paddingTop: '8px' }}>
                <strong>الصافي:</strong><strong style={{ color: '#28a745', fontSize: '18px' }}>{selectedPurchase.net_amount} ج.م</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPrintModal && selectedPurchase && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setShowPrintModal(false)}>
          <div style={{ color: '#1e293b',
            backgroundColor: 'white', borderRadius: '8px', padding: '30px',
            maxWidth: '900px', width: '90%', maxHeight: '90vh', overflow: 'auto', direction: 'rtl'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>🖨️ معاينة الطباعة</h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => window.print()}
                  style={{ padding: '5px 15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  🖨️ طباعة
                </button>
                <button onClick={() => setShowPrintModal(false)}
                  style={{ padding: '5px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  ✕ إغلاق
                </button>
              </div>
            </div>
            <div id="print-area" style={{ padding: '20px', border: '2px solid #333' }}>
              <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #333', paddingBottom: '10px' }}>
                <h2>فاتورة شراء</h2>
                <p>رقم: {selectedPurchase.purchase_number}</p>
                <p>التاريخ: {new Date(selectedPurchase.created_at).toLocaleDateString('ar-EG')}</p>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #333', padding: '8px', fontWeight: 'bold' }}>المورد:</td>
                    <td style={{ border: '1px solid #333', padding: '8px' }}>{selectedPurchase.supplier}</td>
                    <td style={{ border: '1px solid #333', padding: '8px', fontWeight: 'bold' }}>المخزن:</td>
                    <td style={{ border: '1px solid #333', padding: '8px' }}>{selectedPurchase.warehouse_name || '-'}</td>
                  </tr>
                </tbody>
              </table>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ color: '#1e293b', backgroundColor: '#f0f0f0' }}>
                    <th style={{ border: '1px solid #333', padding: '8px' }}>#</th>
                    <th style={{ border: '1px solid #333', padding: '8px' }}>الصنف</th>
                    <th style={{ border: '1px solid #333', padding: '8px' }}>الكمية</th>
                    <th style={{ border: '1px solid #333', padding: '8px' }}>الوحدة</th>
                    <th style={{ border: '1px solid #333', padding: '8px' }}>السعر</th>
                    <th style={{ border: '1px solid #333', padding: '8px' }}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPurchase.items && selectedPurchase.items.length > 0 ? (
                    selectedPurchase.items.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>{item.item_name}</td>
                        <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>{item.unit}</td>
                        <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>{item.unit_price} ج.م</td>
                        <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}><strong>{item.total_amount} ج.م</strong></td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>1</td>
                      <td style={{ border: '1px solid #333', padding: '8px' }}>{selectedPurchase.item_name}</td>
                      <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>{selectedPurchase.quantity}</td>
                      <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>{selectedPurchase.unit}</td>
                      <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>{selectedPurchase.unit_price} ج.م</td>
                      <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}><strong>{selectedPurchase.total_amount} ج.م</strong></td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ color: '#1e293b', backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
                    <td colSpan="5" style={{ border: '1px solid #333', padding: '8px', textAlign: 'left' }}>الإجمالي:</td>
                    <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}><strong>{selectedPurchase.total_amount} ج.م</strong></td>
                  </tr>
                  <tr style={{ color: '#1e293b', backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
                    <td colSpan="5" style={{ border: '1px solid #333', padding: '8px', textAlign: 'left' }}>ضريبة 14%:</td>
                    <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>{selectedPurchase.tax_14_percent} ج.م</td>
                  </tr>
                  <tr style={{ color: '#1e293b', backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
                    <td colSpan="5" style={{ border: '1px solid #333', padding: '8px', textAlign: 'left' }}>خصم ضريبي:</td>
                    <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>{selectedPurchase.tax_discount_amount} ج.م</td>
                  </tr>
                  <tr style={{ color: '#1e293b', backgroundColor: '#f0f0f0', fontWeight: 'bold', fontSize: '18px' }}>
                    <td colSpan="5" style={{ border: '1px solid #333', padding: '8px', textAlign: 'left' }}>الصافي:</td>
                    <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}><strong>{selectedPurchase.net_amount} ج.م</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Purchases;