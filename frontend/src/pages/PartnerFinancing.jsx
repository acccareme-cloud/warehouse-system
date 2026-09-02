// frontend/src/pages/PartnerFinancing.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getColors } from '../theme';
import api from '../services/api';

function PartnerFinancing() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t, isRtl } = useLanguage();
  const colors = getColors(theme === 'dark');

  const [financing, setFinancing] = useState([]);
  const [partners, setPartners] = useState([]);
  const [formData, setFormData] = useState({
    partner_id: '',
    amount: '',
    financing_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [financingRes, partnersRes] = await Promise.all([
        api.get('/partner-financing'),
        api.get('/partners'),
      ]);
      setFinancing(financingRes.data);
      setPartners(partnersRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/partner-financing', formData);
      alert(t('common.success'));
      fetchData();
      setFormData({
        partner_id: '',
        amount: '',
        financing_date: new Date().toISOString().split('T')[0],
        notes: '',
      });
    } catch (err) {
      alert(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px',
    background: colors.input,
    border: `1px solid ${colors.inputBorder}`,
    borderRadius: '8px',
    color: colors.text,
    fontSize: '14px',
    fontFamily: 'inherit',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.gradient,
      fontFamily: isRtl ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'Inter', system-ui, sans-serif",
      direction: isRtl ? 'rtl' : 'ltr',
      padding: '40px 20px',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '40px',
        }}>
          <h1 style={{
            color: colors.primary,
            fontSize: '32px',
            fontWeight: 700,
            margin: 0,
          }}>
            🤝 {t('moduleHub.menus.partnerFinancing.title')}
          </h1>
          <button
            onClick={() => navigate('/treasury-module')}
            style={{
              padding: '10px 20px',
              background: colors.surfaceHover,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            {isRtl ? '← رجوع' : 'Back →'}
          </button>
        </div>

        {/* Form */}
        <div style={{
          background: colors.surface,
          padding: '32px',
          borderRadius: '16px',
          border: `1px solid ${colors.border}`,
          marginBottom: '32px',
          boxShadow: `0 4px 12px ${colors.shadow}`,
        }}>
          <h2 style={{ color: colors.text, marginBottom: '24px', fontSize: '24px', fontWeight: 700 }}>
            {t('partnerFinancing.add')}
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '20px',
            }}>
              <div>
                <label style={{ display: 'block', color: colors.textMuted, marginBottom: '8px', fontSize: '14px' }}>
                  {t('partnerFinancing.partner')}
                </label>
                <select
                  value={formData.partner_id}
                  onChange={(e) => setFormData({ ...formData, partner_id: e.target.value })}
                  required
                  style={inputStyle}
                >
                  <option value="">-- {t('common.select')} --</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: colors.textMuted, marginBottom: '8px', fontSize: '14px' }}>
                  {t('partnerFinancing.amount')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: colors.textMuted, marginBottom: '8px', fontSize: '14px' }}>
                  {t('partnerFinancing.date')}
                </label>
                <input
                  type="date"
                  value={formData.financing_date}
                  onChange={(e) => setFormData({ ...formData, financing_date: e.target.value })}
                  required
                  style={inputStyle}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', color: colors.textMuted, marginBottom: '8px', fontSize: '14px' }}>
                  {t('partnerFinancing.notes')}
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '24px',
                padding: '14px 32px',
                background: loading ? colors.textMuted : colors.primary,
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: 600,
                fontFamily: 'inherit',
                transition: 'all 0.3s ease',
              }}
            >
              {loading ? t('common.saving') : t('common.save')}
            </button>
          </form>
        </div>

        {/* Table */}
        <div style={{
          background: colors.surface,
          padding: '32px',
          borderRadius: '16px',
          border: `1px solid ${colors.border}`,
          boxShadow: `0 4px 12px ${colors.shadow}`,
        }}>
          <h2 style={{ color: colors.text, marginBottom: '24px', fontSize: '24px', fontWeight: 700 }}>
            {t('partnerFinancing.history')}
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${colors.border}` }}>
                  <th style={{ padding: '12px', textAlign: isRtl ? 'right' : 'left', color: colors.text }}>
                    {t('partnerFinancing.partner')}
                  </th>
                  <th style={{ padding: '12px', textAlign: isRtl ? 'right' : 'left', color: colors.text }}>
                    {t('partnerFinancing.amount')}
                  </th>
                  <th style={{ padding: '12px', textAlign: isRtl ? 'right' : 'left', color: colors.text }}>
                    {t('partnerFinancing.date')}
                  </th>
                  <th style={{ padding: '12px', textAlign: isRtl ? 'right' : 'left', color: colors.text }}>
                    {t('partnerFinancing.notes')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {financing.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{
                      padding: '40px',
                      textAlign: 'center',
                      color: colors.textMuted,
                    }}>
                      {t('common.noData')}
                    </td>
                  </tr>
                ) : (
                  financing.map((f, i) => (
                    <tr key={f.id} style={{
                      borderBottom: `1px solid ${colors.border}`,
                      background: i % 2 === 0 ? colors.surface : colors.surfaceHover,
                    }}>
                      <td style={{ padding: '12px', color: colors.text }}>{f.partner_name}</td>
                      <td style={{
                        padding: '12px',
                        color: colors.success,
                        fontWeight: 700,
                        fontSize: '16px',
                      }}>
                        {parseFloat(f.amount).toLocaleString()} {t('currency')}
                      </td>
                      <td style={{ padding: '12px', color: colors.text }}>{f.financing_date}</td>
                      <td style={{ padding: '12px', color: colors.textMuted }}>{f.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PartnerFinancing;