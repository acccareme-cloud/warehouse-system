import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function SalesInvoices() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('tax');
  const [taxSubType, setTaxSubType] = useState('real');
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [approvedOrders, setApprovedOrders] = useState([]);
  const [approvedDqs, setApprovedDqs] = useState([]);
  const [selectedDqs, setSelectedDqs] = useState([]);
  const [settings, setSettings] = useState({});
  const [userRole, setUserRole] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showOrderSelector, setShowOrderSelector] = useState(false);
  const [showDqSelector, setShowDqSelector] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [printData, setPrintData] = useState(null);
  const [filterCustomerType, setFilterCustomerType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [taxControls, setTaxControls] = useState({ has_vat: true, has_discount_tax: true, is_taxable: true });

  const emptyForm = {
    invoice_number: '', invoice_date: new Date().toISOString().split('T')[0], so_id: '',
    customer_id: '', customer_name: '', parent_id: null,
    notes: '', discount_amount: 0, tax_discount_percent: 0,
    tax_rate: 14, tax_sub_type: 'real', warehouse_type: 'tax'
  };
  const [formData, setFormData] = useState(emptyForm);
  const [formItems, setFormItems] = useState([]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserRole(user.role || '');
    fetchItems(); fetchCustomers(); fetchWarehouses(); fetchInvoices(); fetchSettings();
  }, [activeTab, taxSubType]);

  const fetchItems = async () => { try { const r = await api.get('/items'); setItems(r.data); } catch (e) {} };
  const fetchCustomers = async () => { try { const r = await api.get('/customers'); setCustomers(r.data); } catch (e) {} };
  const fetchWarehouses = async () => { try { const r = await api.get('/warehouses'); setWarehouses(r.data); } catch (e) {} };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params = {};
      if (activeTab === 'tax') { params.type = 'tax'; params.tax_sub_type = taxSubType; }
      else { params.type = 'price_quote'; }
      const r = await api.get('/sales-invoices', { params });
      setInvoices(r.data || []);
    } catch (e) { setMessage('❌ خطأ في تحميل الفواتير'); }
    setLoading(false);
  };

  const fetchSettings = async () => {
    try { const r = await api.get('/tax-settings'); setSettings(r.data); }
    catch (e) { setMessage('❌ خطأ في تحميل الإعدادات'); }
  };

  const fetchNextNumber = async () => {
    try {
      const r = await api.get('/sales-invoices/next-number', { params: { type: activeTab, sub_type: taxSubType } });
      setFormData(p => ({ ...p, invoice_number: r.data.nextNumber }));
    } catch (e) { setMessage('❌ خطأ في توليد الرقم'); }
  };

  const safeNumber = (v, d = 2) => { const n = parseFloat(v); return isNaN(n) ? '0.00' : n.toFixed(d); };

  // ===== محرر الأصناف =====
  const emptyLine = () => ({ item_id: '', item_name: '', warehouse_id: '', quantity: 1, unit_price: 0, dq_id: null, has_serial: false });

  const addLine = () => setFormItems(p => [...p, emptyLine()]);

  const updateLine = (idx, field, value) => {
    setFormItems(p => p.map((l, i) => {
      if (i !== idx) return l;
      const nl = { ...l, [field]: value };
      if (field === 'item_id') {
        const it = items.find(x => x.id == value);
        nl.item_name = it?.name || '';
        nl.has_serial = it?.has_serial || false;
        if (it?.sale_price && !nl.unit_price) nl.unit_price = parseFloat(it.sale_price) || 0;
        if (it?.warehouse_id && !nl.warehouse_id) nl.warehouse_id = it.warehouse_id;
      }
      return nl;
    }));
  };

  const removeLine = (idx) => setFormItems(p => p.filter((_, i) => i !== idx));

  // ===== اختيار أمر بيع =====
  const handleSelectOrder = async (orderId) => {
    // نجمع كل أسطر الأصناف اللي تخص نفس أمر البيع (مش صنف واحد بس)
    const orderLines = approvedOrders.filter(o => o.id === orderId);
    if (orderLines.length === 0) return;
    const order = orderLines[0];
    setSelectedDqs([]);
    setFormData({
      ...emptyForm,
      invoice_date: new Date().toISOString().split('T')[0], so_id: order.id,
      customer_id: order.customer_id, customer_name: order.customer_name || '',
      parent_id: order.parent_id || null,
      notes: `مستند إلى أمر البيع: ${order.order_number}`,
      tax_rate: activeTab === 'price_quote' ? 0 : (settings.default_tax_rate || 14),
      tax_sub_type: activeTab === 'tax' ? taxSubType : 'real',
      warehouse_type: activeTab === 'price_quote' ? 'company' : 'tax'
    });
    setFormItems(orderLines.filter(l => l.item_id).map(l => ({
      item_id: l.item_id || '', item_name: l.item_name || '',
      warehouse_id: '', quantity: parseFloat(l.quantity) || 1,
      unit_price: parseFloat(l.unit_price) || 0, dq_id: null, has_serial: false
    })));
    fetchNextNumber();
    setShowOrderSelector(false);
    setShowForm(true);
  };

  // ===== اختيار بيانات تسليم مسعرة (متعدد) =====
  const handleShowDqSelector = async () => {
    setShowDqSelector(true);
    try { const r = await api.get('/sales-invoices/approved-dqs'); setApprovedDqs(r.data || []); }
    catch (e) { setMessage('❌ خطأ في تحميل بيانات التسليم'); }
  };

  const toggleDqSelection = (dq) => {
    setSelectedDqs(p => p.find(d => d.id === dq.id) ? p.filter(d => d.id !== dq.id) : [...p, dq]);
  };

  const buildFormFromDqs = (dqs) => {
    if (dqs.length === 0) return;
    const first = dqs[0];
    const lines = [];
    dqs.forEach(dq => {
      (dq.items || []).forEach(it => {
        lines.push({
          item_id: it.item_id, item_name: it.item_name || '',
          warehouse_id: it.warehouse_id || it.item_warehouse_id || '',
          quantity: parseFloat(it.quantity) || 1,
          unit_price: parseFloat(it.unit_price) || 0,
          dq_id: dq.id, has_serial: it.has_serial || false
        });
      });
    });
    setFormData({
      ...emptyForm,
      invoice_date: new Date().toISOString().split('T')[0],
      customer_id: first.customer_branch_id || first.customer_id || '',
      customer_name: first.customer_name || '',
      notes: `بيانات التسليم المسعرة: ${dqs.map(d => d.dq_number).join('، ')}`,
      tax_rate: activeTab === 'price_quote' ? 0 : (settings.default_tax_rate || 14),
      tax_sub_type: activeTab === 'tax' ? taxSubType : 'real',
      warehouse_type: activeTab === 'price_quote' ? 'company' : 'tax'
    });
    setFormItems(lines);
    fetchNextNumber();
    setShowDqSelector(false);
    setShowForm(true);
  };

  const handleShowForm = () => {
    setEditingId(null);
    setSelectedDqs([]);
    setShowForm(true);
    fetchNextNumber();
    setFormData({
      ...emptyForm,
      tax_rate: activeTab === 'price_quote' ? 0 : (settings.default_tax_rate || 14),
      tax_sub_type: activeTab === 'tax' ? taxSubType : 'real',
      warehouse_type: activeTab === 'price_quote' ? 'company' : 'tax'
    });
    setFormItems([emptyLine()]);
    setTaxControls(activeTab === 'price_quote' ? { has_vat: false, has_discount_tax: false, is_taxable: false } : { has_vat: true, has_discount_tax: true, is_taxable: true });
  };

  const handleShowOrderSelector = async () => {
    setShowOrderSelector(true);
    try { const r = await api.get('/sales-invoices/approved-orders'); setApprovedOrders(r.data || []); }
    catch (e) { setMessage('❌ خطأ في تحميل أوامر البيع'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validItems = formItems.filter(l => l.item_id && parseFloat(l.quantity) > 0);
    if (validItems.length === 0) { setMessage('❌ أضف صنف واحد على الأقل'); return; }
    const submitData = {
      ...formData, invoice_type: activeTab, ...taxControls,
      tax_discount_percent: parseFloat(formData.tax_discount_percent) || 0,
      tax_sub_type: activeTab === 'tax' ? taxSubType : 'real',
      warehouse_type: activeTab === 'price_quote' ? 'company' : 'tax',
      items: validItems.map(l => ({
        item_id: l.item_id, item_name: l.item_name, warehouse_id: l.warehouse_id || null,
        quantity: parseFloat(l.quantity), unit_price: parseFloat(l.unit_price) || 0,
        dq_id: l.dq_id || null
      })),
      dq_ids: selectedDqs.length > 0 ? selectedDqs.map(d => d.id) : undefined,
      // توافق قديم (صنف واحد)
      item_id: validItems[0].item_id, quantity: parseFloat(validItems[0].quantity),
      unit_price: parseFloat(validItems[0].unit_price) || 0, warehouse_id: validItems[0].warehouse_id || formData.warehouse_id || ''
    };
    setLoading(true);
    try {
      if (editingId) { await api.put(`/sales-invoices/${editingId}`, submitData); setMessage('✅ تم التعديل'); }
      else { await api.post('/sales-invoices', submitData); setMessage('✅ تم الإنشاء'); }
      setShowForm(false); setEditingId(null); setSelectedDqs([]); fetchInvoices();
    } catch (err) { setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ')); }
    setLoading(false);
  };

  const handleEdit = async (invoice) => {
    if (invoice.status !== 'draft') { setMessage('❌ لا يمكن تعديل الفاتورة المعتمدة'); return; }
    setEditingId(invoice.id);
    setSelectedDqs([]);
    try {
      const r = await api.get(`/sales-invoices/${invoice.id}`);
      const inv = r.data;
      setFormData({
        invoice_number: inv.invoice_number, invoice_date: inv.invoice_date || new Date().toISOString().split('T')[0],
        so_id: inv.so_id || '', customer_id: inv.customer_id || '', customer_name: inv.customer_name || inv.customer_name_display || '',
        parent_id: inv.parent_id || null, notes: inv.notes || '',
        discount_amount: parseFloat(inv.discount_amount) || 0,
        tax_discount_percent: parseFloat(inv.tax_discount_percent) || 0,
        tax_rate: parseFloat(inv.tax_14_percent) > 0 ? 14 : 0,
        tax_sub_type: inv.tax_sub_type || 'real',
        warehouse_type: inv.warehouse_type || (inv.invoice_type === 'price_quote' ? 'company' : 'tax')
      });
      if (Array.isArray(inv.items) && inv.items.length > 0) {
        setFormItems(inv.items.map(it => ({
          item_id: it.item_id, item_name: it.item_name || '', warehouse_id: it.warehouse_id || '',
          quantity: parseFloat(it.quantity) || 1, unit_price: parseFloat(it.unit_price) || 0,
          dq_id: it.dq_id || null, has_serial: it.has_serial || false
        })));
      } else {
        setFormItems([{ item_id: inv.item_id || '', item_name: inv.item_name || '', warehouse_id: inv.warehouse_id || '', quantity: parseFloat(inv.quantity) || 1, unit_price: parseFloat(inv.unit_price) || 0, dq_id: null, has_serial: false }]);
      }
      setTaxControls({ has_vat: inv.has_vat !== false, has_discount_tax: inv.has_discount_tax !== false, is_taxable: inv.is_taxable !== false });
      setShowForm(true);
    } catch (e) { setMessage('❌ خطأ في جلب البيانات'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف الفاتورة؟')) return;
    try { await api.delete(`/sales-invoices/${id}`); setMessage('✅ تم الحذف'); fetchInvoices(); }
    catch (err) { setMessage('❌ خطأ في الحذف'); }
  };

  const handleDuplicate = async (invoice) => {
    try {
      const r = await api.get('/sales-invoices/next-number', { params: { type: activeTab, sub_type: taxSubType } });
      const ni = { ...invoice, invoice_number: r.data.nextNumber, parent_id: invoice.id, status: 'draft', tax_sub_type: taxSubType, warehouse_type: activeTab === 'price_quote' ? 'company' : 'tax' };
      delete ni.id; delete ni.created_at; delete ni.manager_approved_at; delete ni.manager_approved_by;
      delete ni.finance_approved_at; delete ni.finance_approved_by; delete ni.dq_numbers; delete ni.items_summary; delete ni.items_count;
      await api.post('/sales-invoices', ni); setMessage('✅ تم التكرار'); fetchInvoices();
    } catch (e) { setMessage('❌ خطأ في التكرار'); }
  };

  const handleManagerApprove = async (id) => { try { await api.put(`/sales-invoices/${id}/manager-approve`); setMessage('✅ اعتماد المدير'); fetchInvoices(); } catch (e) { setMessage('❌ خطأ'); } };
  const handleFinanceApprove = async (id) => { try { await api.put(`/sales-invoices/${id}/finance-approve`); setMessage('✅ اعتماد المالية'); fetchInvoices(); } catch (e) { setMessage('❌ خطأ'); } };
  const handleCancelManager = async (id) => { if (!window.confirm('إلغاء اعتماد المدير؟')) return; try { await api.put(`/sales-invoices/${id}/cancel-manager`); setMessage('✅ تم الإلغاء'); fetchInvoices(); } catch (e) { setMessage('❌ خطأ'); } };
  const handleCancelFinance = async (id) => { if (!window.confirm('إلغاء اعتماد المالية؟')) return; try { await api.put(`/sales-invoices/${id}/cancel-finance`); setMessage('✅ تم الإلغاء'); fetchInvoices(); } catch (e) { setMessage('❌ خطأ'); } };
  const handleCancelAll = async (id) => {
    if (!window.confirm('⚠️ إلغاء شامل — هيرجّع الفاتورة كاملة لحالة مسودة، ويلغي إذن التسليم وأمر الشغل وإذن الصرف المرتبطين، ويرجّع الرصيد والسريالات. متأكد؟')) return;
    if (!window.confirm('تأكيد أخير: مفيش رجوع بعد كده. تكمل؟')) return;
    try {
      await api.put(`/sales-invoices/${id}/cancel-all`);
      setMessage('✅ تم الإلغاء الشامل — الفاتورة رجعت لمسودة');
      fetchInvoices();
    } catch (e) {
      setMessage('❌ خطأ: ' + (e.response?.data?.message || 'فشل الإلغاء'));
    }
  };

  const handleCreateWorkOrder = async (id) => {
    if (!window.confirm('إنشاء أمر شغل لهذه الفاتورة؟')) return;
    try { await api.post(`/sales-invoices/${id}/create-work-order`); setMessage('✅ تم إنشاء أمر الشغل'); fetchInvoices(); }
    catch (err) { setMessage('❌ ' + (err.response?.data?.message || 'فشل إنشاء أمر الشغل')); }
  };

  const handleCreateDeliveryNote = async (id) => {
    if (!window.confirm('إنشاء إذن تسليم لهذه الفاتورة؟')) return;
    try { await api.post(`/sales-invoices/${id}/create-delivery-note`); setMessage('✅ تم إنشاء إذن التسليم'); fetchInvoices(); }
    catch (err) { setMessage('❌ ' + (err.response?.data?.message || 'فشل إنشاء إذن التسليم')); }
  };

  const handlePrint = async (invoice) => {
    try { const r = await api.get(`/sales-invoices/${invoice.id}/print`); setPrintData(r.data); setShowPrint(true); }
    catch (e) { setMessage('❌ فشل الطباعة'); }
  };

  const getStatusText = (s) => {
    const m = { draft: '✏️ مسودة', approved_manager: '✓ مدير معتمد', work_order: '🔧 أمر شغل', pending_delivery: '📦 بانتظار التسليم', quality_approved: '✓ جودة معتمدة', quality_rejected: '✕ مرفوضة جودة', warehouse_approved: '✓ مخزن معتمد', approved_finance: '✓ مالية معتمدة', posted: '✓ مرحلة', cancelled: '✕ ملغي' };
    return m[s] || s;
  };
  const getStatusColor = (s) => {
    const c = { draft: '#6c757d', approved_manager: '#9c27b0', work_order: '#795548', pending_delivery: '#ff9800', quality_approved: '#4caf50', quality_rejected: '#dc3545', warehouse_approved: '#2196f3', approved_finance: '#28a745', posted: '#0d9488', cancelled: '#dc3545' };
    return c[s] || '#6c757d';
  };
  const getTabLabel = () => activeTab === 'tax' ? 'فاتورة ضريبية' : 'بيان سعر';
  const getCustomerDisplay = (cid) => {
    const c = customers.find(x => x.id === cid);
    if (!c) return '-';
    if (c.parent_id) { const p = customers.find(x => x.id === c.parent_id); return `${c.name} (تحت: ${p?.name || '?'})`; }
    return c.name;
  };
  const getItemsSummary = (i) => {
    if (i.items_summary) return i.items_summary;
    if (Array.isArray(i.items) && i.items.length > 0) {
      return i.items.map(it => `${it.item_name || ''} (${it.quantity})`).join('، ');
    }
    return i.item_name || '-';
  };

  const printItems = (printData && Array.isArray(printData.items) && printData.items.length > 0)
    ? printData.items
    : (printData?.invoice ? [{ item_name: printData.invoice.item_name, quantity: printData.invoice.quantity, unit_price: printData.invoice.unit_price, subtotal: printData.invoice.subtotal, serial_numbers: printData.invoice.serial_numbers }] : []);

  const thStyle = { padding: '12px', border: '1px solid #ddd' };
  const tdStyle = { padding: '10px', border: '1px solid #ddd', color: '#1e293b' };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl', background: '#ffffff', color: '#1f2937', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>🧾 فواتير المبيعات</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => navigate('/sales-module')} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>← العودة للمبيعات</button>
          <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🏠 الرئيسية</button>
        </div>
      </div>

      {message && <p style={{ padding: '10px', backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da', borderRadius: '4px', fontWeight: 'bold', marginBottom: '20px' }}>{message}</p>}

      {/* Tabs */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('tax')} style={{ padding: '12px 30px', backgroundColor: activeTab === 'tax' ? '#2563eb' : '#e2e8f0', color: activeTab === 'tax' ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>🧾 فواتير ضريبية</button>
        <button onClick={() => setActiveTab('price_quote')} style={{ padding: '12px 30px', backgroundColor: activeTab === 'price_quote' ? '#7c3aed' : '#e2e8f0', color: activeTab === 'price_quote' ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>📋 بيان أسعار</button>
      </div>

      {/* Tax Sub-type selector (only for tax tab) */}
      {activeTab === 'tax' && (
        <div style={{ marginBottom: '20px', padding: '15px', background: '#fff3cd', borderRadius: '8px', border: '2px solid #ffc107' }}>
          <label style={{ fontWeight: 'bold', marginLeft: '10px' }}>نوع الفاتورة الضريبية:</label>
          <select value={taxSubType} onChange={(e) => { setTaxSubType(e.target.value); fetchInvoices(); }} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '15px' }}>
            <option value="real">📄 فعلية (استيراد من أمر بيع)</option>
            <option value="virtual">👻 وهمية (إنشاء مباشر)</option>
          </select>
          <span style={{ marginRight: '15px', fontSize: '13px', color: '#856404' }}>
            {taxSubType === 'real' ? '→ تُستورد من أمر بيع معتمد | VAT + أرباح تجارية | مخزون ضريبي' : '→ تُنشأ مباشرة | العميل يدفع جزء من الضريبة | مخزون ضريبي'}
          </span>
        </div>
      )}

      {/* Filters */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
        <select value={filterCustomerType} onChange={e => setFilterCustomerType(e.target.value)} style={{ padding: '8px' }}>
          <option value="">كل العملاء</option><option value="authority">🏛️ الهيئات</option><option value="hospital">🏥 المستشفيات</option><option value="regular">👤 عملاء عاديون</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '8px' }}>
          <option value="">كل الحالات</option><option value="draft">مسودة</option><option value="approved_manager">مدير معتمد</option><option value="work_order">أمر شغل</option><option value="pending_delivery">بانتظار التسليم</option><option value="quality_approved">جودة معتمدة</option><option value="quality_rejected">مرفوضة جودة</option><option value="warehouse_approved">مخزن معتمد</option><option value="approved_finance">مالية معتمدة</option>
        </select>
        <input type="text" value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="بحث..." style={{ padding: '8px' }} />
        <button onClick={fetchInvoices} style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🔍 بحث</button>
        <button onClick={() => { setFilterCustomerType(''); setFilterStatus(''); setFilterSearch(''); }} style={{ padding: '8px 16px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>مسح</button>
      </div>

      {/* Action Buttons */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {!(activeTab === 'tax' && taxSubType === 'virtual') && (
          <button onClick={handleShowOrderSelector} style={{ padding: '12px 30px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
            ➕ {getTabLabel()} من أمر بيع
          </button>
        )}
        {activeTab === 'tax' && (
          <button onClick={handleShowDqSelector} style={{ padding: '12px 30px', backgroundColor: '#d97706', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
            📋 فاتورة من بيانات تسليم مسعرة
          </button>
        )}
        <button onClick={handleShowForm} style={{ padding: '12px 30px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
          ➕ {getTabLabel()} {activeTab === 'tax' && taxSubType === 'virtual' ? 'وهمية جديدة' : 'جديدة'}
        </button>
      </div>

      {/* Order Selector Modal */}
      {showOrderSelector && (
        <div style={{ color: '#1e293b', backgroundColor: '#f0f9ff', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '2px solid #0ea5e9' }}>
          <h3>📋 اختر أمر بيع معتمد:</h3>
          {approvedOrders.length === 0 ? <p>لا يوجد أوامر بيع معتمدة</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ backgroundColor: '#0ea5e9', color: 'white' }}>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>رقم الأمر</th>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>العميل</th>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>الأصناف</th>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>الإجمالي</th>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>إجراء</th>
              </tr></thead>
              <tbody>{Object.values(
                approvedOrders.reduce((acc, o) => {
                  if (!acc[o.id]) acc[o.id] = { ...o, lines: [] };
                  if (o.item_id) acc[o.id].lines.push(o);
                  return acc;
                }, {})
              ).map(o => (
                <tr key={o.id}>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}><strong>{o.order_number}</strong></td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{o.customer_name}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd', fontSize: '13px' }}>
                    {o.lines.map(l => `${l.item_name} (${l.quantity})`).join('، ') || '-'}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{safeNumber(o.lines.reduce((s, l) => s + (parseFloat(l.line_total) || 0), 0))} ج.م</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}><button onClick={() => handleSelectOrder(o.id)} style={{ padding: '8px 16px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>✅ اختر ({o.lines.length} صنف)</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
          <button onClick={() => setShowOrderSelector(false)} style={{ marginTop: '10px', padding: '8px 20px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>❌ إلغاء</button>
        </div>
      )}

      {/* DQ Multi-Selector Modal */}
      {showDqSelector && (
        <div style={{ color: '#1e293b', backgroundColor: '#fffbeb', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '2px solid #d97706' }}>
          <h3>📋 اختر بيانات التسليم المسعرة (ممكن تختار أكتر من واحد — هتتجمع في فاتورة واحدة):</h3>
          {approvedDqs.length === 0 ? <p>لا توجد بيانات تسليم مسعرة معتمدة لم تُفوتر بعد</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ backgroundColor: '#d97706', color: 'white' }}>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>اختيار</th>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>رقم البيان</th>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>العميل</th>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>الأصناف</th>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>الإجمالي</th>
              </tr></thead>
              <tbody>{approvedDqs.map(dq => {
                const selected = !!selectedDqs.find(d => d.id === dq.id);
                return (
                  <tr key={dq.id} style={{ backgroundColor: selected ? '#fef3c7' : 'white', cursor: 'pointer' }} onClick={() => toggleDqSelection(dq)}>
                    <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>
                      <input type="checkbox" checked={selected} onChange={() => toggleDqSelection(dq)} onClick={e => e.stopPropagation()} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #ddd' }}><strong>{dq.dq_number}</strong></td>
                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>{dq.customer_name}</td>
                    <td style={{ padding: '10px', border: '1px solid #ddd', fontSize: '13px' }}>
                      {(dq.items || []).map(it => `${it.item_name} (${it.quantity})`).join('، ') || '-'}
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>{safeNumber(dq.total_amount)} ج.م</td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
          <div style={{ marginTop: '15px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={() => buildFormFromDqs(selectedDqs)} disabled={selectedDqs.length === 0} style={{ padding: '10px 30px', backgroundColor: selectedDqs.length > 0 ? '#059669' : '#9ca3af', color: 'white', border: 'none', borderRadius: '4px', cursor: selectedDqs.length > 0 ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>
              ✅ إنشاء فاتورة من {selectedDqs.length} بيان
            </button>
            <button onClick={() => { setShowDqSelector(false); setSelectedDqs([]); }} style={{ padding: '8px 20px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>❌ إلغاء</button>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{ color: '#1e293b', backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '3px solid #2563eb' }}>
          <h3 style={{ color: '#2563eb' }}>
            {editingId ? '✏️ تعديل' : (selectedDqs.length > 0 ? `📋 فاتورة من ${selectedDqs.length} بيان تسليم مسعر` : (formData.so_id ? `🔄 تحويل أمر بيع إلى ${getTabLabel()}` : `➕ ${getTabLabel()} ${activeTab === 'tax' && taxSubType === 'virtual' ? 'وهمية' : 'جديدة'}`))}
          </h3>

          {selectedDqs.length > 0 && (
            <div style={{ marginBottom: '15px', padding: '10px', background: '#fef3c7', borderRadius: '6px', border: '1px solid #d97706' }}>
              <strong>البيانات المختارة:</strong> {selectedDqs.map(d => d.dq_number).join('، ')}
            </div>
          )}

          {activeTab === 'tax' && (
            <div style={{ color: '#1e293b', marginBottom: '20px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '8px', border: '2px solid #ffc107' }}>
              <h4 style={{ marginBottom: '10px', color: '#856404' }}>⚙️ إعدادات الضريبة</h4>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={taxControls.is_taxable} onChange={e => setTaxControls({ ...taxControls, is_taxable: e.target.checked })} />
                  <span>خاضع للضريبة</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={taxControls.has_vat} onChange={e => setTaxControls({ ...taxControls, has_vat: e.target.checked })} />
                  <span>ضريبة 14%</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={taxControls.has_discount_tax} onChange={e => setTaxControls({ ...taxControls, has_discount_tax: e.target.checked })} />
                  <span>ضريبة خصم</span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'price_quote' && (
            <div style={{ color: '#1e293b', marginBottom: '20px', padding: '15px', backgroundColor: '#ede9fe', borderRadius: '8px', border: '2px solid #8b5cf6' }}>
              <h4 style={{ marginBottom: '10px', color: '#5b21b6' }}>📋 بيان أسعار — بدون ضرائب | مخزون الشركة</h4>
              <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>هذا المستند لا يحتوي على ضرائب ويصرف من مخزون الشركة (غير الضريبي)</p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            <div>
              <label>رقم الفاتورة:</label>
              <div style={{ display: 'flex', gap: '5px' }}>
                <input type="text" value={formData.invoice_number} onChange={e => setFormData({ ...formData, invoice_number: e.target.value })} required style={{ flex: 1, padding: '8px' }} />
                {!editingId && <button type="button" onClick={fetchNextNumber} style={{ padding: '8px 12px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>توليد</button>}
              </div>
            </div>
            <div><label>التاريخ:</label><input type="date" value={formData.invoice_date} onChange={e => setFormData({ ...formData, invoice_date: e.target.value })} required style={{ width: '100%', padding: '8px' }} /></div>
            {formData.so_id && <div><label>أمر البيع:</label><input type="text" value={`SO-${formData.so_id}`} readOnly style={{ color: '#1e293b', width: '100%', padding: '8px', backgroundColor: '#e2e8f0' }} /></div>}
            <div>
              <label>العميل:</label>
              <select value={formData.customer_id} onChange={e => {
                const c = customers.find(x => x.id == e.target.value);
                setFormData({ ...formData, customer_id: e.target.value, customer_name: c?.name || '', parent_id: c?.parent_id || null });
              }} required disabled={selectedDqs.length > 0} style={{ width: '100%', padding: '8px' }}>
                <option value="">اختر العميل</option>
                <optgroup label="🏛️ الهيئات">{customers.filter(c => c.customer_type === 'authority' || !c.customer_type).map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}</optgroup>
                <optgroup label="🏥 المستشفيات">{customers.filter(c => c.customer_type === 'hospital').map(c => <option key={c.id} value={c.id}>{c.code} - {c.name} {c.parent_name ? `(تحت: ${c.parent_name})` : ''}</option>)}</optgroup>
                <optgroup label="👤 عملاء عاديون">{customers.filter(c => c.customer_type === 'regular').map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}</optgroup>
              </select>
            </div>
            {formData.customer_id && (() => { const c = customers.find(x => x.id === parseInt(formData.customer_id)); if (c?.parent_id) { const p = customers.find(x => x.id === c.parent_id); return <div style={{ background: '#e3f2fd', padding: '10px', borderRadius: '4px', gridColumn: '1 / -1' }}><strong>الهيئة التابعة:</strong> {p?.name || 'غير معروف'}</div>; } return null; })()}
            {activeTab === 'tax' && (
              <div><label>ضريبة الخصم (%):</label>
                <select value={formData.tax_discount_percent} onChange={e => setFormData({ ...formData, tax_discount_percent: e.target.value })} style={{ width: '100%', padding: '8px' }}>
                  <option value="0">0%</option><option value="1">1%</option><option value="3">3%</option>
                </select></div>
            )}
            <div><label>ملاحظات:</label><input type="text" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} style={{ width: '100%', padding: '8px' }} /></div>
          </div>

          {/* محرر الأصناف */}
          <div style={{ marginTop: '20px', padding: '15px', background: 'white', borderRadius: '8px', border: '2px solid #2563eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h4 style={{ margin: 0, color: '#2563eb' }}>📦 أصناف الفاتورة ({formItems.length})</h4>
              <button type="button" onClick={addLine} style={{ padding: '8px 20px', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>➕ إضافة صنف</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ backgroundColor: '#2563eb', color: 'white' }}>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>#</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>الصنف</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>المخزن</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>الكمية</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>سعر البيع</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>الإجمالي</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}></th>
              </tr></thead>
              <tbody>
                {formItems.map((line, idx) => (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#f8f9fa' : 'white' }}>
                    <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ padding: '6px', border: '1px solid #ddd', minWidth: '220px' }}>
                      <select value={line.item_id} onChange={e => updateLine(idx, 'item_id', e.target.value)} required disabled={selectedDqs.length > 0} style={{ width: '100%', padding: '6px' }}>
                        <option value="">اختر الصنف</option>
                        {items.map(i => <option key={i.id} value={i.id}>{i.code} - {i.name}{i.has_serial ? ' 🔢' : ''}</option>)}
                      </select>
                      {line.has_serial && <div style={{ fontSize: '11px', color: '#7c3aed', marginTop: '3px' }}>🔢 صنف بسريالات — تُحدد في إذن التسليم/الصرف</div>}
                    </td>
                    <td style={{ padding: '6px', border: '1px solid #ddd', minWidth: '140px' }}>
                      <select value={line.warehouse_id} onChange={e => updateLine(idx, 'warehouse_id', e.target.value)} disabled={selectedDqs.length > 0} style={{ width: '100%', padding: '6px' }}>
                        <option value="">—</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px', border: '1px solid #ddd', width: '100px' }}>
                      <input type="number" step="0.001" min="0.001" value={line.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)} required style={{ width: '100%', padding: '6px' }} />
                    </td>
                    <td style={{ padding: '6px', border: '1px solid #ddd', width: '110px' }}>
                      <input type="number" step="0.01" min="0" value={line.unit_price} onChange={e => updateLine(idx, 'unit_price', e.target.value)} style={{ width: '100%', padding: '6px' }} />
                    </td>
                    <td style={{ padding: '6px', border: '1px solid #ddd', fontWeight: 'bold' }}>{safeNumber((parseFloat(line.quantity) || 0) * (parseFloat(line.unit_price) || 0))}</td>
                    <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'center' }}>
                      {formItems.length > 1 && selectedDqs.length === 0 && (
                        <button type="button" onClick={() => removeLine(idx)} style={{ padding: '4px 10px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🗑️</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ color: '#1e293b', backgroundColor: '#e3f2fd', fontWeight: 'bold' }}>
                  <td colSpan="5" style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>إجمالي الأصناف:</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                    {safeNumber(formItems.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0), 0))} ج.م
                  </td>
                  <td style={{ border: '1px solid #ddd' }}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="submit" disabled={loading} style={{ padding: '12px 40px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>{loading ? 'جاري الحفظ...' : (editingId ? '💾 تحديث' : '💾 حفظ')}</button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setSelectedDqs([]); }} style={{ padding: '12px 40px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>❌ إلغاء</button>
          </div>
        </form>
      )}

      {/* Invoices Table */}
      <h3>📋 {getTabLabel()} {activeTab === 'tax' ? (taxSubType === 'real' ? 'فعلية' : 'وهمية') : ''} ({invoices.length})</h3>
      {loading ? <p>جاري التحميل...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead><tr style={{ backgroundColor: '#2563eb', color: 'white' }}>
            <th style={thStyle}>رقم الفاتورة</th><th style={thStyle}>المرجع</th><th style={thStyle}>العميل</th><th style={thStyle}>الأصناف</th>
            <th style={thStyle}>الإجمالي</th><th style={thStyle}>الصافي</th>
            <th style={thStyle}>الحالة</th><th style={thStyle}>إجراء</th>
          </tr></thead>
          <tbody>
            {invoices.length === 0 ? <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>لا يوجد فواتير</td></tr> : (
              invoices.filter(i => {
                if (filterCustomerType && i.customer_type !== filterCustomerType) return false;
                if (filterStatus && i.status !== filterStatus) return false;
                if (filterSearch && !i.invoice_number?.toLowerCase().includes(filterSearch.toLowerCase()) && !i.customer_name?.toLowerCase().includes(filterSearch.toLowerCase())) return false;
                return true;
              }).map(i => (
                <tr key={i.id} style={{ backgroundColor: i.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                  <td style={tdStyle}><strong>{i.invoice_number}</strong></td>
                  <td style={tdStyle}>
                    {i.sales_order_number && <div style={{ fontSize: '12px' }}>🧾 {i.sales_order_number}</div>}
                    {i.dq_numbers && <div style={{ fontSize: '12px', color: '#d97706' }}>📋 {i.dq_numbers}</div>}
                    {!i.sales_order_number && !i.dq_numbers && '-'}
                  </td>
                  <td style={tdStyle}>{getCustomerDisplay(i.customer_id)}</td>
                  <td style={tdStyle}>
                    <div style={{ fontSize: '13px' }}>{getItemsSummary(i)}</div>
                    {(i.items_count > 1) && <span style={{ fontSize: '11px', background: '#e3f2fd', padding: '2px 8px', borderRadius: '10px', color: '#2563eb' }}>{i.items_count} أصناف</span>}
                  </td>
                  <td style={tdStyle}>{safeNumber(i.subtotal)} ج.م</td>
                  <td style={tdStyle}><strong>{safeNumber(i.total_amount)} ج.م</strong></td>
                  <td style={tdStyle}><span style={{ color: getStatusColor(i.status), fontWeight: 'bold', padding: '4px 12px', borderRadius: '12px', backgroundColor: getStatusColor(i.status) + '20' }}>{getStatusText(i.status)}</span></td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      <button onClick={() => handlePrint(i)} style={{ padding: '5px 10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>🖨️</button>
                      {i.status === 'draft' && <><button onClick={() => handleEdit(i)} style={{ padding: '5px 10px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✏️</button><button onClick={() => handleDelete(i.id)} style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>🗑️</button><button onClick={() => handleManagerApprove(i.id)} style={{ padding: '5px 10px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✓ مدير</button></>}
                      {i.status === 'approved_manager' && <><button onClick={() => handleCreateWorkOrder(i.id)} style={{ padding: '5px 10px', backgroundColor: '#795548', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>🔧 شغل</button><button onClick={() => handleCancelManager(i.id)} style={{ padding: '5px 10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>↩️</button></>}
                      {i.status === 'work_order' && <button onClick={() => handleCreateDeliveryNote(i.id)} style={{ padding: '5px 10px', backgroundColor: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>📦 تسليم</button>}
                      {i.status === 'pending_delivery' && <span style={{ padding: '5px 10px', backgroundColor: '#e2e8f0', color: '#666', borderRadius: '4px', fontSize: '12px' }}>⏳ في الجودة</span>}
                      {i.status === 'quality_approved' && <span style={{ padding: '5px 10px', backgroundColor: '#e2e8f0', color: '#666', borderRadius: '4px', fontSize: '12px' }}>⏳ في المخزن</span>}
                      {i.status === 'quality_rejected' && <span style={{ padding: '5px 10px', backgroundColor: '#f8d7da', color: '#dc3545', borderRadius: '4px', fontSize: '12px' }}>✕ مرفوضة</span>}
                      {i.status === 'warehouse_approved' && <button onClick={() => handleFinanceApprove(i.id)} style={{ padding: '5px 10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✓ مالية</button>}
                      {i.status === 'approved_finance' && <button onClick={() => handleCancelFinance(i.id)} style={{ padding: '5px 10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>↩️ مالية</button>}
                      <button onClick={() => handleDuplicate(i)} style={{ padding: '5px 10px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>🔄 تكرار</button>
                      {userRole === 'admin' && i.status !== 'draft' && <button onClick={() => handleCancelAll(i.id)} style={{ padding: '5px 10px', backgroundColor: '#b91c1c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }} title="إلغاء شامل - يرجّع الفاتورة لمسودة ويلغي كل المستندات التابعة">🗑️ إلغاء شامل</button>}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {/* Print Modal */}
      {showPrint && printData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '8px', padding: '30px', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div id="printable-area">
              <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #333', paddingBottom: '20px' }}>
                <h1 style={{ margin: 0 }}>{printData.invoice?.invoice_type === 'tax' ? (printData.invoice?.tax_sub_type === 'virtual' ? 'فاتورة ضريبية وهمية' : 'فاتورة ضريبية') : 'بيان سعر'}</h1>
                <div style={{ fontSize: '16px', marginTop: '10px' }}>رقم: {printData.invoice?.invoice_number}</div>
                <div style={{ fontSize: '16px' }}>التاريخ: {printData.invoice?.invoice_date}</div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>بيانات العميل</h3>
                <p><strong>الاسم:</strong> {printData.invoice?.customer_name_display}</p>
                {printData.invoice?.parent_customer_name && <p><strong>الهيئة:</strong> {printData.invoice?.parent_customer_name}</p>}
                <p><strong>العنوان:</strong> {printData.invoice?.customer_address || '-'}</p>
                <p><strong>التليفون:</strong> {printData.invoice?.customer_phone || '-'}</p>
                <p><strong>الرقم الضريبي:</strong> {printData.invoice?.customer_tax_number || '-'}</p>
                {printData.invoice?.dq_numbers && <p><strong>بيانات التسليم المسعرة:</strong> {printData.invoice.dq_numbers}</p>}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', margin: '20px 0' }}>
                <thead><tr style={{ background: '#f0f0f0' }}>
                  <th style={{ border: '1px solid #333', padding: '8px' }}>#</th>
                  <th style={{ border: '1px solid #333', padding: '8px' }}>الصنف</th>
                  <th style={{ border: '1px solid #333', padding: '8px' }}>الكمية</th>
                  <th style={{ border: '1px solid #333', padding: '8px' }}>السعر</th>
                  <th style={{ border: '1px solid #333', padding: '8px' }}>الإجمالي</th>
                </tr></thead>
                <tbody>
                  {printItems.map((it, idx) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #333', padding: '8px' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #333', padding: '8px' }}>{it.item_name}</td>
                      <td style={{ border: '1px solid #333', padding: '8px' }}>{it.quantity}</td>
                      <td style={{ border: '1px solid #333', padding: '8px' }}>{safeNumber(it.unit_price)}</td>
                      <td style={{ border: '1px solid #333', padding: '8px' }}>{safeNumber(it.subtotal != null ? it.subtotal : (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: '20px', textAlign: 'left' }}>
                <p><strong>الإجمالي:</strong> {safeNumber(printData.invoice?.subtotal)}</p>
                {parseFloat(printData.invoice?.tax_discount_amount || 0) > 0 && <p><strong>خصم الضريبة:</strong> {safeNumber(printData.invoice?.tax_discount_amount)}</p>}
                {parseFloat(printData.invoice?.tax_14_percent || 0) > 0 && <p><strong>ضريبة 14%:</strong> {safeNumber(printData.invoice?.tax_14_percent)}</p>}
                <p style={{ fontSize: '18px', fontWeight: 'bold' }}><strong>الصافي:</strong> {safeNumber(printData.invoice?.total_amount)}</p>
              </div>
              <div style={{ marginTop: '40px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
                <p>تم الطباعة بتاريخ: {new Date().toLocaleDateString('ar-EG')}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
              <button onClick={() => window.print()} style={{ padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🖨️ طباعة</button>
              <button onClick={() => setShowPrint(false)} style={{ padding: '10px 20px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SalesInvoices;
