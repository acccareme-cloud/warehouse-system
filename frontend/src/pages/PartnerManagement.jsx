import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';

function PartnerManagement() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';

  const [partners, setPartners] = useState([]);
  const [capital, setCapital] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', share_percentage: '', notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [partnersRes, capitalRes] = await Promise.all([
        api.get('/partners'),
        api.get('/partners/company-capital')
      ]);
      setPartners(partnersRes.data || []);
      setCapital(capitalRes.data?.capital || 0);
    } catch (e) {
      console.error('Error loading partners:', e);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', email: '', share_percentage: '', notes: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (p) => {
    setEditingId(p.id);
    setFormData({
      name: p.name || '',
      phone: p.phone || '',
      email: p.email || '',
      share_percentage: p.share_percentage || '',
      notes: p.notes || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('حذف الشريك؟')) return;
    try {
      await api.delete(`/partners/${id}`);
      setMessage('✅ تم الحذف');
      loadData();
    } catch (e) {
      setMessage('❌ ' + (e.response?.data?.message || 'خطأ'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...formData, share_percentage: parseFloat(formData.share_percentage) || 0 };
      if (editingId) {
        await api.put(`/partners/${editingId}`, data);
        setMessage('✅ تم التعديل');
      } else {
        await api.post('/partners', data);
        setMessage('✅ تم الإضافة');
      }
      resetForm();
      loadData();
    } catch (e) {
      setMessage('❌ ' + (e.response?.data?.message || 'خطأ'));
    }
  };

  const handleCapitalChange = async (newCapital) => {
    try {
      await api.put('/partners/company-capital', { capital: parseFloat(newCapital) || 0 });
      setCapital(parseFloat(newCapital) || 0);
      setMessage('✅ تم تحديث رأس المال');
    } catch (e) {
      setMessage('❌ ' + (e.response?.data?.message || 'خطأ'));
    }
  };

  const totalPercentage = partners.reduce((sum, p) => sum + (parseFloat(p.share_percentage) || 0), 0);

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl', background: bgColor, minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => navigate('/treasury-module')} style={{ padding: '10px 20px', background: isDark ? '#334155' : '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            ← رجوع
          </button>
          <h1 style={{ color: '#EC4899', margin: 0 }}>🤝 تكويد الشركاء</h1>
        </div>
      </div>

      {message && (
        <p style={{ padding: '12px', backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da', color: message.includes('✅') ? '#155724' : '#721c24', borderRadius: '8px', marginBottom: '15px', fontWeight: 'bold' }}>
          {message}
        </p>
      )}

      {/* رأس مال الشركة */}
      <div style={{ background: cardBg, borderRadius: '12px', padding: '25px', marginBottom: '20px', border: '3px solid #8B5CF6', borderTop: '6px solid #8B5CF6' }}>
        <h3 style={{ color: textColor, margin: '0 0 15px 0' }}>💰 رأس مال الشركة</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="number"
            value={capital}
            onChange={(e) => setCapital(e.target.value)}
            onBlur={(e) => handleCapitalChange(e.target.value)}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '16px', fontWeight: 'bold', width: '200px' }}
          />
          <span style={{ color: subTextColor, fontSize: '14px' }}>جنيه مصري</span>
        </div>
      </div>

      {/* ملخص النسب */}
      <div style={{ background: cardBg, borderRadius: '12px', padding: '20px', marginBottom: '20px', border: '3px solid #F59E0B', borderTop: '6px solid #F59E0B' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ color: textColor, margin: '0 0 5px 0' }}> ملخص النسب</h3>
            <p style={{ color: subTextColor, margin: 0, fontSize: '14px' }}>إجمالي النسب: {totalPercentage}%</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ color: totalPercentage === 100 ? '#059669' : '#dc2626', fontWeight: 'bold', fontSize: '18px' }}>
              {totalPercentage === 100 ? '✅ مكتملة' : '⚠️ غير مكتملة'}
            </span>
            <button onClick={() => { setShowForm(true); setEditingId(null); setFormData({ name: '', phone: '', email: '', share_percentage: '', notes: '' }); }} style={{ padding: '10px 20px', background: '#EC4899', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              ➕ إضافة شريك
            </button>
          </div>
        </div>
      </div>

      {/* نموذج الإضافة/التعديل */}
      {showForm && (
        <div style={{ background: cardBg, borderRadius: '12px', padding: '25px', marginBottom: '20px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ color: textColor, margin: '0 0 15px 0' }}>
            {editingId ? '✏️ تعديل شريك' : '➕ إضافة شريك جديد'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: textColor, fontSize: '14px' }}>اسم الشريك *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: textColor, fontSize: '14px' }}>الهاتف</label>
                <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: textColor, fontSize: '14px' }}>البريد الإلكتروني</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: textColor, fontSize: '14px' }}>نسبة المساهمة (%) *</label>
                <input type="number" step="0.01" min="0" max="100" value={formData.share_percentage} onChange={(e) => setFormData({ ...formData, share_percentage: e.target.value })} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: textColor, fontSize: '14px' }}>نصيب الشريك (تلقائي)</label>
                <input type="text" value={((parseFloat(formData.share_percentage) || 0) * capital / 100).toFixed(2) + ' ج.م'} readOnly style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#f3f4f6', fontWeight: 'bold', color: '#059669' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: textColor, fontSize: '14px' }}>ملاحظات</label>
                <input type="text" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
              </div>
            </div>
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button type="submit" style={{ padding: '12px 32px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
                {editingId ? '💾 حفظ التعديل' : ' إضافة'}
              </button>
              <button type="button" onClick={resetForm} style={{ padding: '12px 24px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* قائمة الشركاء */}
      <div style={{ background: cardBg, borderRadius: '12px', padding: '25px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h3 style={{ color: textColor, marginBottom: '15px' }}>📋 قائمة الشركاء ({partners.length})</h3>
        {partners.length === 0 ? (
          <p style={{ color: subTextColor, textAlign: 'center', padding: '20px' }}>لا يوجد شركاء مسجلين</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid ' + (isDark ? '#334155' : '#e5e7eb') }}>
                  <th style={{ padding: '12px', textAlign: 'right', color: textColor }}>#</th>
                  <th style={{ padding: '12px', textAlign: 'right', color: textColor }}>الاسم</th>
                  <th style={{ padding: '12px', textAlign: 'right', color: textColor }}>الهاتف</th>
                  <th style={{ padding: '12px', textAlign: 'right', color: textColor }}>البريد</th>
                  <th style={{ padding: '12px', textAlign: 'right', color: textColor }}>النسبة</th>
                  <th style={{ padding: '12px', textAlign: 'right', color: textColor }}>النصيب</th>
                  <th style={{ padding: '12px', textAlign: 'right', color: textColor }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid ' + (isDark ? '#334155' : '#e5e7eb') }}>
                    <td style={{ padding: '12px', color: textColor }}>{i + 1}</td>
                    <td style={{ padding: '12px', color: textColor, fontWeight: 'bold' }}>{p.name}</td>
                    <td style={{ padding: '12px', color: subTextColor }}>{p.phone || '-'}</td>
                    <td style={{ padding: '12px', color: subTextColor }}>{p.email || '-'}</td>
                    <td style={{ padding: '12px', color: '#8B5CF6', fontWeight: 'bold' }}>{p.share_percentage}%</td>
                    <td style={{ padding: '12px', color: '#059669', fontWeight: 'bold' }}>{((parseFloat(p.share_percentage) || 0) * capital / 100).toFixed(2)} ج.م</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handleEdit(p)} style={{ padding: '6px 12px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>✏️</button>
                        <button onClick={() => handleDelete(p.id)} style={{ padding: '6px 12px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default PartnerManagement;