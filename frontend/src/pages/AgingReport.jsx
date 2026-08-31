import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';

function AgingReport() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? '#334155' : '#e2e8f0';

  const [activeTab, setActiveTab] = useState('suppliers'); // suppliers | custodies
  const [supplierAging, setSupplierAging] = useState(null);
  const [custodyOutstanding, setCustodyOutstanding] = useState(null);
  const [minDays, setMinDays] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchSupplierAging = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/supplier-reports/aging');
      setSupplierAging(res.data);
    } catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setLoading(false); }
  };

  const fetchCustodyOutstanding = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/custody-reports/outstanding', { params: { min_days: minDays } });
      setCustodyOutstanding(res.data);
    } catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setLoading(false); }
  };

  const bucketLabels = {
    current: { label: '0-30 يوم', color: '#059669' },
    '31_60': { label: '31-60 يوم', color: '#d97706' },
    '61_90': { label: '61-90 يوم', color: '#dc2626' },
    over_90: { label: 'أكتر من 90 يوم', color: '#7f1d1d' },
    unknown: { label: 'غير محدد', color: '#64748b' },
  };

  const custodyBucketLabels = {
    '0_15': { label: '0-15 يوم', color: '#059669' },
    '16_30': { label: '16-30 يوم', color: '#d97706' },
    '31_60': { label: '31-60 يوم', color: '#dc2626' },
    over_60: { label: 'أكتر من 60 يوم', color: '#7f1d1d' },
  };

  const tabBtn = (key, label) => (
    <button
      onClick={() => setActiveTab(key)}
      style={{
        padding: '10px 20px', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer',
        background: activeTab === key ? cardBg : 'transparent',
        color: activeTab === key ? '#0d9488' : subTextColor,
        fontWeight: activeTab === key ? 'bold' : 'normal',
        borderBottom: activeTab === key ? '3px solid #0d9488' : '3px solid transparent'
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ padding: '20px', maxWidth: '1300px', margin: '0 auto', direction: 'rtl', background: bgColor, minHeight: '100vh', color: textColor }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => navigate(-1)} style={{ padding: '10px 20px', background: isDark ? '#334155' : '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>← رجوع</button>
          <h1 style={{ color: '#0d9488', margin: 0 }}>⏰ أعمار الديون والعهد المتأخرة</h1>
        </div>
        <ThemeToggle />
      </div>

      <div style={{ display: 'flex', borderBottom: `1px solid ${borderColor}`, marginBottom: '20px' }}>
        {tabBtn('suppliers', '🏭 أعمار ديون الموردين')}
        {tabBtn('custodies', '💼 العهد المفتوحة المتأخرة')}
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>❌ {error}</div>}

      {/* ═══ أعمار ديون الموردين ═══ */}
      {activeTab === 'suppliers' && (
        <div>
          <button onClick={fetchSupplierAging} disabled={loading} style={{ padding: '10px 24px', background: '#0d9488', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '20px' }}>
            {loading ? 'جاري التحميل...' : '👁️ عرض التقرير'}
          </button>

          {supplierAging && (
            <>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {Object.entries(bucketLabels).map(([key, { label, color }]) => (
                  <div key={key} style={{ background: cardBg, borderRadius: '12px', padding: '16px', border: `2px solid ${color}`, flex: 1, minWidth: '180px' }}>
                    <div style={{ fontSize: '12px', color: subTextColor }}>{label}</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color }}>{parseFloat(supplierAging.totals[key] || 0).toLocaleString()} ج.م</div>
                    <div style={{ fontSize: '11px', color: subTextColor }}>{(supplierAging.buckets[key] || []).length} مورد</div>
                  </div>
                ))}
                <div style={{ background: cardBg, borderRadius: '12px', padding: '16px', border: '2px solid #0d9488', flex: 1, minWidth: '180px' }}>
                  <div style={{ fontSize: '12px', color: subTextColor }}>الإجمالي</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0d9488' }}>{parseFloat(supplierAging.grand_total || 0).toLocaleString()} ج.م</div>
                </div>
              </div>

              <div style={{ background: cardBg, borderRadius: '12px', padding: '16px', border: `1px solid ${borderColor}` }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${borderColor}`, textAlign: 'right' }}>
                      <th style={{ padding: '8px' }}>المورد</th>
                      <th style={{ padding: '8px' }}>الرصيد</th>
                      <th style={{ padding: '8px' }}>أيام التأخير</th>
                      <th style={{ padding: '8px' }}>الفئة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(bucketLabels).flatMap(([key, { label, color }]) =>
                      (supplierAging.buckets[key] || []).map(row => (
                        <tr key={row.supplier_id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                          <td style={{ padding: '8px' }}>{row.supplier_name}</td>
                          <td style={{ padding: '8px', fontWeight: 'bold' }}>{parseFloat(row.balance).toLocaleString()} ج.م</td>
                          <td style={{ padding: '8px' }}>{row.days_outstanding ?? '-'}</td>
                          <td style={{ padding: '8px', color }}>{label}</td>
                        </tr>
                      ))
                    )}
                    {supplierAging.grand_total === 0 && (
                      <tr><td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: subTextColor }}>مفيش موردين عليهم أرصدة مستحقة 🎉</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ العهد المفتوحة المتأخرة ═══ */}
      {activeTab === 'custodies' && (
        <div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '20px' }}>
            <div>
              <label style={{ fontSize: '12px', color: subTextColor, display: 'block', marginBottom: '4px' }}>أقل عدد أيام (اختياري)</label>
              <input type="number" value={minDays} onChange={e => setMinDays(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: `1px solid ${borderColor}`, background: cardBg, color: textColor, width: '120px' }} />
            </div>
            <button onClick={fetchCustodyOutstanding} disabled={loading} style={{ padding: '10px 24px', background: '#0d9488', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              {loading ? 'جاري التحميل...' : '👁️ عرض التقرير'}
            </button>
          </div>

          {custodyOutstanding && (
            <>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <div style={{ background: cardBg, borderRadius: '12px', padding: '16px', border: '2px solid #0d9488', flex: 1, minWidth: '180px' }}>
                  <div style={{ fontSize: '12px', color: subTextColor }}>إجمالي المبالغ المفتوحة</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0d9488' }}>{parseFloat(custodyOutstanding.total_outstanding || 0).toLocaleString()} ج.م</div>
                  <div style={{ fontSize: '11px', color: subTextColor }}>{custodyOutstanding.count} عهدة ({custodyOutstanding.linked_to_shipment_count} مربوطة بشحنة)</div>
                </div>
                {Object.entries(custodyBucketLabels).map(([key, { label, color }]) => {
                  const rows = custodyOutstanding.buckets[key] || [];
                  const total = rows.reduce((s, r) => s + (parseFloat(r.remaining_amount) || 0), 0);
                  return (
                    <div key={key} style={{ background: cardBg, borderRadius: '12px', padding: '16px', border: `2px solid ${color}`, flex: 1, minWidth: '180px' }}>
                      <div style={{ fontSize: '12px', color: subTextColor }}>{label}</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color }}>{total.toLocaleString()} ج.م</div>
                      <div style={{ fontSize: '11px', color: subTextColor }}>{rows.length} عهدة</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ background: cardBg, borderRadius: '12px', padding: '16px', border: `1px solid ${borderColor}` }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${borderColor}`, textAlign: 'right' }}>
                      <th style={{ padding: '8px' }}>رقم العهدة</th>
                      <th style={{ padding: '8px' }}>صاحبها</th>
                      <th style={{ padding: '8px' }}>المتبقي</th>
                      <th style={{ padding: '8px' }}>أيام مفتوحة</th>
                      <th style={{ padding: '8px' }}>الشحنة</th>
                      <th style={{ padding: '8px' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(custodyBucketLabels).flatMap(([key, { label, color }]) =>
                      (custodyOutstanding.buckets[key] || []).map(row => (
                        <tr key={row.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                          <td style={{ padding: '8px' }}>{row.custody_number}</td>
                          <td style={{ padding: '8px' }}>{row.holder_name || '-'}</td>
                          <td style={{ padding: '8px', fontWeight: 'bold' }}>{parseFloat(row.remaining_amount).toLocaleString()} ج.م</td>
                          <td style={{ padding: '8px', color }}>{row.days_open} ({label})</td>
                          <td style={{ padding: '8px' }}>{row.shipment_number || '-'}</td>
                          <td style={{ padding: '8px' }}>{row.status === 'active' ? '🟢 نشطة' : '🟡 جزئي التسوية'}</td>
                        </tr>
                      ))
                    )}
                    {custodyOutstanding.count === 0 && (
                      <tr><td colSpan={6} style={{ padding: '16px', textAlign: 'center', color: subTextColor }}>مفيش عهد مفتوحة 🎉</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default AgingReport;
