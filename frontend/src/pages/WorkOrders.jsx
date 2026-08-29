import { useState, useEffect } from 'react';
import api from '../services/api';
import SerialPicker from './SerialPicker';

function WorkOrders() {
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [editForm, setEditForm] = useState({ work_type: 'installation', description: '', start_date: '', expected_end_date: '', assigned_to: '', notes: '' });
  const [editItems, setEditItems] = useState([]);
  const [message, setMessage] = useState('');
  const [userRole, setUserRole] = useState('');
  const [printData, setPrintData] = useState(null);

  const [formData, setFormData] = useState({
    work_order_number: '', customer_id: '', customer_name: '', item_id: '', item_name: '',
    quantity: 1, work_type: 'installation', description: '', start_date: '',
    expected_end_date: '', assigned_to: '', notes: '', warehouse_id: '', serial_numbers: []
  });

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserRole(user.role || '');
    fetchOrders();
    fetchEmployees();
    fetchCustomers();
    fetchItems();
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    try { const res = await api.get('/warehouses'); setWarehouses(res.data); }
    catch (err) { console.error(err); }
  };

  const fetchOrders = async () => {
    try { 
      const res = await api.get('/work-orders'); 
      setOrders(res.data); 
    }
    catch (err) { console.error(err); }
  };

  const fetchEmployees = async () => {
    try { const res = await api.get('/employees'); setEmployees(res.data); }
    catch (err) { console.error(err); }
  };

  const fetchCustomers = async () => {
    try { const res = await api.get('/customers'); setCustomers(res.data); }
    catch (err) { console.error(err); }
  };

  const fetchItems = async () => {
    try { const res = await api.get('/items'); setItems(res.data); }
    catch (err) { console.error(err); }
  };

  const fetchNextNumber = async () => {
    try {
      const res = await api.get('/work-orders');
      const last = res.data.find(o => o.work_order_number?.startsWith('WO-'));
      let nextNum = 1;
      if (last) {
        const num = parseInt(last.work_order_number.split('-')[1]);
        if (!isNaN(num)) nextNum = num + 1;
      }
      setFormData(prev => ({...prev, work_order_number: `WO-${String(nextNum).padStart(4, '0')}`}));
    } catch (err) { console.error(err); }
  };

  const handleShowForm = () => {
    setShowForm(true);
    fetchNextNumber();
    setFormData({
      work_order_number: '', customer_id: '', customer_name: '', item_id: '', item_name: '',
      quantity: 1, work_type: 'installation', description: '', start_date: '',
      expected_end_date: '', assigned_to: '', notes: '', warehouse_id: '', serial_numbers: []
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const selectedItem = items.find(x => x.id == formData.item_id);
    const serials = formData.serial_numbers || [];
    if (selectedItem?.has_serial && serials.length !== parseInt(formData.quantity)) {
      setMessage(`خطأ: الصنف بسريالات — لازم تختار ${formData.quantity} سريال (اخترت ${serials.length})`);
      return;
    }
    const payload = {
      ...formData,
      serial_numbers: serials.length > 0 ? serials : undefined,
      items: [{
        item_id: formData.item_id, item_name: formData.item_name,
        quantity: parseFloat(formData.quantity) || 1,
        warehouse_id: formData.warehouse_id || null,
        serial_numbers: serials.length > 0 ? serials : null
      }]
    };
    try {
      await api.post('/work-orders', payload);
      setMessage('تم إنشاء أمر الشغل بنجاح');
      setShowForm(false);
      fetchOrders();
    } catch (err) { setMessage('خطأ: ' + (err.response?.data?.message || 'حدث خطأ')); }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await api.put(`/work-orders/${id}/status`, { status });
      setMessage('تم تحديث الحالة بنجاح');
      fetchOrders();
    } catch (err) { setMessage('خطأ في التحديث'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من الحذف؟')) return;
    try {
      await api.delete(`/work-orders/${id}`);
      setMessage('تم الحذف بنجاح');
      fetchOrders();
    } catch (err) { setMessage('خطأ في الحذف'); }
  };

  // ===== ✏️ تعديل أمر شغل (أدمن فقط — في أي حالة) =====
  const openEdit = async (order) => {
    try {
      const res = await api.get(`/work-orders/${order.id}`);
      const full = res.data;
      setEditOrder(full);
      setEditForm({
        work_type: full.work_type || 'installation',
        description: full.description || '',
        start_date: full.start_date ? String(full.start_date).slice(0, 10) : '',
        expected_end_date: full.expected_end_date ? String(full.expected_end_date).slice(0, 10) : '',
        assigned_to: full.assigned_to || '',
        notes: full.notes || ''
      });
      const srcItems = (Array.isArray(full.items) && full.items.length > 0)
        ? full.items
        : [{ item_id: full.item_id, item_name: full.item_name, quantity: full.quantity, warehouse_id: full.warehouse_id, serial_numbers: full.serial_numbers }];
      setEditItems(srcItems.filter(it => it.item_id).map(it => {
        const itemMaster = items.find(i => i.id == it.item_id);
        return {
          item_id: it.item_id,
          item_name: it.item_name || itemMaster?.name || '',
          has_serial: it.has_serial || itemMaster?.has_serial || false,
          quantity: parseFloat(it.quantity) || 1,
          unit_price: parseFloat(it.unit_price) || 0,
          warehouse_id: it.warehouse_id || full.warehouse_id || '',
          serial_numbers: Array.isArray(it.serial_numbers) ? it.serial_numbers : [],
          notes: it.notes || ''
        };
      }));
      setMessage('');
    } catch (err) { setMessage('خطأ في جلب بيانات أمر الشغل'); }
  };

  const updateEditItem = (idx, field, value) => {
    setEditItems(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      const nl = { ...l, [field]: value };
      if (field === 'item_id') {
        const it = items.find(x => x.id == value);
        nl.item_name = it?.name || '';
        nl.has_serial = it?.has_serial || false;
        nl.serial_numbers = [];
      }
      if (field === 'warehouse_id' || field === 'quantity') nl.serial_numbers = [];
      return nl;
    }));
  };

  const addEditItem = () => setEditItems(prev => [...prev, { item_id: '', item_name: '', has_serial: false, quantity: 1, unit_price: 0, warehouse_id: '', serial_numbers: [], notes: '' }]);
  const removeEditItem = (idx) => setEditItems(prev => prev.filter((_, i) => i !== idx));

  const submitEdit = async () => {
    for (const l of editItems.filter(x => x.item_id)) {
      const itemMaster = items.find(i => i.id == l.item_id);
      if ((l.has_serial || itemMaster?.has_serial) && (l.serial_numbers || []).length !== parseInt(l.quantity)) {
        setMessage(`خطأ: الصنف "${l.item_name || itemMaster?.name}" محتاج ${l.quantity} سريال — اخترت ${(l.serial_numbers || []).length}`);
        return;
      }
    }
    const payloadItems = editItems.filter(l => l.item_id && parseFloat(l.quantity) > 0).map(l => ({
      item_id: l.item_id, item_name: l.item_name, quantity: parseFloat(l.quantity),
      unit_price: parseFloat(l.unit_price) || 0, warehouse_id: l.warehouse_id || null,
      serial_numbers: (l.serial_numbers && l.serial_numbers.length > 0) ? l.serial_numbers : null,
      notes: l.notes || null
    }));
    if (payloadItems.length === 0) { setMessage('خطأ: أضف صنف واحد على الأقل'); return; }
    try {
      await api.put(`/work-orders/${editOrder.id}`, { ...editForm, items: payloadItems });
      setMessage('تم تعديل أمر الشغل بنجاح');
      setEditOrder(null);
      fetchOrders();
    } catch (err) { setMessage('خطأ: ' + (err.response?.data?.message || 'حدث خطأ أثناء التعديل')); }
  };

  // 🖨️ طباعة أمر الشغل
  const handlePrint = (order) => {
    setPrintData(order);
    const oItems = (Array.isArray(order.items) && order.items.length > 0) ? order.items : [{ item_name: order.item_name, quantity: order.quantity, serial_numbers: order.serial_numbers, warehouse_name: order.warehouse_name, item_unit: order.item_unit }];
    const itemRows = oItems.map((it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${it.item_name || '-'}</td>
        <td><strong>${it.quantity}</strong></td>
        <td>${it.item_unit || it.unit || 'عدد'}</td>
        <td>${it.warehouse_name || '-'}</td>
        <td style="direction:ltr;font-family:monospace;font-size:12px;">${Array.isArray(it.serial_numbers) && it.serial_numbers.length > 0 ? it.serial_numbers.join(', ') : '-'}</td>
      </tr>`).join('');
    setTimeout(() => {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html dir="rtl">
        <head>
          <title>أمر شغل - ${order.work_order_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; }
            .header { text-align: center; border-bottom: 3px solid #f59e0b; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { color: #f59e0b; margin: 0; }
            .info { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; }
            .info-item { padding: 10px; background: #f8f9fa; border-radius: 8px; }
            .info-label { font-weight: bold; color: #6c757d; font-size: 12px; }
            .info-value { font-size: 16px; margin-top: 5px; }
            .quantity-box { text-align: center; padding: 30px; background: #fffbeb; border: 3px solid #f59e0b; border-radius: 12px; margin: 30px 0; }
            .quantity-box .label { font-size: 18px; color: #92400e; }
            .quantity-box .value { font-size: 48px; font-weight: bold; color: #f59e0b; margin: 10px 0; }
            .footer { margin-top: 50px; display: flex; justify-content: space-between; }
            .signature { text-align: center; width: 200px; }
            .signature-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 10px; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🔧 أمر شغل تركيبات</h1>
            <p>رقم الأمر: <strong>${order.work_order_number}</strong></p>
            <p>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</p>
          </div>

          <div class="info">
            <div class="info-item">
              <div class="info-label">العميل</div>
              <div class="info-value">${order.customer_name || '-'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">المرجع</div>
              <div class="info-value">${order.invoice_number ? '🧾 ' + order.invoice_number : (order.dq_number ? '📋 ' + order.dq_number : '-')}</div>
            </div>
            <div class="info-item">
              <div class="info-label">نوع الشغل</div>
              <div class="info-value">${order.work_type === 'installation' ? 'تركيب' : order.work_type === 'maintenance' ? 'صيانة' : order.work_type === 'repair' ? 'إصلاح' : 'تصنيع'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">مسند إلى</div>
              <div class="info-value">${order.assigned_to_name || '-'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">تاريخ البدء</div>
              <div class="info-value">${order.start_date ? new Date(order.start_date).toLocaleDateString('ar-EG') : '-'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">تاريخ الانتهاء المتوقع</div>
              <div class="info-value">${order.expected_end_date ? new Date(order.expected_end_date).toLocaleDateString('ar-EG') : '-'}</div>
            </div>
          </div>

          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <thead><tr style="background:#fffbeb;"><th style="border:1px solid #333;padding:10px;">#</th><th style="border:1px solid #333;padding:10px;">الصنف</th><th style="border:1px solid #333;padding:10px;">الكمية</th><th style="border:1px solid #333;padding:10px;">الوحدة</th><th style="border:1px solid #333;padding:10px;">المخزن</th><th style="border:1px solid #333;padding:10px;">السريالات</th></tr></thead>
            <tbody>${itemRows}</tbody>
          </table>

          <div class="info-item" style="margin-bottom: 30px;">
            <div class="info-label">الوصف / ملاحظات</div>
            <div class="info-value">${order.description || order.notes || 'لا يوجد'}</div>
          </div>

          <div class="footer">
            <div class="signature">
              <div class="signature-line">توقيع المشرف</div>
            </div>
            <div class="signature">
              <div class="signature-line">توقيع الفني</div>
            </div>
            <div class="signature">
              <div class="signature-line">توقيع العميل</div>
            </div>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }, 100);
  };

  const getStatusText = (status) => {
    const statuses = {
      'pending': '⏳ بانتظار البدء', 'in_progress': '🔧 جاري التنفيذ',
      'completed': '✓ مكتمل', 'cancelled': '✕ ملغي'
    };
    return statuses[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': '#f59e0b', 'in_progress': '#2563eb',
      'completed': '#22c55e', 'cancelled': '#dc3545'
    };
    return colors[status] || '#6c757d';
  };

  const thStyle = { padding: '12px', border: '1px solid #ddd', backgroundColor: '#f59e0b', color: 'white' };
  const tdStyle = { padding: '10px', border: '1px solid #ddd' };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl', background: '#ffffff', color: '#1f2937', minHeight: '100vh' }}>
      <h1>🔧 أوامر الشغل</h1>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={() => window.location.href = '/sales-module'} style={{ padding: '10px 20px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          ← رجوع للمبيعات
        </button>
        <button onClick={() => window.location.href = '/dashboard'} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          🏠 الرئيسية
        </button>
      </div>

      {message && <p style={{ padding: '10px', backgroundColor: message.includes('نجاح') || message.includes('تم') ? '#d4edda' : '#f8d7da', borderRadius: '4px', fontWeight: 'bold' }}>{message}</p>}

      <div style={{ marginBottom: '20px' }}>
        <button onClick={handleShowForm} style={{ padding: '12px 30px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
          ➕ أمر شغل جديد
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ backgroundColor: '#fffbeb', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '3px solid #f59e0b' }}>
          <h3 style={{ color: '#f59e0b' }}>➕ أمر شغل جديد</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            <div><label>رقم الأمر:</label><input type="text" value={formData.work_order_number} readOnly style={{ width: '100%', padding: '8px', backgroundColor: '#e2e8f0' }} /></div>
            <div><label>العميل:</label><select value={formData.customer_id} onChange={(e) => { const c = customers.find(x => x.id == e.target.value); setFormData({...formData, customer_id: e.target.value, customer_name: c?.name || ''}); }} required style={{ width: '100%', padding: '8px' }}><option value="">اختر</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label>الصنف:</label><select value={formData.item_id} onChange={(e) => { const item = items.find(x => x.id == e.target.value); setFormData({...formData, item_id: e.target.value, item_name: item?.name || '', serial_numbers: [], warehouse_id: formData.warehouse_id || item?.warehouse_id || ''}); }} required style={{ width: '100%', padding: '8px' }}><option value="">اختر</option>{items.map(i => <option key={i.id} value={i.id}>{i.code} - {i.name}{i.has_serial ? ' 🔢' : ''}</option>)}</select></div>
            <div><label>الكمية:</label><input type="number" step="0.001" min="0.001" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: e.target.value, serial_numbers: []})} required style={{ width: '100%', padding: '8px' }} /></div>
            <div><label>المخزن:</label><select value={formData.warehouse_id} onChange={(e) => setFormData({...formData, warehouse_id: e.target.value, serial_numbers: []})} style={{ width: '100%', padding: '8px' }}><option value="">اختر المخزن</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
            {formData.item_id && items.find(x => x.id == formData.item_id)?.has_serial && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label>🔢 السريالات (من الرصيد المتاح — مطلوب {formData.quantity}):</label>
                <SerialPicker
                  itemId={formData.item_id}
                  warehouseId={formData.warehouse_id}
                  count={formData.quantity}
                  value={formData.serial_numbers}
                  onChange={(arr) => setFormData({ ...formData, serial_numbers: arr })}
                />
              </div>
            )}
            <div><label>نوع الشغل:</label><select value={formData.work_type} onChange={(e) => setFormData({...formData, work_type: e.target.value})} style={{ width: '100%', padding: '8px' }}><option value="installation">تركيب</option><option value="maintenance">صيانة</option><option value="repair">إصلاح</option><option value="manufacturing">تصنيع</option></select></div>
            <div><label>تاريخ البدء:</label><input type="date" value={formData.start_date} onChange={(e) => setFormData({...formData, start_date: e.target.value})} style={{ width: '100%', padding: '8px' }} /></div>
            <div><label>تاريخ الانتهاء المتوقع:</label><input type="date" value={formData.expected_end_date} onChange={(e) => setFormData({...formData, expected_end_date: e.target.value})} style={{ width: '100%', padding: '8px' }} /></div>
            <div><label>مسند إلى:</label><select value={formData.assigned_to} onChange={(e) => setFormData({...formData, assigned_to: e.target.value})} style={{ width: '100%', padding: '8px' }}><option value="">اختر</option>{employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></div>
            <div><label>الوصف:</label><input type="text" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} style={{ width: '100%', padding: '8px' }} /></div>
            <div><label>ملاحظات:</label><input type="text" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} style={{ width: '100%', padding: '8px' }} /></div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="submit" style={{ padding: '12px 40px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>💾 حفظ</button>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: '12px 40px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>❌ إلغاء</button>
          </div>
        </form>
      )}

      <h3>🔧 قائمة أوامر الشغل ({orders.length})</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr>
              <th style={thStyle}>رقم الأمر</th>
              <th style={thStyle}>المرجع</th>
              <th style={thStyle}>العميل</th>
              <th style={thStyle}>الأصناف</th>
              <th style={thStyle}>السريالات</th>
              <th style={thStyle}>نوع الشغل</th>
              <th style={thStyle}>مسند إلى</th>
              <th style={thStyle}>الحالة</th>
              <th style={thStyle}>إجراء</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? <tr><td colSpan="9" style={{ textAlign: 'center', padding: '20px' }}>لا توجد أوامر شغل</td></tr> : (
              orders.map(o => {
                const oItems = (Array.isArray(o.items) && o.items.length > 0) ? o.items : [{ item_name: o.item_name, quantity: o.quantity, serial_numbers: o.serial_numbers, warehouse_name: o.warehouse_name }];
                const allSerials = oItems.flatMap(it => Array.isArray(it.serial_numbers) ? it.serial_numbers : []);
                return (
                <tr key={o.id} style={{ backgroundColor: o.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                  <td style={tdStyle}><strong>{o.work_order_number}</strong></td>
                  <td style={tdStyle}>
                    {o.invoice_number && <div style={{ fontSize: '12px' }}>🧾 {o.invoice_number}</div>}
                    {o.dq_number && <div style={{ fontSize: '12px', color: '#d97706' }}>📋 {o.dq_number}</div>}
                    {!o.invoice_number && !o.dq_number && '-'}
                  </td>
                  <td style={tdStyle}>{o.customer_name}</td>
                  <td style={tdStyle}>
                    {oItems.map((it, i) => (
                      <div key={i} style={{ fontSize: '13px', marginBottom: '2px' }}>
                        {it.item_name || '-'} <strong style={{ color: '#f59e0b' }}>({it.quantity})</strong>
                        {it.warehouse_name && <span style={{ fontSize: '11px', color: '#6c757d' }}> — {it.warehouse_name}</span>}
                      </div>
                    ))}
                    {oItems.length > 1 && <span style={{ fontSize: '11px', background: '#fef3c7', padding: '2px 8px', borderRadius: '10px', color: '#92400e' }}>{oItems.length} أصناف</span>}
                  </td>
                  <td style={tdStyle}>
                    {allSerials.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', maxWidth: '220px' }}>
                        {allSerials.map((s, i) => (
                          <code key={i} style={{ background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{s}</code>
                        ))}
                      </div>
                    ) : '-'}
                  </td>
                  <td style={tdStyle}>{o.work_type === 'installation' ? 'تركيب' : o.work_type === 'maintenance' ? 'صيانة' : o.work_type === 'repair' ? 'إصلاح' : 'تصنيع'}</td>
                  <td style={tdStyle}>{o.assigned_to_name || '-'}</td>
                  <td style={tdStyle}>
                    <span style={{ color: getStatusColor(o.status), fontWeight: 'bold', padding: '4px 12px', borderRadius: '12px', backgroundColor: getStatusColor(o.status) + '20' }}>
                      {getStatusText(o.status)}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      <button onClick={() => handlePrint(o)} style={{ padding: '4px 8px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>🖨️ طباعة</button>
                      {userRole === 'admin' && (
                        <button onClick={() => openEdit(o)} style={{ padding: '4px 8px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>✏️ تعديل</button>
                      )}
                      {o.status === 'pending' && ['admin'].includes(userRole) && (
                        <button onClick={() => handleStatusUpdate(o.id, 'in_progress')} style={{ padding: '4px 8px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>▶️ بدء</button>
                      )}
                      {o.status === 'in_progress' && ['admin'].includes(userRole) && (
                        <button onClick={() => handleStatusUpdate(o.id, 'completed')} style={{ padding: '4px 8px', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>✓ إنهاء</button>
                      )}
                      {o.status === 'pending' && ['admin'].includes(userRole) && (
                        <button onClick={() => handleDelete(o.id)} style={{ padding: '4px 8px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>🗑️ حذف</button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ✏️ مودال تعديل أمر الشغل — أدمن فقط */}
      {editOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={() => setEditOrder(null)}>
          <div style={{ backgroundColor: 'white', borderRadius: '10px', padding: '25px', maxWidth: '950px', width: '95%', maxHeight: '90vh', overflow: 'auto', direction: 'rtl' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: '#f59e0b' }}>✏️ تعديل أمر الشغل {editOrder.work_order_number}</h3>
              <button onClick={() => setEditOrder(null)} style={{ padding: '5px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
              <div><label>نوع الشغل:</label>
                <select value={editForm.work_type} onChange={(e) => setEditForm({ ...editForm, work_type: e.target.value })} style={{ width: '100%', padding: '8px' }}>
                  <option value="installation">تركيب</option><option value="maintenance">صيانة</option><option value="repair">إصلاح</option><option value="manufacturing">تصنيع</option>
                </select>
              </div>
              <div><label>تاريخ البدء:</label><input type="date" value={editForm.start_date} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} style={{ width: '100%', padding: '8px' }} /></div>
              <div><label>تاريخ الانتهاء المتوقع:</label><input type="date" value={editForm.expected_end_date} onChange={(e) => setEditForm({ ...editForm, expected_end_date: e.target.value })} style={{ width: '100%', padding: '8px' }} /></div>
              <div><label>مسند إلى:</label>
                <select value={editForm.assigned_to} onChange={(e) => setEditForm({ ...editForm, assigned_to: e.target.value })} style={{ width: '100%', padding: '8px' }}>
                  <option value="">اختر</option>{employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                </select>
              </div>
              <div><label>الوصف:</label><input type="text" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} style={{ width: '100%', padding: '8px' }} /></div>
              <div><label>ملاحظات:</label><input type="text" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} style={{ width: '100%', padding: '8px' }} /></div>
            </div>

            <h4 style={{ color: '#374151', marginBottom: '10px' }}>📦 الأصناف</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f59e0b', color: 'white' }}>
                  <th style={thStyle}>الصنف</th>
                  <th style={thStyle}>الكمية</th>
                  <th style={thStyle}>المخزن</th>
                  <th style={thStyle}>السريالات</th>
                  <th style={thStyle}>حذف</th>
                </tr>
              </thead>
              <tbody>
                {editItems.map((l, idx) => {
                  const itemMaster = items.find(i => i.id == l.item_id);
                  const hasSerial = l.has_serial || itemMaster?.has_serial;
                  return (
                    <tr key={idx}>
                      <td style={tdStyle}>
                        <select value={l.item_id} onChange={(e) => updateEditItem(idx, 'item_id', e.target.value)} style={{ width: '100%', padding: '6px' }}>
                          <option value="">اختر الصنف</option>
                          {items.map(i => <option key={i.id} value={i.id}>{i.code} - {i.name}{i.has_serial ? ' 🔢' : ''}</option>)}
                        </select>
                      </td>
                      <td style={tdStyle}>
                        <input type="number" step="0.001" min="0.001" value={l.quantity} onChange={(e) => updateEditItem(idx, 'quantity', e.target.value)} style={{ width: '100%', padding: '6px' }} />
                      </td>
                      <td style={tdStyle}>
                        <select value={l.warehouse_id} onChange={(e) => updateEditItem(idx, 'warehouse_id', e.target.value)} style={{ width: '100%', padding: '6px' }}>
                          <option value="">اختر المخزن</option>
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      </td>
                      <td style={{ ...tdStyle, minWidth: '240px' }}>
                        {hasSerial ? (
                          <SerialPicker
                            itemId={l.item_id}
                            warehouseId={l.warehouse_id}
                            count={l.quantity}
                            value={l.serial_numbers || []}
                            onChange={(arr) => updateEditItem(idx, 'serial_numbers', arr)}
                          />
                        ) : <span style={{ color: '#9ca3af', fontSize: '12px' }}>بدون سريال</span>}
                      </td>
                      <td style={tdStyle}>
                        <button type="button" onClick={() => removeEditItem(idx)} style={{ padding: '4px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <button type="button" onClick={addEditItem} style={{ padding: '8px 20px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', marginBottom: '15px' }}>
              ➕ إضافة صنف
            </button>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={submitEdit} style={{ padding: '10px 30px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                💾 حفظ التعديلات
              </button>
              <button onClick={() => setEditOrder(null)} style={{ padding: '10px 30px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkOrders;
