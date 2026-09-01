import { useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useBranding } from '../context/BrandingContext';
import { theme } from '../theme';

const COLORS = theme.dark;

// موجة نبض هادئة — نفس شكل مؤشرات أجهزة التنفس والحضانات
function WaveformSVG() {
  return (
    <svg viewBox="0 0 600 120" width="100%" height="90" preserveAspectRatio="none" style={{ display: 'block' }}>
      <polyline
        points="0,60 60,60 80,60 95,20 110,100 125,40 140,60 200,60 260,60 280,60 295,15 310,105 325,35 340,60 400,60 460,60 480,60 495,25 510,95 525,45 540,60 600,60"
        fill="none"
        stroke={COLORS.primary}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { t, lang, toggleLang, isRtl } = useLanguage();
  const { programName, companyName } = useBranding();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { username, password });
      login(response.data);
      window.location.href = '/dashboard';
    } catch (err) {
      if (!err.response) {
        setError(t('login.errNoServer'));
      } else if (err.response.status === 401 || err.response.status === 400) {
        setError(t('login.errBadCreds'));
      } else if (err.response.status >= 500) {
        setError(t('login.errServer', { code: err.response.status }));
      } else {
        setError(t('login.errUnknown'));
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    background: COLORS.input,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    color: COLORS.text,
    fontSize: '14px',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    outline: 'none',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexWrap: 'wrap',
        background: COLORS.bg,
        fontFamily: isRtl
          ? "'IBM Plex Sans Arabic', system-ui, sans-serif"
          : "'Inter', system-ui, sans-serif",
        direction: isRtl ? 'rtl' : 'ltr',
        position: 'relative',
      }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
      />

      {/* تعطيل تلوين المتصفح التلقائي (Autofill) عشان مايكسرش الدارك مود */}
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0px 1000px ${COLORS.input} inset !important;
          -webkit-text-fill-color: ${COLORS.text} !important;
          caret-color: ${COLORS.text};
          transition: background-color 9999s ease-in-out 0s;
        }
      `}</style>

      {/* مبدّل اللغة */}
      <button
        onClick={toggleLang}
        type="button"
        style={{
          position: 'absolute',
          top: '20px',
          [isRtl ? 'left' : 'right']: '20px',
          zIndex: 2,
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          color: COLORS.text,
          borderRadius: '8px',
          padding: '8px 14px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {lang === 'ar' ? 'English' : 'العربية'}
      </button>

      {/* لوحة الهوية */}
      <div
        style={{
          flex: '1 1 420px',
          minHeight: '340px',
          background: `linear-gradient(160deg, ${COLORS.bg} 0%, ${COLORS.surface} 60%, ${COLORS.surfaceHover} 100%)`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '60px 56px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{
          position: 'absolute', top: '-80px', [isRtl ? 'right' : 'left']: '-80px', width: '280px', height: '280px',
          borderRadius: '50%', background: COLORS.primary, opacity: 0.08, filter: 'blur(40px)'
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: COLORS.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              marginBottom: '28px',
              boxShadow: `0 0 24px ${COLORS.primary}55`,
            }}
          >
            🫁
          </div>
          <h1
            style={{
              color: COLORS.text,
              fontSize: '30px',
              fontWeight: 700,
              margin: '0 0 6px 0',
              lineHeight: 1.3,
            }}
          >
            {programName}
          </h1>
          <p style={{ color: COLORS.textMuted, fontSize: '14px', margin: '0 0 16px 0' }}>
            {companyName}
          </p>
          <p style={{ color: COLORS.textMuted, fontSize: '15px', lineHeight: 1.8, maxWidth: '380px', margin: 0 }}>
            {t('login.brandDesc')}
          </p>
        </div>

        <div style={{ marginTop: '48px', position: 'relative', zIndex: 1 }}>
          <WaveformSVG />
          <div style={{ height: '1px', background: COLORS.border, margin: '8px 0 0 0' }} />
        </div>
      </div>

      {/* لوحة الدخول */}
      <div
        style={{
          flex: '1 1 380px',
          minHeight: '340px',
          background: COLORS.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
        }}
      >
        <form onSubmit={handleSubmit} style={{
          width: '100%', maxWidth: '360px', background: COLORS.surface,
          padding: '36px 32px', borderRadius: '16px', border: `1px solid ${COLORS.border}`,
        }}>
          <h2 style={{ color: COLORS.text, fontSize: '22px', fontWeight: 600, margin: '0 0 6px 0' }}>
            {t('login.heading')}
          </h2>
          <p style={{ color: COLORS.textMuted, fontSize: '14px', margin: '0 0 32px 0' }}>
            {t('login.subheading')}
          </p>

          {error && (
            <div
              role="alert"
              style={{
                background: COLORS.dangerBg,
                border: `1px solid ${COLORS.danger}`,
                color: COLORS.danger,
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '13px',
                marginBottom: '20px',
              }}
            >
              {error}
            </div>
          )}

          <label style={{ display: 'block', color: COLORS.textMuted, fontSize: '13px', marginBottom: '6px' }}>
            {t('login.username')}
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            style={{ ...inputStyle, marginBottom: '18px' }}
            onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
            onBlur={(e) => (e.target.style.borderColor = COLORS.border)}
          />

          <label style={{ display: 'block', color: COLORS.textMuted, fontSize: '13px', marginBottom: '6px' }}>
            {t('login.password')}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ ...inputStyle, marginBottom: '26px' }}
            onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
            onBlur={(e) => (e.target.style.borderColor = COLORS.border)}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px',
              background: loading ? COLORS.primaryHover : COLORS.primary,
              color: '#04211F',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s ease',
            }}
          >
            {loading ? t('login.submitting') : t('login.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
