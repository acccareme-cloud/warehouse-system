import { useState, useEffect } from 'react';
import api from '../services/api';

function Receipts() {
  const [pendingReceipts, setPendingReceipts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [allReceipts, setAllReceipts] = useState([]);
  const [warehouseKeepers, setWarehouseKeepers] = useState([]);
  const [userRole, setUserRole] = useState('');

  // الإذن المختار
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [receiptItems, setReceiptItems] = useState([]);

  // بيانات الاستلام
  const [formData, setFormData] = useState({
    receipt_id: '',
    receipt_date: new Date().toISOString().split('T')[0],
    warehouse_id: '',
    received_by: ''
  });

  // السريالات لكل صنف: { itemId: ['SN1', 'SN2', ...] }
  const [itemSerials, setItemSerials] = useState({});

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // For view modal
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedReceiptForView, setSelectedReceiptForView] = useState(null);
  const [viewReceiptItems, setViewReceiptItems] = useState([]);
  const [expandedItemId, setExpandedItemId] = useState(null);
  const [itemSerialsMap, setItemSerialsMap] = useState({});

  // For print modal
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printData, setPrintData] = useState(null);

  useEffect(() => {
    fetchPendingReceipts();
    fetchWarehouses();
    fetchAllReceipts();
    fetchWarehouseKeepers();
    fetchUserRole();
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // جيب role المستخدم من التوكن
  // ═══════════════════════════════════════════════════════════════
  const fetchUserRole = () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserRole(payload.role || '');
      } catch (e) {
        console.error('Error decoding token:', e);
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // جلب الإذون المعلقة (approved_quality فقط)
  // ═══════════════════════════════════════════════════════════════
  const fetchPendingReceipts = async () => {
    try {
      const response = await api.get('/receipts');
      // نفلتر بس الإذون اللي معتمدة جودة (مستعدة للاستلام)
      setPendingReceipts(response.data.filter(r => r.status === 'approved_quality'));
    } catch (err) {
      console.error('خطأ في تحميل الإذون:', err);
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

  const fetchAllReceipts = async () => {
    try {
      const response = await api.get('/receipts');
      setAllReceipts(response.data);
    } catch (err) {
      console.error('خطأ في تحميل الإذونات:', err);
    }
  };

  const fetchWarehouseKeepers = async () => {
    try {
      const response = await api.get('/employees/warehouse-keepers');
      setWarehouseKeepers(response.data);
    } catch (err) {
      console.error('خطأ في تحميل أمناء المخازن:', err);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // لما يختار إذن
  // ═══════════════════════════════════════════════════════════════
  const handleReceiptChange = async (receiptId) => {
    setSelectedReceipt(null);
    setReceiptItems([]);
    setItemSerials({});

    if (!receiptId) return;

    const receipt = pendingReceipts.find(r => r.id === parseInt(receiptId));
    setSelectedReceipt(receipt);
    setFormData(prev => ({...prev, receipt_id: receiptId}));

    // نجيب أصناف الإذن
    try {
      const response = await api.get(`/receipts/${receiptId}/items`);
      const items = response.data;
      setReceiptItems(items);

      // نجهز حقول السريالات الفاضية (بس للأصناف اللي محتاجة سريال فعلاً)
      const serialsMap = {};
      items.forEach(item => {
        if (item.has_serial) {
          const qty = Math.round(parseFloat(item.quantity) || 0);
          serialsMap[item.item_id] = Array(qty).fill('');
        }
      });
      setItemSerials(serialsMap);

    } catch (err) {
      console.error('خطأ في تحميل أصناف الإذن:', err);
    }
  };

 
  // ═══════════════════════════════════════════════════════════════
// لما يختار مخزن → يعبّئ المسؤول تلقائي
// ═══════════════════════════════════════════════════════════════
const handleWarehouseChange = (warehouseId) => {
    const selectedWarehouse = warehouses.find(w => w.id == warehouseId);
    
    console.log('Selected warehouse:', selectedWarehouse);
    
    setFormData(prev => ({
      ...prev,
      warehouse_id: warehouseId,
      // نستخدم أي حقل في warehouse فيه اسم المسؤول
      received_by: selectedWarehouse?.responsible_name 
        || selectedWarehouse?.manager 
        || selectedWarehouse?.keeper_name 
        || selectedWarehouse?.admin_name 
        || selectedWarehouse?.name 
        || ''
    }));
  };
  // ═══════════════════════════════════════════════════════════════
  // تغيير سريال
  // ═══════════════════════════════════════════════════════════════
  const handleSerialChange = (itemId, index, value) => {
    setItemSerials(prev => {
      const newSerials = {...prev};
      newSerials[itemId] = [...(newSerials[itemId] || [])];
      newSerials[itemId][index] = value;
      return newSerials;
    });
  };

  // ═══════════════════════════════════════════════════════════════
  // استلام الإذن / تحديث الإذن
  // ═══════════════════════════════════════════════════════════════
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (!formData.receipt_id) {
      setMessage('❌ خطأ: اختر الإذن');
      setLoading(false);
      return;
    }

    if (!formData.warehouse_id) {
      setMessage('❌ خطأ: اختر المخزن');
      setLoading(false);
      return;
    }

    if (!formData.received_by) {
      setMessage('❌ خطأ: أدخل اسم أمين المخزن');
      setLoading(false);
      return;
    }

    // نتحقق من السريالات (بس للأصناف اللي محتاجة سريال)
    for (const item of receiptItems) {
      if (!item.has_serial) continue;

      const serials = itemSerials[item.item_id] || [];

      // نتأكد إن كل السريالات مكتوبة
      if (serials.some(s => !s.trim())) {
        setMessage(`❌ خطأ: أكمل سريالات الصنف ${item.item_name}`);
        setLoading(false);
        return;
      }

      // نتأكد من عدم التكرار
      const uniqueSerials = [...new Set(serials.map(s => s.trim()))];
      if (uniqueSerials.length !== serials.length) {
        setMessage(`❌ خطأ: يوجد سريالات مكررة في الصنف ${item.item_name}`);
        setLoading(false);
        return;
      }
    }

    try {
      const itemsToReceive = receiptItems.map(item => ({
        item_id: item.item_id,
        received_quantity: parseFloat(item.quantity),
        serials: itemSerials[item.item_id] || []
      }));

      // لو تعديل (posted) → PUT /:id
      // لو استلام جديد → PUT /:id/warehouse-receive
      const isEditing = selectedReceipt?.status === 'posted';
      const url = isEditing 
        ? `/receipts/${formData.receipt_id}` 
        : `/receipts/${formData.receipt_id}/warehouse-receive`;

      await api.put(url, {
        items: itemsToReceive,
        warehouse_id: formData.warehouse_id,
        received_by: formData.received_by
      });

      setMessage(isEditing ? '✅ تم تحديث الإذن بنجاح!' : '✅ تم استلام المخزن بنجاح!');

      // نمسح البيانات
      setSelectedReceipt(null);
      setReceiptItems([]);
      setItemSerials({});
      setFormData({
        receipt_id: '',
        receipt_date: new Date().toISOString().split('T')[0],
        warehouse_id: '',
        received_by: ''
      });

      fetchPendingReceipts();
      fetchAllReceipts();

    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || err.message || 'حدث خطأ'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // عرض تفاصيل الإذن (Modal)
  // ═══════════════════════════════════════════════════════════════
  const handleView = async (receipt) => {
    try {
      const response = await api.get(`/receipts/${receipt.id}/items`);
      const items = response.data || [];

      // Fetch serials for items that have serials
      const serialsMap = {};
      for (const item of items) {
        if (item.has_serial) {
          try {
            const serialsResponse = await api.get(`/receipts/${receipt.id}/serials?item_id=${item.item_id}`);
            serialsMap[item.item_id] = serialsResponse.data || [];
          } catch (err) {
            console.error(`Error fetching serials for item ${item.item_id}:`, err);
            serialsMap[item.item_id] = [];
          }
        }
      }
      setItemSerialsMap(serialsMap);
      setViewReceiptItems(items);
    } catch (err) {
      console.error('خطأ في تحميل أصناف الإذن:', err);
      setViewReceiptItems([]);
      setItemSerialsMap({});
    }
    setSelectedReceiptForView(receipt);
    setShowViewModal(true);
  };

  // Toggle item expansion to show serials
  const toggleItemSerials = (itemId) => {
    setExpandedItemId(expandedItemId === itemId ? null : itemId);
  };

  // Print receipt total
  const handlePrintReceipt = (receipt) => {
    setPrintData({
      type: 'receipt',
      receipt: receipt,
      items: viewReceiptItems,
      serials: itemSerialsMap
    });
    setShowPrintModal(true);
  };

  // Print item with serials
  const handlePrintItem = (item) => {
    setPrintData({
      type: 'item',
      item: item,
      serials: itemSerialsMap[item.item_id] || []
    });
    setShowPrintModal(true);
  };

  // ═══════════════════════════════════════════════════════════════
  // تعديل إذن - نجيب الأصناف والسريالات مباشرة من API
  // ═══════════════════════════════════════════════════════════════
  const handleEdit = async (receipt) => {
    setSelectedReceipt(receipt);
// نجيب المخزن المختار
    const selectedWarehouse = warehouses.find(w => w.id == receipt.warehouse_id);
    
    // نجيب اسم أمين المخزن - نستخدم == مش === عشان لو النوع مختلف
    const keeper = warehouseKeepers.find(wk => wk.warehouse_id == receipt.warehouse_id);
    
    // نجيب الاسم من: received_by في الإذن → warehouse.responsible_name → warehouse.name → فاضي
    const keeperName = receipt.received_by 
      || selectedWarehouse?.responsible_name 
      || selectedWarehouse?.manager 
      || selectedWarehouse?.keeper_name 
      || selectedWarehouse?.name 
      || '';
    
    console.log('=== handleEdit ===');
    console.log('receipt.warehouse_id:', receipt.warehouse_id);
    console.log('selectedWarehouse:', selectedWarehouse);
    console.log('receipt.received_by:', receipt.received_by);
    console.log('Final keeperName:', keeperName);
    
    setFormData({
      receipt_id: receipt.id,
      receipt_date: receipt.receipt_date ? receipt.receipt_date.split('T')[0] : new Date().toISOString().split('T')[0],
      warehouse_id: receipt.warehouse_id || '',
      received_by: keeperName
    });
    // نجيب الأصناف والسريالات مباشرة من API
    try {
      const response = await api.get(`/receipts/${receipt.id}/items`);
      const items = response.data;
      setReceiptItems(items);

      // نجيب السريالات للأصناف اللي ليها سريال
      const serialsMap = {};
      const itemSerialsData = {};

      for (const item of items) {
        const qty = Math.round(parseFloat(item.quantity) || 0);

        if (item.has_serial) {
          try {
            const serialsResponse = await api.get(`/receipts/${receipt.id}/serials?item_id=${item.item_id}`);
            const serials = serialsResponse.data || [];
            serialsMap[item.item_id] = serials;

            // نملى حقول السريالات بالقيم الموجودة
            itemSerialsData[item.item_id] = serials.map(s => s.serial_number);
          } catch (err) {
            console.error(`Error fetching serials for item ${item.item_id}:`, err);
            serialsMap[item.item_id] = [];
            itemSerialsData[item.item_id] = Array(qty).fill('');
          }
        } else {
          itemSerialsData[item.item_id] = Array(qty).fill('');
        }
      }

      setItemSerialsMap(serialsMap);
      setItemSerials(itemSerialsData);

    } catch (err) {
      console.error('خطأ في تحميل أصناف الإذن:', err);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ═══════════════════════════════════════════════════════════════
  // إلغاء التعديل
  // ═══════════════════════════════════════════════════════════════
  const handleCancel = () => {
    setSelectedReceipt(null);
    setReceiptItems([]);
    setItemSerials({});
    setItemSerialsMap({});
    setFormData({
      receipt_id: '',
      receipt_date: new Date().toISOString().split('T')[0],
      warehouse_id: '',
      received_by: ''
    });
  };

  // ═══════════════════════════════════════════════════════════════
  // حذف إذن
  // ═══════════════════════════════════════════════════════════════
  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الإذن؟')) return;

    try {
      await api.delete(`/receipts/${id}`);
      setMessage('✅ تم الحذف بنجاح');
      fetchAllReceipts();
      fetchPendingReceipts();
    } catch (err) {
      setMessage('❌ خطأ في الحذف: ' + (err.response?.data?.message || err.message));
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // اعتماد الإذن (المحاسب)
  // ═══════════════════════════════════════════════════════════════
  const handleApprove = async (id) => {
    try {
      await api.put(`/receipts/${id}/approve`, { status: 'approved' });
      setMessage('✅ تم اعتماد الإذن وإضافة الكمية للمخزن');
      fetchAllReceipts();
      fetchPendingReceipts();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const thStyle = { padding: '12px', border: '1px solid #ddd', textAlign: 'center' };
  const tdStyle = { padding: '10px', border: '1px solid #ddd', textAlign: 'center', color: '#1e293b' };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1>📦 إضافة مخزن (إذن استلام)</h1>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={() => window.location.href = '/warehouse-module'}
          style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          🏭 رجوع للمخازن
        </button>
        <button 
          onClick={() => window.location.href = '/dashboard'}
          style={{ padding: '10px 20px', backgroundColor: '#495057', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          🏠 الرئيسية
        </button>
      </div>

      {message && (
        <p style={{ 
          padding: '15px', 
          backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da', 
          borderRadius: '8px',
          marginBottom: '20px',
          fontWeight: 'bold'
        }}>
          {message}
        </p>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          نموذج استلام إذن
      ═══════════════════════════════════════════════════════════════ */}
      <form onSubmit={handleSubmit} style={{ color: '#1e293b', backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '12px', marginBottom: '30px', border: '2px solid #dee2e6' }}>
        <h3 style={{ color: '#495057', marginBottom: '20px', borderBottom: '2px solid #28a745', paddingBottom: '10px' }}>
          {selectedReceipt?.status === 'posted' ? '✏️ تعديل إذن مخزن' : '📝 استلام إذن مخزن'}
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          {/* اختيار الإذن */}
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#495057' }}>
              إذن الاستلام: <span style={{ color: '#dc3545' }}>*</span>
            </label>
            <select 
              value={formData.receipt_id} 
              onChange={(e) => handleReceiptChange(e.target.value)} 
              required 
              disabled={selectedReceipt?.status === 'posted'}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '2px solid #ced4da', fontSize: '14px' }}
            >
              <option value="">-- اختر إذن الاستلام --</option>
              {pendingReceipts.map(r => (
                <option key={r.id} value={r.id}>
                  {r.voucher_number} - {r.purchase_number} - {r.supplier} 
                  ({r.status === 'approved_quality' ? '✓ معتمد جودة' : '⏳ معلق'})
                </option>
              ))}
            </select>
            {selectedReceipt?.status === 'posted' && (
              <small style={{ color: '#6c757d', fontSize: '12px' }}>رقم الإذن: {selectedReceipt.voucher_number}</small>
            )}
          </div>

          {/* اختيار المخزن */}
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#495057' }}>
              المخزن المستلم: <span style={{ color: '#dc3545' }}>*</span>
            </label>
            <select 
              value={formData.warehouse_id} 
              onChange={(e) => handleWarehouseChange(e.target.value)}
              required 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '2px solid #ced4da', fontSize: '14px' }}
            >
              <option value="">-- اختر المخزن --</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          {/* أمين المخزن (يتعبأ تلقائي من المخزن) */}
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#495057' }}>
              أمين المخزن (المستلم): <span style={{ color: '#dc3545' }}>*</span>
            </label>
            <input 
              type="text" 
              value={formData.received_by} 
              onChange={(e) => setFormData(prev => ({...prev, received_by: e.target.value}))}
              placeholder="يُعبأ تلقائي عند اختيار المخزن"
              required
              style={{ 
                width: '100%', 
                padding: '10px', 
                borderRadius: '6px', 
                border: '2px solid #ced4da', 
                fontSize: '14px',
                backgroundColor: formData.received_by ? '#e8f5e9' : '#f5f5f5'
              }} 
            />
            {formData.received_by && (
              <small style={{ color: '#28a745', fontSize: '12px' }}>✓ تم التعيين</small>
            )}
          </div>

          {/* تاريخ الاستلام */}
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#495057' }}>
              تاريخ الاستلام:
            </label>
            <input 
              type="date" 
              value={formData.receipt_date} 
              onChange={(e) => setFormData({...formData, receipt_date: e.target.value})} 
              required 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '2px solid #ced4da' }} 
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            عرض أصناف الإذن + السريالات
        ═══════════════════════════════════════════════════════════════ */}
        {selectedReceipt && receiptItems.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ color: '#28a745', marginBottom: '15px' }}>
              📋 أصناف الإذن: {selectedReceipt.voucher_number}
              {selectedReceipt.purchase_number && ` (فاتورة: ${selectedReceipt.purchase_number})`}
            </h4>

            {receiptItems.map((item) => {
              const qty = Math.round(parseFloat(item.quantity) || 0);
              const serials = itemSerials[item.item_id] || [];
              const unitPrice = parseFloat(item.unit_price) || 0;
              const totalAmount = qty * unitPrice;
              const existingSerials = itemSerialsMap[item.item_id] || [];
              const isEditing = selectedReceipt?.status === 'posted';

              return (
                <div 
                  key={item.id} 
                  style={{ color: '#1e293b', 
                    backgroundColor: 'white', 
                    padding: '20px', 
                    borderRadius: '12px', 
                    marginBottom: '20px',
                    border: '2px solid #e9ecef',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  {/* معلومات الصنف */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '15px',
                    paddingBottom: '10px',
                    borderBottom: '2px solid #e9ecef'
                  }}>
                    <div>
                      <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#495057' }}>
                        📦 {item.item_name}
                      </span>
                      <span style={{ marginRight: '15px', color: '#6c757d' }}>
                        (كود: {item.item_code || item.item_id})
                      </span>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <span style={{ fontSize: '14px', color: '#6c757d' }}>الكمية المطلوبة: </span>
                      <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#28a745' }}>
                        {qty} {item.unit || 'عدد'}
                      </span>
                      <span style={{ marginRight: '20px', fontSize: '14px', color: '#6c757d' }}>السعر: </span>
                      <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#495057' }}>
                        {unitPrice.toFixed(2)} ج.م
                      </span>
                      <span style={{ marginRight: '20px', fontSize: '14px', color: '#6c757d' }}>الإجمالي: </span>
                      <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#28a745' }}>
                        {totalAmount.toFixed(2)} ج.م
                      </span>
                    </div>
                  </div>

                  {/* جدول السريالات */}
                  {item.has_serial && (
                    <>
                      <h5 style={{ color: '#0d9488', marginBottom: '10px' }}>
                        🔢 سريالات الأجهزة ({qty} جهاز)
                        {isEditing && existingSerials.length > 0 && (
                          <span style={{ marginRight: '10px', fontSize: '12px', color: '#6c757d' }}>
                            (تم تسجيل {existingSerials.length} سريال)
                          </span>
                        )}
                      </h5>

                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ color: '#1e293b', backgroundColor: '#e0f2fe' }}>
                              <th style={{ ...thStyle, width: '60px' }}>#</th>
                              <th style={thStyle}>الوحدة</th>
                              <th style={thStyle}>الكمية</th>
                              <th style={thStyle}>سعر الوحدة</th>
                              <th style={thStyle}>القيمة</th>
                              <th style={thStyle}>السريال / IMEI <span style={{ color: '#dc3545' }}>*</span></th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: qty }, (_, idx) => (
                              <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f8f9fa' }}>
                                <td style={tdStyle}>
                                  <span style={{ 
                                    display: 'inline-block', 
                                    width: '30px', 
                                    height: '30px', 
                                    lineHeight: '30px',
                                    backgroundColor: '#0d9488', 
                                    color: 'white', 
                                    borderRadius: '50%',
                                    fontWeight: 'bold'
                                  }}>
                                    {idx + 1}
                                  </span>
                                </td>
                                <td style={tdStyle}>{item.unit || 'عدد'}</td>
                                <td style={tdStyle}>1</td>
                                <td style={tdStyle}>{unitPrice.toFixed(2)} ج.م</td>
                                <td style={tdStyle}>{unitPrice.toFixed(2)} ج.م</td>
                                <td style={tdStyle}>
                                  <input
                                    type="text"
                                    value={serials[idx] || ''}
                                    onChange={(e) => handleSerialChange(item.item_id, idx, e.target.value)}
                                    placeholder={`سريال الجهاز ${idx + 1}`}
                                    required
                                    style={{ 
                                      width: '100%', 
                                      padding: '8px 12px', 
                                      border: '2px solid #0d9488', 
                                      borderRadius: '6px',
                                      fontSize: '14px',
                                      textAlign: 'center'
                                    }}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ color: '#1e293b', backgroundColor: '#d1fae5', fontWeight: 'bold' }}>
                              <td colSpan="2" style={tdStyle}>الإجمالي</td>
                              <td style={tdStyle}>{qty}</td>
                              <td style={tdStyle}>-</td>
                              <td style={tdStyle}>{totalAmount.toFixed(2)} ج.م</td>
                              <td style={tdStyle}>-</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </>
                  )}

                  {/* لو الصنف مالوش سريال */}
                  {!item.has_serial && (
                    <div style={{ color: '#1e293b', 
                      padding: '15px', 
                      backgroundColor: '#fff3cd', 
                      borderRadius: '8px',
                      border: '1px solid #ffc107'
                    }}>
                      <strong>⚠️</strong> هذا الصنف لا يحتاج إلى سريالات. الكمية: {qty} {item.unit || 'عدد'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* زر الاستلام / التحديث + إلغاء */}
        {selectedReceipt && (
          <div style={{ marginTop: '20px', textAlign: 'center', display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button 
              type="submit" 
              disabled={loading}
              style={{ 
                padding: '15px 50px', 
                backgroundColor: loading ? '#6c757d' : '#28a745', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '18px', 
                fontWeight: 'bold',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}
            >
              {loading ? '⏳ جاري...' : (selectedReceipt?.status === 'posted' ? '🔄 تحديث الإذن' : '✅ تأكيد استلام المخزن')}
            </button>
            <button 
              type="button"
              onClick={handleCancel}
              style={{ 
                padding: '15px 30px', 
                backgroundColor: '#dc3545', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: 'pointer',
                fontSize: '18px', 
                fontWeight: 'bold',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}
            >
              ❌ إلغاء
            </button>
          </div>
        )}
      </form>

      {/* ═══════════════════════════════════════════════════════════════
          جدول الإذونات
      ═══════════════════════════════════════════════════════════════ */}
      <h3 style={{ color: '#495057', marginBottom: '15px', borderBottom: '2px solid #28a745', paddingBottom: '10px' }}>
        📋 إذونات الاستلام
      </h3>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#28a745', color: 'white' }}>
              <th style={thStyle}>رقم الإذن</th>
              <th style={thStyle}>رقم الفاتورة</th>
              <th style={thStyle}>المورد</th>
              <th style={thStyle}>المخزن</th>
              <th style={thStyle}>أمين المخزن</th>
              <th style={thStyle}>الأصناف</th>
              <th style={thStyle}>الكمية الكلية</th>
              <th style={thStyle}>حالة الإذن</th>
              <th style={thStyle}>حالة المالية</th>
              <th style={thStyle}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {allReceipts.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '30px', color: '#6c757d' }}>
                  لا توجد إذونات استلام
                </td>
              </tr>
            ) : (
              allReceipts.map((r, idx) => {
                // نستخدم quantity من الإذن نفسه
                const totalQty = r.quantity || 0;

                return (
                  <tr key={r.id} style={{ backgroundColor: idx % 2 === 0 ? '#f8f9fa' : 'white' }}>
                    <td style={tdStyle}><strong>{r.voucher_number}</strong></td>
                    <td style={tdStyle}>{r.purchase_number || r.supply_order || '-'}</td>
                    <td style={tdStyle}>{r.supplier || '-'}</td>
                    <td style={tdStyle}>{r.warehouse_name || '-'}</td>
                    <td style={tdStyle}>{r.received_by || '-'}</td>
                    <td style={tdStyle}>{r.item_name || '-'}</td>
                    <td style={tdStyle}><strong>{totalQty}</strong></td>
                    <td style={tdStyle}>
                      {r.status === 'pending' && <span style={{ color: '#ffc107', fontWeight: 'bold' }}>⏳ بانتظار الجودة</span>}
                      {r.status === 'approved_quality' && <span style={{ color: '#6f42c1', fontWeight: 'bold' }}>✓ معتمد جودة</span>}
                      {r.status === 'warehouse_received' && <span style={{ color: '#17a2b8', fontWeight: 'bold' }}>✓ تم الاستلام</span>}
                      {r.status === 'posted' && <span style={{ color: '#28a745', fontWeight: 'bold' }}>✅ تم الترحيل</span>}
                    </td>
                    <td style={tdStyle}>
                      {r.financial_approval_status === 'pending' && <span style={{ color: '#ffc107' }}>⏳ بانتظار</span>}
                      {r.financial_approval_status === 'approved' && <span style={{ color: '#28a745' }}>✓ معتمد</span>}
                      {r.financial_approval_status === 'rejected' && <span style={{ color: '#dc3545' }}>✗ مرفوض</span>}
                    </td>
                    <td style={tdStyle}>

                      {/* اعتماد مالي - بس لو تم الاستلام ولسه المالية معلقة والمستخدم مالية أو أدمن */}
                      {r.status === 'warehouse_received' && r.financial_approval_status === 'pending' && (userRole === 'finance' || userRole === 'admin') && (
                        <button 
                          onClick={() => handleApprove(r.id)}
                          style={{ padding: '5px 10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginLeft: '5px' }}
                        >
                          ✓ اعتماد
                        </button>
                      )}

                      {/* تعديل + حذف + طباعة - بس لو تم الترحيل (posted) */}
                      {r.status === 'posted' && (
                        <>
                          <button 
                            onClick={() => handleEdit(r)}
                            style={{ padding: '5px 10px', backgroundColor: '#ffc107', color: '#212529', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginLeft: '5px' }}
                          >
                            ✏️ تعديل
                          </button>
                          <button 
                            onClick={() => handleDelete(r.id)}
                            style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginLeft: '5px' }}
                          >
                            🗑️ حذف
                          </button>
                          <button 
                            onClick={() => handlePrintReceipt(r)}
                            style={{ padding: '5px 10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginLeft: '5px' }}
                          >
                            🖨️ طباعة
                          </button>
                        </>
                      )}

                      {/* عرض - لكل الإذونات */}
                      <button 
                        onClick={() => handleView(r)}
                        style={{ padding: '5px 10px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        👁️ عرض
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          نافذة عرض تفاصيل الإذن (Modal)
      ═══════════════════════════════════════════════════════════════ */}
      {showViewModal && selectedReceiptForView && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setShowViewModal(false)}>
          <div style={{ color: '#1e293b',
            backgroundColor: 'white', borderRadius: '8px', padding: '30px',
            maxWidth: '900px', width: '90%', maxHeight: '90vh', overflow: 'auto',
            direction: 'rtl'
          }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #28a745', paddingBottom: '10px' }}>
              <h2>👁️ تفاصيل إذن الاستلام</h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => handlePrintReceipt(selectedReceiptForView)}
                  style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
                >
                  🖨️ طباعة الإذن
                </button>
                <button 
                  onClick={() => setShowViewModal(false)}
                  style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
                >
                  ✕ إغلاق
                </button>
              </div>
            </div>

            {/* Receipt Info */}
            <div style={{ color: '#1e293b', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <div><strong>رقم الإذن:</strong> {selectedReceiptForView.voucher_number}</div>
              <div><strong>رقم الفاتورة:</strong> {selectedReceiptForView.purchase_number || '-'}</div>
              <div><strong>المورد:</strong> {selectedReceiptForView.supplier || '-'}</div>
              <div><strong>المخزن المستلم:</strong> {selectedReceiptForView.warehouse_name || '-'}</div>
              <div><strong>أمين المخزن:</strong> {selectedReceiptForView.received_by || '-'}</div>
              <div><strong>تاريخ الاستلام:</strong> {selectedReceiptForView.warehouse_approved_at ? new Date(selectedReceiptForView.warehouse_approved_at).toLocaleDateString('ar-EG') : '-'}</div>
              <div><strong>الحالة:</strong> 
                {selectedReceiptForView.status === 'pending' && <span style={{color: '#ffc107'}}> ⏳ بانتظار الجودة</span>}
                {selectedReceiptForView.status === 'approved_quality' && <span style={{color: '#6f42c1'}}> ✓ معتمد جودة</span>}
                {selectedReceiptForView.status === 'warehouse_received' && <span style={{color: '#17a2b8'}}> ✓ تم الاستلام</span>}
                {selectedReceiptForView.status === 'posted' && <span style={{color: '#28a745'}}> ✅ تم الترحيل</span>}
              </div>
              <div><strong>حالة المالية:</strong>
                {selectedReceiptForView.financial_approval_status === 'pending' && <span style={{color: '#ffc107'}}> ⏳ بانتظار</span>}
                {selectedReceiptForView.financial_approval_status === 'approved' && <span style={{color: '#28a745'}}> ✓ معتمد</span>}
                {selectedReceiptForView.financial_approval_status === 'rejected' && <span style={{color: '#dc3545'}}> ✗ مرفوض</span>}
              </div>
            </div>

            {/* Items Table */}
            <h3 style={{ marginBottom: '15px', color: '#495057' }}>📋 الأصناف</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <thead>
                <tr style={{ backgroundColor: '#28a745', color: 'white' }}>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>الصنف</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>الكمية</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>الوحدة</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>السعر</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>الإجمالي</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>السريالات</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>طباعة</th>
                </tr>
              </thead>
              <tbody>
                {viewReceiptItems.length > 0 ? (
                  viewReceiptItems.map((item, idx) => (
                    <tr key={`item-row-${item.item_id || idx}`} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f9fa', cursor: item.has_serial ? 'pointer' : 'default' }}
                        onClick={() => item.has_serial && toggleItemSerials(item.item_id)}>
                      <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                        {item.item_name}
                        {item.has_serial && (
                          <span style={{ marginRight: '8px', fontSize: '12px', color: '#0d9488' }}>
                            {expandedItemId === item.item_id ? ' ▲' : ' ▼'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{item.unit || 'عدد'}</td>
                      <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{item.unit_price} ج.م</td>
                      <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{item.total_amount} ج.م</td>
                      <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>
                        {item.has_serial ? (
                          <span style={{ backgroundColor: '#e0f2fe', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', color: '#0d9488' }}>
                            🔢 {itemSerialsMap[item.item_id]?.length || 0} سريال
                          </span>
                        ) : (
                          <span style={{ color: '#6c757d', fontSize: '12px' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handlePrintItem(item); }}
                          style={{ padding: '4px 10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                        >
                          🖨️ صنف
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ padding: '20px', border: '1px solid #ddd', textAlign: 'center', color: '#6c757d' }}>
                      لا توجد أصناف مسجلة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Expanded Serials Section */}
            {viewReceiptItems.map((item) => (
              item.has_serial && expandedItemId === item.item_id && (
                <div key={`serials-${item.item_id}`} style={{ color: '#1e293b', 
                  backgroundColor: '#f0f9ff', 
                  padding: '15px', 
                  borderRadius: '8px', 
                  marginBottom: '20px',
                  border: '2px solid #0d9488'
                }}>
                  <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#0d9488', fontSize: '16px' }}>🔢 سريالات {item.item_name}:</strong>
                    <span style={{ fontSize: '12px', color: '#6c757d' }}>
                      (عدد: {itemSerialsMap[item.item_id]?.length || 0} / {item.quantity})
                    </span>
                  </div>
                  {itemSerialsMap[item.item_id] && itemSerialsMap[item.item_id].length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {itemSerialsMap[item.item_id].map((serial, sIdx) => (
                        <div key={`serial-${sIdx}`} style={{
                          backgroundColor: 'white',
                          border: '2px solid #0d9488',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontSize: '14px',
                          fontFamily: 'monospace',
                          fontWeight: 'bold',
                          color: '#0d9488'
                        }}>
                          {sIdx + 1}. {serial.serial_number}
                          <span style={{ fontSize: '10px', color: '#6c757d', marginRight: '5px', fontWeight: 'normal' }}>
                            ({serial.status === 'in_stock' ? '✓ في المخزن' : serial.status})
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: '#6c757d', fontStyle: 'italic', padding: '10px' }}>
                      لا توجد سريالات مسجلة لهذا الصنف
                    </div>
                  )}
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          نافذة الطباعة (Print Modal)
      ═══════════════════════════════════════════════════════════════ */}
      {showPrintModal && printData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1001,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setShowPrintModal(false)}>
          <div style={{ color: '#1e293b',
            backgroundColor: 'white', borderRadius: '8px', padding: '30px',
            maxWidth: '800px', width: '90%', maxHeight: '90vh', overflow: 'auto',
            direction: 'rtl'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>🖨️ معاينة الطباعة</h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => window.print()}
                  style={{ padding: '8px 16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
                >
                  🖨️ طباعة
                </button>
                <button 
                  onClick={() => setShowPrintModal(false)}
                  style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
                >
                  ✕ إغلاق
                </button>
              </div>
            </div>

            <div id="print-area" style={{ padding: '20px', border: '2px solid #333' }}>
              {printData.type === 'receipt' ? (
                <>
                  <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #333', paddingBottom: '10px' }}>
                    <h2>إذن استلام مخزن</h2>
                    <p>رقم: {printData.receipt.voucher_number}</p>
                    <p>التاريخ: {new Date().toLocaleDateString('ar-EG')}</p>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                    <tbody>
                      <tr>
                        <td style={{ border: '1px solid #333', padding: '8px', fontWeight: 'bold' }}>المورد:</td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>{printData.receipt.supplier || '-'}</td>
                        <td style={{ border: '1px solid #333', padding: '8px', fontWeight: 'bold' }}>المخزن:</td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>{printData.receipt.warehouse_name || '-'}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #333', padding: '8px', fontWeight: 'bold' }}>أمين المخزن:</td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>{printData.receipt.received_by || '-'}</td>
                        <td style={{ border: '1px solid #333', padding: '8px', fontWeight: 'bold' }}>عدد الأصناف:</td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>{printData.items.length}</td>
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
                      {printData.items.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #333', padding: '8px' }}>{item.item_name}</td>
                          <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>{item.quantity}</td>
                          <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>{item.unit || 'عدد'}</td>
                          <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>{item.unit_price} ج.م</td>
                          <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>{item.total_amount} ج.م</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ color: '#1e293b', backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
                        <td colSpan="5" style={{ border: '1px solid #333', padding: '8px', textAlign: 'left' }}>الإجمالي الكلي:</td>
                        <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>
                          {printData.items.reduce((sum, i) => sum + (parseFloat(i.total_amount) || 0), 0).toFixed(2)} ج.م
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  <div style={{ borderTop: '2px solid #333', paddingTop: '10px', marginTop: '20px' }}>
                    <p><strong>إجمالي الكمية:</strong> {printData.items.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0)}</p>
                    <p><strong>عدد الأصناف:</strong> {printData.items.length}</p>
                  </div>

                  <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ textAlign: 'center' }}>
                      <p>_________________</p>
                      <p>توقيع أمين المخزن</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p>_________________</p>
                      <p>توقيع المستلم</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #333', paddingBottom: '10px' }}>
                    <h2>تفاصيل صنف - {printData.item.item_name}</h2>
                    <p>رقم الإذن: {selectedReceiptForView?.voucher_number || '-'}</p>
                    <p>التاريخ: {new Date().toLocaleDateString('ar-EG')}</p>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                    <tbody>
                      <tr>
                        <td style={{ border: '1px solid #333', padding: '8px', fontWeight: 'bold' }}>الصنف:</td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>{printData.item.item_name}</td>
                        <td style={{ border: '1px solid #333', padding: '8px', fontWeight: 'bold' }}>الكود:</td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>{printData.item.item_code || '-'}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #333', padding: '8px', fontWeight: 'bold' }}>الكمية:</td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>{printData.item.quantity}</td>
                        <td style={{ border: '1px solid #333', padding: '8px', fontWeight: 'bold' }}>الوحدة:</td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>{printData.item.unit || 'عدد'}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #333', padding: '8px', fontWeight: 'bold' }}>السعر:</td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>{printData.item.unit_price} ج.م</td>
                        <td style={{ border: '1px solid #333', padding: '8px', fontWeight: 'bold' }}>الإجمالي:</td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>{printData.item.total_amount} ج.م</td>
                      </tr>
                    </tbody>
                  </table>

                  <h3 style={{ marginBottom: '15px' }}>🔢 قائمة السريالات ({printData.serials.length})</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: '#1e293b', backgroundColor: '#f0f0f0' }}>
                        <th style={{ border: '1px solid #333', padding: '8px' }}>#</th>
                        <th style={{ border: '1px solid #333', padding: '8px' }}>السريال / IMEI</th>
                        <th style={{ border: '1px solid #333', padding: '8px' }}>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {printData.serials.map((serial, idx) => (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #333', padding: '8px', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '14px' }}>{serial.serial_number}</td>
                          <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>
                            {serial.status === 'in_stock' ? '✓ في المخزن' : serial.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ textAlign: 'center' }}>
                      <p>_________________</p>
                      <p>توقيع أمين المخزن</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p>_________________</p>
                      <p>توقيع المستلم</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Receipts;
