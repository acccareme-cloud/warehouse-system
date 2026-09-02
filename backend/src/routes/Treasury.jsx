// frontend/src/pages/Treasury.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getColors } from '../theme';
import api from '../services/api';

function Treasury() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t, isRtl } = useLanguage();
  const colors = getColors(theme === 'dark');

  const [summary, setSummary] = useState({
    treasury_balance: 0,
    today_income: 0,
    today_expense: 0,
    bank_balance: 0,
  });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [summaryRes, transactionsRes] = await Promise.all([
        api.get('/treasury/summary'),
        api.get('/treasury/transactions?limit=10'),
      ]);
      setSummary(summaryRes.data);
      setTransactions(transactionsRes.data);
    } catch (err) {
      console.error('Error fetching treasury data:', err);
    } finally {
      setLoading(false);
    }
  };

  const statCardStyle = (color) => ({
    background: colors.surface,
    borderRadius: '16px',
    padding: '24px',
    border: `2px solid ${color}`,
    boxShadow: `0 4px 12px ${colors.shadow}`,
    transition: 'transform 0.3s ease',
    cursor: 'pointer',
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.gradient,
      fontFamily: isRtl ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'Inter', system-ui, sans-serif",
      direction: isRtl ? 'rtl' : 'ltr',
      padding: '40px 20px',
    }}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
      />

      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
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
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            💰 {t('moduleHub.menus.treasury.title')}
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
              fontSize: '14px',
            }}
          >
            {isRtl ? '← رجوع' : 'Back →'}
          </button>
        </div>

        {/* Summary Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '24px',
          marginBottom: '40px',
        }}>
          <div style={statCardStyle(colors.success)}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ color: colors.textMuted, fontSize: '14px', marginBottom: '8px' }}>
              {t('equityReport.treasuryBalance')}
            </div>
            <div style={{
              color: colors.success,
              fontSize: '32px',
              fontWeight: 700,
            }}>
              {summary.treasury_balance.toLocaleString()} {t('currency')}
            </div>
          </div>

          <div style={statCardStyle(colors.info)}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ color: colors.textMuted, fontSize: '14px', marginBottom: '8px' }}>
              {t('treasury.todayIncome')}
            </div>
            <div style={{
              color: colors.info,
              fontSize: '32px',
              fontWeight: 700,
            }}>
              {summary.today_income.toLocaleString()} {t('currency')}
            </div>
          </div>

          <div style={statCardStyle(colors.danger)}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ color: colors.textMuted, fontSize: '14px', marginBottom: '8px' }}>
              {t('treasury.todayExpense')}
            </div>
            <div style={{
              color: colors.danger,
              fontSize: '32px',
              fontWeight: 700,
            }}>
              {summary.today_expense.toLocaleString()} {t('currency')}
            </div>
          </div>

          <div style={statCardStyle(colors.accent)}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ color: colors.textMuted, fontSize: '14px', marginBottom: '8px' }}>
              {t('equityReport.bankBalance')}
            </div>
            <div style={{
              color: colors.accent,
              fontSize: '32px',
              fontWeight: 700,
            }}>
              {summary.bank_balance.toLocaleString()} {t('currency')}
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div style={{
          background: colors.surface,
          borderRadius: '16px',
          padding: '32px',
          border: `1px solid ${colors.border}`,
          boxShadow: `0 4px 12px ${colors.shadow}`,
        }}>
          <h2 style={{
            color: colors.text,
            fontSize: '24px',
            fontWeight: 700,
            marginBottom: '24px',
          }}>
             {t('treasury.recentTransactions')}
          </h2>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: colors.textMuted }}>
              {t('common.loading')}
            </div>
          ) : transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: colors.textMuted }}>
              {t('common.noData')}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${colors.border}` }}>
                    <th style={{ padding: '12px', textAlign: isRtl ? 'right' : 'left', color: colors.text }}>
                      {t('treasury.date')}
                    </th>
                    <th style={{ padding: '12px', textAlign: isRtl ? 'right' : 'left', color: colors.text }}>
                      {t('treasury.type')}
                    </th>
                    <th style={{ padding: '12px', textAlign: isRtl ? 'right' : 'left', color: colors.text }}>
                      {t('treasury.description')}
                    </th>
                    <th style={{ padding: '12px', textAlign: isRtl ? 'right' : 'left', color: colors.text }}>
                      {t('treasury.amount')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((trans, i) => (
                    <tr key={trans.id} style={{
                      borderBottom: `1px solid ${colors.border}`,
                      background: i % 2 === 0 ? colors.surface : colors.surfaceHover,
                    }}>
                      <td style={{ padding: '12px', color: colors.text }}>
                        {new Date(trans.created_at).toLocaleDateString('ar-EG')}
                      </td>
                      <td style={{ padding: '12px', color: colors.text }}>
                        {trans.type === 'in' ? (
                          <span style={{ color: colors.success, fontWeight: 600 }}>
                            {t('reports.in')}
                          </span>
                        ) : (
                          <span style={{ color: colors.danger, fontWeight: 600 }}>
                            {t('reports.out')}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px', color: colors.textMuted }}>
                        {trans.description}
                      </td>
                      <td style={{
                        padding: '12px',
                        color: trans.type === 'in' ? colors.success : colors.danger,
                        fontWeight: 700,
                        fontSize: '16px',
                      }}>
                        {trans.amount.toLocaleString()} {t('currency')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Treasury;