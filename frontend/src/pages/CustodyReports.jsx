import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

function CustodyReports() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [minDays, setMinDays] = useState(0);
  const [expandedBucket, setExpandedBucket] = useState(null);

  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? '#334155' : '#e2e8f0';

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/custody-reports/outstanding', { params: { min_days: minDays || 0 } });
      setData(res.data);
    } catch (err) {
      setError('خطأ في تحميل التقرير: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const buckets = [
    { key: '0_15', label: '0-15 يوم', color: '#16a34a' },
    { key: '16_30', label: '16-30 يوم', color: '#eab308' },
    { key: '31_60', label: '31-60 يوم', color: '#f97316' },
    { key: 'over_60', label: 'أكتر من 60 يوم', color: '#dc2626' }
  ];

  const thStyle = { padding: '10px', textAlign: 'right', borderBottom: `2px solid ${borderColor}`, color: subTextColor, fontSize: '13px' };
  const tdStyle = { padding: '10px', borderBottom: `1px solid ${borderColor}`, color: textColor };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', direction: 'rtl', background: bgColor, minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => navigate('/custody-module')}
            style={{ padding: '10px 20px', background: isDark ? '#334155' : '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            ← رجوع
          </button>
          <h1 style={{ color: '#7c3aed', margin: 0 }}>⏰ العهد المفتوحة المتأخرة</h1>
        </div>
        <ThemeToggle />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', marginBottom: '20px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', color: subTextColor, fontSize: '13px' }}>حد أدنى للأيام</label>
          <input
            type="number" min="0" value={minDays} onChange={(e) => setMinDays(e.target.value)}
            style={{ padding: '8px', width: '120px', borderRadius: '6px', border: `1px solid ${borderColor}`, background: isDark ? '#0f172a' : '#fff', color: textColor }}
          />
        </div>
        <button onClick={fetchData}
          style={{ padding: '10px 20px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          تحديث
        </button>
      </div>

      {error && <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', background: '#dc262622', color: '#dc2626', border: '1px solid #dc2626' }}>{error}</div>}

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: subTextColor }}>جاري التحميل...</div>
      ) : data ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px' }}>
            <div style={{ padding: '18px', borderRadius: '10px', background: cardBg, border: `1px solid ${borderColor}` }}>
              <div style={{ fontSize: '13px', color: subTextColor, marginBottom: '6px' }}>إجمالي المبالغ المفتوحة</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#dc2626' }}>
                {(data.total_outstanding || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م
              </div>
            </div>
            <div style={{ padding: '18px', borderRadius: '10px', background: cardBg, border: `1px solid ${borderColor}` }}>
              <div style={{ fontSize: '13px', color: subTextColor, marginBottom: '6px' }}>عدد العهد المفتوحة</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: textColor }}>{data.count}</div>
            </div>
            <div style={{ padding: '18px', borderRadius: '10px', background: cardBg, border: `1px solid ${borderColor}` }}>
              <div style={{ fontSize: '13px', color: subTextColor, marginBottom: '6px' }}>مربوطة بشحنة</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#0d9488' }}>{data.linked_to_shipment_count}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '20px' }}>
            {buckets.map(b => (
              <div key={b.key}
                onClick={() => setExpandedBucket(expandedBucket === b.key ? null : b.key)}
                style={{
                  padding: '16px', borderRadius: '10px', cursor: 'pointer', background: cardBg,
                  border: `2px solid ${expandedBucket === b.key ? b.color : borderColor}`
                }}>
                <div style={{ fontSize: '13px', color: subTextColor, marginBottom: '6px' }}>{b.label}</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: b.color }}>{(data.buckets[b.key] || []).length} عهدة</div>
              </div>
            ))}
          </div>

          {expandedBucket && (
            <div style={{ background: cardBg, borderRadius: '12px', overflow: 'hidden', border: `1px solid ${borderColor}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>رقم العهدة</th>
                    <th style={thStyle}>صاحب العهدة</th>
                    <th style={thStyle}>النوع</th>
                    <th style={thStyle}>المبلغ</th>
                    <th style={thStyle}>المتبقي</th>
                    <th style={thStyle}>عدد الأيام</th>
                    <th style={thStyle}>الشحنة المرتبطة</th>
                    <th style={thStyle}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.buckets[expandedBucket] || []).map(row => (
                    <tr key={row.id}>
                      <td style={{ ...tdStyle, fontWeight: 'bold' }}>{row.custody_number}</td>
                      <td style={tdStyle}>{row.holder_name || '-'}</td>
                      <td style={tdStyle}>{row.party_type === 'supplier' ? 'مورد/مخلص' : 'موظف'}</td>
                      <td style={tdStyle}>{parseFloat(row.amount).toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م</td>
                      <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 'bold' }}>{parseFloat(row.remaining_amount).toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م</td>
                      <td style={tdStyle}>{row.days_open}</td>
                      <td style={tdStyle}>{row.shipment_number || '-'}</td>
                      <td style={tdStyle}>{row.status === 'active' ? 'مفتوحة' : 'تسوية جزئية'}</td>
                    </tr>
                  ))}
                  {(data.buckets[expandedBucket] || []).length === 0 && (
                    <tr><td colSpan="8" style={{ ...tdStyle, textAlign: 'center', color: subTextColor }}>لا يوجد عهد في هذه الفئة</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {!expandedBucket && (
            <p style={{ textAlign: 'center', color: subTextColor }}>اضغط على أي فئة بالأعلى لعرض تفاصيل العهد فيها</p>
          )}
        </>
      ) : null}
    </div>
  );
}

export default CustodyReports;
