import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';

function TreasuryModule() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';

  const subMenus = [
    { title: '💵 الخزينة', desc: 'سندات قبض وصرف', color: '#6f42c1', path: '/treasury' },
    { title: '🏦 حسابات البنوك', desc: 'ادارة حسابات البنوك', color: '#17a2b8', path: '/bank-accounts' },
    { title: '📊 مراكز التكلفة', desc: 'تكويد وادارة المراكز', color: '#fd7e14', path: '/cost-centers' },
    { title: '📝 تكويد المصاريف', desc: 'مصاريف اساسية وفرعية', color: '#92400e', path: '/expense-categories' },
    { title: '📈 تقرير المصاريف', desc: 'حسب مراكز التكلفة', color: '#1565c0', path: '/expense-report' },
    { title: '🤝 الشريك', desc: 'تمويل وصرف للشركاء', color: '#EC4899', path: '/partner-management' },
  ];

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '1400px', 
      margin: '0 auto', 
      direction: 'rtl',
      background: bgColor,
      minHeight: '100vh'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '20px' 
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
            ← رجوع
          </button>
          <h1 style={{ color: '#6f42c1', margin: 0 }}> الخزينة والبنك</h1>
        </div>
        <ThemeToggle />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {subMenus.map((menu, i) => (
          <div 
            key={i} 
            onClick={() => navigate(menu.path)} 
            style={{
              background: cardBg, 
              borderRadius: '12px', 
              padding: '25px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)', 
              cursor: 'pointer',
              border: `3px solid ${menu.color}`, 
              borderTop: `6px solid ${menu.color}`,
              transition: 'transform 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <h3 style={{ margin: '0 0 10px 0', color: menu.color }}>{menu.title}</h3>
            <p style={{ margin: 0, color: subTextColor }}>{menu.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TreasuryModule;