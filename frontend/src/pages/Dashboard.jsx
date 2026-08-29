import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';

function Dashboard() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [user, setUser] = useState({});
  const [stats, setStats] = useState({
    customers: 0,
    suppliers: 0,
    items: 0,
    todayInvoices: 0
  });
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [animatedStats, setAnimatedStats] = useState({ customers: 0, suppliers: 0, items: 0, todayInvoices: 0 });

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(u);
    fetchStats();
  }, []);

  // Animation effect for stats
  useEffect(() => {
    if (!loading) {
      const duration = 1000;
      const steps = 30;
      const interval = duration / steps;
      let step = 0;

      const timer = setInterval(() => {
        step++;
        const progress = step / steps;
        const easeOut = 1 - Math.pow(1 - progress, 3);

        setAnimatedStats({
          customers: Math.round(stats.customers * easeOut),
          suppliers: Math.round(stats.suppliers * easeOut),
          items: Math.round(stats.items * easeOut),
          todayInvoices: Math.round(stats.todayInvoices * easeOut)
        });

        if (step >= steps) clearInterval(timer);
      }, interval);

      return () => clearInterval(timer);
    }
  }, [loading, stats]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [customersRes, suppliersRes, itemsRes, invoicesRes] = await Promise.all([
        api.get('/customers').catch(() => ({ data: [] })),
        api.get('/suppliers').catch(() => ({ data: [] })),
        api.get('/items').catch(() => ({ data: [] })),
        api.get('/sales-invoices').catch(() => ({ data: [] }))
      ]);

      const today = new Date().toISOString().split('T')[0];
      const todayInvoices = invoicesRes.data.filter(inv => 
        inv.created_at?.startsWith(today)
      ).length;

      setStats({
        customers: customersRes.data.length,
        suppliers: suppliersRes.data.length,
        items: itemsRes.data.length,
        todayInvoices: todayInvoices
      });

      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const count = invoicesRes.data.filter(inv => 
          inv.created_at?.startsWith(dateStr)
        ).length;
        last7Days.push({
          date: date.toLocaleDateString('ar-EG', { weekday: 'short' }),
          count: count,
          fullDate: dateStr
        });
      }
      setChartData(last7Days);
      setLoading(false);
    } catch (err) {
      console.error('Stats error:', err);
      setLoading(false);
    }
  };

  const getAllowedModules = (role) => {
    const modules = {
      admin: [
        { title: '🛒 المشتريات', desc: 'طلبات - أوامر - فواتير - موردين', color: '#0d9488', path: '/purchases-module' },
        { title: '💰 المبيعات', desc: 'أوامر بيع - فواتير - عملاء', color: '#2563eb', path: '/sales-module' },
        { title: '📋 العهد', desc: 'تقديم - اعتماد - تسوية', color: '#7c3aed', path: '/custody-module' },
        { title: '💵 الخزينة', desc: 'سندات - عهد - مصاريف', color: '#6f42c1', path: '/treasury-module' },
        { title: '📦 المخازن', desc: 'أصناف - إضافة - صرف - جودة', color: '#28a745', path: '/warehouse-module' },
        { title: '👥 الموظفين', desc: 'تكويد وإدارة الموظفين', color: '#e11d48', path: '/employees' },
        { title: '📊 التقارير', desc: 'حركات - رصيد - كارت صنف', color: '#20c997', path: '/reports' },
        { title: '🌍 الدول والمحافظات', desc: 'تكويد الدول والمحافظات والمدن', color: '#7c3aed', path: '/locations' },
        { title: '⚙️ الإعدادات', desc: 'مستخدمين - Backup - تصفير', color: '#f59e0b', path: '/settings' },
      ],
      purchasing: [
        { title: '🛒 المشتريات', desc: 'طلبات - أوامر - فواتير - موردين', color: '#0d9488', path: '/purchases-module' },
        { title: '📊 التقارير', desc: 'تقارير المشتريات', color: '#20c997', path: '/reports' },
      ],
      storekeeper: [
        { title: '📦 المخازن', desc: 'أصناف - إضافة - صرف - جودة', color: '#28a745', path: '/warehouse-module' },
        { title: '🔍 فحص جودة', desc: 'فحص الطلبات والإذونات', color: '#0891b2', path: '/quality' },
      ],
      finance: [
        { title: '💵 الخزينة', desc: 'سندات - عهد - مصاريف', color: '#6f42c1', path: '/treasury-module' },
        { title: '📊 التقارير', desc: 'تقارير مالية', color: '#20c997', path: '/reports' },
      ],
      quality: [
        { title: '🔍 فحص جودة', desc: 'فحص الطلبات والإذونات', color: '#0891b2', path: '/quality' },
      ],
      maintenance: [
        { title: '🔧 الصيانة', desc: 'أوامر شغل وصيانة', color: '#f59e0b', path: '/work-orders' },
      ],
      manager: [
        { title: '💰 المبيعات', desc: 'أوامر بيع - فواتير - عملاء', color: '#2563eb', path: '/sales-module' },
        { title: '🛒 المشتريات', desc: 'طلبات - أوامر - فواتير - موردين', color: '#0d9488', path: '/purchases-module' },
        { title: '📊 التقارير', desc: 'حركات - رصيد - كارت صنف', color: '#20c997', path: '/reports' },
      ],
      // ═══ أدوار سير عمل الخزينة الجديدة ═══
      entry_accountant: [
        { title: '💵 سندات الخزينة', desc: 'إنشاء وإدخال السندات', color: '#6f42c1', path: '/treasury' },
      ],
      review_accountant: [
        { title: '💵 سندات الخزينة', desc: 'مراجعة السندات المُدخلة', color: '#6f42c1', path: '/treasury' },
      ],
      treasury_accountant: [
        { title: '💵 سندات الخزينة', desc: 'صرف السندات المعتمدة', color: '#6f42c1', path: '/treasury' },
      ],
    };
    return modules[role] || modules['storekeeper'];
  };

  const allowedModules = getAllowedModules(user.role || 'storekeeper');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';
  const headerBg = isDark 
    ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' 
    : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';

  const maxCount = Math.max(...chartData.map(d => d.count), 1);
  const hasChartData = chartData.some(d => d.count > 0);

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '1400px', 
      margin: '0 auto', 
      direction: 'rtl', 
      background: bgColor, 
      minHeight: '100vh',
      transition: 'background 0.5s ease'
    }}>
      {/* Header */}
      <div style={{ 
        background: headerBg, 
        color: 'white', 
        padding: '25px', 
        borderRadius: '16px', 
        marginBottom: '30px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '32px' }}>📊 لوحة التحكم</h1>
          <p style={{ margin: '8px 0 0 0', opacity: 0.7, fontSize: '16px' }}>
            نظام إدارة المخازن والمبيعات والمشتريات
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <ThemeToggle />
          <span style={{ 
            background: 'rgba(255,255,255,0.2)', 
            padding: '8px 20px', 
            borderRadius: '20px', 
            fontSize: '14px', 
            fontWeight: 'bold',
            backdropFilter: 'blur(10px)'
          }}>
            {user.role?.toUpperCase() || 'USER'}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>{user.username}</span>
          <button 
            onClick={handleLogout}
            style={{ 
              padding: '10px 25px', 
              background: '#dc2626', 
              color: 'white', 
              border: 'none', 
              borderRadius: '10px', 
              cursor: 'pointer', 
              fontSize: '14px', 
              fontWeight: 'bold',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#b91c1c'}
            onMouseLeave={e => e.currentTarget.style.background = '#dc2626'}
          >
            🚪 خروج
          </button>
        </div>
      </div>

      {/* ✅ Modules Grid - فوق */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '24px',
        marginBottom: '30px'
      }}>
        {allowedModules.map((module, index) => (
          <div 
            key={index}
            onClick={() => navigate(module.path)}
            style={{ 
              background: cardBg, 
              borderRadius: '20px', 
              padding: '35px 30px', 
              textAlign: 'center',
              border: `2px solid ${module.color}15`,
              cursor: 'pointer',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.15)' : '0 4px 20px rgba(0,0,0,0.03)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-10px)';
              e.currentTarget.style.borderColor = module.color + '50';
              e.currentTarget.style.boxShadow = `0 25px 50px ${module.color}20`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = module.color + '15';
              e.currentTarget.style.boxShadow = isDark ? '0 4px 20px rgba(0,0,0,0.15)' : '0 4px 20px rgba(0,0,0,0.03)';
            }}
          >
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: module.color,
              borderRadius: '20px 20px 0 0'
            }} />
            <div style={{ 
              fontSize: '52px', 
              marginBottom: '18px', 
              display: 'inline-block',
              padding: '18px',
              borderRadius: '20px',
              background: module.color + '10'
            }}>
              {module.title.split(' ')[0]}
            </div>
            <h3 style={{ margin: '0 0 12px 0', color: textColor, fontSize: '22px', fontWeight: '700' }}>
              {module.title.split(' ').slice(1).join(' ')}
            </h3>
            <p style={{ 
              margin: '0 0 25px 0', 
              color: subTextColor, 
              fontSize: '14px',
              lineHeight: '1.6'
            }}>
              {module.desc}
            </p>
            <button 
              style={{ 
                padding: '14px 35px', 
                background: module.color, 
                color: 'white', 
                border: 'none', 
                borderRadius: '12px', 
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                width: '100%',
                transition: 'all 0.3s ease',
                boxShadow: `0 8px 20px ${module.color}40`
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = `0 12px 30px ${module.color}60`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = `0 8px 20px ${module.color}40`;
              }}
            >
              فتح ←
            </button>
          </div>
        ))}
      </div>

      {/* ✅ Stats Cards - في النص */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
        gap: '20px', 
        marginBottom: '30px' 
      }}>
        {[
          { label: 'العملاء', value: animatedStats.customers, icon: '👥', color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
          { label: 'الموردين', value: animatedStats.suppliers, icon: '🏭', color: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #059669)' },
          { label: 'الأصناف', value: animatedStats.items, icon: '📦', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
          { label: 'فواتير اليوم', value: animatedStats.todayInvoices, icon: '📄', color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #dc2626)' },
        ].map((stat, i) => (
          <div 
            key={i} 
            style={{ 
              background: cardBg, 
              padding: '25px', 
              borderRadius: '16px', 
              border: `2px solid ${stat.color}20`,
              textAlign: 'center',
              boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 4px 20px rgba(0,0,0,0.05)',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              transform: 'translateY(0)',
              opacity: loading ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
              e.currentTarget.style.boxShadow = `0 20px 40px ${stat.color}30`;
              e.currentTarget.style.borderColor = stat.color + '60';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 4px 20px rgba(0,0,0,0.05)';
              e.currentTarget.style.borderColor = stat.color + '20';
            }}
          >
            <div style={{ fontSize: '42px', marginBottom: '12px' }}>{stat.icon}</div>
            <div style={{ 
              fontSize: '36px', 
              fontWeight: 'bold', 
              background: stat.gradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: '8px'
            }}>
              {loading ? '...' : stat.value}
            </div>
            <div style={{ color: subTextColor, fontSize: '15px', fontWeight: '500' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ✅ Chart Section - تحت */}
      <div style={{ 
        background: cardBg, 
        padding: '30px', 
        borderRadius: '16px', 
        marginBottom: '30px',
        border: `2px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 4px 20px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <h3 style={{ margin: 0, color: textColor, fontSize: '20px' }}>📈 فواتير آخر 7 أيام</h3>
          {hasChartData && (
            <span style={{ 
              background: '#3b82f620', 
              color: '#3b82f6', 
              padding: '6px 14px', 
              borderRadius: '20px', 
              fontSize: '13px',
              fontWeight: 'bold'
            }}>
              الإجمالي: {chartData.reduce((a, b) => a + b.count, 0)}
            </span>
          )}
        </div>

        {!hasChartData ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center',
            height: '220px',
            color: subTextColor,
            fontSize: '16px',
            gap: '15px'
          }}>
            <div style={{ fontSize: '60px', opacity: 0.3 }}>📊</div>
            <div>لا توجد فواتير في آخر 7 أيام</div>
            <div style={{ fontSize: '13px', opacity: 0.6 }}>ستظهر البيانات هنا عند إنشاء الفواتير</div>
          </div>
        ) : (
          <div style={{ 
            display: 'flex', 
            alignItems: 'flex-end', 
            gap: '12px', 
            height: '220px',
            padding: '20px 10px 10px'
          }}>
            {chartData.map((day, i) => (
              <div key={i} style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                gap: '10px',
                height: '100%',
                justifyContent: 'flex-end'
              }}>
                <div style={{ 
                  width: '100%',
                  maxWidth: '60px',
                  height: `${Math.max((day.count / maxCount) * 160, 4)}px`,
                  background: day.count > 0 
                    ? `linear-gradient(to top, #3b82f6, #60a5fa)` 
                    : '#e2e8f0',
                  borderRadius: '10px 10px 4px 4px',
                  transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  cursor: 'pointer'
                }}>
                  {day.count > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '-28px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#3b82f6',
                      color: 'white',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
                    }}>
                      {day.count}
                    </div>
                  )}
                </div>
                <span style={{ color: subTextColor, fontSize: '13px', fontWeight: '500' }}>
                  {day.date}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ✅ Footer Info */}
      <div style={{ 
        padding: '20px', 
        background: cardBg, 
        borderRadius: '16px',
        textAlign: 'center',
        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        color: subTextColor,
        fontSize: '14px'
      }}>
        <p style={{ margin: 0 }}>
          🔑 صلاحياتك: <strong style={{ color: textColor }}>{user.role?.toUpperCase() || 'USER'}</strong> | 
          👤 المستخدم: <strong style={{ color: textColor }}>{user.username || 'غير معروف'}</strong>
        </p>
      </div>
    </div>
  );
}

export default Dashboard;
