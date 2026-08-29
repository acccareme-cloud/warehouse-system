import { useTheme } from '../context/ThemeContext';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      style={{
        padding: '8px 16px',
        background: isDark ? '#f59e0b' : '#334155',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.3s ease'
      }}
      title={isDark ? 'تغيير للوضع الفاتح' : 'تغيير للوضع الداكن'}
    >
      {isDark ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}

export default ThemeToggle;