import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';

function PurchasesModule() {
  const navigate = useNavigate();
  const { theme } = useTheme(); 
  const isDark = theme === 'dark';
  const accent = isDark ? '#14B8A6' : '#0D9488';

  // الألوان الديناميكية
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';

  const subMenus = [
    { title: '📝 طلبات الشراء', desc: 'إنشاء وإدارة طلبات الشراء', color: '#17a2b8', path: '/purchase-requests' },
    { title: '📦 أوامر الشراء', desc: 'إنشاء أوامر الشراء المعتمدة', color: '#28a745', path: '/purchase-orders' },
    { title: '🧾 فواتير المشتريات', desc: 'فواتير محلية واستيراد', color: '#92400e', path: '/purchases' },
    { title: '🚢 الشحنات', desc: 'إدارة شحنات الاستيراد والمصاريف', color: '#0d9488', path: '/shipments' },
    { title: '🏭 الموردين', desc: 'تكويد وإدارة الموردين', color: '#dc2626', path: '/suppliers' },
    { title: '📊 تقارير الموردين', desc: 'كشف حساب وأرصدة الموردين', color: '#2563eb', path: '/supplier-reports' },
    { title: '🧾 تقرير VAT', desc: 'ضريبة القيمة المضافة: مدخلات ومخرجات والصافي المستحق', color: '#dc2626', path: '/vat-report' },
    { title: '⏰ أعمار الديون والعهد', desc: 'أعمار ديون الموردين والعهد المفتوحة المتأخرة', color: '#d97706', path: '/aging-report' },
    { title: '💱 العملات', desc: 'إدارة العملات ومعامل التحويل', color: '#0d9488', path: '/currencies' },
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
      {/* Header */}
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
          <h1 style={{ color: accent, margin: 0 }}>🛒 نظام المشتريات</h1>
        </div>
        <ThemeToggle />
      </div>

      {/* Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '20px' 
      }}>
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
            <h3 style={{ margin: '0 0 10px 0', color: textColor }}>
              {menu.title}
            </h3>
            <p style={{ margin: 0, color: subTextColor }}>
              {menu.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PurchasesModule;
