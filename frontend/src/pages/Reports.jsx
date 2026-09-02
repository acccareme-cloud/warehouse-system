import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import ThemeToggle from '../components/ThemeToggle';

function Reports() {
  const { theme } = useTheme();
  const { lang, toggleLang, isRtl } = useLanguage();
  const isDark = theme === 'dark';

  // الألوان حسب الـ theme
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const inputBg = isDark ? '#334155' : '#ffffff';
  const inputBorder = isDark ? '#475569' : '#ddd';
  const summaryBg1 = isDark ? '#1e3a5f' : '#e0f2fe';
  const summaryBg2 = isDark ? '#3f3a1e' : '#fef3c7';
  const summaryBg3 = isDark ? '#1e3f2f' : '#dcfce7';
  const summaryText1 = isDark ? '#60a5fa' : '#0369a1';
  const summaryText2 = isDark ? '#fbbf24' : '#92400e';
  const summaryText3 = isDark ? '#4ade80' : '#166534';
  const rowEven = isDark ? '#1e293b' : '#f8f9fa';
  const rowOdd = isDark ? '#0f172a' : '#ffffff';

  // التاريخ أوتوماتيك للشهر الحالي
  const getFirstDayOfMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  };

  const getLastDayOfMonth = () => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
  };

  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [movements, setMovements] = useState([]);
  const [stock, setStock] = useState([]);
  const [activeTab, setActiveTab] = useState('movements');

  // كارت صنف
  const [cardData, setCardData] = useState(null);
  const [cardFilter, setCardFilter] = useState({
    item_id: '',
    warehouse_id: '',
    from_date: getFirstDayOfMonth(),
    to_date: getLastDayOfMonth()
  });
   const [movementFilter, setMovementFilter] = useState({
    warehouse_id: '',
    movement_type: '',
    from_date: getFirstDayOfMonth(),
    to_date: getLastDayOfMonth()
  });

  const printRef = useRef();
  const movementsPrintRef = useRef();
  const stockPrintRef = useRef();

  useEffect(() => {
    fetchItems();
    fetchWarehouses();
    fetchMovements();
    fetchStock();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await api.get('/items');
      setItems(response.data);
    } catch (err) {
      console.error('خطأ في تحميل الاصناف');
    }
  };

  const fetchWarehouses = async () => {
    try {
      const response = await api.get('/warehouses');
      setWarehouses(response.data);
    } catch (err) {
      console.error('خطأ في تحميل المخازن');
    }
  };

  const fetchMovements = async (filters = movementFilter) => {
    try {
      const params = new URLSearchParams();
      if (filters.warehouse_id) params.append('warehouse_id', filters.warehouse_id);
      if (filters.movement_type) params.append('movement_type', filters.movement_type);
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      const response = await api.get(`/movements?${params.toString()}`);
      setMovements(response.data);
    } catch (err) {
      console.error('خطأ في تحميل الحركات');
    }
  };

  const fetchStock = async () => {
    try {
      const response = await api.get('/items');
      setStock(response.data);
    } catch (err) {
      console.error('خطأ في تحميل المخزون');
    }
  };

  const fetchCardReport = async (e) => {
    e.preventDefault();
    try {
      const response = await api.get(`/movements/card?item_id=${cardFilter.item_id}&warehouse_id=${cardFilter.warehouse_id}&from_date=${cardFilter.from_date}&to_date=${cardFilter.to_date}`);
      setCardData(response.data);
    } catch (err) {
      console.error('خطأ في تحميل كارت الصنف');
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current.innerHTML;
    const originalContent = document.body.innerHTML;

    document.body.innerHTML = `
      <html>
        <head>
          <title>كارت صنف - تقرير</title>
          <style>
            body { font-family: Arial, sans-serif; direction: rtl; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #333; padding: 10px; text-align: center; }
            th { background-color: #0d9488; color: white; }
            .header { text-align: center; margin-bottom: 30px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>نظام إدارة المخازن</h1>
            <h2>كارت صنف - تقرير مفصل</h2>
            <p>تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}</p>
          </div>
          ${printContent}
        </body>
      </html>
    `;

    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
  };

  const handlePrintMovements = () => {
    const printContent = movementsPrintRef.current.innerHTML;
    const originalContent = document.body.innerHTML;

    document.body.innerHTML = `
      <html>
        <head>
          <title>حركات المخزون - تقرير</title>
          <style>
            body { font-family: Arial, sans-serif; direction: rtl; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #333; padding: 10px; text-align: center; }
            th { background-color: #0d9488; color: white; }
            .header { text-align: center; margin-bottom: 30px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>نظام إدارة المخازن</h1>
            <h2>حركات المخزون</h2>
            <p>تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}</p>
          </div>
          ${printContent}
        </body>
      </html>
    `;

    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
  };

  const handlePrintStock = () => {
    const printContent = stockPrintRef.current.innerHTML;
    const originalContent = document.body.innerHTML;

    document.body.innerHTML = `
      <html>
        <head>
          <title>رصيد المخزون - تقرير</title>
          <style>
            body { font-family: Arial, sans-serif; direction: rtl; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #333; padding: 10px; text-align: center; }
            th { background-color: #0d9488; color: white; }
            .header { text-align: center; margin-bottom: 30px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>نظام إدارة المخازن</h1>
            <h2>رصيد المخزون</h2>
            <p>تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}</p>
          </div>
          ${printContent}
        </body>
      </html>
    `;

    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
  };

  // تنسيق التاريخ
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG');
  };

  const thStyle = { padding: '12px', border: `1px solid ${borderColor}`, color: 'white' };
  const tdStyle = { padding: '10px', border: `1px solid ${borderColor}`, color: textColor };

  const tabButtonStyle = (isActive) => ({
    padding: '10px 20px',
    backgroundColor: isActive ? '#0d9488' : cardBg,
    color: isActive ? 'white' : textColor,
    border: `1px solid ${borderColor}`,
    borderRadius: '4px',
    marginLeft: '5px',
    cursor: 'pointer',
    transition: 'all 0.3s ease'
  });

  const printButtonStyle = {
    padding: '10px 25px',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  };

  return (
    <div style={{
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto',
      direction: isRtl ? 'rtl' : 'ltr',
      backgroundColor: bgColor,
      color: textColor,
      minHeight: '100vh',
      transition: 'all 0.3s ease'
    }}>
      {/* Header مع زرار اللغة والدارك مود */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <h1 style={{ margin: 0, color: textColor }}>التقارير</h1>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={toggleLang}
            style={{
              padding: '8px 16px',
              background: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
              border: `1px solid ${borderColor}`,
              color: textColor,
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 'bold'
            }}
          >
            {lang === 'ar' ? 'English' : 'العربية'}
          </button>
          <ThemeToggle />
          <button
            onClick={() => window.location.href = '/dashboard'}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            رجوع للوحة التحكم
          </button>
        </div>
      </div>

      {/* التبويبات */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('movements')}
          style={tabButtonStyle(activeTab === 'movements')}
        >
          حركات المخزون
        </button>
        <button
          onClick={() => setActiveTab('stock')}
          style={tabButtonStyle(activeTab === 'stock')}
        >
          رصيد المخزون
        </button>
        <button
          onClick={() => setActiveTab('card')}
          style={tabButtonStyle(activeTab === 'card')}
        >
          كارت صنف
        </button>
      </div>

      {/* كارت صنف */}
      {activeTab === 'card' && (
        <div>
          <h3 style={{ color: textColor }}>كارت صنف - تقرير مفصل</h3>

          <form onSubmit={fetchCardReport} style={{
            color: textColor,
            backgroundColor: cardBg,
            border: `1px solid ${borderColor}`,
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div>
                <label style={{ color: textColor }}>الصنف:</label>
                <select
                  value={cardFilter.item_id}
                  onChange={(e) => setCardFilter({...cardFilter, item_id: e.target.value})}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: inputBg,
                    color: textColor,
                    border: `1px solid ${inputBorder}`,
                    borderRadius: '4px'
                  }}
                >
                  <option value="" style={{ backgroundColor: inputBg, color: textColor }}>اختر الصنف</option>
                  {items.map(item => (
                    <option key={item.id} value={item.id} style={{ backgroundColor: inputBg, color: textColor }}>
                      {item.code} - {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ color: textColor }}>المخزن:</label>
                <select
                  value={cardFilter.warehouse_id}
                  onChange={(e) => setCardFilter({...cardFilter, warehouse_id: e.target.value})}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: inputBg,
                    color: textColor,
                    border: `1px solid ${inputBorder}`,
                    borderRadius: '4px'
                  }}
                >
                  <option value="" style={{ backgroundColor: inputBg, color: textColor }}>اختر المخزن</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id} style={{ backgroundColor: inputBg, color: textColor }}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ color: textColor }}>من تاريخ:</label>
                <input
                  type="date"
                  value={cardFilter.from_date}
                  onChange={(e) => setCardFilter({...cardFilter, from_date: e.target.value})}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: inputBg,
                    color: textColor,
                    border: `1px solid ${inputBorder}`,
                    borderRadius: '4px'
                  }}
                />
              </div>
              <div>
                <label style={{ color: textColor }}>إلى تاريخ:</label>
                <input
                  type="date"
                  value={cardFilter.to_date}
                  onChange={(e) => setCardFilter({...cardFilter, to_date: e.target.value})}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: inputBg,
                    color: textColor,
                    border: `1px solid ${inputBorder}`,
                    borderRadius: '4px'
                  }}
                />
              </div>
            </div>
            <button type="submit" style={{
              marginTop: '15px',
              padding: '10px 30px',
              backgroundColor: '#0d9488',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}>
              عرض التقرير
            </button>
          </form>

          {cardData && (
            <div>
              {/* زر الطباعة */}
              <button
                onClick={handlePrint}
                style={{ ...printButtonStyle, marginBottom: '15px' }}
              >
                🖨️ طباعة التقرير
              </button>

              <div ref={printRef}>
                {/* ملخص الرصيد */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '15px',
                  marginBottom: '20px'
                }}>
                  <div style={{
                    backgroundColor: summaryBg1,
                    padding: '20px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    border: `1px solid ${borderColor}`
                  }}>
                    <div style={{ fontSize: '14px', color: summaryText1 }}>رصيد أول</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: summaryText1 }}>
                      {cardData.opening_balance}
                    </div>
                  </div>
                  <div style={{
                    backgroundColor: summaryBg2,
                    padding: '20px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    border: `1px solid ${borderColor}`
                  }}>
                    <div style={{ fontSize: '14px', color: summaryText2 }}>الحركات</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: summaryText2 }}>
                      {cardData.movements.length}
                    </div>
                  </div>
                  <div style={{
                    backgroundColor: summaryBg3,
                    padding: '20px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    border: `1px solid ${borderColor}`
                  }}>
                    <div style={{ fontSize: '14px', color: summaryText3 }}>رصيد آخر</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: summaryText3 }}>
                      {cardData.closing_balance}
                    </div>
                  </div>
                </div>

                {/* جدول الحركات */}
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  backgroundColor: cardBg,
                  border: `1px solid ${borderColor}`
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0d9488', color: 'white' }}>
                      <th style={thStyle}>التاريخ</th>
                      <th style={thStyle}>البيان</th>
                      <th style={thStyle}>نوع الحركة</th>
                      <th style={thStyle}>وارد</th>
                      <th style={thStyle}>منصرف</th>
                      <th style={thStyle}>الرصيد</th>
                      <th style={thStyle}>المستخدم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* سطر رصيد أول */}
                    <tr style={{
                      backgroundColor: summaryBg1,
                      fontWeight: 'bold'
                    }}>
                      <td style={tdStyle} colSpan="5">رصيد أول الفترة</td>
                      <td style={tdStyle}>{cardData.opening_balance}</td>
                      <td style={tdStyle}>-</td>
                    </tr>

                    {cardData.movements.map((mov) => (
                      <tr key={mov.unique_key} style={{
                        backgroundColor: mov.id % 2 === 0 ? rowEven : rowOdd
                      }}>
                        <td style={tdStyle}>{formatDate(mov.moved_at)}</td>
                        <td style={tdStyle}>
                          {mov.reference_type === 'request' ? 'طلب صرف' : 'اذن اضافة'}
                          {mov.reference_id ? ` #${mov.reference_id}` : ''}
                          {mov.voucher_number ? ` (${mov.voucher_number})` : ''}
                        </td>
                        <td style={tdStyle}>
                          {mov.movement_type === 'in'
                            ? <span style={{ color: '#28a745', fontWeight: 'bold' }}>وارد</span>
                            : <span style={{ color: '#dc3545', fontWeight: 'bold' }}>منصرف</span>}
                        </td>
                        <td style={tdStyle}>{mov.movement_type === 'in' ? mov.quantity : '-'}</td>
                        <td style={tdStyle}>{mov.movement_type === 'out' ? mov.quantity : '-'}</td>
                        <td style={tdStyle}><strong>{mov.running_balance}</strong></td>
                        <td style={tdStyle}>{mov.done_by_name || '-'}</td>
                      </tr>
                    ))}

                    {/* سطر رصيد آخر */}
                    <tr style={{
                      backgroundColor: summaryBg3,
                      fontWeight: 'bold'
                    }}>
                      <td style={tdStyle} colSpan="5">رصيد آخر الفترة</td>
                      <td style={tdStyle}>{cardData.closing_balance}</td>
                      <td style={tdStyle}>-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'movements' && (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '15px'
          }}>
            <h3 style={{ margin: 0, color: textColor }}>حركات المخزون</h3>
            <button
              onClick={handlePrintMovements}
              style={printButtonStyle}
            >
              🖨️ طباعة التقرير
            </button>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: subTextColor, marginBottom: '4px' }}>من تاريخ</label>
              <input type="date" value={movementFilter.from_date}
                onChange={e => setMovementFilter({ ...movementFilter, from_date: e.target.value })}
                style={{ padding: '8px', borderRadius: '6px', border: `1px solid ${borderColor}` }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: subTextColor, marginBottom: '4px' }}>إلى تاريخ</label>
              <input type="date" value={movementFilter.to_date}
                onChange={e => setMovementFilter({ ...movementFilter, to_date: e.target.value })}
                style={{ padding: '8px', borderRadius: '6px', border: `1px solid ${borderColor}` }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: subTextColor, marginBottom: '4px' }}>المخزن</label>
              <select value={movementFilter.warehouse_id}
                onChange={e => setMovementFilter({ ...movementFilter, warehouse_id: e.target.value })}
                style={{ padding: '8px', borderRadius: '6px', border: `1px solid ${borderColor}` }}>
                <option value="">الكل</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: subTextColor, marginBottom: '4px' }}>نوع الحركة</label>
              <select value={movementFilter.movement_type}
                onChange={e => setMovementFilter({ ...movementFilter, movement_type: e.target.value })}
                style={{ padding: '8px', borderRadius: '6px', border: `1px solid ${borderColor}` }}>
                <option value="">الكل</option>
                <option value="in">اضافة</option>
                <option value="out">صرف</option>
              </select>
            </div>
            <button onClick={() => fetchMovements()} style={{ padding: '9px 20px', background: '#0d9488', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              🔍 بحث
            </button>
            <button onClick={() => { const cleared = { warehouse_id: '', movement_type: '', from_date: '', to_date: '' }; setMovementFilter(cleared); fetchMovements(cleared); }}
              style={{ padding: '9px 20px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              إلغاء الفلاتر
            </button>
          </div>
          <div ref={movementsPrintRef}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              backgroundColor: cardBg,
              border: `1px solid ${borderColor}`
            }}>
              <thead>
                <tr style={{ backgroundColor: '#0d9488', color: 'white' }}>
                  <th style={thStyle}>التاريخ</th>
                  <th style={thStyle}>الصنف</th>
                  <th style={thStyle}>المخزن</th>
                  <th style={thStyle}>النوع</th>
                  <th style={thStyle}>الكمية</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{
                      textAlign: 'center',
                      padding: '20px',
                      color: subTextColor
                    }}>
                      لا يوجد حركات
                    </td>
                  </tr>
                ) : (
                  movements.map(mov => (
                    <tr key={mov.id} style={{
                      backgroundColor: mov.id % 2 === 0 ? rowEven : rowOdd
                    }}>
                      <td style={tdStyle}>{formatDate(mov.moved_at)}</td>
                      <td style={tdStyle}>{mov.item_name}</td>
                      <td style={tdStyle}>{mov.warehouse_name}</td>
                      <td style={tdStyle}>
                        {mov.movement_type === 'in'
                          ? <span style={{ color: '#28a745', fontWeight: 'bold' }}>اضافة</span>
                          : <span style={{ color: '#dc3545', fontWeight: 'bold' }}>صرف</span>}
                      </td>
                      <td style={tdStyle}>{mov.quantity}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'stock' && (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '15px'
          }}>
            <h3 style={{ margin: 0, color: textColor }}>رصيد المخزون</h3>
            <button
              onClick={handlePrintStock}
              style={printButtonStyle}
            >
              🖨️ طباعة التقرير
            </button>
          </div>
          <div ref={stockPrintRef}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              backgroundColor: cardBg,
              border: `1px solid ${borderColor}`
            }}>
              <thead>
                <tr style={{ backgroundColor: '#0d9488', color: 'white' }}>
                  <th style={thStyle}>كود الصنف</th>
                  <th style={thStyle}>اسم الصنف</th>
                  <th style={thStyle}>المخزن</th>
                  <th style={thStyle}>الوحدة</th>
                  <th style={thStyle}>الكمية</th>
                  <th style={thStyle}>تكلفة القطعة</th>
                  <th style={thStyle}>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {stock.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{
                      textAlign: 'center',
                      padding: '20px',
                      color: subTextColor
                    }}>
                      لا يوجد اصناف
                    </td>
                  </tr>
                ) : (
                  stock.map(item => (
                    <tr key={item.id} style={{
                      backgroundColor: item.id % 2 === 0 ? rowEven : rowOdd
                    }}>
                      <td style={tdStyle}>{item.code}</td>
                      <td style={tdStyle}>{item.name}</td>
                      <td style={tdStyle}>{item.warehouse_name}</td>
                      <td style={tdStyle}>{item.unit}</td>
                      <td style={tdStyle}><strong>{item.quantity || 0}</strong></td>
                      <td style={tdStyle}>{item.unit_cost ? item.unit_cost + ' ج.م' : '-'}</td>
                      <td style={tdStyle}>{item.is_active ? 'نشط' : 'غير نشط'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reports;
