import { useState, useEffect } from 'react';
import api from '../services/api';

function FinanceDashboard() {
  const [receipts, setReceipts] = useState([]);
  const [summary, setSummary] = useState({
    total_count: 0,
    total_amount: 0,
    pending_amount: 0,
    approved_amount: 0,
    rejected_amount: 0
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchReceipts();
    fetchSummary();
  }, []);

  const fetchReceipts = async () => {
    try {
      const response = await api.get('/receipts/all');
      setReceipts(response.data);
    } catch (err) {
      console.error('خطأ في تحميل الاذونات');
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await api.get('/receipts/summary');
      setSummary(response.data);
    } catch (err) {
      console.error('خطأ في تحميل الإجماليات');
    }
  };

  const handleApprove = async (id, status) => {
    try {
      await api.put(`/receipts/${id}/approve`, { status });
      setMessage(status === 'approved' ? 'تم الاعتماد بنجاح' : 'تم الرفض بنجاح');
      fetchReceipts();
      fetchSummary();
    } catch (err) {
      setMessage('خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  // تنسيق التاريخ
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG');
  };

  // تنسيق الرقم
  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0.00';
    return parseFloat(num).toFixed(2);
  };

  const thStyle = { padding: '12px', border: '1px solid #ddd', backgroundColor: '#0d9488', color: 'white' };
  const tdStyle = { padding: '10px', border: '1px solid #ddd' };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>لوحة تحكم المدير المالي</h1>
      
      <button 
        onClick={() => window.location.href = '/dashboard'}
        style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', marginBottom: '20px', cursor: 'pointer' }}
      >
        رجوع للوحة التحكم
      </button>

      {message && <p style={{ padding: '10px', backgroundColor: message.includes('نجاح') ? '#d4edda' : '#f8d7da', borderRadius: '4px' }}>{message}</p>}

      {/* ملخص الإجماليات */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '30px' }}>
        <div style={{ color: '#1e293b', backgroundColor: '#e0f2fe', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#0369a1' }}>إجمالي الاذونات</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0369a1' }}>{summary.total_count}</div>
          <div style={{ fontSize: '16px', color: '#0369a1' }}>{formatNumber(summary.total_amount)} ج.م</div>
        </div>
        <div style={{ color: '#1e293b', backgroundColor: '#fef3c7', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#92400e' }}>بانتظار الاعتماد</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#92400e' }}>{formatNumber(summary.pending_amount)}</div>
          <div style={{ fontSize: '16px', color: '#92400e' }}>ج.م</div>
        </div>
        <div style={{ color: '#1e293b', backgroundColor: '#dcfce7', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#166534' }}>معتمد</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#166534' }}>{formatNumber(summary.approved_amount)}</div>
          <div style={{ fontSize: '16px', color: '#166534' }}>ج.م</div>
        </div>
        <div style={{ color: '#1e293b', backgroundColor: '#fee2e2', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#991b1b' }}>مرفوض</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#991b1b' }}>{formatNumber(summary.rejected_amount)}</div>
          <div style={{ fontSize: '16px', color: '#991b1b' }}>ج.م</div>
        </div>
      </div>

      <h3>جميع اذونات الاضافة</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
        <thead>
          <tr>
            <th style={thStyle}>رقم الاذن</th>
            <th style={thStyle}>التاريخ</th>
            <th style={thStyle}>المورد</th>
            <th style={thStyle}>الصنف</th>
            <th style={thStyle}>المخزن</th>
            <th style={thStyle}>الكمية</th>
            <th style={thStyle}>سعر الشراء</th>
            <th style={thStyle}>الاجمالي</th>
            <th style={thStyle}>ض.ق.م 14%</th>
            <th style={thStyle}>ض.خصم</th>
            <th style={thStyle}>الصافي</th>
            <th style={thStyle}>الحالة</th>
            <th style={thStyle}>إجراء</th>
          </tr>
        </thead>
        <tbody>
          {receipts.length === 0 ? (
            <tr><td colSpan="13" style={{ textAlign: 'center', padding: '20px' }}>لا يوجد اذونات</td></tr>
          ) : (
            receipts.map(r => (
              <tr key={r.id} style={{ backgroundColor: r.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                <td style={tdStyle}>{r.voucher_number}</td>
                <td style={tdStyle}>{formatDate(r.receipt_date)}</td>
                <td style={tdStyle}>{r.supplier}</td>
                <td style={tdStyle}>{r.item_name}</td>
                <td style={tdStyle}>{r.warehouse_name}</td>
                <td style={tdStyle}>{r.quantity}</td>
                <td style={tdStyle}>{formatNumber(r.purchase_price)} ج.م</td>
                <td style={tdStyle}>{formatNumber(r.quantity * r.purchase_price)} ج.م</td>
                <td style={tdStyle}>{formatNumber(r.tax_14_percent)} ج.م</td>
                <td style={tdStyle}>{formatNumber(r.tax_discount_amount)} ج.م</td>
                <td style={tdStyle}><strong>{formatNumber(r.total_amount)} ج.م</strong></td>
                <td style={tdStyle}>
                  {r.financial_approval_status === 'pending' && <span style={{ color: '#ffc107' }}>بانتظار الاعتماد</span>}
                  {r.financial_approval_status === 'approved' && <span style={{ color: '#28a745' }}>معتمد</span>}
                  {r.financial_approval_status === 'rejected' && <span style={{ color: '#dc3545' }}>مرفوض</span>}
                </td>
                <td style={tdStyle}>
                  {r.financial_approval_status === 'pending' && (
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button 
                        onClick={() => handleApprove(r.id, 'approved')}
                        style={{ padding: '5px 10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        اعتماد
                      </button>
                      <button 
                        onClick={() => handleApprove(r.id, 'rejected')}
                        style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        رفض
                      </button>
                    </div>
                  )}
                  {r.financial_approval_status !== 'pending' && <span>-</span>}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default FinanceDashboard;