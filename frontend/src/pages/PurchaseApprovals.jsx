import { useState, useEffect } from 'react';
import api from '../services/api';

function PurchaseApprovals() {
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState('');
  const [userRole, setUserRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : {};
    const role = user.role || '';

    setUserRole(role);

    if (['admin', 'purchasing'].includes(role)) {
      setAuthorized(true);
      fetchRequests();
    }

    setLoading(false);
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await api.get('/purchase-requests/pending');
      setRequests(response.data);
    } catch (err) {
      console.error('خطأ في تحميل الطلبات:', err);
    }
  };

  const handleApprove = async (id, status) => {
    try {
      await api.put(`/purchase-requests/${id}/approve`, { status });
      setMessage(status === 'approved' ? '✅ تم الاعتماد' : '❌ تم الرفض');
      fetchRequests();
    } catch (err) {
      setMessage('❌ خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const thStyle = { padding: '12px', border: '1px solid #ddd', textAlign: 'right' };
  const tdStyle = { padding: '10px', border: '1px solid #ddd', textAlign: 'right' };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>⏳ جاري التحميل...</h2>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>🚫 غير مصرح</h1>
        <p>هذه الشاشة للمدير والمشتريات فقط</p>
        <p>دورك: {userRole || 'غير معروف'}</p>
        <button onClick={() => window.location.href = '/dashboard'} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          رجوع للداشبورد
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', direction: 'rtl' }}>
      <h1>✅ اعتماد طلبات الشراء</h1>

      <button 
        onClick={() => window.location.href = '/dashboard'}
        style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', marginBottom: '20px', cursor: 'pointer' }}
      >
        ← رجوع للوحة التحكم
      </button>

      {message && (
        <p style={{ 
          padding: '15px', 
          backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da', 
          borderRadius: '4px',
          marginBottom: '20px',
          fontWeight: 'bold'
        }}>
          {message}
        </p>
      )}

      <h3>📋 طلبات بانتظار الاعتماد ({requests.length})</h3>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ color: '#1e293b', width: '100%', borderCollapse: 'collapse', marginTop: '10px', backgroundColor: 'white' }}>
          <thead>
            <tr style={{ backgroundColor: '#343a40', color: 'white' }}>
              <th style={thStyle}>رقم الطلب</th>
              <th style={thStyle}>التاريخ</th>
              <th style={thStyle}>القسم</th>
              <th style={thStyle}>الصنف</th>
              <th style={thStyle}>الكمية</th>
              <th style={thStyle}>طلب بواسطة</th>
              <th style={thStyle}>إجراء</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#6c757d' }}>
                  🎉 لا يوجد طلبات معلقة
                </td>
              </tr>
            ) : (
              requests.map(r => (
                <tr key={r.id} style={{ backgroundColor: r.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                  <td style={tdStyle}><strong>{r.request_number}</strong></td>
                  <td style={tdStyle}>{new Date(r.request_date).toLocaleDateString('ar-EG')}</td>
                  <td style={tdStyle}>{r.department}</td>
                  <td style={tdStyle}>{r.item_code} - {r.item_name}</td>
                  <td style={tdStyle}>{r.quantity}</td>
                  <td style={tdStyle}>{r.requested_by_name}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button 
                        onClick={() => handleApprove(r.id, 'approved')}
                        style={{ 
                          padding: '8px 20px', 
                          backgroundColor: '#28a745', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '4px', 
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 'bold'
                        }}
                      >
                        ✓ اعتماد
                      </button>
                      <button 
                        onClick={() => handleApprove(r.id, 'rejected')}
                        style={{ 
                          padding: '8px 20px', 
                          backgroundColor: '#dc3545', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '4px', 
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 'bold'
                        }}
                      >
                        ✕ رفض
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
  );
}

export default PurchaseApprovals;