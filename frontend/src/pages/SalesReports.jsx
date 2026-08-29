import { useState, useEffect } from 'react';
import api from '../services/api';

function SalesReports() {
  const [activeReport, setActiveReport] = useState('sales');
  const [data, setData] = useState([]);
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const [filters, setFilters] = useState({
    start_date: firstDay, end_date: lastDay, customer_id: '', invoice_type: '', status: '', salesperson_id: ''
  });
  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({ total: 0, count: 0, commission: 0 });

  useEffect(() => {
    fetchCustomers();
    fetchEmployees();
    fetchReport();
  }, [activeReport]);

  const fetchCustomers = async () => {
    try { const res = await api.get('/customers'); setCustomers(res.data); }
    catch (err) { console.error(err); }
  };

  const fetchEmployees = async () => {
    try { const res = await api.get('/employees'); setEmployees(res.data); }
    catch (err) { console.error(err); }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = '';
      if (activeReport === 'sales') url = '/sales-invoices/reports/sales';
      else if (activeReport === 'commissions') url = '/sales-invoices/reports/commissions';
      else if (activeReport === 'pending') url = '/sales-invoices/reports/pending';

      const params = new URLSearchParams();
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.customer_id) params.append('customer_id', filters.customer_id);
      if (filters.invoice_type) params.append('invoice_type', filters.invoice_type);
      if (filters.status) params.append('status', filters.status);
      if (filters.salesperson_id) params.append('salesperson_id', filters.salesperson_id);

      const res = await api.get(`${url}?${params.toString()}`);
      setData(res.data);

      // Calculate summary
      const total = res.data.reduce((sum, r) => sum + parseFloat(r.total_amount || 0), 0);
      const commission = res.data.reduce((sum, r) => sum + parseFloat(r.commission_amount || 0), 0);
      setSummary({ total, count: res.data.length, commission });
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  const thStyle = { padding: '12px', border: '1px solid #ddd', backgroundColor: '#2563eb', color: 'white' };
  const tdStyle = { padding: '10px', border: '1px solid #ddd' };

  const getStatusText = (status) => {
    const statuses = {
      'draft': '✏️ مسودة', 'work_order': '🔧 شغل', 'pending_delivery': '📦 تسليم',
      'quality_approved': '✓ جودة', 'warehouse_approved': '✓ مخزن',
      'approved_manager': '✓ مدير', 'approved_finance': '✓ مالية', 'posted': '✓ مرحلة'
    };
    return statuses[status] || status;
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl' }}>
      <h1>📊 تقارير المبيعات</h1>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={() => window.location.href = '/sales-module'} style={{ padding: '10px 20px', backgroundColor: '#7c3aed', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          ← رجوع للمبيعات
        </button>
        <button onClick={() => window.location.href = '/dashboard'} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          🏠 الرئيسية
        </button>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveReport('sales')} style={{ padding: '12px 24px', backgroundColor: activeReport === 'sales' ? '#2563eb' : '#e2e8f0', color: activeReport === 'sales' ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          📊 مبيعات
        </button>
        <button onClick={() => setActiveReport('commissions')} style={{ padding: '12px 24px', backgroundColor: activeReport === 'commissions' ? '#059669' : '#e2e8f0', color: activeReport === 'commissions' ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          💰 عمولات
        </button>
        <button onClick={() => setActiveReport('pending')} style={{ padding: '12px 24px', backgroundColor: activeReport === 'pending' ? '#f59e0b' : '#e2e8f0', color: activeReport === 'pending' ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          ⏳ معلقة
        </button>
      </div>

      {/* Filters */}
      <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <h4>🔍 فلترة</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
          <div><label>من:</label><input type="date" value={filters.start_date} onChange={(e) => setFilters({...filters, start_date: e.target.value})} style={{ width: '100%', padding: '8px' }} /></div>
          <div><label>إلى:</label><input type="date" value={filters.end_date} onChange={(e) => setFilters({...filters, end_date: e.target.value})} style={{ width: '100%', padding: '8px' }} /></div>
          <div><label>العميل:</label><select value={filters.customer_id} onChange={(e) => setFilters({...filters, customer_id: e.target.value})} style={{ width: '100%', padding: '8px' }}><option value="">الكل</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label>نوع الفاتورة:</label><select value={filters.invoice_type} onChange={(e) => setFilters({...filters, invoice_type: e.target.value})} style={{ width: '100%', padding: '8px' }}><option value="">الكل</option><option value="tax">ضريبية</option><option value="price_quote">بيان سعر</option><option value="government_quote">مسعر هيئة</option></select></div>
          {activeReport === 'sales' && <div><label>الحالة:</label><select value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})} style={{ width: '100%', padding: '8px' }}><option value="">الكل</option><option value="draft">مسودة</option><option value="approved_manager">مدير</option><option value="approved_finance">مالية</option><option value="posted">مرحلة</option></select></div>}
          {activeReport === 'commissions' && <div><label>البياع:</label><select value={filters.salesperson_id} onChange={(e) => setFilters({...filters, salesperson_id: e.target.value})} style={{ width: '100%', padding: '8px' }}><option value="">الكل</option>{employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></div>}
        </div>
        <button onClick={fetchReport} style={{ marginTop: '15px', padding: '10px 30px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>🔍 عرض</button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        <div style={{ backgroundColor: '#dbeafe', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#2563eb' }}>عدد الفواتير</h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, color: '#1e40af' }}>{summary.count}</p>
        </div>
        <div style={{ backgroundColor: '#dcfce7', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#059669' }}>إجمالي المبيعات</h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, color: '#166534' }}>{summary.total.toFixed(2)} ج.م</p>
        </div>
        {activeReport === 'commissions' && (
          <div style={{ backgroundColor: '#fef3c7', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#d97706' }}>إجمالي العمولات</h3>
            <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, color: '#92400e' }}>{summary.commission.toFixed(2)} ج.م</p>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? <p>جاري التحميل...</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {activeReport === 'sales' && <>
                  <th style={thStyle}>رقم الفاتورة</th><th style={thStyle}>النوع</th><th style={thStyle}>العميل</th><th style={thStyle}>الصنف</th>
                  <th style={thStyle}>الإجمالي</th><th style={thStyle}>العمولة</th><th style={thStyle}>الحالة</th><th style={thStyle}>التاريخ</th>
                </>}
                {activeReport === 'commissions' && <>
                  <th style={thStyle}>رقم الفاتورة</th><th style={thStyle}>البياع</th><th style={thStyle}>العميل</th>
                  <th style={thStyle}>الإجمالي</th><th style={thStyle}>نسبة العمولة</th><th style={thStyle}>قيمة العمولة</th><th style={thStyle}>التاريخ</th>
                </>}
                {activeReport === 'pending' && <>
                  <th style={thStyle}>رقم الفاتورة</th><th style={thStyle}>العميل</th><th style={thStyle}>الصنف</th>
                  <th style={thStyle}>الإجمالي</th><th style={thStyle}>الحالة</th><th style={thStyle}>التاريخ</th>
                </>}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>لا توجد بيانات</td></tr> : (
                data.map((r, i) => (
                  <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f8f9fa' : 'white' }}>
                    {activeReport === 'sales' && <>
                      <td style={tdStyle}><strong>{r.invoice_number}</strong></td>
                      <td style={tdStyle}>{r.invoice_type === 'tax' ? 'ضريبية' : r.invoice_type === 'price_quote' ? 'بيان سعر' : 'مسعر هيئة'}</td>
                      <td style={tdStyle}>{r.customer_name || r.customer_name_display}</td>
                      <td style={tdStyle}>{r.item_name}</td>
                      <td style={tdStyle}><strong>{Number(r.total_amount || 0).toFixed(2)} ج.م</strong></td>
                      <td style={tdStyle}>{Number(r.commission_amount || 0).toFixed(2)} ج.م</td>
                      <td style={tdStyle}>{getStatusText(r.status)}</td>
                      <td style={tdStyle}>{new Date(r.created_at).toLocaleDateString('ar-EG')}</td>
                    </>}
                    {activeReport === 'commissions' && <>
                      <td style={tdStyle}><strong>{r.invoice_number}</strong></td>
                      <td style={tdStyle}>{r.salesperson_name || '-'}</td>
                      <td style={tdStyle}>{r.customer_name}</td>
                      <td style={tdStyle}><strong>{Number(r.total_amount || 0).toFixed(2)} ج.م</strong></td>
                      <td style={tdStyle}>{r.commission_rate}%</td>
                      <td style={tdStyle}><strong>{Number(r.commission_amount || 0).toFixed(2)} ج.م</strong></td>
                      <td style={tdStyle}>{new Date(r.created_at).toLocaleDateString('ar-EG')}</td>
                    </>}
                    {activeReport === 'pending' && <>
                      <td style={tdStyle}><strong>{r.invoice_number}</strong></td>
                      <td style={tdStyle}>{r.customer_name}</td>
                      <td style={tdStyle}>{r.item_name}</td>
                      <td style={tdStyle}><strong>{Number(r.total_amount || 0).toFixed(2)} ج.م</strong></td>
                      <td style={tdStyle}>{getStatusText(r.status)}</td>
                      <td style={tdStyle}>{new Date(r.created_at).toLocaleDateString('ar-EG')}</td>
                    </>}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default SalesReports;
