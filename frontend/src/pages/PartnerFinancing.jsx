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
    }
  };

  return (
    <div style={{
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto',
      direction: isRtl ? 'rtl' : 'ltr',
      background: colors.bg,
      minHeight: '100vh',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
      }}>
        <button
          onClick={() => navigate('/treasury')}
          style={{
            padding: '10px 20px',
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            color: colors.text,
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          {isRtl ? '← رجوع' : 'Back →'}
        </button>
        <h1 style={{ color: colors.primary, margin: 0 }}>
          💰 {t('moduleHub.menus.partnerFinancing.title')}
        </h1>
      </div>

      <div style={{
        background: colors.surface,
        padding: '30px',
        borderRadius: '12px',
        border: `1px solid ${colors.border}`,
        marginBottom: '30px',
      }}>
        <h2 style={{ color: colors.text, marginBottom: '20px' }}>
          {t('common.add')} {t('moduleHub.menus.partnerFinancing.title')}
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
          }}>
            <div>
              <label style={{ display: 'block', color: colors.textMuted, marginBottom: '8px' }}>
                {t('moduleHub.menus.partnerFinancing.partner')}
              </label>
              <select
                value={formData.partner_id}
                onChange={(e) => setFormData({ ...formData, partner_id: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  background: colors.input,
                  border: `1px solid ${colors.inputBorder}`,
                  borderRadius: '8px',
                  color: colors.text,
                }}
              >
                <option value="">-- {t('common.select')} --</option>
                {partners.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', color: colors.textMuted, marginBottom: '8px' }}>
                {t('moduleHub.menus.partnerFinancing.amount')}
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  background: colors.input,
                  border: `1px solid ${colors.inputBorder}`,
                  borderRadius: '8px',
                  color: colors.text,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: colors.textMuted, marginBottom: '8px' }}>
                {t('moduleHub.menus.partnerFinancing.date')}
              </label>
              <input
                type="date"
                value={formData.financing_date}
                onChange={(e) => setFormData({ ...formData, financing_date: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  background: colors.input,
                  border: `1px solid ${colors.inputBorder}`,
                  borderRadius: '8px',
                  color: colors.text,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: colors.textMuted, marginBottom: '8px' }}>
                {t('moduleHub.menus.partnerFinancing.notes')}
              </label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: colors.input,
                  border: `1px solid ${colors.inputBorder}`,
                  borderRadius: '8px',
                  color: colors.text,
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            style={{
              marginTop: '20px',
              padding: '12px 30px',
              background: colors.primary,
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            {t('common.save')}
          </button>
        </form>
      </div>

      <div style={{
        background: colors.surface,
        padding: '30px',
        borderRadius: '12px',
        border: `1px solid ${colors.border}`,
      }}>
        <h2 style={{ color: colors.text, marginBottom: '20px' }}>
          {t('moduleHub.menus.partnerFinancing.history')}
        </h2>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
        }}>
          <thead>
            <tr style={{ background: colors.surfaceHover }}>
              <th style={{ padding: '12px', textAlign: 'start', color: colors.text }}>{t('moduleHub.menus.partnerFinancing.partner')}</th>
              <th style={{ padding: '12px', textAlign: 'start', color: colors.text }}>{t('moduleHub.menus.partnerFinancing.amount')}</th>
              <th style={{ padding: '12px', textAlign: 'start', color: colors.text }}>{t('moduleHub.menus.partnerFinancing.date')}</th>
              <th style={{ padding: '12px', textAlign: 'start', color: colors.text }}>{t('moduleHub.menus.partnerFinancing.notes')}</th>
            </tr>
          </thead>
          <tbody>
            {financing.map((f, i) => (
              <tr key={f.id} style={{ background: i % 2 === 0 ? colors.surface : colors.surfaceHover }}>
                <td style={{ padding: '12px', color: colors.text }}>{f.partner_name}</td>
                <td style={{ padding: '12px', color: colors.success, fontWeight: 600 }}>{f.amount} {t('currency')}</td>
                <td style={{ padding: '12px', color: colors.text }}>{f.financing_date}</td>
                <td style={{ padding: '12px', color: colors.textMuted }}>{f.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PartnerFinancing;