import React from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';

const CustodyModule = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';

  const custodyItems = [
    {
      title: '📝 تقديم تسوية',
      description: 'تقديم مصروفات على العهدة',
      color: '#2563eb',
      path: '/custody-submissions'
    },
    {
      title: '✅ اعتماد تسويات',
      description: 'اعتماد تسويات العهد (للمدير)',
      color: '#16a34a',
      path: '/custody-approvals'
    },
    {
      title: '💰 تسوية العهد',
      description: 'تسوية مالية نهائية (للخزينة)',
      color: '#dc2626',
      path: '/custody-settlements'
    },
    {
      title: '📊 كشف حساب موظف',
      description: 'تقرير تفصيلي لحركة عهدة موظف خلال فترة',
      color: '#7c3aed',
      path: '/custody-employee-statement'
    },
    {
      title: '📈 تقرير أرصدة الموظفين',
      description: 'ملخص أرصدة عدة موظفين خلال فترة',
      color: '#0891b2',
      path: '/custody-employees-summary'
    },
    {
      title: '🧾 طباعة سند تسوية',
      description: 'اختر موظف وتسوية معينة لطباعتها',
      color: '#059669',
      path: '/custody-settlement-voucher'
    }
  ];

  const styles = {
    container: { 
      padding: '20px', 
      maxWidth: '1200px', 
      margin: '0 auto', 
      direction: 'rtl',
      background: bgColor,
      minHeight: '100vh'
    },
    header: { 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: '30px' 
    },
    title: { 
      fontSize: '28px', 
      fontWeight: 'bold', 
      color: textColor 
    },
    btnBack: { 
      background: isDark ? '#334155' : '#6b7280', 
      color: 'white', 
      padding: '10px 20px', 
      border: 'none', 
      borderRadius: '8px', 
      cursor: 'pointer', 
      fontSize: '16px' 
    },
    grid: { 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
      gap: '20px' 
    },
    card: (color) => ({
      background: cardBg, 
      borderRadius: '12px', 
      padding: '30px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)', 
      border: `3px solid ${color}`,
      borderTop: `6px solid ${color}`, 
      textAlign: 'center', 
      cursor: 'pointer',
      transition: 'transform 0.2s, box-shadow 0.2s'
    }),
    icon: { 
      fontSize: '60px', 
      marginBottom: '15px', 
      display: 'inline-block', 
      padding: '15px', 
      borderRadius: '50%' 
    },
    cardTitle: { 
      fontSize: '24px', 
      fontWeight: 'bold', 
      color: textColor, 
      marginBottom: '10px' 
    },
    cardDesc: { 
      fontSize: '14px', 
      color: subTextColor, 
      marginBottom: '20px' 
    },
    btn: (color) => ({
      padding: '12px 30px', 
      background: color, 
      color: 'white',
      border: 'none', 
      borderRadius: '8px', 
      cursor: 'pointer',
      fontSize: '16px', 
      fontWeight: 'bold', 
      width: '100%'
    })
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate('/dashboard')} style={styles.btnBack}>
          ← رجوع للرئيسية
        </button>
        <h1 style={styles.title}>📋 العهود والتسويات</h1>
        <ThemeToggle />
      </div>

      <div style={styles.grid}>
        {custodyItems.map((item, index) => (
          <div 
            key={index} 
            style={styles.card(item.color)}
            onClick={() => navigate(item.path)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            }}
          >
            <div style={{...styles.icon, backgroundColor: item.color + '15'}}>
              {item.title.split(' ')[0]}
            </div>
            <h3 style={styles.cardTitle}>{item.title.split(' ').slice(1).join(' ')}</h3>
            <p style={styles.cardDesc}>{item.description}</p>
            <button 
              style={styles.btn(item.color)}
              onClick={(e) => { e.stopPropagation(); navigate(item.path); }}
            >
              فتح ←
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustodyModule;