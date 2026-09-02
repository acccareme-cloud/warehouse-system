// frontend/src/components/ModuleHubLayout.jsx
//
// شكل موحّد لكل شاشات "بوابة الموديول" (المشتريات/المبيعات/المخازن/الخزينة).
// أي شاشة بوابة جديدة بعد كده تستخدم نفس الكومبوننت ده بدل ما تكرر نفس الكود
// في 4 ملفات منفصلة زي ما كان حاصل.
//
// props:
//   icon        — إيموجي العنوان (مثال: '🛒')
//   titleKey    — مفتاح ترجمة العنوان (مثال: 'moduleHub.purchasesTitle')
//   menus       — [{ icon, key, color, path }]  ← key بيتبص عليه في moduleHub.menus.<key>.title/.desc

// frontend/src/components/ModuleHubLayout.jsx
import { useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getColors } from '../theme';

function ModuleHubLayout({ icon, titleKey, menus }) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t, lang, toggleLang, isRtl } = useLanguage();
  const colors = getColors(theme === 'dark');

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.gradient,
      fontFamily: isRtl ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'Inter', system-ui, sans-serif",
      direction: isRtl ? 'rtl' : 'ltr',
      position: 'relative',
    }}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
      />

      {/* Header */}
      <div style={{
        background: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        padding: '20px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: `0 2px 8px ${colors.shadow}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '10px 20px',
              background: colors.surfaceHover,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.primary;
              e.currentTarget.style.color = '#FFFFFF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.surfaceHover;
              e.currentTarget.style.color = colors.text;
            }}
          >
            {isRtl ? `← ${t('moduleHub.back')}` : `${t('moduleHub.back')} →`}
          </button>
          <h1 style={{
            color: colors.primary,
            margin: 0,
            fontSize: '28px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <span style={{ fontSize: '32px' }}>{icon}</span>
            {t(titleKey)}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={toggleLang}
            type="button"
            style={{
              background: colors.surfaceHover,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              borderRadius: '8px',
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = colors.primary;
              e.currentTarget.style.color = colors.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = colors.border;
              e.currentTarget.style.color = colors.text;
            }}
          >
            {lang === 'ar' ? 'English' : 'العربية'}
          </button>
          <ThemeToggle />
        </div>
      </div>

      {/* Content */}
      <div style={{
        padding: '40px',
        maxWidth: '1400px',
        margin: '0 auto',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px',
        }}>
          {menus.map((menu, i) => (
            <div
              key={i}
              onClick={() => navigate(menu.path)}
              style={{
                background: colors.surface,
                borderRadius: '16px',
                padding: '32px',
                cursor: 'pointer',
                border: `1px solid ${colors.border}`,
                borderTop: `4px solid ${menu.color || colors.primary}`,
                transition: 'all 0.3s ease',
                boxShadow: `0 4px 12px ${colors.shadow}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.boxShadow = `0 12px 24px ${colors.shadow}`;
                e.currentTarget.style.borderColor = menu.color || colors.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = `0 4px 12px ${colors.shadow}`;
                e.currentTarget.style.borderColor = colors.border;
              }}
            >
              <div style={{
                fontSize: '48px',
                marginBottom: '16px',
                display: 'inline-block',
                padding: '16px',
                borderRadius: '12px',
                background: `${menu.color || colors.primary}15`,
              }}>
                {menu.icon}
              </div>
              <h3 style={{
                margin: '0 0 12px 0',
                color: colors.text,
                fontSize: '20px',
                fontWeight: 600,
              }}>
                {t(`moduleHub.menus.${menu.key}.title`)}
              </h3>
              <p style={{
                margin: 0,
                color: colors.textMuted,
                fontSize: '14px',
                lineHeight: 1.6,
              }}>
                {t(`moduleHub.menus.${menu.key}.desc`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ModuleHubLayout;