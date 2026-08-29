import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

function Reports() {
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
    from_date: '',
    to_date: ''
  });

  const printRef = useRef();

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

  const fetchMovements = async () => {
    try {
      const response = await api.get('/movements');
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
            .summary { display: flex; justify-content: space-around; margin: 20px 0; }
            .summary-box { border: 2px solid #333; padding: 15px; text-align: center; width: 30%; }
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

  // تنسيق التاريخ
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG');
  };

  const thStyle = { padding: '12px', border: '1px solid #ddd' };
  const tdStyle = { padding: '10px', border: '1px solid #ddd' };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>التقارير</h1>
      
      <button 
        onClick={() => window.location.href = '/dashboard'}
        style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', marginBottom: '20px', cursor: 'pointer' }}
      >
        رجوع للوحة التحكم
      </button>

      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={() => setActiveTab('movements')}
          style={{ padding: '10px 20px', backgroundColor: activeTab === 'movements' ? '#0d9488' : '#e2e8f0', color: activeTab === 'movements' ? 'white' : '#333', border: 'none', borderRadius: '4px', marginLeft: '5px', cursor: 'pointer' }}
        >
          حركات المخزون
        </button>
        <button 
          onClick={() => setActiveTab('stock')}
          style={{ padding: '10px 20px', backgroundColor: activeTab === 'stock' ? '#0d9488' : '#e2e8f0', color: activeTab === 'stock' ? 'white' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          رصيد المخزون
        </button>
        <button 
          onClick={() => setActiveTab('card')}
          style={{ padding: '10px 20px', backgroundColor: activeTab === 'card' ? '#0d9488' : '#e2e8f0', color: activeTab === 'card' ? 'white' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          كارت صنف
        </button>
      </div>

      {/* كارت صنف */}
      {activeTab === 'card' && (
        <div>
          <h3>كارت صنف - تقرير مفصل</h3>
          
          <form onSubmit={fetchCardReport} style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div>
                <label>الصنف:</label>
                <select value={cardFilter.item_id} onChange={(e) => setCardFilter({...cardFilter, item_id: e.target.value})} required style={{ width: '100%', padding: '8px' }}>
                  <option value="">اختر الصنف</option>
                  {items.map(item => (
                    <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>المخزن:</label>
                <select value={cardFilter.warehouse_id} onChange={(e) => setCardFilter({...cardFilter, warehouse_id: e.target.value})} required style={{ width: '100%', padding: '8px' }}>
                  <option value="">اختر المخزن</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>من تاريخ:</label>
                <input type="date" value={cardFilter.from_date} onChange={(e) => setCardFilter({...cardFilter, from_date: e.target.value})} required style={{ width: '100%', padding: '8px' }} />
              </div>
              <div>
                <label>إلى تاريخ:</label>
                <input type="date" value={cardFilter.to_date} onChange={(e) => setCardFilter({...cardFilter, to_date: e.target.value})} required style={{ width: '100%', padding: '8px' }} />
              </div>
            </div>
            <button type="submit" style={{ marginTop: '15px', padding: '10px 30px', backgroundColor: '#0d9488', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              عرض التقرير
            </button>
          </form>

          {cardData && (
            <div>
              {/* زر الطباعة */}
              <button 
                onClick={handlePrint}
                style={{ padding: '10px 25px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginBottom: '15px', fontSize: '14px', fontWeight: '600' }}
              >
                🖨️ طباعة التقرير
              </button>

              <div ref={printRef}>
                {/* ملخص الرصيد */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px' }}>
                  <div style={{ backgroundColor: '#e0f2fe', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', color: '#0369a1' }}>رصيد أول</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0369a1' }}>{cardData.opening_balance}</div>
                  </div>
                  <div style={{ backgroundColor: '#fef3c7', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', color: '#92400e' }}>الحركات</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#92400e' }}>{cardData.movements.length}</div>
                  </div>
                  <div style={{ backgroundColor: '#dcfce7', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', color: '#166534' }}>رصيد آخر</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#166534' }}>{cardData.closing_balance}</div>
                  </div>
                </div>

                {/* جدول الحركات */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                    <tr style={{ backgroundColor: '#e0f2fe', fontWeight: 'bold' }}>
                      <td style={tdStyle} colSpan="5">رصيد أول الفترة</td>
                      <td style={tdStyle}>{cardData.opening_balance}</td>
                      <td style={tdStyle}>-</td>
                    </tr>
                    
                    {cardData.movements.map((mov) => (
                      <tr key={mov.unique_key} style={{ backgroundColor: mov.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
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
                    <tr style={{ backgroundColor: '#dcfce7', fontWeight: 'bold' }}>
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
          <h3>حركات المخزون</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
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
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>لا يوجد حركات</td></tr>
              ) : (
                movements.map(mov => (
                  <tr key={mov.id} style={{ backgroundColor: mov.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                    <td style={tdStyle}>{formatDate(mov.moved_at)}</td>
                    <td style={tdStyle}>{mov.item_name}</td>
                    <td style={tdStyle}>{mov.warehouse_name}</td>
                    <td style={tdStyle}>
                      {mov.movement_type === 'in' ? <span style={{ color: '#28a745', fontWeight: 'bold' }}>اضافة</span> : <span style={{ color: '#dc3545', fontWeight: 'bold' }}>صرف</span>}
                    </td>
                    <td style={tdStyle}>{mov.quantity}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'stock' && (
        <div>
          <h3>رصيد المخزون</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
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
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>لا يوجد اصناف</td></tr>
              ) : (
                stock.map(item => (
                  <tr key={item.id} style={{ backgroundColor: item.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
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
      )}
    </div>
  );
}

export default Reports;