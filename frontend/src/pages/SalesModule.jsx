import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';

function SalesModule() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const accent = isDark ? '#14B8A6' : '#0D9488';

  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';

  const subMenus = [
    { title: '📋 أوامر البيع', desc: 'إنشاء وإدارة أوامر البيع', color: '#059669', path: '/sales-orders' },
    { title: '🧾 فواتير المبيعات', desc: 'فواتير ضريبية وبيانات سعر ومسعر هيئة', color: '#2563eb', path: '/sales-invoices' },
    { title: '👥 العملاء', desc: 'تكويد وإدارة العملاء', color: '#17a2b8', path: '/customers' },
    { title: '🔧 أوامر الشغل', desc: 'تركيب وصيانة وتصنيع', color: '#f59e0b', path: '/work-orders' },
    { title: '📦 إذن تسليم', desc: 'تسليم البضاعة للعميل', color: '#22c55e', path: '/delivery-notes' },
    { title: '📊 تقارير المبيعات', desc: 'مبيعات وعمولات وفواتير معلقة', color: '#7c3aed', path: '/sales-reports' },
    { title: '💰 عمولات البيع', desc: 'عمولات رجال البيع', color: '#059669', path: '/sales-commissions' },
    { title: '🔒 التأمينات المستردة', desc: 'تأمين مسترد من البيع', color: '#0d9488', path: '/refundable-deposits' },
    { title: '📜 خطابات الضمان', desc: 'ضمان أعمال قبل/بعد البيع', color: '#f59e0b', path: '/work-warranties' },
    { title: '📊 تقارير العملاء', desc: 'أرصدة وحركات ومبيعات', color: '#2563eb', path: '/customer-reports' },
    { title: '⚙️ إعدادات الضرائب', desc: 'ضريبة 14% واستقطاع 20% وعمولة البيع', color: '#6b7280', path: '/tax-settings' },
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
          <h1 style={{ color: accent, margin: 0 }}>💰 نظام المبيعات المتكامل</h1>
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

export default SalesModule;