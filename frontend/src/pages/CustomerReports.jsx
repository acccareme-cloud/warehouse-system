import { useState, useEffect } from 'react';
import api from '../services/api';

function CustomerReports() {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [reportType, setReportType] = useState('statement'); // تغيير الـ default
  const [dateRange, setDateRange] = useState({
    from_date: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    to_date: new Date().toISOString().split('T')[0]
  });
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/customers');
      setCustomers(res.data);
    } catch (err) {
      console.error('خطأ في تحميل العملاء:', err);
      setError('فشل في تحميل قائمة العملاء');
    }
  };

  const generateReport = async () => {
    setLoading(true);
    setError(null);
    setReportData(null);

    try {
      let res;
      switch (reportType) {
        case 'statement': // ✅ بدل ledger
          if (!selectedCustomer) {
            setError('اختر عميل أولاً');
            setLoading(false);
            return;
          }
          res = await api.get(`/customer-reports/statement/${selectedCustomer}`, {
            params: {
              from_date: dateRange.from_date,
              to_date: dateRange.to_date
            }
          });
          break;

        case 'balance': // ✅ بدل balances
          res = await api.get('/customer-reports/balance', {
            params: {
              from_date: dateRange.from_date,
              to_date: dateRange.to_date
            }
          });
          break;

        case 'sales-by-customer': // ✅ بدل sales
          res = await api.get('/customer-reports/sales-by-customer', {
            params: {
              from_date: dateRange.from_date,
              to_date: dateRange.to_date
            }
          });
          break;

        case 'hierarchy': // ✅ جديد
          res = await api.get('/customer-reports/hierarchy');
          break;

        case 'aging': // ✅ جديد
          res = await api.get('/customer-reports/aging');
          break;

        default:
          setError('نوع التقرير غير معروف');
          setLoading(false);
          return;
      }
      setReportData(res.data);
    } catch (err) {
      console.error('خطأ في توليد التقرير:', err);
      setError(err.response?.data?.error || 'فشل في توليد التقرير');
    } finally {
      setLoading(false);
    }
  };

  const thStyle = { padding: '12px', border: '1px solid #ddd', textAlign: 'right' };
  const tdStyle = { padding: '10px', border: '1px solid #ddd', color: '#1e293b' };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
        <button onClick={() => window.location.href = '/dashboard'} 
          style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          ← رجوع
        </button>
        <h1 style={{ color: '#2563eb', margin: 0 }}>📊 تقارير العملاء</h1>
      </div>

      {error && (
        <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Filters */}
      <div style={{ color: '#1e293b', backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '2px solid #2563eb' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div>
            <label>نوع التقرير:</label>
            <select value={reportType} onChange={(e) => {
              setReportType(e.target.value);
              setReportData(null);
              setError(null);
            }} style={{ width: '100%', padding: '8px' }}>
              <option value="statement">📋 كشف حساب عميل</option>
              <option value="balance">💰 أرصدة العملاء</option>
              <option value="sales-by-customer">📈 مبيعات العملاء</option>
              <option value="hierarchy">🏢 تقرير الهيئات والفروع</option>
              <option value="aging">⏰ تقرير تقادم الديون</option>
            </select>
          </div>

          {reportType === 'statement' && (
            <div>
              <label>العميل:</label>
              <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)} style={{ width: '100%', padding: '8px' }}>
                <option value="">اختر العميل</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>
          )}

          {reportType !== 'hierarchy' && reportType !== 'aging' && (
            <>
              <div>
                <label>من تاريخ:</label>
                <input type="date" value={dateRange.from_date} 
                  onChange={(e) => setDateRange({...dateRange, from_date: e.target.value})} 
                  style={{ width: '100%', padding: '8px' }} />
              </div>
              <div>
                <label>إلى تاريخ:</label>
                <input type="date" value={dateRange.to_date} 
                  onChange={(e) => setDateRange({...dateRange, to_date: e.target.value})} 
                  style={{ width: '100%', padding: '8px' }} />
              </div>
            </>
          )}
        </div>

        <button
          onClick={generateReport}
          disabled={loading || (reportType === 'statement' && !selectedCustomer)}
          style={{
            marginTop: '15px',
            padding: '12px 40px',
            backgroundColor: loading ? '#9ca3af' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          {loading ? '⏳ جاري التحميل...' : '📊 عرض التقرير'}
        </button>
      </div>

      {/* ==================== STATEMENT REPORT ==================== */}
      {reportData && reportType === 'statement' && (
        <div style={{ color: '#1e293b', backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '2px solid #e5e7eb' }}>
          <h3 style={{ color: '#2563eb', marginBottom: '15px' }}>
            📋 كشف حساب: {reportData.customer?.name}
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '15px' }}>
            الفترة: {new Date(dateRange.from_date).toLocaleDateString('ar-EG')} إلى {new Date(dateRange.to_date).toLocaleDateString('ar-EG')}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px' }}>
            <div style={{ color: '#1e293b', backgroundColor: '#f0f9ff', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <h4 style={{ color: '#0284c7', margin: '0 0 10px 0' }}>إجمالي مدين</h4>
              <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#0284c7', margin: 0 }}>
                {parseFloat(reportData.summary?.total_debit || 0).toLocaleString()} ج.م
              </p>
            </div>
            <div style={{ color: '#1e293b', backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <h4 style={{ color: '#059669', margin: '0 0 10px 0' }}>إجمالي دائن</h4>
              <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#059669', margin: 0 }}>
                {parseFloat(reportData.summary?.total_credit || 0).toLocaleString()} ج.م
              </p>
            </div>
            <div style={{ color: '#1e293b', backgroundColor: '#fef3c7', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <h4 style={{ color: '#d97706', margin: '0 0 10px 0' }}>الرصيد النهائي</h4>
              <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#d97706', margin: 0 }}>
                {parseFloat(reportData.final_balance || 0).toLocaleString()} ج.م
              </p>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#2563eb', color: 'white' }}>
                <th style={thStyle}>التاريخ</th>
                <th style={thStyle}>نوع الحركة</th>
                <th style={thStyle}>البيان</th>
                <th style={thStyle}>المرجع</th>
                <th style={thStyle}>المبلغ</th>
                <th style={thStyle}>الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {reportData.transactions?.map((t, index) => (
                <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'white' }}>
                  <td style={tdStyle}>{new Date(t.transaction_date).toLocaleDateString('ar-EG')}</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: t.transaction_type === 'debit' ? '#dcfce7' : '#fee2e2',
                      color: t.transaction_type === 'debit' ? '#166534' : '#991b1b'
                    }}>
                      {t.transaction_type === 'debit' ? 'مدين' : 'دائن'}
                    </span>
                  </td>
                  <td style={tdStyle}>{t.description || '-'}</td>
                  <td style={tdStyle}>{t.reference_number || t.invoice_number || '-'}</td>
                  <td style={tdStyle}><strong>{parseFloat(t.amount).toLocaleString()} ج.م</strong></td>
                  <td style={tdStyle}><strong>{parseFloat(t.balance).toLocaleString()} ج.م</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ==================== BALANCE REPORT ==================== */}
      {reportData && reportType === 'balance' && (
        <div style={{ color: '#1e293b', backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '2px solid #e5e7eb' }}>
          <h3 style={{ color: '#2563eb', marginBottom: '15px' }}>💰 أرصدة العملاء</h3>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#2563eb', color: 'white' }}>
                <th style={thStyle}>الكود</th>
                <th style={thStyle}>العميل</th>
                <th style={thStyle}>النوع</th>
                <th style={thStyle}>الرصيد</th>
                <th style={thStyle}>إجمالي المبيعات</th>
                <th style={thStyle}>عدد الفواتير</th>
                <th style={thStyle}>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((c, index) => (
                <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'white' }}>
                  <td style={tdStyle}><strong>{c.code}</strong></td>
                  <td style={tdStyle}>{c.name}</td>
                  <td style={tdStyle}>{c.customer_type === 'authority' ? 'هيئة' : c.customer_type === 'branch' ? 'فرع' : 'عميل'}</td>
                  <td style={tdStyle}>
                    <strong style={{ color: parseFloat(c.balance) >= 0 ? '#059669' : '#dc2626' }}>
                      {parseFloat(c.balance).toLocaleString()} ج.م
                    </strong>
                  </td>
                  <td style={tdStyle}>{parseFloat(c.total_sales).toLocaleString()} ج.م</td>
                  <td style={tdStyle}>{c.invoices_count}</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: c.status === 'active' ? '#dcfce7' : '#fee2e2',
                      color: c.status === 'active' ? '#166534' : '#991b1b'
                    }}>
                      {c.status === 'active' ? 'نشط' : 'غير نشط'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ==================== SALES BY CUSTOMER REPORT ==================== */}
      {reportData && reportType === 'sales-by-customer' && (
        <div style={{ color: '#1e293b', backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '2px solid #e5e7eb' }}>
          <h3 style={{ color: '#2563eb', marginBottom: '15px' }}>📈 مبيعات العملاء</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '20px' }}>
            <div style={{ color: '#1e293b', backgroundColor: '#f0f9ff', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <h4 style={{ color: '#0284c7', margin: '0 0 10px 0' }}>إجمالي الفواتير</h4>
              <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#0284c7', margin: 0 }}>
                {reportData.reduce((sum, c) => sum + parseFloat(c.invoices_count || 0), 0).toLocaleString()}
              </p>
            </div>
            <div style={{ color: '#1e293b', backgroundColor: '#fef3c7', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <h4 style={{ color: '#d97706', margin: '0 0 10px 0' }}>إجمالي المبيعات</h4>
              <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#d97706', margin: 0 }}>
                {reportData.reduce((sum, c) => sum + parseFloat(c.total_amount || 0), 0).toLocaleString()} ج.م
              </p>
            </div>
            <div style={{ color: '#1e293b', backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <h4 style={{ color: '#059669', margin: '0 0 10px 0' }}>إجمالي المدفوع</h4>
              <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#059669', margin: 0 }}>
                {reportData.reduce((sum, c) => sum + parseFloat(c.total_paid || 0), 0).toLocaleString()} ج.م
              </p>
            </div>
            <div style={{ color: '#1e293b', backgroundColor: '#fef2f2', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <h4 style={{ color: '#dc2626', margin: '0 0 10px 0' }}>إجمالي المتبقي</h4>
              <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#dc2626', margin: 0 }}>
                {reportData.reduce((sum, c) => sum + parseFloat(c.total_remaining || 0), 0).toLocaleString()} ج.م
              </p>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#2563eb', color: 'white' }}>
                <th style={thStyle}>الكود</th>
                <th style={thStyle}>العميل</th>
                <th style={thStyle}>النوع</th>
                <th style={thStyle}>عدد الفواتير</th>
                <th style={thStyle}>الإجمالي</th>
                <th style={thStyle}>المدفوع</th>
                <th style={thStyle}>المتبقي</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((c, index) => (
                <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'white' }}>
                  <td style={tdStyle}><strong>{c.code}</strong></td>
                  <td style={tdStyle}>{c.name}</td>
                  <td style={tdStyle}>{c.customer_type === 'authority' ? 'هيئة' : c.customer_type === 'branch' ? 'فرع' : 'عميل'}</td>
                  <td style={tdStyle}>{c.invoices_count}</td>
                  <td style={tdStyle}>
                    <strong style={{ color: '#2563eb' }}>
                      {parseFloat(c.total_amount || 0).toLocaleString()} ج.م
                    </strong>
                  </td>
                  <td style={tdStyle} style={{ color: '#059669' }}>{parseFloat(c.total_paid || 0).toLocaleString()} ج.م</td>
                  <td style={tdStyle} style={{ color: '#dc2626', fontWeight: 'bold' }}>{parseFloat(c.total_remaining || 0).toLocaleString()} ج.م</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ==================== HIERARCHY REPORT ==================== */}
      {reportData && reportType === 'hierarchy' && (
        <div style={{ color: '#1e293b', backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '2px solid #e5e7eb' }}>
          <h3 style={{ color: '#2563eb', marginBottom: '15px' }}>🏢 تقرير الهيئات والفروع</h3>

          {reportData.map((auth, index) => (
            <div key={index} style={{ marginBottom: '20px', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#1e40af', color: 'white', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0 }}>🏛️ {auth.name}</h4>
                  <p style={{ margin: '5px 0 0 0', fontSize: '14px', opacity: 0.9 }}>الكود: {auth.code} | الرقم الضريبي: {auth.tax_number || '-'}</p>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{parseFloat(auth.total_sales).toLocaleString()} ج.م</p>
                  <p style={{ margin: '5px 0 0 0', fontSize: '12px' }}>إجمالي المبيعات</p>
                </div>
              </div>

              {auth.children?.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: '#1e293b', backgroundColor: '#dbeafe' }}>
                      <th style={{ ...thStyle, color: '#1e40af' }}>الكود</th>
                      <th style={{ ...thStyle, color: '#1e40af' }}>الفرع</th>
                      <th style={{ ...thStyle, color: '#1e40af' }}>المبيعات</th>
                      <th style={{ ...thStyle, color: '#1e40af' }}>الرصيد</th>
                      <th style={{ ...thStyle, color: '#1e40af' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auth.children.map((child, idx) => (
                      <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#f8f9fa' : 'white' }}>
                        <td style={tdStyle}><strong>{child.code}</strong></td>
                        <td style={tdStyle}>{child.name}</td>
                        <td style={tdStyle}>{parseFloat(child.total_sales).toLocaleString()} ج.م</td>
                        <td style={tdStyle}>{parseFloat(child.balance).toLocaleString()} ج.م</td>
                        <td style={tdStyle}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: child.status === 'active' ? '#dcfce7' : '#fee2e2',
                            color: child.status === 'active' ? '#166534' : '#991b1b'
                          }}>
                            {child.status === 'active' ? 'نشط' : 'غير نشط'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {auth.children?.length === 0 && (
                <p style={{ padding: '15px', textAlign: 'center', color: '#6b7280' }}>لا يوجد فروع لهذه الهيئة</p>
              )}

              <div style={{ color: '#1e293b', backgroundColor: '#f8f9fa', padding: '10px 15px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
                <span>👥 عدد الفروع: <strong>{auth.children_count}</strong></span>
                <span>📊 مبيعات الفروع: <strong>{parseFloat(auth.children_sales).toLocaleString()} ج.م</strong></span>
                <span>💰 رصيد الفروع: <strong>{parseFloat(auth.children_balance).toLocaleString()} ج.م</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================== AGING REPORT ==================== */}
      {reportData && reportType === 'aging' && (
        <div style={{ color: '#1e293b', backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '2px solid #e5e7eb' }}>
          <h3 style={{ color: '#2563eb', marginBottom: '15px' }}>⏰ تقرير تقادم الديون</h3>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#2563eb', color: 'white' }}>
                <th style={thStyle}>الكود</th>
                <th style={thStyle}>العميل</th>
                <th style={thStyle}>الرصيد الإجمالي</th>
                <th style={thStyle}>حالي (0-30)</th>
                <th style={thStyle}>متأخر (31-60)</th>
                <th style={thStyle}>متأخر (61-90)</th>
                <th style={thStyle}>متأخر +90</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((c, index) => (
                <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'white' }}>
                  <td style={tdStyle}><strong>{c.code}</strong></td>
                  <td style={tdStyle}>{c.name}</td>
                  <td style={tdStyle}><strong>{parseFloat(c.total_balance).toLocaleString()} ج.م</strong></td>
                  <td style={tdStyle}>{parseFloat(c.current_0_30).toLocaleString()} ج.م</td>
                  <td style={tdStyle}>{parseFloat(c.days_31_60).toLocaleString()} ج.م</td>
                  <td style={tdStyle}>{parseFloat(c.days_61_90).toLocaleString()} ج.م</td>
                  <td style={tdStyle} style={{ color: '#dc2626', fontWeight: 'bold' }}>
                    {parseFloat(c.over_90).toLocaleString()} ج.م
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default CustomerReports;