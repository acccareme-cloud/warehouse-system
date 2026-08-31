import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';

function VatReport() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const inputBg = isDark ? '#334155' : '#ffffff';
  const inputBorder = isDark ? '#475569' : '#d1d5db';

  const today = new Date();
  const yearStart = `${today.getFullYear()}-01-01`;
  const todayStr = today.toISOString().split('T')[0];

  const [fromDate, setFromDate] = useState(yearStart);
  const [toDate, setToDate] = useState(todayStr);
  const [data, setData] = useState(null);
  const [detail, setDetail] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const inp = { padding: '8px', borderRadius: '6px', border: `1px solid ${inputBorder}`, background: inputBg, color: textColor, fontSize: '13px' };

  const fetchReport = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/expense-reports/vat-report', { params: { date_from: fromDate, date_to: toDate } });
      setData(res.data);
      setShowDetail(false);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setLoading(false); }
  };

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await api.get('/expense-reports/vat-report/input-detail', { params: { date_from: fromDate, date_to: toDate } });
      setDetail(res.data.data || []);
      setShowDetail(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setLoading(false); }
  };

  const summaryCard = (title, value, color, subtitle) => (
    <div style={{ background: cardBg, borderRadius: '12px', padding: '20px', border: `2px solid ${color}`, flex: 1, minWidth: '220px' }}>
      <div style={{ fontSize: '13px', color: subTextColor, marginBottom: '6px' }}>{title}</div>
      <div style={{ fontSize: '26px', fontWeight: 'bold', color }}>{parseFloat(value || 0).toLocaleString()} ج.م</div>
      {subtitle && <div style={{ fontSize: '12px', color: subTextColor, marginTop: '4px' }}>{subtitle}</div>}
    </div>
  );

  return (
    <div style={{ padding: '20px', maxWidth: '1300px', margin: '0 auto', direction: 'rtl', background: bgColor, minHeight: '100vh', color: textColor }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => navigate(-1)} style={{ padding: '10px 20px', background: isDark ? '#334155' : '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>← رجوع</button>
          <h1 style={{ color: '#0d9488', margin: 0 }}>🧾 تقرير ضريبة القيمة المضافة (VAT)</h1>
        </div>
        <ThemeToggle />
      </div>

      {/* الفلاتر */}
      <div style={{ background: cardBg, borderRadius: '12px', padding: '16px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: '12px', color: subTextColor, display: 'block', marginBottom: '4px' }}>من تاريخ</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={inp} />
        </div>
        <div>
          <label style={{ fontSize: '12px', color: subTextColor, display: 'block', marginBottom: '4px' }}>إلى تاريخ</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={inp} />
        </div>
        <button onClick={fetchReport} disabled={loading} style={{ padding: '10px 24px', background: '#0d9488', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          {loading ? 'جاري التحميل...' : '👁️ عرض التقرير'}
        </button>
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>❌ {error}</div>}

      {data && (
        <>
          {/* ملخص */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {summaryCard('VAT مدخلات (مدفوعة)', data.summary.input_vat.total, '#dc2626',
              `شحن: ${parseFloat(data.summary.input_vat.shipment_expenses).toLocaleString()} | جمارك: ${parseFloat(data.summary.input_vat.shipment_clearances).toLocaleString()} | مشتريات: ${parseFloat(data.summary.input_vat.purchases).toLocaleString()}`)}
            {summaryCard('VAT مخرجات (محصّلة)', data.summary.output_vat.total, '#2563eb', `من الفواتير الضريبية للعملاء`)}
            {summaryCard(
              data.summary.net_due >= 0 ? 'الصافي المستحق للمصلحة' : 'الصافي القابل للاسترداد',
              Math.abs(data.summary.net_due),
              data.summary.net_due >= 0 ? '#b45309' : '#059669',
              data.summary.net_due >= 0 ? 'لازم يتسدد' : 'رصيد لصالحك'
            )}
          </div>

          {/* تفصيل شهري */}
          <div style={{ background: cardBg, borderRadius: '12px', padding: '16px', marginBottom: '20px', border: `1px solid ${borderColor}` }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#0d9488' }}>📅 التفصيل الشهري</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${borderColor}`, textAlign: 'right' }}>
                  <th style={{ padding: '8px' }}>الشهر</th>
                  <th style={{ padding: '8px' }}>VAT مدخلات</th>
                  <th style={{ padding: '8px' }}>VAT مخرجات</th>
                  <th style={{ padding: '8px' }}>الصافي</th>
                </tr>
              </thead>
              <tbody>
                {data.monthly.map((m, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${borderColor}` }}>
                    <td style={{ padding: '8px' }}>{m.month}</td>
                    <td style={{ padding: '8px', color: '#dc2626' }}>{parseFloat(m.input_vat).toLocaleString()}</td>
                    <td style={{ padding: '8px', color: '#2563eb' }}>{parseFloat(m.output_vat).toLocaleString()}</td>
                    <td style={{ padding: '8px', fontWeight: 'bold', color: m.net_due >= 0 ? '#b45309' : '#059669' }}>{parseFloat(m.net_due).toLocaleString()}</td>
                  </tr>
                ))}
                {data.monthly.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: subTextColor }}>مفيش بيانات في الفترة دي</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* تفصيل المستندات */}
          <div style={{ marginBottom: '12px' }}>
            <button onClick={fetchDetail} style={{ padding: '10px 20px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              📋 عرض تفصيل مستندات VAT المدخلات
            </button>
          </div>

          {showDetail && detail && (
            <div style={{ background: cardBg, borderRadius: '12px', padding: '16px', border: `1px solid ${borderColor}` }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#8b5cf6' }}>📋 تفصيل مستندات VAT المدخلات</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${borderColor}`, textAlign: 'right' }}>
                    <th style={{ padding: '8px' }}>المصدر</th>
                    <th style={{ padding: '8px' }}>التاريخ</th>
                    <th style={{ padding: '8px' }}>الوصف</th>
                    <th style={{ padding: '8px' }}>الشحنة</th>
                    <th style={{ padding: '8px' }}>VAT</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.map((row, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${borderColor}` }}>
                      <td style={{ padding: '8px' }}>
                        {row.source === 'shipment_expense' ? '💰 مصروف شحنة' : row.source === 'shipment_clearance' ? '🏛️ إفراج جمركي' : '🧾 فاتورة مشتريات'}
                      </td>
                      <td style={{ padding: '8px' }}>{row.date ? new Date(row.date).toLocaleDateString('ar-EG') : '-'}</td>
                      <td style={{ padding: '8px' }}>{row.description || '-'}</td>
                      <td style={{ padding: '8px' }}>{row.shipment_number || '-'}</td>
                      <td style={{ padding: '8px', fontWeight: 'bold', color: '#dc2626' }}>{parseFloat(row.vat || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                  {detail.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: subTextColor }}>مفيش مستندات</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!data && !loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: subTextColor }}>اختر الفترة واضغط "عرض التقرير"</div>
      )}
    </div>
  );
}

export default VatReport;
