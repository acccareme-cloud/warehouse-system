import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

function Currencies() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    code: '', name: '', symbol: '', exchange_rate: '', is_default: false
  });

  const [showHistory, setShowHistory] = useState(false);
  const [historyCurrency, setHistoryCurrency] = useState(null);
  const [historyData, setHistoryData] = useState([]);

  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? '#334155' : '#e2e8f0';

  const fetchCurrencies = async () => {
    try {
      setLoading(true);
      const res = await api.get('/currencies');
      setCurrencies(res.data || []);
    } catch (err) {
      setMessage('❌ فشل في جلب العملات: ' + (err.response?.data?.error || 'خطأ غير متوقع'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCurrencies(); }, []);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(''), 4000);
    return () => clearTimeout(t);
  }, [message]);

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ code: '', name: '', symbol: '', exchange_rate: '', is_default: false });
    setShowModal(true);
  };

  const openEditModal = (c) => {
    setEditingId(c.id);
    setFormData({
      code: c.code, name: c.name, symbol: c.symbol || '',
      exchange_rate: c.exchange_rate, is_default: c.is_default
    });
    setShowModal(true);
  };

    const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Convert exchange_rate to number before sending
    const data = {
      ...formData,
      exchange_rate: formData.exchange_rate ? parseFloat(formData.exchange_rate) : null
    };
    
    try {
      if (editingId) {
        await api.put(`/currencies/${editingId}`, data);
        setMessage('✅ تم تعديل العملة بنجاح');
      } else {
        await api.post('/currencies', data);
        setMessage('✅ تم إضافة العملة بنجاح');
      }
      setShowModal(false);
      fetchCurrencies();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.error || 'حدث خطأ غير متوقع'));
    }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`هل أنت متأكد من حذف عملة "${c.name}"؟`)) return;
    try {
      await api.delete(`/currencies/${c.id}`);
      setMessage('✅ تم حذف العملة');
      fetchCurrencies();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.error || 'حدث خطأ غير متوقع'));
    }
  };

  const openHistory = async (c) => {
    setHistoryCurrency(c);
    try {
      const res = await api.get(`/currencies/${c.id}/history`);
      setHistoryData(res.data || []);
      setShowHistory(true);
    } catch (err) {
      setMessage('❌ فشل في جلب تاريخ معامل التحويل');
    }
  };

  const inputStyle = {
    width: '100%', padding: '8px', borderRadius: '6px',
    border: `1px solid ${borderColor}`, background: isDark ? '#0f172a' : '#fff',
    color: textColor, boxSizing: 'border-box'
  };

  const thStyle = {
    padding: '10px', textAlign: 'right', borderBottom: `2px solid ${borderColor}`,
    color: subTextColor, fontSize: '13px'
  };
  const tdStyle = { padding: '10px', borderBottom: `1px solid ${borderColor}`, color: textColor };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', direction: 'rtl', background: bgColor, minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button
            onClick={() => navigate('/purchases-module')}
            style={{ padding: '10px 20px', background: isDark ? '#334155' : '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            ← رجوع
          </button>
          <h1 style={{ color: '#0d9488', margin: 0 }}>💱 العملات ومعاملات التحويل</h1>
        </div>
        <ThemeToggle />
      </div>

      {message && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
          background: message.startsWith('✅') ? '#16a34a22' : '#dc262622',
          color: message.startsWith('✅') ? '#16a34a' : '#dc2626',
          border: `1px solid ${message.startsWith('✅') ? '#16a34a' : '#dc2626'}`
        }}>
          {message}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button
          onClick={openAddModal}
          style={{ padding: '10px 20px', background: '#0d9488', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          + إضافة عملة جديدة
        </button>
      </div>

      <div style={{ background: cardBg, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: subTextColor }}>جاري التحميل...</div>
        ) : currencies.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: subTextColor }}>لا توجد عملات مسجلة</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>الكود</th>
                <th style={thStyle}>الاسم</th>
                <th style={thStyle}>الرمز</th>
                <th style={thStyle}>معامل التحويل (1 = ؟ ج.م)</th>
                <th style={thStyle}>افتراضية</th>
                <th style={thStyle}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {currencies.map((c) => (
                <tr key={c.id}>
                  <td style={{ ...tdStyle, fontWeight: 'bold' }}>{c.code}</td>
                  <td style={tdStyle}>{c.name}</td>
                  <td style={tdStyle}>{c.symbol || '-'}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{parseFloat(c.exchange_rate).toFixed(4)}</td>
                  <td style={tdStyle}>{c.is_default ? '⭐ نعم' : '-'}</td>
                  <td style={tdStyle}>
                    <button onClick={() => openEditModal(c)} style={{ marginLeft: '6px', padding: '6px 10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>تعديل</button>
                    <button onClick={() => openHistory(c)} style={{ marginLeft: '6px', padding: '6px 10px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>التاريخ</button>
                    {!c.is_default && (
                      <button onClick={() => handleDelete(c)} style={{ padding: '6px 10px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>حذف</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal إضافة / تعديل */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <form onSubmit={handleSubmit} style={{ background: cardBg, padding: '24px', borderRadius: '12px', width: '400px', maxWidth: '90%' }}>
            <h3 style={{ color: textColor, marginTop: 0 }}>{editingId ? 'تعديل عملة' : 'إضافة عملة جديدة'}</h3>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: subTextColor, display: 'block', marginBottom: '4px' }}>كود العملة (مثال: USD)</label>
              <input
                type="text" required disabled={!!editingId} value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: subTextColor, display: 'block', marginBottom: '4px' }}>اسم العملة</label>
              <input
                type="text" required value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: subTextColor, display: 'block', marginBottom: '4px' }}>الرمز (مثال: $)</label>
              <input
                type="text" value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: subTextColor, display: 'block', marginBottom: '4px' }}>معامل التحويل (1 وحدة = كام جنيه؟)</label>
              <input
                type="number" step="0.0001" required value={formData.exchange_rate}
                onChange={(e) => setFormData({ ...formData, exchange_rate: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <input
                type="checkbox" id="is_default" checked={formData.is_default}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
              />
              <label htmlFor="is_default" style={{ color: textColor }}>عملة افتراضية</label>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px 18px', background: isDark ? '#334155' : '#e2e8f0', color: textColor, border: 'none', borderRadius: '8px', cursor: 'pointer' }}>إلغاء</button>
              <button type="submit" style={{ padding: '10px 18px', background: '#0d9488', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>{editingId ? 'حفظ التعديل' : 'إضافة'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal التاريخ */}
      {showHistory && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: cardBg, padding: '24px', borderRadius: '12px', width: '500px', maxWidth: '90%', maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={{ color: textColor, marginTop: 0 }}>تاريخ معامل التحويل - {historyCurrency?.name}</h3>
            {historyData.length === 0 ? (
              <p style={{ color: subTextColor }}>لا يوجد سجل تاريخي بعد.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>التاريخ</th>
                    <th style={thStyle}>المعامل</th>
                    <th style={thStyle}>ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.map((h) => (
                    <tr key={h.id}>
                      <td style={tdStyle}>{new Date(h.effective_date).toLocaleDateString('ar-EG')}</td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{parseFloat(h.exchange_rate).toFixed(4)}</td>
                      <td style={tdStyle}>{h.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setShowHistory(false)} style={{ padding: '10px 18px', background: isDark ? '#334155' : '#e2e8f0', color: textColor, border: 'none', borderRadius: '8px', cursor: 'pointer' }}>إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Currencies;
