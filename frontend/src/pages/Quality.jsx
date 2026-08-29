import React, { useState, useEffect } from 'react';
import api from '../services/api';

const Quality = () => {
  const [activeTab, setActiveTab] = useState('purchases');
  const [purchases, setPurchases] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [salesPending, setSalesPending] = useState([]);
  const [salesReviewed, setSalesReviewed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('');
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);

  useEffect(() => {
    fetchUserRole();
    fetchPurchases();
    fetchReceipts();
    fetchSalesPending();
    fetchSalesReviewed();
  }, []);

  const fetchUserRole = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) setUserRole(user.role);
  };

  const fetchPurchases = async () => {
    try {
      const response = await api.get('/purchases');
      setPurchases(response.data);
    } catch (err) {
      setError('فشل في تحميل فواتير المشتريات');
    } finally {
      setLoading(false);
    }
  };

  const fetchReceipts = async () => {
    try {
      const response = await api.get('/receipts');
      setReceipts(response.data);
    } catch (err) {
      setError('فشل في تحميل إذون الاستلام');
    }
  };

  // اعتماد جودة فاتورة مشتريات
  const handleQualityApprove = async (id) => {
    if (!window.confirm('هل أنت متأكد من اعتماد الجودة لهذه الفاتورة؟')) return;
    try {
      await api.put(`/purchases/${id}/quality-approve`);
      alert('تم اعتماد الجودة بنجاح');
      fetchPurchases();
    } catch (err) {
      alert('فشل في اعتماد الجودة: ' + (err.response?.data?.message || err.message));
    }
  };

  // رفض جودة فاتورة مشتريات
  const handleQualityReject = async (id) => {
    if (!window.confirm('هل أنت متأكد من رفض الجودة لهذه الفاتورة؟')) return;
    try {
      await api.put(`/purchases/${id}/quality-reject`);
      alert('تم رفض الجودة بنجاح');
      fetchPurchases();
    } catch (err) {
      alert('فشل في رفض الجودة: ' + (err.response?.data?.message || err.message));
    }
  };

  // استعراض فاتورة مشتريات
  const handleView = async (purchase) => {
    try {
      const response = await api.get(`/purchases/${purchase.id}/items`);
      setSelectedPurchase({
        ...purchase,
        items: response.data || []
      });
      setShowViewModal(true);
    } catch (err) {
      setSelectedPurchase(purchase);
      setShowViewModal(true);
    }
  };

  // فحص جودة إذن استلام
  const handleReceiptQualityCheck = async (id) => {
    if (!window.confirm('هل أنت متأكد من اعتماد جودة إذن الاستلام؟')) return;
    try {
      await api.put(`/receipts/${id}/quality-check`);
      alert('تم اعتماد جودة إذن الاستلام بنجاح');
      fetchReceipts();
    } catch (err) {
      alert('فشل في اعتماد الجودة: ' + (err.response?.data?.message || err.message));
    }
  };

  // ===== فواتير المبيعات — جودة =====
  const fetchSalesPending = async () => {
    try {
      const res = await api.get('/sales-invoices/pending-quality');
      setSalesPending(res.data || []);
    } catch (err) { console.error('خطأ في تحميل فواتير المبيعات المعلقة'); }
  };

  const fetchSalesReviewed = async () => {
    try {
      const res = await api.get('/sales-invoices/quality-approved');
      setSalesReviewed(res.data || []);
    } catch (err) { console.error('خطأ في تحميل الفواتير المعتمدة'); }
  };

  // اعتماد جودة فاتورة مبيعات
  const handleSalesQualityApprove = async (id) => {
    if (!window.confirm('اعتماد الجودة لهذه الفاتورة؟')) return;
    try {
      await api.put(`/sales-invoices/${id}/quality-approve`);
      alert('✅ تم اعتماد الجودة');
      fetchSalesPending();
      fetchSalesReviewed();
    } catch (err) {
      alert('❌ فشل: ' + (err.response?.data?.message || err.message));
    }
  };

  // رفض جودة فاتورة مبيعات — بسبب الرفض
  const handleSalesQualityReject = async (id) => {
    const reason = window.prompt('سبب الرفض (إجباري):');
    if (!reason || !reason.trim()) { if (reason !== null) alert('❌ لازم تكتب سبب الرفض'); return; }
    try {
      await api.put(`/sales-invoices/${id}/quality-reject`, { rejection_reason: reason.trim() });
      alert('✅ تم رفض الفاتورة وتسجيل السبب');
      fetchSalesPending();
      fetchSalesReviewed();
    } catch (err) {
      alert('❌ فشل: ' + (err.response?.data?.message || err.message));
    }
  };

  const getInvoiceItems = (inv) => (Array.isArray(inv.items) && inv.items.length > 0)
    ? inv.items
    : [{ item_name: inv.item_name, quantity: inv.quantity, warehouse_name: inv.warehouse_name, serial_numbers: inv.serial_numbers, has_serial: inv.has_serial }];

  const getStatusText = (status) => {
    const statusMap = {
      'draft': 'مسودة',
      'pending': 'بانتظار المراجعة',
      'approved': 'معتمد',
      'rejected': 'مرفوض',
      'quality_approved': 'معتمد جودة',
      'quality_rejected': 'مرفوض جودة',
      'quality_passed': '✓ تم الفحص',
      'warehouse_received': '🏭 تم استلام المخزن',
      'posted': '✅ تم الترحيل'
    };
    return statusMap[status] || status;
  };

  const getStatusStyle = (status) => {
    const colors = {
      'draft': '#6c757d',
      'pending': '#ffc107',
      'approved': '#28a745',
      'rejected': '#dc3545',
      'quality_approved': '#17a2b8',
      'quality_rejected': '#dc3545',
      'quality_passed': '#20c997',
      'warehouse_received': '#fd7e14',
      'posted': '#28a745'
    };
    return {
      padding: '4px 8px',
      borderRadius: '4px',
      backgroundColor: colors[status] || '#6c757d',
      color: 'white',
      fontSize: '12px',
      display: 'inline-block'
    };
  };

  const thStyle = {
    padding: '12px',
    textAlign: 'right',
    borderBottom: '2px solid #92400e',
    backgroundColor: '#92400e',
    color: 'white',
    fontWeight: 'bold'
  };

  const tdStyle = {
    padding: '12px',
    borderBottom: '1px solid #e5e7eb',
    textAlign: 'right'
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}>جاري التحميل...</div>;

  return (
    <div style={{ padding: '20px', direction: 'rtl' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ color: '#92400e', margin: 0 }}>🔍 الجودة</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => window.location.href = '/warehouse-module'}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: '#6c757d', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🏭 المخازن
          </button>
          <button 
            onClick={() => window.location.href = '/dashboard'}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: '#92400e', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🏠 الرئيسية
          </button>
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '10px', borderRadius: '4px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('pending')}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderBottom: activeTab === 'pending' ? '3px solid #92400e' : 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            fontWeight: activeTab === 'pending' ? 'bold' : 'normal',
            color: activeTab === 'pending' ? '#92400e' : '#666'
          }}
        >
          ⏳ بانتظار الجودة
        </button>
        <button
          onClick={() => setActiveTab('checked')}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderBottom: activeTab === 'checked' ? '3px solid #92400e' : 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            fontWeight: activeTab === 'checked' ? 'bold' : 'normal',
            color: activeTab === 'checked' ? '#92400e' : '#666'
          }}
        >
          ✓ تم الفحص
        </button>
        <button
          onClick={() => setActiveTab('warehouse')}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderBottom: activeTab === 'warehouse' ? '3px solid #92400e' : 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            fontWeight: activeTab === 'warehouse' ? 'bold' : 'normal',
            color: activeTab === 'warehouse' ? '#92400e' : '#666'
          }}
        >
          🏭 في انتظار المخزن
        </button>
        <button
          onClick={() => setActiveTab('received')}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderBottom: activeTab === 'received' ? '3px solid #92400e' : 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            fontWeight: activeTab === 'received' ? 'bold' : 'normal',
            color: activeTab === 'received' ? '#92400e' : '#666'
          }}
        >
          ✅ تم الاستلام
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderBottom: activeTab === 'sales' ? '3px solid #2563eb' : 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            fontWeight: activeTab === 'sales' ? 'bold' : 'normal',
            color: activeTab === 'sales' ? '#2563eb' : '#666'
          }}
        >
          🧾 فواتير المبيعات ({salesPending.length})
        </button>
      </div>

      {/* بانتظار الجودة */}
      {activeTab === 'pending' && (
        <div>
          <h2 style={{ marginBottom: '15px' }}>⏳ فواتير بانتظار فحص الجودة</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>رقم الفاتورة</th>
                  <th style={thStyle}>المورد</th>
                  <th style={thStyle}>الصنف</th>
                  <th style={thStyle}>الكمية</th>
                  <th style={thStyle}>الإجمالي</th>
                  <th style={thStyle}>الحالة</th>
                  <th style={thStyle}>التاريخ</th>
                  <th style={thStyle}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {purchases.filter(p => p.status === 'approved').length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                      لا توجد فواتير بانتظار فحص الجودة
                    </td>
                  </tr>
                ) : (
                  purchases.filter(p => p.status === 'approved').map((p, index) => (
                    <tr key={p.id} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                      <td style={tdStyle}>{index + 1}</td>
                      <td style={tdStyle}>{p.purchase_number}</td>
                      <td style={tdStyle}>{p.supplier}</td>
                      <td style={tdStyle}>{p.item_name}</td>
                      <td style={tdStyle}>{p.quantity} {p.unit}</td>
                      <td style={tdStyle}>{p.total_amount} ج.م</td>
                      <td style={tdStyle}><span style={getStatusStyle(p.status)}>{getStatusText(p.status)}</span></td>
                      <td style={tdStyle}>{new Date(p.created_at).toLocaleDateString('ar-EG')}</td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          <button 
                            onClick={() => handleView(p)}
                            style={{ padding: '5px 10px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                          >
                            👁️ استعراض
                          </button>
                          {['quality', 'admin'].includes(userRole) && (
                            <>
                              <button onClick={() => handleQualityApprove(p.id)} style={{ padding: '5px 10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✓ اعتماد</button>
                              <button onClick={() => handleQualityReject(p.id)} style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✕ رفض</button>
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
        </div>
      )}

      {/* تم الفحص */}
      {activeTab === 'checked' && (
        <div>
          <h2 style={{ marginBottom: '15px' }}>✓ فواتير تم فحصها من الجودة</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>رقم الفاتورة</th>
                  <th style={thStyle}>المورد</th>
                  <th style={thStyle}>الصنف</th>
                  <th style={thStyle}>الكمية</th>
                  <th style={thStyle}>الإجمالي</th>
                  <th style={thStyle}>الحالة</th>
                  <th style={thStyle}>التاريخ</th>
                  <th style={thStyle}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {purchases.filter(p => p.status === 'quality_passed' || p.status === 'quality_rejected').length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                      لا توجد فواتير تم فحصها
                    </td>
                  </tr>
                ) : (
                  purchases.filter(p => p.status === 'quality_passed' || p.status === 'quality_rejected').map((p, index) => (
                    <tr key={p.id} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                      <td style={tdStyle}>{index + 1}</td>
                      <td style={tdStyle}>{p.purchase_number}</td>
                      <td style={tdStyle}>{p.supplier}</td>
                      <td style={tdStyle}>{p.item_name}</td>
                      <td style={tdStyle}>{p.quantity} {p.unit}</td>
                      <td style={tdStyle}>{p.total_amount} ج.م</td>
                      <td style={tdStyle}><span style={getStatusStyle(p.status)}>{getStatusText(p.status)}</span></td>
                      <td style={tdStyle}>{new Date(p.created_at).toLocaleDateString('ar-EG')}</td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          <button 
                            onClick={() => handleView(p)}
                            style={{ padding: '5px 10px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                          >
                            👁️ استعراض
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* في انتظار المخزن */}
      {activeTab === 'warehouse' && (
        <div>
          <h2 style={{ marginBottom: '15px' }}>🏭 فواتير في انتظار استلام المخزن</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>رقم الفاتورة</th>
                  <th style={thStyle}>المورد</th>
                  <th style={thStyle}>الصنف</th>
                  <th style={thStyle}>الكمية</th>
                  <th style={thStyle}>الإجمالي</th>
                  <th style={thStyle}>الحالة</th>
                  <th style={thStyle}>التاريخ</th>
                  <th style={thStyle}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {purchases.filter(p => p.status === 'quality_passed').length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                      لا توجد فواتير في انتظار المخزن
                    </td>
                  </tr>
                ) : (
                  purchases.filter(p => p.status === 'quality_passed').map((p, index) => (
                    <tr key={p.id} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                      <td style={tdStyle}>{index + 1}</td>
                      <td style={tdStyle}>{p.purchase_number}</td>
                      <td style={tdStyle}>{p.supplier}</td>
                      <td style={tdStyle}>{p.item_name}</td>
                      <td style={tdStyle}>{p.quantity} {p.unit}</td>
                      <td style={tdStyle}>{p.total_amount} ج.م</td>
                      <td style={tdStyle}><span style={getStatusStyle(p.status)}>{getStatusText(p.status)}</span></td>
                      <td style={tdStyle}>{new Date(p.created_at).toLocaleDateString('ar-EG')}</td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          <button 
                            onClick={() => handleView(p)}
                            style={{ padding: '5px 10px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                          >
                            👁️ استعراض
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* تم الاستلام */}
      {activeTab === 'received' && (
        <div>
          <h2 style={{ marginBottom: '15px' }}>✅ فواتير تم استلامها</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>رقم الفاتورة</th>
                  <th style={thStyle}>المورد</th>
                  <th style={thStyle}>الصنف</th>
                  <th style={thStyle}>الكمية</th>
                  <th style={thStyle}>الإجمالي</th>
                  <th style={thStyle}>الحالة</th>
                  <th style={thStyle}>التاريخ</th>
                  <th style={thStyle}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {purchases.filter(p => p.status === 'warehouse_received' || p.status === 'posted').length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                      لا توجد فواتير تم استلامها
                    </td>
                  </tr>
                ) : (
                  purchases.filter(p => p.status === 'warehouse_received' || p.status === 'posted').map((p, index) => (
                    <tr key={p.id} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                      <td style={tdStyle}>{index + 1}</td>
                      <td style={tdStyle}>{p.purchase_number}</td>
                      <td style={tdStyle}>{p.supplier}</td>
                      <td style={tdStyle}>{p.item_name}</td>
                      <td style={tdStyle}>{p.quantity} {p.unit}</td>
                      <td style={tdStyle}>{p.total_amount} ج.م</td>
                      <td style={tdStyle}><span style={getStatusStyle(p.status)}>{getStatusText(p.status)}</span></td>
                      <td style={tdStyle}>{new Date(p.created_at).toLocaleDateString('ar-EG')}</td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          <button 
                            onClick={() => handleView(p)}
                            style={{ padding: '5px 10px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                          >
                            👁️ استعراض
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}



      {/* 🧾 فواتير المبيعات — جودة */}
      {activeTab === 'sales' && (
        <div>
          <h2 style={{ marginBottom: '10px', color: '#2563eb' }}>🧾 فواتير مبيعات بانتظار فحص الجودة</h2>
          <p style={{ color: '#6c757d', marginBottom: '15px' }}>
            💡 الفواتير اللي وصلها إذن تسليم بتظهر هنا — اعتماد أو رفض بسبب. المرفوضة ممكن يعاد فحصها.
          </p>
          {salesPending.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>لا توجد فواتير بانتظار الجودة</p>
          ) : (
            salesPending.map(inv => {
              const invItems = getInvoiceItems(inv);
              const isRejected = inv.status === 'quality_rejected';
              return (
                <div key={inv.id} style={{ background: 'white', border: `2px solid ${isRejected ? '#dc3545' : '#e2e8f0'}`, borderRadius: '10px', padding: '15px', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                    <div>
                      <strong style={{ fontSize: '16px' }}>🧾 {inv.invoice_number}</strong>
                      <span style={{ marginRight: '10px', color: '#475569' }}>👤 {inv.customer_name_display || inv.customer_name}</span>
                      <span style={{ marginRight: '10px', color: '#64748b', fontSize: '13px' }}>{inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('ar-EG') : ''}</span>
                    </div>
                    <span style={{
                      padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold',
                      backgroundColor: isRejected ? '#f8d7da' : '#fff3cd',
                      color: isRejected ? '#dc3545' : '#856404'
                    }}>
                      {isRejected ? '✕ مرفوضة — بإعادة الفحص' : '⏳ بانتظار الجودة'}
                    </span>
                  </div>

                  {isRejected && inv.quality_rejection_reason && (
                    <div style={{ padding: '10px', background: '#f8d7da', borderRadius: '6px', marginBottom: '10px', color: '#721c24', fontSize: '14px' }}>
                      <strong>سبب الرفض السابق:</strong> {inv.quality_rejection_reason}
                    </div>
                  )}

                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#2563eb', color: 'white' }}>
                        <th style={{ padding: '8px', border: '1px solid #ddd' }}>الصنف</th>
                        <th style={{ padding: '8px', border: '1px solid #ddd' }}>الكمية</th>
                        <th style={{ padding: '8px', border: '1px solid #ddd' }}>المخزن</th>
                        <th style={{ padding: '8px', border: '1px solid #ddd' }}>السريالات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invItems.map((it, i) => (
                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                          <td style={{ padding: '8px', border: '1px solid #ddd' }}>{it.item_name || '-'} {it.has_serial ? '🔢' : ''}</td>
                          <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}><strong>{it.quantity}</strong></td>
                          <td style={{ padding: '8px', border: '1px solid #ddd' }}>{it.warehouse_name || '-'}</td>
                          <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                            {Array.isArray(it.serial_numbers) && it.serial_numbers.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                {it.serial_numbers.map((s, si) => (
                                  <code key={si} style={{ background: '#ede9fe', color: '#6d28d9', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{s}</code>
                                ))}
                              </div>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {['quality', 'admin', 'manager'].includes(userRole) && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => handleSalesQualityApprove(inv.id)} style={{ padding: '8px 25px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                        ✓ اعتماد الجودة
                      </button>
                      <button onClick={() => handleSalesQualityReject(inv.id)} style={{ padding: '8px 25px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                        ✕ رفض بسبب
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}

          <h3 style={{ marginTop: '30px', marginBottom: '10px', color: '#16a34a' }}>✅ فواتير اجتازت الجودة ({salesReviewed.length})</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <thead>
                <tr>
                  <th style={thStyle}>رقم الفاتورة</th>
                  <th style={thStyle}>العميل</th>
                  <th style={thStyle}>الأصناف</th>
                  <th style={thStyle}>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {salesReviewed.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>لا توجد فواتير معتمدة من الجودة</td></tr>
                ) : (
                  salesReviewed.map(inv => (
                    <tr key={inv.id}>
                      <td style={tdStyle}><strong>{inv.invoice_number}</strong></td>
                      <td style={tdStyle}>{inv.customer_name_display || inv.customer_name}</td>
                      <td style={{ ...tdStyle, fontSize: '13px' }}>
                        {getInvoiceItems(inv).map((it, i) => (
                          <div key={i}>{it.item_name} <strong>({it.quantity})</strong></div>
                        ))}
                      </td>
                      <td style={tdStyle}><span style={getStatusStyle(inv.status)}>{inv.status === 'quality_approved' ? '✓ جودة معتمدة' : getStatusText(inv.status)}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedPurchase && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setShowViewModal(false)}>
          <div style={{
            backgroundColor: 'white', borderRadius: '8px', padding: '30px',
            maxWidth: '800px', width: '90%', maxHeight: '90vh', overflow: 'auto',
            direction: 'rtl'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>👁️ تفاصيل الفاتورة</h2>
              <button 
                onClick={() => setShowViewModal(false)}
                style={{ padding: '5px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                ✕ إغلاق
              </button>
            </div>

            {/* معلومات الفاتورة */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <div><strong>رقم الفاتورة:</strong> {selectedPurchase.purchase_number}</div>
              <div><strong>التاريخ:</strong> {new Date(selectedPurchase.created_at).toLocaleDateString('ar-EG')}</div>
              <div><strong>المورد:</strong> {selectedPurchase.supplier}</div>
              <div><strong>المخزن:</strong> {selectedPurchase.warehouse_name || '-'}</div>
              <div><strong>الحالة:</strong> {getStatusText(selectedPurchase.status)}</div>
            </div>

            {/* جدول الأصناف */}
            <h3 style={{ marginBottom: '15px' }}>📋 الأصناف</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <thead>
                <tr style={{ backgroundColor: '#92400e', color: 'white' }}>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>الصنف</th>
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
                      <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{item.unit}</td>
                      <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{item.unit_price} ج.م</td>
                      <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{item.total_amount} ج.م</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>
                      {selectedPurchase.item_name} - {selectedPurchase.quantity} {selectedPurchase.unit}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* ملخص الفاتورة */}
            <div style={{ backgroundColor: '#e2e8f0', padding: '15px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>الإجمالي:</span>
                <strong>{selectedPurchase.total_amount} ج.م</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>ضريبة 14%:</span>
                <span>{selectedPurchase.tax_14_percent} ج.م</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #333', paddingTop: '8px' }}>
                <strong>الصافي:</strong>
                <strong style={{ color: '#28a745', fontSize: '18px' }}>{selectedPurchase.net_amount} ج.م</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quality;
