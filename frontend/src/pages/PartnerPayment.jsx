// frontend/src/pages/PartnerPayment.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getColors } from '../theme';
import api from '../services/api';

function PartnerPayment() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t, isRtl } = useLanguage();
  const colors = getColors(theme === 'dark');

  const [payments, setPayments] = useState([]);
  const [partners, setPartners] = useState([]);
  const [formData, setFormData] = useState({
    partner_id: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [paymentsRes, partnersRes] = await Promise.all([
        api.get('/partner-payments'),
        api.get('/partners'),
      ]);
      setPayments(paymentsRes.data);
      setPartners(partnersRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/partner-payments', formData);
      alert(t('common.success'));
      fetchData();
      setFormData({
        partner_id: '',
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash',
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
      padding: '20px',
    }}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
      />

      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px',
          background: colors.surface,
          padding: '20px 30px',
          borderRadius: '12px',
          border: `1px solid ${colors.border}`,
        }}>
          <button
            onClick={() => navigate('/treasury')}
            style={{
              padding: '10px 20px',
              background: colors.surfaceHover,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            {isRtl ? '← رجوع' : 'Back →'}
          </button>
          <h1 style={{ color: colors.primary, margin: 0, fontSize: '28px', fontWeight: 700 }}>
            💵 {t('moduleHub.menus.partnerPayment.title')}
          </h1>
        </div>

        {/* Form */}
        <div style={{
          background: colors.surface,
          padding: '30px',
          borderRadius: '12px',
          border: `1px solid ${colors.border}`,
          marginBottom: '30px',
        }}>
          <h2 style={{ color: colors.text, marginBottom: '20px', fontSize: '20px', fontWeight: 600 }}>
            {t('common.add')} {t('moduleHub.menus.partnerPayment.title')}
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '20px',
            }}>
              <div>
                <label style={{ display: 'block', color: colors.textMuted, marginBottom: '8px', fontSize: '14px' }}>
                  {t('moduleHub.menus.partnerPayment.partner')}
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
                  {t('moduleHub.menus.partnerPayment.amount')}
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
                  {t('moduleHub.menus.partnerPayment.date')}
                </label>
                <input
                  type="date"
                  value={formData.payment_date}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  required
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: colors.textMuted, marginBottom: '8px', fontSize: '14px' }}>
                  {t('moduleHub.menus.partnerPayment.method')}
                </label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  style={inputStyle}
                >
                  <option value="cash">{t('paymentMethod.cash')}</option>
                  <option value="bank_transfer">{t('paymentMethod.bankTransfer')}</option>
                  <option value="check">{t('paymentMethod.check')}</option>
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', color: colors.textMuted, marginBottom: '8px', fontSize: '14px' }}>
                  {t('moduleHub.menus.partnerPayment.notes')}
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
                marginTop: '20px',
                padding: '12px 30px',
                background: loading ? colors.textMuted : colors.primary,
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: 600,
                fontFamily: 'inherit',
              }}
            >
              {loading ? t('common.saving') : t('common.save')}
            </button>
          </form>
        </div>

        {/* Table */}
        <div style={{
          background: colors.surface,
          padding: '30px',
          borderRadius: '12px',
          border: `1px solid ${colors.border}`,
        }}>
          <h2 style={{ color: colors.text, marginBottom: '20px', fontSize: '20px', fontWeight: 600 }}>
            {t('moduleHub.menus.partnerPayment.history')}
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
            }}>
              <thead>
                <tr style={{ background: colors.surfaceHover }}>
                  <th style={{ padding: '12px', textAlign: isRtl ? 'right' : 'left', color: colors.text, borderBottom: `2px solid ${colors.border}` }}>
                    {t('moduleHub.menus.partnerPayment.partner')}
                  </th>
                  <th style={{ padding: '12px', textAlign: isRtl ? 'right' : 'left', color: colors.text, borderBottom: `2px solid ${colors.border}` }}>
                    {t('moduleHub.menus.partnerPayment.amount')}
                  </th>
                  <th style={{ padding: '12px', textAlign: isRtl ? 'right' : 'left', color: colors.text, borderBottom: `2px solid ${colors.border}` }}>
                    {t('moduleHub.menus.partnerPayment.date')}
                  </th>
                  <th style={{ padding: '12px', textAlign: isRtl ? 'right' : 'left', color: colors.text, borderBottom: `2px solid ${colors.border}` }}>
                    {t('moduleHub.menus.partnerPayment.method')}
                  </th>
                  <th style={{ padding: '12px', textAlign: isRtl ? 'right' : 'left', color: colors.text, borderBottom: `2px solid ${colors.border}` }}>
                    {t('moduleHub.menus.partnerPayment.notes')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{
                      padding: '40px',
                      textAlign: 'center',
                      color: colors.textMuted,
                    }}>
                      {t('common.noData')}
                    </td>
                  </tr>
                ) : (
                  payments.map((p, i) => (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? colors.surface : colors.surfaceHover }}>
                      <td style={{ padding: '12px', color: colors.text, borderBottom: `1px solid ${colors.border}` }}>
                        {p.partner_name}
                      </td>
                      <td style={{ padding: '12px', color: colors.danger, fontWeight: 600, borderBottom: `1px solid ${colors.border}` }}>
                        {parseFloat(p.amount).toLocaleString()} {t('currency')}
                      </td>
                      <td style={{ padding: '12px', color: colors.text, borderBottom: `1px solid ${colors.border}` }}>
                        {p.payment_date}
                      </td>
                      <td style={{ padding: '12px', color: colors.textMuted, borderBottom: `1px solid ${colors.border}` }}>
                        {t(`paymentMethod.${p.payment_method}`)}
                      </td>
                      <td style={{ padding: '12px', color: colors.textMuted, borderBottom: `1px solid ${colors.border}` }}>
                        {p.notes || '-'}
                      </td>
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

export default PartnerPayment;