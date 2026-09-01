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

import { useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

function ModuleHubLayout({ icon, titleKey, menus }) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t, lang, toggleLang, isRtl } = useLanguage();
  const isDark = theme === 'dark';
  const accent = isDark ? '#14B8A6' : '#0D9488';

  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <div style={{
      padding: '20px',
      maxWidth: '1400px',
      margin: '0 auto',
      direction: isRtl ? 'rtl' : 'ltr',
      background: bgColor,
      minHeight: '100vh'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '10px 20px',
              background: isDark ? '#334155' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            {isRtl ? `← ${t('moduleHub.back')}` : `${t('moduleHub.back')} →`}
          </button>
          <h1 style={{ color: accent, margin: 0 }}>{icon} {t(titleKey)}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={toggleLang}
            type="button"
            style={{
              background: 'transparent',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              color: textColor,
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {lang === 'ar' ? 'English' : 'العربية'}
          </button>
          <ThemeToggle />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {menus.map((menu, i) => (
          <div
            key={i}
            onClick={() => navigate(menu.path)}
            style={{
              background: cardBg,
              borderRadius: '12px',
              padding: '25px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              borderTop: `4px solid ${accent}`,
              transition: 'transform 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <h3 style={{ margin: '0 0 10px 0', color: textColor }}>
              {menu.icon} {t(`moduleHub.menus.${menu.key}.title`)}
            </h3>
            <p style={{ margin: 0, color: subTextColor }}>
              {t(`moduleHub.menus.${menu.key}.desc`)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ModuleHubLayout;
