import { useState, useEffect } from 'react';
import api from '../services/api';

function TaxInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [pricingSheets, setPricingSheets] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [message, setMessage] = useState('');
  const [userRole, setUserRole] = useState('');

  const [formData, setFormData] = useState({
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    customer_id: '',
    customer_name: '',
    payment_due_date: '',
    notes: ''
  });

  const [invoiceItems, setInvoiceItems] = useState([{
    item_id: '',
    item_name: '',
    quantity: 1,
    unit_price: 0,
    notes: ''
  }]);

  const [selectedSheets, setSelectedSheets] = useState([]);
  const [customerTaxSettings, setCustomerTaxSettings] = useState(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserRole(user.role || '');
    fetchInvoices();
    fetchCustomers();
    fetchItems();
    fetchAvailableSheets();
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await api.get('/tax-invoices');
      setInvoices(res.data);
    } catch (err) {
      console.error('خطأ في تحميل الفواتير');
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

  const fetchAvailableSheets = async () => {
    try {
      const res = await api.get('/pricing-sheets/available-for-invoice');
      setPricingSheets(res.data);
    } catch (err) {
      console.error('خطأ في تحميل البيانات');
    }
  };

  const fetchCustomerTaxSettings = async (customerId) => {
    try {
      const res = await api.get(`/customer-tax-settings/${customerId}`);
      setCustomerTaxSettings(res.data);
    } catch (err) {
      setCustomerTaxSettings(null);
    }
  };

  const fetchNextNumber = async () => {
    try {
      const res = await api.get('/tax-invoices/next-number');
      setFormData(prev => ({...prev, invoice_number: res.data.nextNumber}));
    } catch (err) {
      console.error('خطأ في توليد الرقم');
    }
  };

  const handleShowForm = () => {
    setShowForm(true);
    fetchNextNumber();
    setFormData({
      invoice_number: '',
      invoice_date: new Date().toISOString().split('T')[0],
      customer_id: '',
      customer_name: '',
      payment_due_date: '',
      notes: ''
    });
    setInvoiceItems([{ item_id: '', item_name: '', quantity: 1, unit_price: 0, notes: '' }]);
    setSelectedSheets([]);
    setCustomerTaxSettings(null);
  };

  const addItemRow = () => {
    setInvoiceItems([...invoiceItems, { item_id: '', item_name: '', quantity: 1, unit_price: 0, notes: '' }]);
  };

  const removeItemRow = (index) => {
    if (invoiceItems.length > 1) {
      setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
    }
  };

  const updateItemRow = (index, field, value) => {
    const updated = [...invoiceItems];
    updated[index][field] = value;
    if (field === 'item_id') {
      const item = items.find(i => i.id == value);
      updated[index].item_name = item?.name || '';
    }
    setInvoiceItems(updated);
  };

  const calculateTotals = () => {
    const subtotal = invoiceItems.reduce((sum, item) => sum + (parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0)), 0);

    const hasVat = customerTaxSettings?.has_vat !== false;
    const vatRate = hasVat ? (customerTaxSettings?.vat_rate || 14) : 0;
    const vatAmount = subtotal * (vatRate / 100);

    const hasWithholding = customerTaxSettings?.has_withholding || false;
    const withholdingRate = hasWithholding ? (customerTaxSettings?.withholding_rate || 20) : 0;
    const withholdingAmount = vatAmount * (withholdingRate / 100);

    const total = subtotal + vatAmount - withholdingAmount;

    return { subtotal, vatRate, vatAmount, withholdingRate, withholdingAmount, total };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tax-invoices', {
        ...formData,
        items: invoiceItems.filter(i => i.item_id),
        pricing_sheet_ids: selectedSheets
      });
      setMessage('✅ تم إنشاء الفاتورة الضريبية بنجاح');
      setShowForm(false);
      fetchInvoices();
      fetchAvailableSheets();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const handlePayment = async (id) => {
    const paidAmount = prompt('أدخل مبلغ التحصيل:');
    if (!paidAmount) return;

    try {
      await api.put(`/tax-invoices/${id}/payment`, {
        paid_amount: parseFloat(paidAmount),
        payment_date: new Date().toISOString().split('T')[0]
      });
      setMessage('✅ تم تسجيل التحصيل بنجاح');
      fetchInvoices();
    } catch (err) {
      setMessage('❌ خطأ في التحصيل');
    }
  };

  const handlePlatformLink = async (id) => {
    const platformNumber = prompt('أدخل رقم الفاتورة في المنصة:');
    if (!platformNumber) return;

    try {
      await api.put(`/tax-invoices/${id}/platform-link`, { platform_number: platformNumber });
      setMessage('✅ تم ربط الفاتورة بالمنصة');
      fetchInvoices();
    } catch (err) {
      setMessage('❌ خطأ في الربط');
    }
  };

  const handleDeductionUpdate = async (id) => {
    const status = prompt('حالة بيان الاستقطاع (pending/received):', 'received');
    if (!status) return;

    const number = prompt('رقم بيان الاستقطاع:');
    const amount = prompt('مبلغ الاستقطاع:');

    try {
      await api.put(`/tax-invoices/${id}/deduction`, {
        status,
        certificate_number: number,
        certificate_date: new Date().toISOString().split('T')[0],
        certificate_amount: parseFloat(amount || 0)
      });
      setMessage('✅ تم تحديث بيان الاستقطاع');
      fetchInvoices();
    } catch (err) {
      setMessage('❌ خطأ في التحديث');
    }
  };

  const handleManagerApprove = async (id) => {
    try {
      await api.put(`/tax-invoices/${id}/manager-approve`);
      setMessage('✅ تم اعتماد الفاتورة من المدير');
      fetchInvoices();
    } catch (err) {
      setMessage('❌ خطأ في الاعتماد');
    }
  };

  const handleFinanceApprove = async (id) => {
    try {
      await api.put(`/tax-invoices/${id}/finance-approve`);
      setMessage('✅ تم اعتماد الفاتورة من المالية');
      fetchInvoices();
    } catch (err) {
      setMessage('❌ خطأ في الاعتماد');
    }
  };

  const getStatusText = (status) => {
    const statuses = {
      'draft': '✏️ مسودة',
      'approved_manager': '✓ مدير',
      'approved_finance': '✓ مالية',
      'posted': '✓ مرحلة'
    };
    return statuses[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      'draft': '#6c757d',
      'approved_manager': '#17a2b8',
      'approved_finance': '#28a745',
      'posted': '#0d9488'
    };
    return colors[status] || '#6c757d';
  };

  const getPaymentStatusText = (status) => {
    const statuses = {
      'unpaid': '❌ غير مدفوع',
      'partial': '⚠️ جزئي',
      'paid': '✅ مدفوع'
    };
    return statuses[status] || status;
  };

  const { subtotal, vatRate, vatAmount, withholdingRate, withholdingAmount, total } = calculateTotals();

  const thStyle = { padding: '12px', border: '1px solid #ddd', textAlign: 'right' };
  const tdStyle = { padding: '10px', border: '1px solid #ddd' };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
        <button onClick={() => window.location.href = '/dashboard'} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          ← رجوع
        </button>
        <h1 style={{ color: '#2563eb', margin: 0 }}>🧾 الفواتير الضريبية</h1>
      </div>

      {message && (
        <p style={{ padding: '12px', backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da', borderRadius: '8px', fontWeight: 'bold', marginBottom: '20px' }}>
          {message}
        </p>
      )}

      <div style={{ marginBottom: '20px' }}>
        <button onClick={handleShowForm} style={{ padding: '12px 30px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
          ➕ فاتورة ضريبية جديدة
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ color: '#1e293b', backgroundColor: '#f8f9fa', padding: '25px', borderRadius: '12px', marginBottom: '20px', border: '3px solid #2563eb' }}>
          <h3 style={{ color: '#2563eb', marginBottom: '20px' }}>➕ فاتورة ضريبية جديدة</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div>
              <label>رقم الفاتورة (تلقائي):</label>
              <input type="text" value={formData.invoice_number} readOnly style={{ color: '#1e293b', width: '100%', padding: '8px', backgroundColor: '#e2e8f0' }} />
            </div>
            <div>
              <label>تاريخ الفاتورة:</label>
              <input type="date" value={formData.invoice_date} onChange={(e) => setFormData({...formData, invoice_date: e.target.value})} required style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label>العميل:</label>
              <select value={formData.customer_id} onChange={(e) => {
                const customer = customers.find(c => c.id == e.target.value);
                setFormData({...formData, customer_id: e.target.value, customer_name: customer?.name || ''});
                fetchCustomerTaxSettings(e.target.value);
              }} required style={{ width: '100%', padding: '8px' }}>
                <option value="">اختر العميل</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>تاريخ استحقاق الدفع:</label>
              <input type="date" value={formData.payment_due_date} onChange={(e) => setFormData({...formData, payment_due_date: e.target.value})} style={{ width: '100%', padding: '8px' }} />
            </div>
          </div>

          {/* إعدادات الضرائب للعميل */}
          {customerTaxSettings && (
            <div style={{ color: '#1e293b', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '8px', border: '2px solid #ffc107', marginBottom: '20px' }}>
              <h4 style={{ color: '#856404', margin: '0 0 10px 0' }}>⚙️ إعدادات الضرائب للعميل</h4>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <span style={{ color: '#856404' }}>
                  ضريبة {customerTaxSettings.has_vat ? `${customerTaxSettings.vat_rate}%` : 'غير مطبقة'}
                </span>
                <span style={{ color: '#856404' }}>
                  استقطاع {customerTaxSettings.has_withholding ? `${customerTaxSettings.withholding_rate}% من الضريبة` : 'غير مطبق'}
                </span>
              </div>
            </div>
          )}

          {/* ربط ببيانات التسليم */}
          {pricingSheets.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: '#374151', marginBottom: '10px' }}>🔗 ربط ببيانات التسليم المسعر (اختياري)</h4>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {pricingSheets.map(sheet => (
                  <label key={sheet.id} style={{ color: '#1e293b', display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', backgroundColor: '#e0e7ff', borderRadius: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedSheets.includes(sheet.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSheets([...selectedSheets, sheet.id]);
                        } else {
                          setSelectedSheets(selectedSheets.filter(id => id !== sheet.id));
                        }
                      }}
                    />
                    <span>{sheet.sheet_number} - {sheet.hospital_name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <h4 style={{ color: '#374151', marginBottom: '10px' }}>📦 الأصناف</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
            <thead>
              <tr style={{ backgroundColor: '#2563eb', color: 'white' }}>
                <th style={thStyle}>الصنف</th>
                <th style={thStyle}>العدد</th>
                <th style={thStyle}>السعر</th>
                <th style={thStyle}>القيمة</th>
                <th style={thStyle}>ملاحظات</th>
                <th style={thStyle}>حذف</th>
              </tr>
            </thead>
            <tbody>
              {invoiceItems.map((item, index) => (
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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>ضريبة {vatRate}%:</span>
              <strong>{vatAmount.toLocaleString()} ج.م</strong>
            </div>
            {withholdingAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#dc3545' }}>
                <span>استقطاع {withholdingRate}% من الضريبة:</span>
                <strong>-{withholdingAmount.toLocaleString()} ج.م</strong>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', color: '#2563eb' }}>
              <strong>الصافي:</strong>
              <strong>{total.toLocaleString()} ج.م</strong>
            </div>
          </div>

          <div>
            <label>ملاحظات:</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} style={{ width: '100%', padding: '8px', minHeight: '60px' }} />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="submit" style={{ padding: '12px 40px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
              💾 حفظ الفاتورة
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: '12px 40px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>
              ❌ إلغاء
            </button>
          </div>
        </form>
      )}

      <h3>📋 قائمة الفواتير الضريبية ({invoices.length})</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
        <thead>
          <tr style={{ backgroundColor: '#2563eb', color: 'white' }}>
            <th style={thStyle}>رقم الفاتورة</th>
            <th style={thStyle}>التاريخ</th>
            <th style={thStyle}>العميل</th>
            <th style={thStyle}>الإجمالي</th>
            <th style={thStyle}>الضريبة</th>
            <th style={thStyle}>الاستقطاع</th>
            <th style={thStyle}>الصافي</th>
            <th style={thStyle}>الحالة</th>
            <th style={thStyle}>التحصيل</th>
            <th style={thStyle}>الاستقطاع</th>
            <th style={thStyle}>إجراء</th>
          </tr>
        </thead>
        <tbody>
          {invoices.length === 0 ? (
            <tr><td colSpan="11" style={{ textAlign: 'center', padding: '20px' }}>لا يوجد فواتير</td></tr>
          ) : (
            invoices.map(inv => (
              <tr key={inv.id} style={{ backgroundColor: inv.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                <td style={tdStyle}><strong>{inv.invoice_number}</strong></td>
                <td style={tdStyle}>{new Date(inv.invoice_date).toLocaleDateString('ar-EG')}</td>
                <td style={tdStyle}>{inv.customer_name || inv.customer_name_display}</td>
                <td style={tdStyle}>{parseFloat(inv.subtotal).toLocaleString()} ج.م</td>
                <td style={tdStyle}>{parseFloat(inv.vat_amount).toLocaleString()} ج.م</td>
                <td style={tdStyle} style={{ color: '#dc3545' }}>{parseFloat(inv.withholding_amount).toLocaleString()} ج.م</td>
                <td style={tdStyle}><strong>{parseFloat(inv.total_amount).toLocaleString()} ج.م</strong></td>
                <td style={tdStyle}>
                  <span style={{ color: getStatusColor(inv.status), fontWeight: 'bold', padding: '4px 12px', borderRadius: '12px', backgroundColor: getStatusColor(inv.status) + '20', fontSize: '12px' }}>
                    {getStatusText(inv.status)}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span style={{ fontSize: '12px' }}>
                    {getPaymentStatusText(inv.payment_status)}<br/>
                    {inv.paid_amount > 0 && <small>تم دفع: {parseFloat(inv.paid_amount).toLocaleString()} ج.م</small>}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span style={{ fontSize: '12px' }}>
                    {inv.deduction_certificate_status === 'received' ? '✅ تم الاستلام' : '⏳ معلق'}
                  </span>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {inv.status === 'draft' && ['admin'].includes(userRole) && (
                      <button onClick={() => handleManagerApprove(inv.id)} style={{ padding: '4px 8px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>✓ مدير</button>
                    )}
                    {inv.status === 'approved_manager' && ['finance', 'admin'].includes(userRole) && (
                      <button onClick={() => handleFinanceApprove(inv.id)} style={{ padding: '4px 8px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>✓ مالية</button>
                    )}
                    <button onClick={() => handlePayment(inv.id)} style={{ padding: '4px 8px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>💰 تحصيل</button>
                    <button onClick={() => handlePlatformLink(inv.id)} style={{ padding: '4px 8px', backgroundColor: '#7c3aed', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>🔗 منصة</button>
                    <button onClick={() => handleDeductionUpdate(inv.id)} style={{ padding: '4px 8px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>📋 استقطاع</button>
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

export default TaxInvoices;
