// frontend/src/pages/EquityReport.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getColors } from '../theme';
import api from '../services/api';

function EquityReport() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t, isRtl } = useLanguage();
  const colors = getColors(theme === 'dark');

  const [report, setReport] = useState({
    total_assets: 0,
    total_liabilities: 0,
    total_equity: 0,
    partner_capital: 0,
    retained_earnings: 0,
  });

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      const res = await api.get('/equity-report');
      setReport(res.data);
    } catch (err) {
      console.error('Error fetching equity report:', err);
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
           {t('moduleHub.menus.equityReport.title')}
        </h1>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px',
        marginBottom: '30px',
      }}>
        <div style={{
          background: colors.surface,
          padding: '30px',
          borderRadius: '12px',
          border: `1px solid ${colors.border}`,
          borderRight: `4px solid ${colors.info}`,
        }}>
          <h3 style={{ color: colors.textMuted, margin: '0 0 10px 0', fontSize: '14px' }}>
            {t('equityReport.totalAssets')}
          </h3>
          <p style={{ color: colors.info, fontSize: '32px', fontWeight: 700, margin: 0 }}>
            {report.total_assets.toLocaleString()} {t('currency')}
          </p>
        </div>

        <div style={{
          background: colors.surface,
          padding: '30px',
          borderRadius: '12px',
          border: `1px solid ${colors.border}`,
          borderRight: `4px solid ${colors.danger}`,
        }}>
          <h3 style={{ color: colors.textMuted, margin: '0 0 10px 0', fontSize: '14px' }}>
            {t('equityReport.totalLiabilities')}
          </h3>
          <p style={{ color: colors.danger, fontSize: '32px', fontWeight: 700, margin: 0 }}>
            {report.total_liabilities.toLocaleString()} {t('currency')}
          </p>
        </div>

        <div style={{
          background: colors.surface,
          padding: '30px',
          borderRadius: '12px',
          border: `1px solid ${colors.border}`,
          borderRight: `4px solid ${colors.success}`,
        }}>
          <h3 style={{ color: colors.textMuted, margin: '0 0 10px 0', fontSize: '14px' }}>
            {t('equityReport.totalEquity')}
          </h3>
          <p style={{ color: colors.success, fontSize: '32px', fontWeight: 700, margin: 0 }}>
            {report.total_equity.toLocaleString()} {t('currency')}
          </p>
        </div>
      </div>

      <div style={{
        background: colors.surface,
        padding: '30px',
        borderRadius: '12px',
        border: `1px solid ${colors.border}`,
      }}>
        <h2 style={{ color: colors.text, marginBottom: '20px' }}>
          {t('equityReport.breakdown')}
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
        }}>
          <div style={{
            padding: '20px',
            background: colors.surfaceHover,
            borderRadius: '8px',
          }}>
            <h4 style={{ color: colors.textMuted, margin: '0 0 10px 0' }}>
              {t('equityReport.partnerCapital')}
            </h4>
            <p style={{ color: colors.text, fontSize: '24px', fontWeight: 600, margin: 0 }}>
              {report.partner_capital.toLocaleString()} {t('currency')}
            </p>
          </div>

          <div style={{
            padding: '20px',
            background: colors.surfaceHover,
            borderRadius: '8px',
          }}>
            <h4 style={{ color: colors.textMuted, margin: '0 0 10px 0' }}>
              {t('equityReport.retainedEarnings')}
            </h4>
            <p style={{ color: colors.text, fontSize: '24px', fontWeight: 600, margin: 0 }}>
              {report.retained_earnings.toLocaleString()} {t('currency')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EquityReport;