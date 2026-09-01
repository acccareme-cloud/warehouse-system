import { useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const COLORS = {
  bgDark: '#1E323B',
  surfaceDark: '#2A4048',
  primary: '#20B2A6',
  primaryDark: '#178F86',
  amber: '#D19A5C',
  textLight: '#EEF4F3',
  textDark: '#16262A',
  muted: '#A9C0C4',
  danger: '#E37876',
  border: '#3D5960',
};

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { username, password });
      login(response.data);
      window.location.href = '/dashboard';
    } catch (err) {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexWrap: 'wrap',
        background: COLORS.bgDark,
        fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif",
        direction: 'rtl',
      }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
      />

      {/* لوحة الهوية */}
      <div
        style={{
          flex: '1 1 420px',
          minHeight: '340px',
          background: `linear-gradient(160deg, ${COLORS.bgDark} 0%, #243B44 60%, ${COLORS.surfaceDark} 100%)`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '60px 56px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
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
            }}
          >
            🫁
          </div>
          <h1
            style={{
              color: COLORS.textLight,
              fontSize: '30px',
              fontWeight: 700,
              margin: '0 0 12px 0',
              lineHeight: 1.3,
            }}
          >
            نظام إدارة المخازن
            <br />
            والأجهزة الطبية
          </h1>
          <p style={{ color: COLORS.muted, fontSize: '15px', lineHeight: 1.8, maxWidth: '380px', margin: 0 }}>
            متابعة أجهزة التنفس الصناعي والحضانات وقطع الغيار — من طلب الشراء
            وحتى المخزون، في مكان واحد.
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
          background: COLORS.surfaceDark,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
        }}
      >
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '360px' }}>
          <h2 style={{ color: COLORS.textLight, fontSize: '22px', fontWeight: 600, margin: '0 0 6px 0' }}>
            تسجيل الدخول
          </h2>
          <p style={{ color: COLORS.muted, fontSize: '14px', margin: '0 0 32px 0' }}>
            ادخل ببيانات حسابك للمتابعة
          </p>

          {error && (
            <div
              role="alert"
              style={{
                background: 'rgba(225, 85, 84, 0.12)',
                border: `1px solid ${COLORS.danger}`,
                color: '#F5B5B4',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '13px',
                marginBottom: '20px',
              }}
            >
              {error}
            </div>
          )}

          <label style={{ display: 'block', color: COLORS.muted, fontSize: '13px', marginBottom: '6px' }}>
            اسم المستخدم
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            style={{
              width: '100%',
              padding: '11px 14px',
              marginBottom: '18px',
              background: COLORS.bgDark,
              border: `1px solid ${COLORS.border}`,
              borderRadius: '8px',
              color: COLORS.textLight,
              fontSize: '14px',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              outline: 'none',
            }}
            onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
            onBlur={(e) => (e.target.style.borderColor = COLORS.border)}
          />

          <label style={{ display: 'block', color: COLORS.muted, fontSize: '13px', marginBottom: '6px' }}>
            كلمة المرور
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '11px 14px',
              marginBottom: '26px',
              background: COLORS.bgDark,
              border: `1px solid ${COLORS.border}`,
              borderRadius: '8px',
              color: COLORS.textLight,
              fontSize: '14px',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              outline: 'none',
            }}
            onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
            onBlur={(e) => (e.target.style.borderColor = COLORS.border)}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px',
              background: loading ? COLORS.primaryDark : COLORS.primary,
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
            {loading ? 'جاري الدخول...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
