import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';

function WarehouseModule() {
  const navigate = useNavigate();
  const { theme } = useTheme();

  const subMenus = [
    { title: '📦 الأصناف', desc: 'إدارة وتكويد الأصناف', color: '#2563eb', path: '/items' },
    { title: '📥 إضافة مخزون', desc: 'إذن إضافة للمخزن', color: '#28a745', path: '/receipts' },
    { title: '📤 طلب صرف', desc: 'طلب صرف من المخزن', color: '#fd7e14', path: '/requests' },
    { title: '🚚 صرف مخزون', desc: 'تنفيذ طلبات الصرف', color: '#e83e8c', path: '/movements' },
    { title: '🔍 فحص جودة', desc: 'فحص الطلبات والإذونات', color: '#0891b2', path: '/quality' },
    { title: '📋 إذن صرف', desc: 'إذن صرف من الفواتير', color: '#dc2626', path: '/warehouse-issues' },
  ];

  const isDark = theme === 'dark';
  const accent = isDark ? '#14B8A6' : '#0D9488';
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl', background: bgColor, minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', background: isDark ? '#334155' : '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            ← رجوع
          </button>
          <h1 style={{ color: accent, margin: 0 }}>📦 نظام المخازن</h1>
        </div>
        <ThemeToggle />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {subMenus.map((menu, i) => (
          <div key={i} onClick={() => navigate(menu.path)} style={{
            background: cardBg, borderRadius: '12px', padding: '25px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)', cursor: 'pointer',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderTop: `4px solid ${accent}`,
            transition: 'transform 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <h3 style={{ margin: '0 0 10px 0', color: textColor }}>{menu.title}</h3>
            <p style={{ margin: 0, color: subTextColor }}>{menu.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WarehouseModule;