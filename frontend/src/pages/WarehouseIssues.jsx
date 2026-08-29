import { useState, useEffect } from 'react';
import api from '../services/api';
import SerialPicker from './SerialPicker';

function WarehouseIssues() {
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [approvedInvoices, setApprovedInvoices] = useState([]);
  const [manualVouchers, setManualVouchers] = useState([]);
  const [invoiceVouchers, setInvoiceVouchers] = useState([]);
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [showManualForm, setShowManualForm] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [message, setMessage] = useState('');
  const [userRole, setUserRole] = useState('');
  const [activeTab, setActiveTab] = useState('pending');

  // 📦 مودال الصرف لكل مخزن
  const [issueModal, setIssueModal] = useState({ open: false, invoice: null, warehouseId: null, warehouseName: '', lines: [], lineSerials: {}, error: '' });

  const [formData, setFormData] = useState({
    voucher_number: '',
    voucher_date: new Date().toISOString().split('T')[0],
    reference_type: 'sales_order',
    reference_number: '',
    customer_id: '',
    warehouse_id: '',
    notes: ''
  });

  const [voucherItems, setVoucherItems] = useState([{
    item_id: '', item_name: '', quantity: 1, unit_price: 0, serial_numbers: [], notes: ''
  }]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserRole(user.role || '');
    fetchPendingInvoices();
    fetchApprovedInvoices();
    fetchManualVouchers();
    fetchInvoiceVouchers();
    fetchItems();
    fetchCustomers();
    fetchWarehouses();
  }, []);

  const fetchPendingInvoices = async () => {
    try {
      const res = await api.get('/sales-invoices/pending-warehouse');
      setPendingInvoices(res.data);
    } catch (err) { console.error('خطأ في تحميل الفواتير المعلقة'); }
  };

  const fetchApprovedInvoices = async () => {
    try {
      const res = await api.get('/sales-invoices/warehouse-approved');
      setApprovedInvoices(res.data);
    } catch (err) { console.error('خطأ في تحميل الفواتير المعتمدة'); }
  };

  const fetchManualVouchers = async () => {
    try {
      const res = await api.get('/warehouse-issues');
      setManualVouchers(res.data);
    } catch (err) { console.error('خطأ في تحميل الإذون اليدوية'); }
  };

  const fetchInvoiceVouchers = async () => {
    try {
      const res = await api.get('/warehouse-issues?source=invoice');
      setInvoiceVouchers(res.data);
    } catch (err) { console.error('خطأ في تحميل إذون الصرف الناتجة من الفواتير'); }
  };

  const fetchItems = async () => { try { const res = await api.get('/items'); setItems(res.data); } catch (err) {} };
  const fetchCustomers = async () => { try { const res = await api.get('/customers'); setCustomers(res.data); } catch (err) {} };
  const fetchWarehouses = async () => { try { const res = await api.get('/warehouses'); setWarehouses(res.data); } catch (err) {} };

  const fetchNextNumber = async () => {
    try {
      const res = await api.get('/warehouse-issues/next-number');
      setFormData(prev => ({ ...prev, voucher_number: res.data.nextNumber }));
    } catch (err) { console.error('خطأ في توليد الرقم'); }
  };

  // ===== الإذن اليدوي =====
  const handleShowManualForm = () => {
    setEditingVoucher(null);
    setShowManualForm(true);
    fetchNextNumber();
    setFormData({
      voucher_number: '', voucher_date: new Date().toISOString().split('T')[0],
      reference_type: 'sales_order', reference_number: '', customer_id: '', warehouse_id: '', notes: ''
    });
    setVoucherItems([{ item_id: '', item_name: '', quantity: 1, unit_price: 0, serial_numbers: [], notes: '' }]);
  };

  const addItemRow = () => setVoucherItems([...voucherItems, { item_id: '', item_name: '', quantity: 1, unit_price: 0, serial_numbers: [], notes: '' }]);
  const removeItemRow = (index) => { if (voucherItems.length > 1) setVoucherItems(voucherItems.filter((_, i) => i !== index)); };

  const updateItemRow = (index, field, value) => {
    const updated = [...voucherItems];
    updated[index][field] = value;
    if (field === 'item_id') {
      const item = items.find(i => i.id == value);
      updated[index].item_name = item?.name || '';
      updated[index].has_serial = item?.has_serial || false;
      updated[index].serial_numbers = [];
    }
    setVoucherItems(updated);
  };

  // فتح فورم التعديل معبّى ببيانات إذن موجود (أدمن فقط)
  const openEditVoucher = async (voucher) => {
    try {
      const res = await api.get(`/warehouse-issues/${voucher.id}`);
      const full = res.data;
      setEditingVoucher(full);
      setFormData({
        voucher_number: full.voucher_number || '',
        voucher_date: full.voucher_date ? String(full.voucher_date).slice(0, 10) : new Date().toISOString().split('T')[0],
        reference_type: full.reference_type || 'sales_order',
        reference_number: full.reference_number || '',
        customer_id: full.customer_id || '',
        warehouse_id: full.warehouse_id || '',
        notes: full.notes || ''
      });
      setVoucherItems((Array.isArray(full.items) && full.items.length > 0 ? full.items : []).map(it => {
        const itemMaster = items.find(i => i.id == it.item_id);
        return {
          item_id: it.item_id,
          item_name: it.item_name || itemMaster?.name || '',
          has_serial: itemMaster?.has_serial || false,
          quantity: it.quantity,
          unit_price: it.unit_price || 0,
          serial_numbers: Array.isArray(it.serial_numbers) ? it.serial_numbers : [],
          notes: it.notes || ''
        };
      }));
      setShowManualForm(true);
      setMessage('');
    } catch (err) {
      setMessage('❌ خطأ في جلب بيانات الإذن: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  // حذف إذن يدوي (أدمن فقط — مسودة بس)
  const handleDeleteVoucher = async (voucher) => {
    if (!window.confirm(`حذف إذن الصرف ${voucher.voucher_number} نهائيًا؟ (هيتم فك حجز السريالات)`)) return;
    try {
      await api.delete(`/warehouse-issues/${voucher.id}`);
      setMessage('✅ تم حذف الإذن بنجاح');
      fetchManualVouchers();
      fetchInvoiceVouchers();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ أثناء الحذف'));
    }
  };

  const handleSubmitManual = async (e) => {
    e.preventDefault();
    // تحقق من السريالات للأصناف اللي بسريال
    for (const it of voucherItems.filter(x => x.item_id)) {
      const itemMaster = items.find(i => i.id == it.item_id);
      if ((it.has_serial || itemMaster?.has_serial) && (it.serial_numbers || []).length !== parseInt(it.quantity)) {
        setMessage(`❌ الصنف "${it.item_name || itemMaster?.name}" محتاج ${it.quantity} سريال — اخترت ${(it.serial_numbers || []).length}`);
        return;
      }
    }
    const payload = {
      ...formData,
      items: voucherItems.filter(i => i.item_id).map(i => ({
        ...i,
        serial_numbers: (i.serial_numbers && i.serial_numbers.length > 0) ? i.serial_numbers : null
      }))
    };
    try {
      if (editingVoucher) {
        await api.put(`/warehouse-issues/${editingVoucher.id}`, payload);
        setMessage('✅ تم تعديل إذن الصرف بنجاح');
      } else {
        await api.post('/warehouse-issues', payload);
        setMessage('✅ تم إنشاء إذن الصرف اليدوي بنجاح');
      }
      setEditingVoucher(null);
      setShowManualForm(false);
      fetchManualVouchers();
      fetchInvoiceVouchers();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  // ===== صرف فاتورة — كل مخزن يصرف أصنافه =====
  const getUnissuedItems = (inv) => (Array.isArray(inv.items) && inv.items.length > 0)
    ? inv.items.filter(it => !it.issued)
    : [{ id: null, item_id: inv.item_id, item_name: inv.item_name, item_code: inv.item_code, quantity: inv.quantity, warehouse_id: inv.warehouse_id, warehouse_name: inv.warehouse_name, has_serial: inv.has_serial, serial_numbers: inv.serial_numbers }];

  const groupByWarehouse = (inv) => {
    const groups = {};
    getUnissuedItems(inv).forEach(it => {
      const key = it.warehouse_id || 'none';
      if (!groups[key]) groups[key] = { warehouse_id: it.warehouse_id || null, warehouse_name: it.warehouse_name || 'بدون مخزن محدد', lines: [] };
      groups[key].lines.push(it);
    });
    return Object.values(groups);
  };

  const openIssueModal = (inv, group) => {
    const lineSerials = {};
    group.lines.forEach(l => {
      if (l.has_serial) {
        const existing = Array.isArray(l.serial_numbers) ? l.serial_numbers : [];
        lineSerials[l.id] = existing.length === parseInt(l.quantity) ? existing : [];
      }
    });
    setIssueModal({ open: true, invoice: inv, warehouseId: group.warehouse_id, warehouseName: group.warehouse_name, lines: group.lines, lineSerials, error: '' });
  };

  const confirmIssue = async () => {
    const { invoice, warehouseId, lines, lineSerials } = issueModal;
    for (const l of lines) {
      if (l.has_serial) {
        const sel = lineSerials[l.id] || [];
        if (sel.length !== parseInt(l.quantity)) {
          setIssueModal(p => ({ ...p, error: `الصنف "${l.item_name}" محتاج ${l.quantity} سريال — اخترت ${sel.length}` }));
          return;
        }
      }
    }
    try {
      const line_serials = lines.filter(l => l.has_serial).map(l => ({ line_id: l.id, serial_numbers: lineSerials[l.id] || [] }));
      const r = await api.put(`/sales-invoices/${invoice.id}/warehouse-approve`, { warehouse_id: warehouseId, line_serials });
      const remaining = r.data?.remaining_lines || 0;
      setMessage(remaining > 0
        ? `✅ تم صرف أصناف ${issueModal.warehouseName} — إذن الصرف: ${r.data?.voucher_number || ''} (متبقي ${remaining} صنف لمخازن أخرى)`
        : `✅ تم صرف كل الأصناف — إذن الصرف: ${r.data?.voucher_number || ''}`);
      setIssueModal({ open: false, invoice: null, warehouseId: null, warehouseName: '', lines: [], lineSerials: {}, error: '' });
      fetchPendingInvoices();
      fetchApprovedInvoices();
    } catch (err) {
      setIssueModal(p => ({ ...p, error: err.response?.data?.message || 'حدث خطأ أثناء الصرف' }));
    }
  };

  // 🖨️ طباعة إذن صرف مخزن - أصناف متعددة + سريالات
  const handlePrintWarehouseIssue = (invoice) => {
    const invItems = (Array.isArray(invoice.items) && invoice.items.length > 0)
      ? invoice.items
      : [{ item_name: invoice.item_name, item_code: invoice.item_code, quantity: invoice.quantity, serial_numbers: invoice.serial_numbers, warehouse_name: invoice.warehouse_name, notes: invoice.notes }];

    const itemRows = invItems.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.item_name || '-'}</td>
        <td>${item.item_code || '-'}</td>
        <td class="quantity">${item.quantity}</td>
        <td>${item.warehouse_name || '-'}</td>
        <td style="direction:ltr;font-family:monospace;font-size:12px;">${Array.isArray(item.serial_numbers) && item.serial_numbers.length > 0 ? item.serial_numbers.join(', ') : '-'}</td>
      </tr>`).join('');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html dir="rtl">
      <head>
        <title>إذن صرف مخزن - ${invoice.invoice_number}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
          * { font-family: 'Cairo', Arial, sans-serif; box-sizing: border-box; }
          body { padding: 30px; background: #fff; }
          .header { text-align: center; border-bottom: 4px solid #dc2626; padding-bottom: 15px; margin-bottom: 25px; }
          .header h1 { color: #dc2626; margin: 0; font-size: 28px; }
          .header .sub { color: #64748b; font-size: 14px; margin-top: 5px; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
          .badge-success { background: #dcfce7; color: #166534; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 25px; }
          .info-box { padding: 12px; background: #fef2f2; border-radius: 8px; border-right: 4px solid #dc2626; }
          .info-label { font-size: 11px; color: #64748b; text-transform: uppercase; }
          .info-value { font-size: 15px; font-weight: 700; color: #1e293b; margin-top: 4px; }
          .items-table { width: 100%; border-collapse: collapse; margin: 25px 0; }
          .items-table th { background: #dc2626; color: white; padding: 14px; text-align: right; font-size: 14px; }
          .items-table td { padding: 12px; border: 1px solid #e2e8f0; font-size: 14px; }
          .items-table tr:nth-child(even) { background: #f8fafc; }
          .quantity { font-weight: 700; color: #dc2626; font-size: 18px; }
          .footer { margin-top: 50px; display: flex; justify-content: space-between; gap: 20px; }
          .signature { text-align: center; flex: 1; }
          .signature-line { border-top: 2px solid #334155; margin-top: 50px; padding-top: 10px; font-weight: 600; color: #475569; }
          .stamp { text-align: center; margin-top: 30px; padding: 20px; border: 2px dashed #dc2626; border-radius: 10px; background: #fef2f2; }
          .stamp-text { font-size: 16px; color: #991b1b; font-weight: 600; }
          .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 10px; border-radius: 6px; margin: 15px 0; font-size: 13px; color: #92400e; }
          @media print { body { padding: 15px; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📦 إذن صرف مخزن</h1>
          <div class="sub">
            رقم الفاتورة: <strong>${invoice.invoice_number}</strong> | 
            تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 20px;">
          <span class="badge badge-success">✓ تم اعتماد المخزن</span>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <div class="info-label">العميل</div>
            <div class="info-value">${invoice.customer_name_display || invoice.customer_name || '-'}</div>
          </div>
          <div class="info-box">
            <div class="info-label">عدد الأصناف</div>
            <div class="info-value">${invItems.length}</div>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th>#</th>
              <th>الصنف</th>
              <th>كود الصنف</th>
              <th>الكمية</th>
              <th>المخزن</th>
              <th>السريالات</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        <div class="warning">
          ⚠️ هذا الإذن صرف بموجب فاتورة مبيعات معتمدة من الجودة. يمنع الصرف بدون هذا الإذن.
        </div>

        <div class="stamp">
          <div class="stamp-text">✓ تم الصرف من المخزن</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 8px;">
            تاريخ الصرف: ${new Date().toLocaleDateString('ar-EG')}
          </div>
        </div>

        <div class="footer">
          <div class="signature"><div class="signature-line">توقيع أمين المخزن</div></div>
          <div class="signature"><div class="signature-line">توقيع المستلم</div></div>
          <div class="signature"><div class="signature-line">توقيع المدير</div></div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // 🖨️ طباعة إذن صرف (يدوي أو ناتج من فاتورة) — بنجيب التفاصيل الكاملة بالأصناف الأول
  const handlePrintManualVoucher = async (voucherRow) => {
    let voucher = voucherRow;
    try {
      const res = await api.get(`/warehouse-issues/${voucherRow.id}`);
      voucher = res.data;
    } catch (err) {
      console.error('خطأ في جلب تفاصيل الإذن للطباعة');
    }
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html dir="rtl">
      <head>
        <title>إذن صرف مخزن - ${voucher.voucher_number}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
          * { font-family: 'Cairo', Arial, sans-serif; box-sizing: border-box; }
          body { padding: 30px; background: #fff; }
          .header { text-align: center; border-bottom: 4px solid #dc2626; padding-bottom: 15px; margin-bottom: 25px; }
          .header h1 { color: #dc2626; margin: 0; font-size: 28px; }
          .header .sub { color: #64748b; font-size: 14px; margin-top: 5px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 25px; }
          .info-box { padding: 12px; background: #fef2f2; border-radius: 8px; border-right: 4px solid #dc2626; }
          .info-label { font-size: 11px; color: #64748b; text-transform: uppercase; }
          .info-value { font-size: 15px; font-weight: 700; color: #1e293b; margin-top: 4px; }
          .items-table { width: 100%; border-collapse: collapse; margin: 25px 0; }
          .items-table th { background: #dc2626; color: white; padding: 14px; text-align: right; font-size: 14px; }
          .items-table td { padding: 12px; border: 1px solid #e2e8f0; font-size: 14px; }
          .items-table tr:nth-child(even) { background: #f8fafc; }
          .quantity { font-weight: 700; color: #dc2626; font-size: 18px; }
          .footer { margin-top: 50px; display: flex; justify-content: space-between; gap: 20px; }
          .signature { text-align: center; flex: 1; }
          .signature-line { border-top: 2px solid #334155; margin-top: 50px; padding-top: 10px; font-weight: 600; color: #475569; }
          .stamp { text-align: center; margin-top: 30px; padding: 20px; border: 2px dashed #dc2626; border-radius: 10px; background: #fef2f2; }
          .stamp-text { font-size: 16px; color: #991b1b; font-weight: 600; }
          @media print { body { padding: 15px; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📦 إذن صرف مخزن</h1>
          <div class="sub">
            رقم الإذن: <strong>${voucher.voucher_number}</strong> | 
            التاريخ: ${new Date(voucher.voucher_date).toLocaleDateString('ar-EG')}
          </div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <div class="info-label">العميل</div>
            <div class="info-value">${voucher.customer_name || '-'}</div>
          </div>
          <div class="info-box">
            <div class="info-label">المخزن</div>
            <div class="info-value">${voucher.warehouse_name || '-'}</div>
          </div>
          <div class="info-box">
            <div class="info-label">نوع المرجع</div>
            <div class="info-value">${voucher.reference_type === 'sales_order' ? 'أمر بيع' : voucher.reference_type === 'pricing_sheet' ? 'بيان تسليم' : voucher.reference_type === 'tax_invoice' ? 'فاتورة ضريبية' : voucher.reference_type === 'sales_invoice' ? 'فاتورة مبيعات (تلقائي)' : 'بيان سعر'}</div>
          </div>
          <div class="info-box">
            <div class="info-label">رقم المرجع</div>
            <div class="info-value">${voucher.reference_number || '-'}</div>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th>#</th>
              <th>الصنف</th>
              <th>الكمية</th>
              <th>السيريال</th>
              <th>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${voucher.items ? voucher.items.map((item, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${item.item_name || item.item_code || '-'}</td>
                <td class="quantity">${item.quantity}</td>
                <td style="direction:ltr;font-family:monospace;font-size:12px;">${Array.isArray(item.serial_numbers) ? item.serial_numbers.join(', ') : (item.serial_numbers || '-')}</td>
                <td>${item.notes || '-'}</td>
              </tr>
            `).join('') : '<tr><td colspan="5" style="text-align:center">لا يوجد أصناف</td></tr>'}
          </tbody>
        </table>

        <div class="stamp">
          <div class="stamp-text">✓ تم الصرف من المخزن</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 8px;">
            تاريخ الصرف: ${new Date().toLocaleDateString('ar-EG')}
          </div>
        </div>

        <div class="footer">
          <div class="signature"><div class="signature-line">توقيع أمين المخزن</div></div>
          <div class="signature"><div class="signature-line">توقيع المستلم</div></div>
          <div class="signature"><div class="signature-line">توقيع المدير</div></div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const getStatusColor = (status) => {
    const colors = { 'quality_approved': '#2563eb', 'warehouse_approved': '#16a34a', 'approved_finance': '#0891b2', 'posted': '#0d9488' };
    return colors[status] || '#6c757d';
  };
  const getStatusText = (status) => {
    const statuses = { 'quality_approved': '✓ معتمدة - بانتظار الصرف', 'warehouse_approved': '✓ تم الصرف', 'approved_finance': '✓ مرحلة مالياً', 'posted': '✅ مرحل' };
    return statuses[status] || status;
  };

  const thStyle = { padding: '12px', border: '1px solid #ddd', textAlign: 'right' };
  const tdStyle = { padding: '10px', border: '1px solid #ddd' };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl', background: '#ffffff', color: '#1f2937', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
        <button onClick={() => window.location.href = '/warehouse-module'} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          ← رجوع لنظام المخازن
        </button>
        <h1 style={{ color: '#dc2626', margin: 0 }}>📦 إذن صرف مخزن</h1>
      </div>

      {message && (
        <p style={{ padding: '12px', backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da', borderRadius: '8px', fontWeight: 'bold', marginBottom: '20px' }}>
          {message}
        </p>
      )}

      {/* Buttons */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={handleShowManualForm} style={{ padding: '12px 30px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
          ➕ إذن صرف يدوي
        </button>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>
        <button onClick={() => setActiveTab('pending')} style={{ padding: '10px 25px', backgroundColor: activeTab === 'pending' ? '#2563eb' : 'transparent', color: activeTab === 'pending' ? 'white' : '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
          📋 معلق - بانتظار الصرف ({pendingInvoices.length})
        </button>
        <button onClick={() => setActiveTab('approved')} style={{ padding: '10px 25px', backgroundColor: activeTab === 'approved' ? '#16a34a' : 'transparent', color: activeTab === 'approved' ? 'white' : '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
          ✅ معتمد - تم الصرف ({approvedInvoices.length})
        </button>
        <button onClick={() => setActiveTab('manual')} style={{ padding: '10px 25px', backgroundColor: activeTab === 'manual' ? '#dc2626' : 'transparent', color: activeTab === 'manual' ? 'white' : '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
          📝 إذون يدوية ({manualVouchers.length})
        </button>
        <button onClick={() => setActiveTab('invoice_vouchers')} style={{ padding: '10px 25px', backgroundColor: activeTab === 'invoice_vouchers' ? '#7c3aed' : 'transparent', color: activeTab === 'invoice_vouchers' ? 'white' : '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
          🧾 إذون صرف الفواتير ({invoiceVouchers.length})
        </button>
      </div>

      {/* Manual Voucher Form */}
      {showManualForm && (
        <form onSubmit={handleSubmitManual} style={{ color: '#1e293b', backgroundColor: '#f8f9fa', padding: '25px', borderRadius: '12px', marginBottom: '20px', border: '3px solid #dc2626' }}>
          <h3 style={{ color: '#dc2626', marginBottom: '20px' }}>{editingVoucher ? `✏️ تعديل إذن الصرف ${editingVoucher.voucher_number}` : '➕ إذن صرف مخزن يدوي'}</h3>
          {editingVoucher && (
            <p style={{ padding: '10px', background: '#fff3cd', borderRadius: '6px', color: '#856404', fontSize: '13px', marginBottom: '15px' }}>
              ⚠️ عند الحفظ هيتم فك حجز السريالات القديمة وحجز الجديدة تلقائيًا
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div>
              <label>رقم الإذن (تلقائي):</label>
              <input type="text" value={formData.voucher_number} readOnly style={{ color: '#1e293b', width: '100%', padding: '8px', backgroundColor: '#e2e8f0' }} />
            </div>
            <div>
              <label>تاريخ الإذن:</label>
              <input type="date" value={formData.voucher_date} onChange={(e) => setFormData({ ...formData, voucher_date: e.target.value })} required style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label>نوع المرجع:</label>
              <select value={formData.reference_type} onChange={(e) => setFormData({ ...formData, reference_type: e.target.value })} style={{ width: '100%', padding: '8px' }}>
                <option value="sales_order">أمر بيع</option>
                <option value="pricing_sheet">بيان تسليم</option>
                <option value="tax_invoice">فاتورة ضريبية</option>
                <option value="price_quote">بيان سعر</option>
                <option value="manual">يدوي</option>
                <option value="sales_invoice">فاتورة مبيعات (تلقائي)</option>
              </select>
            </div>
            <div>
              <label>رقم المرجع:</label>
              <input type="text" value={formData.reference_number} onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })} style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label>العميل:</label>
              <select value={formData.customer_id} onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })} style={{ width: '100%', padding: '8px' }}>
                <option value="">اختر العميل</option>
                {customers.map(c => (<option key={c.id} value={c.id}>{c.code} - {c.name}</option>))}
              </select>
            </div>
            <div>
              <label>المخزن:</label>
              <select value={formData.warehouse_id} onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })} required style={{ width: '100%', padding: '8px' }}>
                <option value="">اختر المخزن</option>
                {warehouses.map(w => (<option key={w.id} value={w.id}>{w.name}</option>))}
              </select>
            </div>
          </div>

          <h4 style={{ color: '#374151', marginBottom: '10px' }}>📦 الأصناف</h4>
          {!formData.warehouse_id && (
            <p style={{ padding: '10px', background: '#fff3cd', borderRadius: '6px', color: '#856404', fontSize: '13px' }}>⚠️ اختر المخزن الأول عشان تقدر تختار السريالات المتاحة</p>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
            <thead>
              <tr style={{ backgroundColor: '#dc2626', color: 'white' }}>
                <th style={thStyle}>الصنف</th>
                <th style={thStyle}>العدد</th>
                <th style={thStyle}>السريالات (من رصيد المخزن)</th>
                <th style={thStyle}>ملاحظات</th>
                <th style={thStyle}>حذف</th>
              </tr>
            </thead>
            <tbody>
              {voucherItems.map((item, index) => {
                const itemMaster = items.find(i => i.id == item.item_id);
                const hasSerial = item.has_serial || itemMaster?.has_serial;
                return (
                  <tr key={index}>
                    <td style={tdStyle}>
                      <select value={item.item_id} onChange={(e) => updateItemRow(index, 'item_id', e.target.value)} required style={{ width: '100%', padding: '6px' }}>
                        <option value="">اختر الصنف</option>
                        {items.map(i => (<option key={i.id} value={i.id}>{i.code} - {i.name}{i.has_serial ? ' 🔢' : ''}</option>))}
                      </select>
                    </td>
                    <td style={tdStyle}>
                      <input type="number" step="0.001" min="0.001" value={item.quantity} onChange={(e) => { updateItemRow(index, 'quantity', e.target.value); updateItemRow(index, 'serial_numbers', []); }} required style={{ width: '100%', padding: '6px' }} />
                    </td>
                    <td style={{ ...tdStyle, minWidth: '260px' }}>
                      {hasSerial ? (
                        <SerialPicker
                          itemId={item.item_id}
                          warehouseId={formData.warehouse_id}
                          count={item.quantity}
                          value={item.serial_numbers || []}
                          onChange={(arr) => updateItemRow(index, 'serial_numbers', arr)}
                        />
                      ) : <span style={{ color: '#9ca3af', fontSize: '12px' }}>بدون سريال</span>}
                    </td>
                    <td style={tdStyle}>
                      <input type="text" value={item.notes} onChange={(e) => updateItemRow(index, 'notes', e.target.value)} style={{ width: '100%', padding: '6px' }} />
                    </td>
                    <td style={tdStyle}>
                      <button type="button" onClick={() => removeItemRow(index)} style={{ padding: '4px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🗑️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <button type="button" onClick={addItemRow} style={{ padding: '8px 20px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', marginBottom: '15px' }}>
            ➕ إضافة صنف
          </button>

          <div>
            <label>ملاحظات:</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} style={{ width: '100%', padding: '8px', minHeight: '60px' }} />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="submit" style={{ padding: '12px 40px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
              {editingVoucher ? '💾 حفظ التعديلات' : '💾 حفظ الإذن'}
            </button>
            <button type="button" onClick={() => { setShowManualForm(false); setEditingVoucher(null); }} style={{ padding: '12px 40px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>
              ❌ إلغاء
            </button>
          </div>
        </form>
      )}

      {/* Tab: Pending - بانتظار الصرف من المخزن — كل مخزن يصرف أصنافه */}
      {activeTab === 'pending' && (
        <div>
          <h3>📋 فواتير معتمدة من الجودة - بانتظار صرف المخزن</h3>
          <p style={{ color: '#6c757d', marginBottom: '15px' }}>
            💡 الفاتورة ممكن يكون فيها أصناف من مخازن مختلفة — كل مخزن يصرف الأصناف اللي تخصه بس
          </p>
          {pendingInvoices.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '20px', color: '#6c757d' }}>لا يوجد فواتير بانتظار صرف المخزن</p>
          ) : (
            pendingInvoices.map(inv => {
              const groups = groupByWarehouse(inv);
              return (
                <div key={inv.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '15px', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                    <div>
                      <strong style={{ fontSize: '16px' }}>🧾 {inv.invoice_number}</strong>
                      <span style={{ marginRight: '10px', color: '#475569' }}>👤 {inv.customer_name_display || inv.customer_name}</span>
                    </div>
                    <span style={{ color: '#2563eb', fontWeight: 'bold', padding: '4px 12px', borderRadius: '12px', backgroundColor: '#2563eb20', fontSize: '13px' }}>✓ معتمدة - بانتظار الصرف</span>
                  </div>
                  {groups.map((g, gi) => (
                    <div key={gi} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '8px', background: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ fontWeight: 'bold', color: '#0f766e' }}>🏬 {g.warehouse_name} <span style={{ color: '#64748b', fontWeight: 'normal' }}>({g.lines.length} صنف)</span></div>
                        {['storekeeper', 'admin', 'manager'].includes(userRole) && (
                          <button onClick={() => openIssueModal(inv, g)} style={{ padding: '8px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                            📦 صرف أصناف {g.warehouse_name}
                          </button>
                        )}
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
                        <thead>
                          <tr style={{ color: '#1e293b', backgroundColor: '#e2e8f0' }}>
                            <th style={{ ...thStyle, padding: '8px' }}>الصنف</th>
                            <th style={{ ...thStyle, padding: '8px' }}>كود الصنف</th>
                            <th style={{ ...thStyle, padding: '8px' }}>الكمية</th>
                            <th style={{ ...thStyle, padding: '8px' }}>بسريال؟</th>
                            <th style={{ ...thStyle, padding: '8px' }}>سريالات محجوزة (من إذن التسليم)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.lines.map((l, li) => (
                            <tr key={li} style={{ background: 'white' }}>
                              <td style={{ ...tdStyle, padding: '8px' }}>{l.item_name}</td>
                              <td style={{ ...tdStyle, padding: '8px' }}><code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>{l.item_code || '-'}</code></td>
                              <td style={{ ...tdStyle, padding: '8px' }}><strong style={{ color: '#2563eb' }}>{l.quantity}</strong></td>
                              <td style={{ ...tdStyle, padding: '8px' }}>{l.has_serial ? <span style={{ color: '#9333ea', fontWeight: 'bold', fontSize: '12px' }}>🔢 بسريال</span> : <span style={{ color: '#94a3b8', fontSize: '12px' }}>-</span>}</td>
                              <td style={{ ...tdStyle, padding: '8px' }}>
                                {Array.isArray(l.serial_numbers) && l.serial_numbers.length > 0 ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                    {l.serial_numbers.map((s, si) => (<code key={si} style={{ background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{s}</code>))}
                                  </div>
                                ) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab: Approved - تم الصرف */}
      {activeTab === 'approved' && (
        <div>
          <h3>✅ فواتير تم صرفها من المخزن</h3>
          <p style={{ color: '#6c757d', marginBottom: '15px' }}>💡 الفواتير اللي تم صرفها من المخزن - ممكن طباعتها كإذن صرف</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ backgroundColor: '#16a34a', color: 'white' }}>
                <th style={thStyle}>رقم الفاتورة</th>
                <th style={thStyle}>العميل</th>
                <th style={thStyle}>الأصناف المصروفة</th>
                <th style={thStyle}>السريالات</th>
                <th style={thStyle}>الحالة</th>
                <th style={thStyle}>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {approvedInvoices.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>لا يوجد فواتير تم صرفها</td></tr>
              ) : (
                approvedInvoices.map(inv => {
                  const invItems = (Array.isArray(inv.items) && inv.items.length > 0) ? inv.items : [{ item_name: inv.item_name, item_code: inv.item_code, quantity: inv.quantity, warehouse_name: inv.warehouse_name, serial_numbers: inv.serial_numbers }];
                  const allSerials = invItems.flatMap(it => Array.isArray(it.serial_numbers) ? it.serial_numbers : []);
                  return (
                    <tr key={inv.id} style={{ backgroundColor: inv.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                      <td style={tdStyle}><strong>{inv.invoice_number}</strong></td>
                      <td style={tdStyle}>{inv.customer_name_display || inv.customer_name}</td>
                      <td style={tdStyle}>
                        {invItems.map((it, i) => (
                          <div key={i} style={{ fontSize: '13px', marginBottom: '2px' }}>
                            {it.item_name} <strong style={{ color: '#16a34a' }}>({it.quantity})</strong>
                            {it.warehouse_name && <span style={{ fontSize: '11px', color: '#6c757d' }}> — {it.warehouse_name}</span>}
                          </div>
                        ))}
                      </td>
                      <td style={tdStyle}>
                        {allSerials.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', maxWidth: '220px' }}>
                            {allSerials.map((s, i) => (<code key={i} style={{ background: '#ede9fe', color: '#6d28d9', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{s}</code>))}
                          </div>
                        ) : '-'}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: '#16a34a', fontWeight: 'bold', padding: '4px 12px', borderRadius: '12px', backgroundColor: '#16a34a20' }}>✓ تم الصرف</span>
                      </td>
                      <td style={tdStyle}>
                        <button onClick={() => handlePrintWarehouseIssue(inv)} style={{ padding: '5px 10px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                          🖨️ طباعة إذن
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Manual Vouchers */}
      {activeTab === 'manual' && (
        <div>
          <h3>📝 إذون صرف يدوية</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ backgroundColor: '#dc2626', color: 'white' }}>
                <th style={thStyle}>رقم الإذن</th>
                <th style={thStyle}>التاريخ</th>
                <th style={thStyle}>المرجع</th>
                <th style={thStyle}>العميل</th>
                <th style={thStyle}>المخزن</th>
                <th style={thStyle}>عدد الأصناف</th>
                <th style={thStyle}>الحالة</th>
                <th style={thStyle}>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {manualVouchers.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>لا يوجد إذون يدوية</td></tr>
              ) : (
                manualVouchers.map(v => (
                  <tr key={v.id} style={{ backgroundColor: v.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                    <td style={tdStyle}><strong>{v.voucher_number}</strong></td>
                    <td style={tdStyle}>{new Date(v.voucher_date).toLocaleDateString('ar-EG')}</td>
                    <td style={tdStyle}>{v.reference_number || '-'}</td>
                    <td style={tdStyle}>{v.customer_name || '-'}</td>
                    <td style={tdStyle}>{v.warehouse_name || '-'}</td>
                    <td style={tdStyle}><strong style={{ color: '#dc2626', fontSize: '16px' }}>{v.total_items || 0}</strong></td>
                    <td style={tdStyle}>
                      <span style={{ color: getStatusColor(v.status), fontWeight: 'bold', padding: '4px 12px', borderRadius: '12px', backgroundColor: getStatusColor(v.status) + '20' }}>
                        {getStatusText(v.status)}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <button onClick={() => handlePrintManualVoucher(v)} style={{ padding: '4px 8px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                          🖨️ طباعة
                        </button>
                        {userRole === 'admin' && (
                          <button onClick={() => openEditVoucher(v)} style={{ padding: '4px 8px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                            ✏️ تعديل
                          </button>
                        )}
                        {v.status === 'draft' && userRole === 'admin' && (
                          <button onClick={() => handleDeleteVoucher(v)} style={{ padding: '4px 8px', backgroundColor: '#b91c1c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                            🗑️ حذف
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Invoice-generated Vouchers — إذون اتولّدت تلقائيًا من صرف فواتير */}
      {activeTab === 'invoice_vouchers' && (
        <div>
          <h3>🧾 إذون صرف تلقائية من الفواتير</h3>
          <p style={{ fontSize: '13px', color: '#6c757d', marginBottom: '10px' }}>
            الإذون دي بتتولّد أوتوماتيك لما فاتورة تتصرف من المخزن — مش يدوية.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ backgroundColor: '#7c3aed', color: 'white' }}>
                <th style={thStyle}>رقم الإذن</th>
                <th style={thStyle}>التاريخ</th>
                <th style={thStyle}>رقم الفاتورة</th>
                <th style={thStyle}>العميل</th>
                <th style={thStyle}>المخزن</th>
                <th style={thStyle}>عدد الأصناف</th>
                <th style={thStyle}>الحالة</th>
                <th style={thStyle}>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {invoiceVouchers.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>لا يوجد إذون تلقائية</td></tr>
              ) : (
                invoiceVouchers.map(v => (
                  <tr key={v.id} style={{ backgroundColor: v.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                    <td style={tdStyle}><strong>{v.voucher_number}</strong></td>
                    <td style={tdStyle}>{new Date(v.voucher_date).toLocaleDateString('ar-EG')}</td>
                    <td style={tdStyle}>{v.reference_number || '-'}</td>
                    <td style={tdStyle}>{v.customer_name || '-'}</td>
                    <td style={tdStyle}>{v.warehouse_name || '-'}</td>
                    <td style={tdStyle}><strong style={{ color: '#7c3aed', fontSize: '16px' }}>{v.total_items || 0}</strong></td>
                    <td style={tdStyle}>
                      <span style={{ color: getStatusColor(v.status), fontWeight: 'bold', padding: '4px 12px', borderRadius: '12px', backgroundColor: getStatusColor(v.status) + '20' }}>
                        {getStatusText(v.status)}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <button onClick={() => handlePrintManualVoucher(v)} style={{ padding: '4px 8px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                          🖨️ طباعة
                        </button>
                        {userRole === 'admin' && (
                          <button onClick={() => openEditVoucher(v)} style={{ padding: '4px 8px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                            ✏️ تعديل
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 📦 مودال الصرف — سريالات من الرصيد لكل صنف */}
      {issueModal.open && issueModal.invoice && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={() => setIssueModal({ open: false, invoice: null, warehouseId: null, warehouseName: '', lines: [], lineSerials: {}, error: '' })}>
          <div style={{ color: '#1e293b', backgroundColor: 'white', borderRadius: '10px', padding: '25px', maxWidth: '750px', width: '95%', maxHeight: '90vh', overflow: 'auto', direction: 'rtl' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: '#dc2626' }}>📦 صرف من مخزن: {issueModal.warehouseName}</h3>
              <button onClick={() => setIssueModal({ open: false, invoice: null, warehouseId: null, warehouseName: '', lines: [], lineSerials: {}, error: '' })} style={{ padding: '5px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ color: '#1e293b', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '15px', fontSize: '14px' }}>
              <div><strong>الفاتورة:</strong> {issueModal.invoice.invoice_number}</div>
              <div><strong>العميل:</strong> {issueModal.invoice.customer_name_display || issueModal.invoice.customer_name}</div>
              <div><strong>أصناف هذا المخزن:</strong> {issueModal.lines.length}</div>
            </div>

            {issueModal.error && <p style={{ padding: '10px', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '6px' }}>{issueModal.error}</p>}

            {issueModal.lines.map((l) => (
              <div key={l.id || l.item_id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                  {l.item_name} <span style={{ color: '#2563eb' }}>(الكمية: {l.quantity})</span>
                  {l.has_serial ? <span style={{ color: '#9333ea', fontSize: '12px', marginRight: '8px' }}>🔢 بسريال</span> : <span style={{ color: '#94a3b8', fontSize: '12px', marginRight: '8px' }}>بدون سريال</span>}
                </div>
                {l.has_serial && (
                  <SerialPicker
                    itemId={l.item_id}
                    warehouseId={issueModal.warehouseId || l.warehouse_id}
                    count={l.quantity}
                    value={issueModal.lineSerials[l.id] || []}
                    onChange={(arr) => setIssueModal(p => ({ ...p, lineSerials: { ...p.lineSerials, [l.id]: arr } }))}
                  />
                )}
              </div>
            ))}

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={confirmIssue} style={{ padding: '10px 30px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                ✓ تأكيد الصرف
              </button>
              <button onClick={() => setIssueModal({ open: false, invoice: null, warehouseId: null, warehouseName: '', lines: [], lineSerials: {}, error: '' })} style={{ padding: '10px 30px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WarehouseIssues;
