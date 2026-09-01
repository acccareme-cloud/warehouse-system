import { useState, useEffect } from 'react';
import api from '../services/api';

function AuthorityTrackingReport() {
  const [sheets, setSheets] = useState([]);
  const [stats, setStats] = useState({});
  const [dateRange, setDateRange] = useState({
    from_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to_date: new Date().toISOString().split('T')[0]
  });
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/customer-reports/authority-tracking?from_date=${dateRange.from_date}&to_date=${dateRange.to_date}&status=${filterStatus}`);
      setSheets(res.data.sheets || []);
      setStats(res.data.stats || {});
    } catch (err) {
      console.error('خطأ في تحميل التقرير');
    } finally {
      setLoading(false);
    }
  };

  const getTrackingStatus = (sheet) => {
    if (sheet.linked_to_platform) return { text: '🔗 مربوط بالمنصة', color: '#0d9488', step: 5 };
    if (sheet.stamped) return { text: '✅ مختوم', color: '#7c3aed', step: 4 };
    if (sheet.submitted_to_authority) return { text: '📤 مرسل للهيئة', color: '#2563eb', step: 3 };
    if (sheet.hospital_received) return { text: '🏥 مستلم من المستشفى', color: '#059669', step: 2 };
    return { text: '✏️ مسودة', color: '#6c757d', step: 1 };
  };

  const getPaymentStatus = (sheet) => {
    if (sheet.invoice_payment_status === 'paid') return { text: '✅ تم التحصيل', color: '#28a745' };
    if (sheet.invoice_payment_status === 'partial') return { text: '⚠️ تحصيل جزئي', color: '#ffc107' };
    if (sheet.deduction_certificate_status === 'received') return { text: '📋 استقطاع مستلم', color: '#17a2b8' };
    return { text: '⏳ في انتظار التحصيل', color: '#6c757d' };
  };

  const thStyle = { padding: '12px', border: '1px solid #ddd', textAlign: 'right' };
  const tdStyle = { padding: '10px', border: '1px solid #ddd', color: '#1e293b' };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
        <button onClick={() => window.location.href = '/dashboard'} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          ← رجوع
        </button>
        <h1 style={{ color: '#7c3aed', margin: 0 }}>📍 تقرير تتبع الهيئة</h1>
      </div>

      {/* Filters */}
      <div style={{ color: '#1e293b', backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '2px solid #7c3aed' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div>
            <label>من تاريخ:</label>
            <input type="date" value={dateRange.from_date} onChange={(e) => setDateRange({...dateRange, from_date: e.target.value})} style={{ width: '100%', padding: '8px' }} />
          </div>
          <div>
            <label>إلى تاريخ:</label>
            <input type="date" value={dateRange.to_date} onChange={(e) => setDateRange({...dateRange, to_date: e.target.value})} style={{ width: '100%', padding: '8px' }} />
          </div>
          <div>
            <label>حالة التتبع:</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: '100%', padding: '8px' }}>
              <option value="">الكل</option>
              <option value="draft">مسودة</option>
              <option value="linked_to_invoice">مرتبط بفاتورة</option>
            </select>
          </div>
        </div>
        <button
          onClick={fetchReport}
          disabled={loading}
          style={{
            marginTop: '15px',
            padding: '12px 40px',
            backgroundColor: loading ? '#9ca3af' : '#7c3aed',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          {loading ? '⏳ جاري التحميل...' : '🔍 عرض التقرير'}
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          <div style={{ color: '#1e293b', backgroundColor: '#f3f4f6', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <h4 style={{ color: '#374151', margin: '0 0 10px 0' }}>الإجمالي</h4>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb', margin: 0 }}>{stats.total || 0}</p>
          </div>
          <div style={{ color: '#1e293b', backgroundColor: '#fef3c7', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <h4 style={{ color: '#92400e', margin: '0 0 10px 0' }}>مسودة</h4>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#d97706', margin: 0 }}>{stats.draft || 0}</p>
          </div>
          <div style={{ color: '#1e293b', backgroundColor: '#d1fae5', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <h4 style={{ color: '#065f46', margin: '0 0 10px 0' }}>مستلم المستشفى</h4>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#059669', margin: 0 }}>{stats.hospital_received || 0}</p>
          </div>
          <div style={{ color: '#1e293b', backgroundColor: '#dbeafe', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <h4 style={{ color: '#1e40af', margin: '0 0 10px 0' }}>مرسل للهيئة</h4>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb', margin: 0 }}>{stats.submitted_to_authority || 0}</p>
          </div>
          <div style={{ color: '#1e293b', backgroundColor: '#ede9fe', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <h4 style={{ color: '#5b21b6', margin: '0 0 10px 0' }}>مختوم</h4>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c3aed', margin: 0 }}>{stats.stamped || 0}</p>
          </div>
          <div style={{ color: '#1e293b', backgroundColor: '#ccfbf1', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <h4 style={{ color: '#115e59', margin: '0 0 10px 0' }}>مربوط بالمنصة</h4>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#0d9488', margin: 0 }}>{stats.linked_to_platform || 0}</p>
          </div>
          <div style={{ color: '#1e293b', backgroundColor: '#fce7f3', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <h4 style={{ color: '#9d174d', margin: '0 0 10px 0' }}>مرتبط بفاتورة</h4>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#db2777', margin: 0 }}>{stats.linked_to_invoice || 0}</p>
          </div>
          <div style={{ color: '#1e293b', backgroundColor: '#ecfdf5', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <h4 style={{ color: '#065f46', margin: '0 0 10px 0' }}>إجمالي المبالغ</h4>
            <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#059669', margin: 0 }}>
              {(stats.total_amount || 0).toLocaleString()} ج.م
            </p>
          </div>
        </div>
      )}

      {/* Progress Tracker */}
      <div style={{ color: '#1e293b', backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '2px solid #e5e7eb', marginBottom: '20px' }}>
        <h3 style={{ color: '#374151', marginBottom: '15px' }}>📊 شريط التقدم</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '20px' }}>
          {[
            { label: 'مسودة', color: '#6c757d' },
            { label: 'المستشفى', color: '#059669' },
            { label: 'الهيئة', color: '#2563eb' },
            { label: 'الاختام', color: '#7c3aed' },
            { label: 'المنصة', color: '#0d9488' }
          ].map((step, index) => (
            <div key={index} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: step.color,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                fontWeight: 'bold',
                fontSize: '14px'
              }}>
                {index + 1}
              </div>
              <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#374151' }}>{step.label}</p>
              {index < 4 && (
                <div style={{ color: '#1e293b',
                  position: 'absolute',
                  top: '20px',
                  right: '-50%',
                  width: '100%',
                  height: '3px',
                  backgroundColor: '#e5e7eb',
                  zIndex: -1
                }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Table */}
      <h3>📋 تفاصيل بيانات التسليم ({sheets.length})</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
        <thead>
          <tr style={{ backgroundColor: '#7c3aed', color: 'white' }}>
            <th style={thStyle}>رقم البيان</th>
            <th style={thStyle}>التاريخ</th>
            <th style={thStyle}>المستشفى</th>
            <th style={thStyle}>الإجمالي</th>
            <th style={thStyle}>الخطوة الحالية</th>
            <th style={thStyle}>الفاتورة المرتبطة</th>
            <th style={thStyle}>حالة التحصيل</th>
            <th style={thStyle}>الاستقطاع</th>
          </tr>
        </thead>
        <tbody>
          {sheets.length === 0 ? (
            <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>لا يوجد بيانات</td></tr>
          ) : (
            sheets.map((s, index) => {
              const tracking = getTrackingStatus(s);
              const payment = getPaymentStatus(s);
              return (
                <tr key={s.id} style={{ backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'white' }}>
                  <td style={tdStyle}><strong>{s.sheet_number}</strong></td>
                  <td style={tdStyle}>{new Date(s.sheet_date).toLocaleDateString('ar-EG')}</td>
                  <td style={tdStyle}>{s.hospital_name}</td>
                  <td style={tdStyle}>{parseFloat(s.total_amount).toLocaleString()} ج.م</td>
                  <td style={tdStyle}>
                    <span style={{
                      color: tracking.color,
                      fontWeight: 'bold',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      backgroundColor: tracking.color + '20',
                      fontSize: '12px'
                    }}>
                      {tracking.text}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {s.linked_invoice_number ? (
                      <span style={{ color: '#2563eb', fontWeight: 'bold' }}>{s.linked_invoice_number}</span>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>غير مرتبط</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      color: payment.color,
                      fontWeight: 'bold',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      backgroundColor: payment.color + '20',
                      fontSize: '12px'
                    }}>
                      {payment.text}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {s.deduction_certificate_status === 'received' ? (
                      <span style={{ color: '#28a745' }}>✅ مستلم</span>
                    ) : (
                      <span style={{ color: '#ffc107' }}>⏳ معلق</span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default AuthorityTrackingReport;
