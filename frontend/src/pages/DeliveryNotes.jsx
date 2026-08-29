import { useState, useEffect } from 'react';
import api from '../services/api';
import SerialPicker from './SerialPicker';

function DeliveryNotes() {
  const [notes, setNotes] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [userRole, setUserRole] = useState('');
  const [editNote, setEditNote] = useState(null);
  const [editItems, setEditItems] = useState([]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserRole(user.role || '');
    fetchNotes(); fetchItems(); fetchWarehouses();
  }, []);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const res = await api.get('/delivery-notes');
      setNotes(res.data);
    } catch (err) {
      console.error('Error fetching delivery notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => { try { const r = await api.get('/items'); setItems(r.data); } catch (e) {} };
  const fetchWarehouses = async () => { try { const r = await api.get('/warehouses'); setWarehouses(r.data); } catch (e) {} };

  const getNoteItems = (n) => {
    if (Array.isArray(n.items) && n.items.length > 0) return n.items;
    return [{ id: null, item_id: n.item_id, item_name: n.item_name, quantity: n.quantity, warehouse_id: n.warehouse_id, warehouse_name: n.warehouse_name, serial_numbers: n.serial_numbers, unit: n.item_unit }];
  };

  const handleDeliver = async (id) => {
    if (!window.confirm('تأكيد تسليم الإذن للعميل؟')) return;
    try {
      await api.put(`/delivery-notes/${id}/deliver`);
      setMessage('✅ تم تأكيد التسليم بنجاح');
      fetchNotes();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || 'خطأ في تأكيد التسليم'));
    }
  };

  const handleCancel = async (id) => {
    const reason = window.prompt('سبب الإلغاء:');
    if (reason === null) return;
    try {
      await api.put(`/delivery-notes/${id}/cancel`, { reason });
      setMessage('✅ تم إلغاء إذن التسليم');
      fetchNotes();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || 'خطأ في الإلغاء'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('حذف إذن التسليم نهائياً؟ (هيتم فك حجز السريالات)')) return;
    try {
      await api.delete(`/delivery-notes/${id}`);
      setMessage('✅ تم الحذف');
      fetchNotes();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || 'خطأ في الحذف'));
    }
  };

  // ===== التعديل =====
  const openEdit = async (note) => {
    try {
      const r = await api.get(`/delivery-notes/${note.id}`);
      const full = r.data;
      setEditNote(full);
      setEditItems(getNoteItems(full).map(it => ({
        id: it.id, item_id: it.item_id, item_name: it.item_name || '',
        has_serial: it.has_serial || false,
        quantity: parseFloat(it.quantity) || 1,
        unit_price: parseFloat(it.unit_price) || 0,
        warehouse_id: it.warehouse_id || '',
        serial_numbers: Array.isArray(it.serial_numbers) ? it.serial_numbers : []
      })));
    } catch (err) { setMessage('❌ خطأ في جلب بيانات الإذن'); }
  };

  const updateEditLine = (idx, field, value) => {
    setEditItems(p => p.map((l, i) => {
      if (i !== idx) return l;
      const nl = { ...l, [field]: value };
      if (field === 'item_id') {
        const it = items.find(x => x.id == value);
        nl.item_name = it?.name || '';
        nl.has_serial = it?.has_serial || false;
        nl.serial_numbers = [];
        if (it?.warehouse_id && !nl.warehouse_id) nl.warehouse_id = it.warehouse_id;
      }
      if (field === 'warehouse_id') nl.serial_numbers = [];
      return nl;
    }));
  };

  const addEditLine = () => setEditItems(p => [...p, { id: null, item_id: '', item_name: '', has_serial: false, quantity: 1, unit_price: 0, warehouse_id: '', serial_numbers: [] }]);
  const removeEditLine = (idx) => setEditItems(p => p.filter((_, i) => i !== idx));

  const submitEdit = async () => {
    // تحقق من اكتمال سريالات الأصناف اللي بسريال
    for (const l of editItems.filter(x => x.item_id && x.has_serial && parseFloat(x.quantity) > 0)) {
      if ((l.serial_numbers || []).length !== parseInt(l.quantity)) {
        setMessage(`❌ الصنف "${l.item_name}" محتاج ${l.quantity} سريال — اخترت ${(l.serial_numbers || []).length}`);
        return;
      }
    }
    const payloadItems = editItems.filter(l => l.item_id && parseFloat(l.quantity) > 0).map(l => ({
      item_id: l.item_id, item_name: l.item_name, quantity: parseFloat(l.quantity),
      unit_price: parseFloat(l.unit_price) || 0, warehouse_id: l.warehouse_id || null,
      serial_numbers: l.has_serial ? (l.serial_numbers || []) : []
    }));
    if (payloadItems.length === 0) { setMessage('❌ أضف صنف واحد على الأقل'); return; }
    try {
      await api.put(`/delivery-notes/${editNote.id}`, { items: payloadItems });
      setMessage('✅ تم تعديل إذن التسليم');
      setEditNote(null);
      fetchNotes();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || 'خطأ في التعديل'));
    }
  };

  // 🖨️ طباعة إذن تسليم — أصناف متعددة
  const handlePrint = async (note) => {
    let printNote = note;
    let printItems = getNoteItems(note);
    try {
      const r = await api.get(`/delivery-notes/${note.id}/print`);
      if (r.data?.delivery_note) {
        printNote = r.data.delivery_note;
        if (Array.isArray(r.data.items) && r.data.items.length > 0) printItems = r.data.items;
      }
    } catch (e) { /* fallback للبيانات المحلية */ }

    const itemRows = printItems.map((it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${it.item_name || '-'}</td>
        <td><strong>${it.quantity}</strong></td>
        <td>${it.unit || it.item_unit || 'عدد'}</td>
        <td>${it.warehouse_name || '-'}</td>
        <td style="direction:ltr;font-family:monospace;font-size:12px;">${Array.isArray(it.serial_numbers) && it.serial_numbers.length > 0 ? it.serial_numbers.join(', ') : '-'}</td>
      </tr>`).join('');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html dir="rtl">
      <head>
        <title>إذن تسليم - ${printNote.note_number}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          .header { text-align: center; border-bottom: 3px solid #22c55e; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { color: #22c55e; margin: 0; }
          .info { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; }
          .info-item { padding: 10px; background: #f8f9fa; border-radius: 8px; }
          .info-label { font-weight: bold; color: #6c757d; font-size: 12px; }
          .info-value { font-size: 16px; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #333; padding: 10px; text-align: center; }
          th { background: #f0fdf4; }
          .footer { margin-top: 50px; display: flex; justify-content: space-between; }
          .signature { text-align: center; width: 200px; }
          .signature-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 10px; }
          .stamp { text-align: center; margin-top: 30px; padding: 20px; border: 2px dashed #22c55e; border-radius: 8px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📦 إذن تسليم للعميل</h1>
          <p>رقم الإذن: <strong>${printNote.note_number}</strong></p>
          <p>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</p>
        </div>

        <div class="info">
          <div class="info-item">
            <div class="info-label">العميل</div>
            <div class="info-value">${printNote.customer_name || '-'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">رقم الفاتورة</div>
            <div class="info-value">${printNote.invoice_number || '-'}</div>
          </div>
          ${printNote.dq_number ? `<div class="info-item"><div class="info-label">بيان التسليم المسعر</div><div class="info-value">${printNote.dq_number}</div></div>` : ''}
          <div class="info-item">
            <div class="info-label">التاريخ</div>
            <div class="info-value">${printNote.created_at ? new Date(printNote.created_at).toLocaleDateString('ar-EG') : '-'}</div>
          </div>
        </div>

        <table>
          <thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>الوحدة</th><th>المخزن</th><th>السريالات</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>

        <div class="stamp">
          <p style="font-size: 14px; color: #6c757d; margin: 0;">✓ تم التسليم بموجب هذا الإذن</p>
          <p style="font-size: 12px; color: #6c757d; margin: 5px 0 0 0;">تاريخ التسليم: ${printNote.delivered_at ? new Date(printNote.delivered_at).toLocaleDateString('ar-EG') : new Date().toLocaleDateString('ar-EG')}</p>
        </div>

        <div class="footer">
          <div class="signature"><div class="signature-line">توقيع المستلم</div></div>
          <div class="signature"><div class="signature-line">توقيع السائق</div></div>
          <div class="signature"><div class="signature-line">توقيع المخزن</div></div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const getStatusText = (status) => {
    const statuses = { 'pending': '⏳ بانتظار التسليم', 'delivered': '✓ تم التسليم', 'cancelled': '✕ ملغي', 'rejected': '✕ مرفوض' };
    return statuses[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = { 'pending': '#f59e0b', 'delivered': '#22c55e', 'cancelled': '#dc3545', 'rejected': '#dc3545' };
    return colors[status] || '#6c757d';
  };

  const thStyle = { padding: '12px', border: '1px solid #ddd', backgroundColor: '#22c55e', color: 'white' };
  const tdStyle = { padding: '10px', border: '1px solid #ddd' };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl', background: '#ffffff', color: '#1f2937', minHeight: '100vh' }}>
      <h1>📦 إذونات التسليم</h1>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={() => window.location.href = '/sales-module'} style={{ padding: '10px 20px', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          ← رجوع للمبيعات
        </button>
        <button onClick={() => window.location.href = '/dashboard'} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          🏠 الرئيسية
        </button>
      </div>

      {message && <p style={{ padding: '10px', backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da', borderRadius: '4px', fontWeight: 'bold' }}>{message}</p>}

      <h3>📦 قائمة إذونات التسليم ({notes.length})</h3>
      {loading ? <p>جاري التحميل...</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr>
                <th style={thStyle}>رقم الإذن</th>
                <th style={thStyle}>المرجع</th>
                <th style={thStyle}>العميل</th>
                <th style={thStyle}>الأصناف</th>
                <th style={thStyle}>السريالات</th>
                <th style={thStyle}>الحالة</th>
                <th style={thStyle}>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {notes.length === 0 ? <tr><td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>لا توجد إذونات تسليم</td></tr> : (
                notes.map(n => {
                  const nItems = getNoteItems(n);
                  return (
                    <tr key={n.id} style={{ backgroundColor: n.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                      <td style={tdStyle}><strong>{n.note_number}</strong></td>
                      <td style={tdStyle}>
                        {n.invoice_number && <div style={{ fontSize: '12px' }}>🧾 {n.invoice_number}</div>}
                        {n.dq_number && <div style={{ fontSize: '12px', color: '#d97706' }}>📋 {n.dq_number}</div>}
                        {!n.invoice_number && !n.dq_number && '-'}
                      </td>
                      <td style={tdStyle}>{n.customer_name}</td>
                      <td style={tdStyle}>
                        {nItems.map((it, i) => (
                          <div key={i} style={{ fontSize: '13px', marginBottom: '2px' }}>
                            {it.item_name || '-'} <strong style={{ color: '#22c55e' }}>({it.quantity})</strong>
                            {it.warehouse_name && <span style={{ fontSize: '11px', color: '#6c757d' }}> — {it.warehouse_name}</span>}
                          </div>
                        ))}
                        {nItems.length > 1 && <span style={{ fontSize: '11px', background: '#dcfce7', padding: '2px 8px', borderRadius: '10px', color: '#166534' }}>{nItems.length} أصناف</span>}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', maxWidth: '250px' }}>
                          {nItems.flatMap(it => Array.isArray(it.serial_numbers) ? it.serial_numbers : []).length > 0 ? (
                            nItems.flatMap(it => Array.isArray(it.serial_numbers) ? it.serial_numbers : []).map((s, i) => (
                              <code key={i} style={{ background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{s}</code>
                            ))
                          ) : '-'}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: getStatusColor(n.status), fontWeight: 'bold', padding: '4px 12px', borderRadius: '12px', backgroundColor: getStatusColor(n.status) + '20' }}>
                          {getStatusText(n.status)}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          <button onClick={() => handlePrint(n)} style={{ padding: '5px 10px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>🖨️ طباعة</button>
                          {userRole === 'admin' && (
                            <button onClick={() => openEdit(n)} style={{ padding: '5px 10px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✏️ تعديل</button>
                          )}
                          {n.status === 'pending' && ['storekeeper', 'admin', 'manager', 'sales'].includes(userRole) && (
                            <button onClick={() => handleDeliver(n.id)} style={{ padding: '5px 10px', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✓ تسليم</button>
                          )}
                          {n.status === 'pending' && ['admin', 'manager'].includes(userRole) && (
                            <button onClick={() => handleCancel(n.id)} style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✕ إلغاء</button>
                          )}
                          {n.status === 'pending' && userRole === 'admin' && (
                            <button onClick={() => handleDelete(n.id)} style={{ padding: '5px 10px', backgroundColor: '#b91c1c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>🗑️ حذف</button>
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
      )}

      {/* Edit Modal */}
      {editNote && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '20px' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginTop: 0 }}>✏️ تعديل إذن التسليم {editNote.note_number}</h2>
            <p style={{ color: '#6c7280', fontSize: '14px' }}>العميل: <strong>{editNote.customer_name}</strong> — السريالات القديمة هتفك حجزها وتتحجز الجديدة تلقائياً.</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
              <thead><tr style={{ background: '#22c55e', color: 'white' }}>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>الصنف</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>المخزن</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>الكمية</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>السريالات</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}></th>
              </tr></thead>
              <tbody>
                {editItems.map((line, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '6px', border: '1px solid #ddd', minWidth: '200px' }}>
                      <select value={line.item_id} onChange={e => updateEditLine(idx, 'item_id', e.target.value)} style={{ width: '100%', padding: '6px' }}>
                        <option value="">اختر الصنف</option>
                        {items.map(i => <option key={i.id} value={i.id}>{i.code} - {i.name}{i.has_serial ? ' 🔢' : ''}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px', border: '1px solid #ddd' }}>
                      <select value={line.warehouse_id} onChange={e => updateEditLine(idx, 'warehouse_id', e.target.value)} style={{ width: '100%', padding: '6px' }}>
                        <option value="">—</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px', border: '1px solid #ddd', width: '90px' }}>
                      <input type="number" step="0.001" min="0.001" value={line.quantity} onChange={e => updateEditLine(idx, 'quantity', e.target.value)} style={{ width: '100%', padding: '6px' }} />
                    </td>
                    <td style={{ padding: '6px', border: '1px solid #ddd', minWidth: '260px' }}>
                      {line.has_serial ? (
                        <SerialPicker
                          itemId={line.item_id}
                          warehouseId={line.warehouse_id}
                          count={line.quantity}
                          value={line.serial_numbers || []}
                          onChange={(arr) => updateEditLine(idx, 'serial_numbers', arr)}
                        />
                      ) : <span style={{ color: '#9ca3af', fontSize: '12px' }}>بدون سريال</span>}
                    </td>
                    <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'center' }}>
                      {editItems.length > 1 && <button onClick={() => removeEditLine(idx)} style={{ padding: '4px 10px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🗑️</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: '10px' }}>
              <button onClick={addEditLine} style={{ padding: '8px 20px', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>➕ إضافة صنف</button>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={submitEdit} style={{ padding: '10px 30px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>💾 حفظ التعديل</button>
              <button onClick={() => setEditNote(null)} style={{ padding: '10px 20px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DeliveryNotes;
