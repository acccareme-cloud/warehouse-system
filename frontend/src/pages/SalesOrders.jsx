import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function SalesOrders() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('sales_orders');
  const [orders, setOrders] = useState([]);
  const [deliveryQuotes, setDeliveryQuotes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [items, setItems] = useState([]);
  const [userRole, setUserRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detailOrder, setDetailOrder] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState({ page: 1, limit: 20, status: '', search: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const calcDeliveryDate = (orderDate) => {
    if (!orderDate) return '';
    const [y, m, d] = orderDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + 2);
    const yy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    customer_id: '', customer_branch_id: '', sales_rep_id: '', department_id: '',
    order_date: today, delivery_date: calcDeliveryDate(today),
    currency: 'EGP', exchange_rate: 1, notes: '', items: []
  });

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserRole(user.role || '');
    fetchDropdowns();
  }, []);

  useEffect(() => {
    if (activeTab === 'sales_orders') fetchOrders();
    else fetchDeliveryQuotes();
  }, [activeTab, filters.page, filters.status, filters.search]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = { ...filters, order_type: 'sales_order' };
      Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
      const res = await api.get('/sales-orders', { params });
      setOrders(res.data.data || []);
      setPagination(res.data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch (err) {
      setMessage('❌ خطأ في تحميل أوامر البيع');
    } finally { setLoading(false); }
  };

  const fetchDeliveryQuotes = async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
      const res = await api.get('/sales-orders/delivery-quotes', { params });
      setDeliveryQuotes(res.data.data || []);
      setPagination(res.data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch (err) {
      setMessage('❌ خطأ في تحميل بيانات التسليم');
    } finally { setLoading(false); }
  };

  const fetchDropdowns = async () => {
    try {
      const [c, e, d, i] = await Promise.all([
        api.get('/customers'),
        api.get('/employees', { params: { status: 'active' } }),
        api.get('/employees/departments'),
        api.get('/items')
      ]);
      setCustomers(c.data || []);
      setEmployees(e.data || []);
      setDepartments(d.data || []);
      setItems(i.data || []);
    } catch (err) { console.error(err); }
  };

  const fetchBranches = async (customerId) => {
    if (!customerId) { setBranches([]); return; }
    try {
      const res = await api.get('/customers', { params: { parent_id: customerId } });
      setBranches(res.data || []);
    } catch {
      setBranches(customers.filter(c => String(c.parent_id) === String(customerId)));
    }
  };

  const resetForm = () => {
    const od = new Date().toISOString().split('T')[0];
    setFormData({
      customer_id: '', customer_branch_id: '', sales_rep_id: '', department_id: '',
      order_date: od, delivery_date: calcDeliveryDate(od),
      currency: 'EGP', exchange_rate: 1, notes: '', items: []
    });
    setBranches([]); setEditingId(null);
  };

  const filteredEmployees = employees.filter(e =>
    !formData.department_id || String(e.department_id) === String(formData.department_id)
  );

  const mainCustomers = customers.filter(c =>
    c.parent_id == null || c.parent_id === '' || c.parent_id === 0 || c.parent_id === '0'
  );

  const handleShowForm = () => { resetForm(); setShowForm(true); setShowDetail(false); };

  const handleCustomerChange = async (e) => {
    const cid = e.target.value;
    const customer = customers.find(c => String(c.id) === String(cid));
    await fetchBranches(cid);
    setFormData(p => ({ ...p, customer_id: cid, customer_branch_id: '', customer_name: customer?.name || '' }));
  };

  const handleDepartmentChange = (e) => {
    const deptId = e.target.value;
    setFormData(p => ({
      ...p,
      department_id: deptId,
      sales_rep_id: deptId && p.sales_rep_id
        ? (employees.some(emp => String(emp.department_id) === String(deptId) && String(emp.id) === String(p.sales_rep_id)) ? p.sales_rep_id : '')
        : p.sales_rep_id
    }));
  };

  const handleOrderDateChange = (e) => {
    const orderDate = e.target.value;
    setFormData(p => ({ ...p, order_date: orderDate, delivery_date: calcDeliveryDate(orderDate) }));
  };

  const handleAddItem = () => {
    setFormData(p => ({ ...p, items: [...p.items, { item_id: '', item_name: '', quantity: 1, unit_price: 0, discount_percent: 0, discount_amount: 0, notes: '' }] }));
  };
  const handleRemoveItem = (idx) => setFormData(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));
  const handleItemChange = (idx, field, value) => {
    setFormData(p => {
      const ni = [...p.items]; ni[idx][field] = value;
      if (field === 'item_id') { const it = items.find(i => i.id == value); if (it) { ni[idx].item_name = it.name || ''; ni[idx].unit_price = parseFloat(it.sale_price) || 0; } }
      return { ...p, items: ni };
    });
  };

  const calculateTotals = () => {
    let t = 0;
    formData.items.forEach(it => {
      const q = parseFloat(it.quantity) || 0, pr = parseFloat(it.unit_price) || 0;
      const da = parseFloat(it.discount_amount) || 0, dp = parseFloat(it.discount_percent) || 0;
      let lt = q * pr; if (da > 0) lt -= da; else if (dp > 0) lt -= (lt * dp / 100);
      t += lt;
    });
    return { total: t.toFixed(2), totalCurrency: (t * (parseFloat(formData.exchange_rate) || 1)).toFixed(2) };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer_id) { setMessage('❌ اختر العميل'); return; }
    if (!formData.items.length) { setMessage('❌ أضف أصناف'); return; }
    const valid = formData.items.filter(it => it.item_id && parseFloat(it.quantity) > 0);
    if (!valid.length) { setMessage('❌ أضف أصناف صحيحة'); return; }
    try {
      setLoading(true);
      const totals = calculateTotals();
      const payload = {
        ...formData,
        items: valid,
        total_amount: parseFloat(totals.total),
        total_amount_currency: parseFloat(totals.totalCurrency),
        customer_branch_id: formData.customer_branch_id || null,
        sales_rep_id: formData.sales_rep_id || null,
        department_id: formData.department_id || null,
        delivery_date: formData.delivery_date || null
      };
      if (activeTab === 'sales_orders') {
        if (editingId) { await api.put(`/sales-orders/${editingId}`, payload); setMessage('✅ تم التحديث'); }
        else { await api.post('/sales-orders', payload); setMessage('✅ تم إنشاء أمر البيع'); }
        fetchOrders();
      } else {
        if (editingId) { await api.put(`/sales-orders/delivery-quotes/${editingId}`, payload); setMessage('✅ تم التحديث'); }
        else { await api.post('/sales-orders/delivery-quotes', payload); setMessage('✅ تم إنشاء بيان التسليم'); }
        fetchDeliveryQuotes();
      }
      setShowForm(false); resetForm();
    } catch (err) { setMessage('❌ خطأ: ' + (err.response?.data?.error || err.message)); }
    finally { setLoading(false); }
  };

  const handleEdit = async (order) => {
    try {
      const res = activeTab === 'sales_orders' 
        ? await api.get(`/sales-orders/${order.id}`) 
        : await api.get(`/sales-orders/delivery-quotes/${order.id}`);
      const d = res.data;
      const customer = customers.find(c => c.id == d.customer_id);
      let newBranches = [];
      if (customer) { if (customer.branches && Array.isArray(customer.branches)) newBranches = customer.branches; else newBranches = customers.filter(c => c.parent_id == d.customer_id); }
      setBranches(newBranches);
      setFormData({
        customer_id: d.customer_id || '', customer_branch_id: d.customer_branch_id || '', sales_rep_id: d.sales_rep_id || '',
        department_id: d.department_id || '', order_date: d.order_date ? d.order_date.split('T')[0] : new Date().toISOString().split('T')[0],
        delivery_date: d.delivery_date ? d.delivery_date.split('T')[0] : '', currency: d.currency || 'EGP', exchange_rate: d.exchange_rate || 1,
        notes: d.notes || '', items: d.items?.map(i => ({ item_id: i.item_id || '', item_name: i.item_name || '', quantity: i.quantity || 1, unit_price: i.unit_price || 0, discount_percent: i.discount_percent || 0, discount_amount: i.discount_amount || 0, notes: i.notes || '' })) || []
      });
      setEditingId(order.id); setShowForm(true); setShowDetail(false);
    } catch (err) { setMessage('❌ خطأ في جلب البيانات'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد؟')) return;
    if (userRole !== 'admin') { setMessage('❌ الأدمن فقط'); return; }
    try {
      if (activeTab === 'sales_orders') { await api.delete(`/sales-orders/${id}`); setMessage('✅ تم الحذف'); fetchOrders(); }
      else { await api.delete(`/sales-orders/delivery-quotes/${id}`); setMessage('✅ تم الحذف'); fetchDeliveryQuotes(); }
    } catch (err) { setMessage('❌ خطأ في الحذف'); }
  };

  const handleApprove = async (id) => {
    try {
      if (activeTab === 'sales_orders') { await api.post(`/sales-orders/${id}/approve`); setMessage('✅ تم الاعتماد'); fetchOrders(); }
      else { await api.post(`/sales-orders/delivery-quotes/${id}/approve`); setMessage('✅ تم الاعتماد'); fetchDeliveryQuotes(); }
    } catch (err) { setMessage('❌ خطأ في الاعتماد'); }
  };

  const handleCancel = async (id) => {
    const reason = prompt('سبب الإلغاء:');
    try {
      if (activeTab === 'sales_orders') { await api.post(`/sales-orders/${id}/cancel`, { cancel_reason: reason }); setMessage('✅ تم الإلغاء'); fetchOrders(); }
      else { await api.post(`/sales-orders/delivery-quotes/${id}/cancel`, { cancel_reason: reason }); setMessage('✅ تم الإلغاء'); fetchDeliveryQuotes(); }
    } catch (err) { setMessage('❌ خطأ في الإلغاء'); }
  };

  const handlePrintDelivery = async (id) => {
    try {
      const res = await api.get(`/sales-orders/delivery-quotes/${id}/print`);
      const { order, items: printItems, company } = res.data;

      const subtotal = parseFloat(order.total_amount || 0);
      const taxRate = 0.14;
      const taxAmount = subtotal * taxRate;
      const grandTotal = subtotal + taxAmount;

      const w = window.open('', '_blank');
      w.document.write(`<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>بيان تسليم مسعر - ${order.dq_number}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Arial', sans-serif; margin: 0; padding: 20px; color: #000; font-size: 13px; }
    .doc-header { text-align: center; margin-bottom: 15px; }
    .doc-header h1 { margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 2px; }
    .doc-header .subtitle { font-size: 14px; margin: 5px 0; }
    .doc-title { text-align: center; border: 2px solid #000; padding: 8px 40px; display: inline-block; margin: 10px auto; font-size: 18px; font-weight: bold; }
    .title-wrap { text-align: center; margin-bottom: 15px; }
    .info-section { display: flex; justify-content: space-between; margin-bottom: 15px; border: 1px solid #000; }
    .info-left, .info-right { padding: 10px; flex: 1; }
    .info-left { border-left: 1px solid #000; }
    .info-row { display: flex; margin-bottom: 6px; }
    .info-row label { font-weight: bold; min-width: 100px; }
    .info-row span { border-bottom: 1px solid #000; flex: 1; padding: 0 5px; min-height: 18px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #000; padding: 8px; text-align: center; font-size: 13px; }
    th { background: #fff; font-weight: bold; }
    .totals-table { width: 100%; border-collapse: collapse; margin-top: 0; }
    .totals-table td { border: 1px solid #000; padding: 8px; }
    .totals-table .label { font-weight: bold; text-align: right; width: 60%; }
    .totals-table .value { text-align: center; font-weight: bold; width: 40%; }
    .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
    .signature-box { width: 30%; text-align: center; }
    .signature-line { border-top: 1px solid #000; margin-top: 50px; padding-top: 8px; font-weight: bold; }
    .company-footer { text-align: center; margin-top: 30px; font-size: 11px; color: #333; border-top: 1px solid #ccc; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="doc-header">
    <h1>${company?.name || 'CareMed'}</h1>
    <div class="subtitle">${company?.subtitle || 'For Medical Equipment'}</div>
  </div>

  <div class="title-wrap">
    <div class="doc-title">بيان تسليم مسعر</div>
  </div>

  <div class="info-section">
    <div class="info-left">
      <div class="info-row"><label>العميل:</label><span>${order.branch_name || '-'}</span></div>
      <div class="info-row"><label>جهة التسليم:</label><span>${order.delivery_location || '-'}</span></div>
      <div class="info-row"><label>مستلم:</label><span>${order.receiver_name || '-'}</span></div>
    </div>
    <div class="info-right">
      <div class="info-row"><label>تاريخ البيان:</label><span>${new Date(order.order_date).toLocaleDateString('ar-EG')}</span></div>
      <div class="info-row"><label>رقم البيان:</label><span>${order.dq_number}</span></div>
      <div class="info-row"><label>اسم البنك:</label><span>${company?.bank_name || 'مصرف أبو ظبي الإسلامي'}</span></div>
      <div class="info-row"><label>رقم الحساب:</label><span>${company?.account_number || '100000904834'}</span></div>
      <div class="info-row"><label>IBAN:</label><span>${company?.iban || 'EG980030600300000100000904834'}</span></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:5%">#</th>
        <th style="width:45%">الصنف</th>
        <th style="width:15%">سعر الوحدة</th>
        <th style="width:10%">الكمية</th>
        <th style="width:25%">الإجمالي</th>
      </tr>
    </thead>
    <tbody>
      ${printItems.map((it, i) => {
        const lineTotal = (parseFloat(it.quantity || 0) * parseFloat(it.unit_price || 0)).toFixed(2);
        return `<tr>
          <td>${i + 1}</td>
          <td style="text-align:right;padding-right:15px">${it.item_name || '-'}</td>
          <td>${parseFloat(it.unit_price || 0).toFixed(2)}</td>
          <td>${it.quantity}</td>
          <td>${lineTotal}</td>
        </tr>`;
      }).join('')}
      ${Array(Math.max(0, 6 - printItems.length)).fill(0).map(() => `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`).join('')}
    </tbody>
  </table>

  <table class="totals-table">
    <tr><td class="label">إجمالي</td><td class="value">${subtotal.toFixed(2)}</td></tr>
    <tr><td class="label">ضريبة القيمة المضافة 14%</td><td class="value">${taxAmount.toFixed(2)}</td></tr>
    <tr><td class="label">إجمالي البيان ( فقط وقدره ${grandTotal.toFixed(0)} جنيها مصريا لا غير)</td><td class="value">${grandTotal.toFixed(2)}</td></tr>
  </table>

  <div class="signatures">
    <div class="signature-box">
      <div class="signature-line">إعداد</div>
    </div>
    <div class="signature-box">
      <div class="signature-line">مراجعة</div>
    </div>
  </div>

  <div class="company-footer">
    ${company?.address || '5112, Dr.Ahmed Hussien St., EL-Meerag city, New Maadi, Cairo, Egypt.'}<br>
    Tel/Fax: ${company?.phone || '+2 0224473059'} &nbsp;&nbsp; Hotline: ${company?.hotline || '01000259542'} &nbsp;&nbsp; Email: ${company?.email || 'Info@caremedeg.com'}
  </div>
</body>
</html>`);
      w.document.close(); w.print();
    } catch (err) { setMessage('❌ خطأ في الطباعة'); }
  };

  const handleShowDetail = async (order) => {
    try {
      const res = activeTab === 'sales_orders' ? await api.get(`/sales-orders/${order.id}`) : await api.get(`/sales-orders/delivery-quotes/${order.id}`);
      setDetailOrder(res.data); setShowDetail(true); setShowForm(false);
    } catch (err) { setMessage('❌ خطأ في جلب التفاصيل'); }
  };

  const getStatusBadge = (s) => {
    const styles = { draft: { background: '#e5e7eb', color: '#374151', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }, approved: { background: '#d1fae5', color: '#065f46', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #10b981' }, cancelled: { background: '#fee2e2', color: '#991b1b', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #ef4444' } };
    const labels = { draft: 'مسودة', approved: 'معتمد', cancelled: 'ملغي' };
    return <span style={styles[s]||styles.draft}>{labels[s]||s}</span>;
  };

  const getDeliveryBadge = (s) => {
    const styles = { pending: { background: '#fef3c7', color: '#92400e', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #f59e0b' }, delivered: { background: '#dbeafe', color: '#1e40af', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #3b82f6' }, partially_delivered: { background: '#ffedd5', color: '#9a3412', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #f97316' }, returned: { background: '#fee2e2', color: '#991b1b', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #ef4444' } };
    const labels = { pending: 'معلق', delivered: 'تم التسليم', partially_delivered: 'تسليم جزئي', returned: 'مرتجع' };
    return <span style={styles[s]||styles.pending}>{labels[s]||s}</span>;
  };

  const totals = calculateTotals();
  const currentData = activeTab === 'sales_orders' ? orders : deliveryQuotes;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl' }}>
      {message && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', background: message.startsWith('✅') ? '#d1fae5' : '#fee2e2', color: message.startsWith('✅') ? '#065f46' : '#991b1b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{message}</span><button onClick={() => setMessage('')} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'inherit' }}>×</button>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate('/sales-module')} style={{ background: '#6b7280', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px' }}>🏠 الرئيسية</button>
<button onClick={() => navigate('/sales-module')} style={{ background: '#059669', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px' }}>← رجوع للمبيعات</button>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>{activeTab === 'sales_orders' ? 'أوامر البيع' : 'بيانات التسليم المسعر'}</h1>
        </div>
        <button onClick={handleShowForm} style={{ background: '#2563eb', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>+ {activeTab === 'sales_orders' ? 'أمر بيع جديد' : 'بيان تسليم مسعر جديد'}</button>
      </div>
      <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: '24px', gap: '4px', flexWrap: 'wrap' }}>
        <button onClick={() => { setActiveTab('sales_orders'); setFilters(p => ({ ...p, page: 1 })); }} style={{ padding: '12px 24px', border: 'none', borderBottom: activeTab === 'sales_orders' ? '3px solid #2563eb' : '3px solid transparent', background: activeTab === 'sales_orders' ? '#eff6ff' : 'transparent', color: activeTab === 'sales_orders' ? '#2563eb' : '#6b7280', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '8px 8px 0 0' }}>📋 أوامر البيع</button>
        <button onClick={() => { setActiveTab('delivery_quotes'); setFilters(p => ({ ...p, page: 1 })); }} style={{ padding: '12px 24px', border: 'none', borderBottom: activeTab === 'delivery_quotes' ? '3px solid #059669' : '3px solid transparent', background: activeTab === 'delivery_quotes' ? '#ecfdf5' : 'transparent', color: activeTab === 'delivery_quotes' ? '#059669' : '#6b7280', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '8px 8px 0 0' }}>🚚 بيانات التسليم المسعر</button>
      </div>
      <div style={{ background: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'end' }}>
        <div><label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#6b7280', fontWeight: 'bold' }}>الحالة</label>
          <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value, page: 1 })} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', minWidth: '140px' }}>
            <option value="">كل الحالات</option><option value="draft">مسودة</option><option value="approved">معتمد</option><option value="cancelled">ملغي</option>
          </select></div>
        <div><label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#6b7280', fontWeight: 'bold' }}>البحث</label>
          <input type="text" placeholder="رقم أو عميل..." value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value, page: 1 })} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', minWidth: '200px' }} /></div>
      </div>
      {loading ? <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>جاري التحميل...</div> : (
        <>
          <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead><tr style={{ background: '#f3f4f6' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold', whiteSpace: 'nowrap' }}>رقم الأمر</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold', whiteSpace: 'nowrap' }}>التاريخ</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold', whiteSpace: 'nowrap' }}>العميل</th>
                  {activeTab === 'delivery_quotes' && <th style={{ padding: '12px 16px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold', whiteSpace: 'nowrap' }}>العميل الفرعي</th>}
                  <th style={{ padding: '12px 16px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold', whiteSpace: 'nowrap' }}>الإجمالي</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold', whiteSpace: 'nowrap' }}>الحالة</th>
                  {activeTab === 'delivery_quotes' && <th style={{ padding: '12px 16px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold', whiteSpace: 'nowrap' }}>التسليم</th>}
                  <th style={{ padding: '12px 16px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold', whiteSpace: 'nowrap' }}>البائع</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold', whiteSpace: 'nowrap', minWidth: '320px' }}>الإجراءات</th>
                </tr></thead>
                <tbody>
                  {currentData.length === 0 ? <tr><td colSpan={activeTab === 'delivery_quotes' ? 9 : 7} style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>لا توجد بيانات</td></tr> : (
                    currentData.map(order => (
                      <tr key={order.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'nowrap' }}><div>{activeTab === 'sales_orders' ? order.order_number : order.dq_number}</div>{order.is_converted && <div style={{ fontSize: '11px', color: '#059669', marginTop: '2px' }}>✓ محول</div>}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}>{order.order_date ? new Date(order.order_date).toLocaleDateString('ar-EG') : '-'}</td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}><div style={{ fontWeight: '500' }}>{order.customer_name}</div></td>
                        {activeTab === 'delivery_quotes' && <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}><div style={{ fontWeight: '500', color: '#059669' }}>{order.branch_name || '-'}</div></td>}
                        <td style={{ padding: '12px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}><div>{parseFloat(order.total_amount || 0).toFixed(2)} {order.currency || 'EGP'}</div>{order.currency !== 'EGP' && order.total_amount_currency && <div style={{ fontSize: '12px', color: '#6b7280' }}>= {parseFloat(order.total_amount_currency).toFixed(2)} EGP</div>}</td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{getStatusBadge(order.status)}</td>
                        {activeTab === 'delivery_quotes' && <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{getDeliveryBadge(order.delivery_status || 'pending')}</td>}
                        <td style={{ padding: '12px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}>{order.sales_rep_name || '-'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            <button onClick={() => handleShowDetail(order)} style={{ background: '#3b82f6', color: 'white', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '12px' }}>عرض</button>
                            {order.status === 'draft' && <><button onClick={() => handleEdit(order)} style={{ background: '#eab308', color: 'white', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '12px' }}>تعديل</button><button onClick={() => handleApprove(order.id)} style={{ background: '#059669', color: 'white', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '12px' }}>اعتماد</button></>}
                            {activeTab === 'delivery_quotes' && order.status === 'approved' && <button onClick={() => handlePrintDelivery(order.id)} style={{ background: '#4b5563', color: 'white', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '12px' }}>🖨️ طباعة</button>}
                            {order.status !== 'cancelled' && <button onClick={() => handleCancel(order.id)} style={{ background: '#f87171', color: 'white', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '12px' }}>إلغاء</button>}
                            {userRole === 'admin' && <button onClick={() => handleDelete(order.id)} style={{ background: '#b91c1c', color: 'white', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '12px' }}>حذف</button>}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {pagination.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setFilters(p => ({ ...p, page: p.page - 1 }))} disabled={filters.page <= 1} style={{ padding: '8px 16px', borderRadius: '6px', background: '#e5e7eb', border: 'none', cursor: filters.page <= 1 ? 'not-allowed' : 'pointer', opacity: filters.page <= 1 ? 0.5 : 1 }}>السابق</button>
              <span style={{ padding: '8px 16px', background: 'white', borderRadius: '6px', border: '1px solid #e5e7eb' }}>صفحة {filters.page} من {pagination.totalPages}</span>
              <button onClick={() => setFilters(p => ({ ...p, page: p.page + 1 }))} disabled={filters.page >= pagination.totalPages} style={{ padding: '8px 16px', borderRadius: '6px', background: '#e5e7eb', border: 'none', cursor: filters.page >= pagination.totalPages ? 'not-allowed' : 'pointer', opacity: filters.page >= pagination.totalPages ? 0.5 : 1 }}>التالي</button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {showDetail && detailOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, overflowY: 'auto', padding: '20px' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid #e5e7eb', paddingBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold' }}>{activeTab === 'sales_orders' ? 'تفاصيل أمر البيع' : 'تفاصيل بيان التسليم المسعر'}</h2>
              <button onClick={() => setShowDetail(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '8px' }}>
                <p style={{ margin: '4px 0', fontSize: '14px' }}><strong>رقم الأمر:</strong> {activeTab === 'sales_orders' ? detailOrder.order_number : detailOrder.dq_number}</p>
                <p style={{ margin: '4px 0', fontSize: '14px' }}><strong>العميل:</strong> {detailOrder.customer_name}</p>
                {activeTab === 'delivery_quotes' && <p style={{ margin: '4px 0', fontSize: '14px' }}><strong>العميل الفرعي:</strong> {detailOrder.branch_name || '-'}</p>}
              </div>
              <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '8px' }}>
                <p style={{ margin: '4px 0', fontSize: '14px' }}><strong>التاريخ:</strong> {new Date(detailOrder.order_date).toLocaleDateString('ar-EG')}</p>
                <p style={{ margin: '4px 0', fontSize: '14px' }}><strong>البائع:</strong> {detailOrder.sales_rep_name || '-'}</p>
                <p style={{ margin: '4px 0', fontSize: '14px' }}><strong>القسم:</strong> {detailOrder.department_name || '-'}</p>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '16px' }}>
              <thead><tr style={{ background: '#f3f4f6' }}>
                <th style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'right' }}>الصنف</th>
                <th style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center' }}>الكمية</th>
                <th style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center' }}>السعر</th>
                <th style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center' }}>الإجمالي</th>
              </tr></thead>
              <tbody>{detailOrder.items?.map((it, i) => (
                <tr key={i}><td style={{ padding: '10px', border: '1px solid #e5e7eb' }}>{it.item_name}</td>
                <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{it.quantity}</td>
                <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{parseFloat(it.unit_price || 0).toFixed(2)}</td>
                <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{((it.quantity || 0) * (it.unit_price || 0)).toFixed(2)}</td></tr>
              ))}</tbody>
            </table>
            <div style={{ background: '#f3f4f6', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
              <p style={{ margin: '4px 0', fontSize: '18px', fontWeight: 'bold' }}>الإجمالي: {parseFloat(detailOrder.total_amount || 0).toFixed(2)} {detailOrder.currency || 'EGP'}</p>
            </div>
            {detailOrder.notes && <div style={{ marginBottom: '16px' }}><strong>ملاحظات:</strong><p style={{ margin: '4px 0', color: '#4b5563' }}>{detailOrder.notes}</p></div>}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDetail(false)} style={{ padding: '8px 16px', borderRadius: '6px', background: '#6b7280', color: 'white', border: 'none', cursor: 'pointer' }}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, overflowY: 'auto', padding: '20px' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '1000px', maxHeight: '95vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '16px', borderBottom: '2px solid #e5e7eb', paddingBottom: '12px' }}>
              {editingId ? (activeTab === 'sales_orders' ? 'تعديل أمر البيع' : 'تعديل بيان التسليم المسعر') : (activeTab === 'sales_orders' ? 'أمر بيع جديد' : 'بيان تسليم مسعر جديد')}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>{activeTab === 'sales_orders' ? 'العميل الرئيسي *' : 'العميل الرئيسي (الهيئة) *'}</label>
                  <select required value={formData.customer_id} onChange={handleCustomerChange} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}>
                    <option value="">اختر العميل</option>
                    {mainCustomers.map(c => <option key={c.id} value={c.id}>{c.name} {c.code ? `(${c.code})` : ''}</option>)}
                  </select>
                </div>
                {(activeTab === 'delivery_quotes' || branches.length > 0) && (
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>{activeTab === 'sales_orders' ? 'الفرع (اختياري)' : 'العميل الفرعي *'}</label>
                  <select required={activeTab === 'delivery_quotes'} value={formData.customer_branch_id} onChange={e => setFormData(p => ({ ...p, customer_branch_id: e.target.value }))} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}>
                    <option value="">{activeTab === 'sales_orders' ? '— بدون فرع —' : 'اختر العميل الفرعي'}</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                )}
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>القسم</label>
                  <select value={formData.department_id} onChange={handleDepartmentChange} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}>
                    <option value="">كل الأقسام</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div><label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>التاريخ *</label>
                  <input type="date" required value={formData.order_date} onChange={handleOrderDateChange} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }} /></div>
                <div><label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>تاريخ التسليم المتوقع</label>
                  <input type="date" value={formData.delivery_date} onChange={e => setFormData(p => ({ ...p, delivery_date: e.target.value }))} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }} /></div>
                <div><label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>مسؤول البيع</label>
                  <select value={formData.sales_rep_id} onChange={e => setFormData(p => ({ ...p, sales_rep_id: e.target.value }))} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}>
                    <option value="">اختر البائع</option>{filteredEmployees.map(e => <option key={e.id} value={e.id}>{e.full_name || e.name}</option>)}
                  </select></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div><label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>العملة</label>
                  <select value={formData.currency} onChange={e => setFormData(p => ({ ...p, currency: e.target.value }))} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}>
                    <option value="EGP">جنيه مصري (EGP)</option><option value="USD">دولار (USD)</option><option value="EUR">يورو (EUR)</option>
                  </select></div>
                <div><label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>معامل التحويل</label>
                  <input type="number" step="0.000001" value={formData.exchange_rate} onChange={e => setFormData(p => ({ ...p, exchange_rate: parseFloat(e.target.value) || 1 }))} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }} /></div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>الأصناف</h3>
                  <button type="button" onClick={handleAddItem} style={{ background: '#059669', color: 'white', padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '14px' }}>+ إضافة صنف</button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', border: '1px solid #e5e7eb' }}>
                    <thead><tr style={{ background: '#f3f4f6' }}>
                      <th style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'right' }}>الصنف</th>
                      <th style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'center', minWidth: '80px' }}>الكمية</th>
                      <th style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'center', minWidth: '90px' }}>السعر</th>
                      <th style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'center', minWidth: '70px' }}>خصم %</th>
                      <th style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'center', minWidth: '80px' }}>خصم ثابت</th>
                      <th style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'center', minWidth: '90px' }}>الإجمالي</th>
                      <th style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'center', minWidth: '100px' }}>ملاحظات</th>
                      <th style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'center', minWidth: '40px' }}>حذف</th>
                    </tr></thead>
                    <tbody>{formData.items.map((it, idx) => {
                      const q = parseFloat(it.quantity) || 0, pr = parseFloat(it.unit_price) || 0;
                      const da = parseFloat(it.discount_amount) || 0, dp = parseFloat(it.discount_percent) || 0;
                      let lt = q * pr; if (da > 0) lt -= da; else if (dp > 0) lt -= (lt * dp / 100);
                      return (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #d1d5db', padding: '6px' }}>
                            <select value={it.item_id} onChange={e => handleItemChange(idx, 'item_id', e.target.value)} style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db' }}>
                              <option value="">اختر الصنف</option>{items.map(i => <option key={i.id} value={i.id}>{i.name} {i.code ? `(${i.code})` : ''}</option>)}
                            </select></td>
                          <td style={{ border: '1px solid #d1d5db', padding: '6px' }}><input type="number" min="0.01" step="0.01" value={it.quantity} onChange={e => handleItemChange(idx, 'quantity', e.target.value)} style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db', textAlign: 'center' }} /></td>
                          <td style={{ border: '1px solid #d1d5db', padding: '6px' }}><input type="number" step="0.01" value={it.unit_price} onChange={e => handleItemChange(idx, 'unit_price', e.target.value)} style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db', textAlign: 'center' }} /></td>
                          <td style={{ border: '1px solid #d1d5db', padding: '6px' }}><input type="number" step="0.01" value={it.discount_percent} onChange={e => handleItemChange(idx, 'discount_percent', e.target.value)} style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db', textAlign: 'center' }} /></td>
                          <td style={{ border: '1px solid #d1d5db', padding: '6px' }}><input type="number" step="0.01" value={it.discount_amount} onChange={e => handleItemChange(idx, 'discount_amount', e.target.value)} style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db', textAlign: 'center' }} /></td>
                          <td style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>{lt.toFixed(2)}</td>
                          <td style={{ border: '1px solid #d1d5db', padding: '6px' }}><input type="text" value={it.notes} placeholder="ملاحظات..." onChange={e => handleItemChange(idx, 'notes', e.target.value)} style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db' }} /></td>
                          <td style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'center' }}><button type="button" onClick={() => handleRemoveItem(idx)} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}>×</button></td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
              </div>
              <div style={{ background: '#f3f4f6', padding: '16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><p style={{ fontSize: '18px', fontWeight: 'bold', margin: '4px 0' }}>الإجمالي: {totals.total} {formData.currency}</p><p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0' }}>الإجمالي بالعملة المحلية: {totals.totalCurrency} EGP</p></div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>عدد الأصناف: {formData.items.length}</div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>ملاحظات عامة</label>
                <textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', minHeight: '80px' }} placeholder="أي ملاحظات إضافية..." />
              </div>
              <div style={{ display: 'flex', gap: '12px', position: 'sticky', bottom: 0, background: 'white', paddingTop: '16px', borderTop: '2px solid #e5e7eb' }}>
                <button type="submit" disabled={loading} style={{ background: '#2563eb', color: 'white', padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: 'bold', opacity: loading ? 0.6 : 1 }}>{loading ? 'جاري الحفظ...' : (editingId ? 'تحديث' : 'حفظ')}</button>
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }} style={{ background: '#6b7280', color: 'white', padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
