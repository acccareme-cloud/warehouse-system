import { useState, useEffect } from 'react';
import api from '../services/api';

function Movements() {
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [movements, setMovements] = useState([]);
  const [formData, setFormData] = useState({
    item_id: '',
    warehouse_id: '',
    movement_type: 'out',
    quantity: 1,
    unit_price: 0,
    tax_discount_percent: 0,
    reference_type: 'request',
    reference_id: ''
  });
  const [calculations, setCalculations] = useState({
    subtotal: 0,
    tax14: 0,
    taxDiscount: 0,
    total: 0
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchItems();
    fetchWarehouses();
    fetchMovements();
  }, []);

  useEffect(() => {
    calculateTotals();
  }, [formData.quantity, formData.unit_price, formData.tax_discount_percent]);

  const calculateTotals = () => {
    const qty = parseFloat(formData.quantity) || 0;
    const price = parseFloat(formData.unit_price) || 0;
    const subtotal = qty * price;
    const tax14 = subtotal * 0.14;
    const taxDiscountRate = parseFloat(formData.tax_discount_percent) || 0;
    const taxDiscount = subtotal * (taxDiscountRate / 100);
    const total = subtotal + tax14 - taxDiscount;

    setCalculations({
      subtotal: subtotal.toFixed(2),
      tax14: tax14.toFixed(2),
      taxDiscount: taxDiscount.toFixed(2),
      total: total.toFixed(2)
    });
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/movements', formData);
      setMessage('تم تسجيل الحركة بنجاح');
      setFormData({
        item_id: '',
        warehouse_id: '',
        movement_type: 'out',
        quantity: 1,
        unit_price: 0,
        tax_discount_percent: 0,
        reference_type: 'request',
        reference_id: ''
      });
      fetchMovements();
    } catch (err) {
      setMessage('خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const thStyle = { padding: '12px', border: '1px solid #ddd' };
  const tdStyle = { padding: '10px', border: '1px solid #ddd' };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>صرف مخزون</h1>
      
      <button 
        onClick={() => window.location.href = '/dashboard'}
        style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', marginBottom: '20px', cursor: 'pointer' }}
      >
        رجوع للوحة التحكم
      </button>

      {message && <p style={{ padding: '10px', backgroundColor: message.includes('نجاح') ? '#d4edda' : '#f8d7da', borderRadius: '4px' }}>{message}</p>}

      <form onSubmit={handleSubmit} style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3>تسجيل حركة مخزون</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div>
            <label>الصنف:</label>
            <select value={formData.item_id} onChange={(e) => setFormData({...formData, item_id: e.target.value})} required style={{ width: '100%', padding: '8px' }}>
              <option value="">اختر الصنف</option>
              {items.map(item => (
                <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label>المخزن:</label>
            <select value={formData.warehouse_id} onChange={(e) => setFormData({...formData, warehouse_id: e.target.value})} required style={{ width: '100%', padding: '8px' }}>
              <option value="">اختر المخزن</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label>نوع الحركة:</label>
            <select value={formData.movement_type} onChange={(e) => setFormData({...formData, movement_type: e.target.value})} required style={{ width: '100%', padding: '8px' }}>
              <option value="in">اضافة</option>
              <option value="out">صرف</option>
            </select>
          </div>
          <div>
            <label>الكمية:</label>
            <input type="number" step="0.001" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: e.target.value})} required min="0.001" style={{ width: '100%', padding: '8px' }} />
          </div>
          <div>
            <label>سعر البيع (جنية):</label>
            <input type="number" step="0.01" value={formData.unit_price} onChange={(e) => setFormData({...formData, unit_price: e.target.value})} required style={{ width: '100%', padding: '8px' }} placeholder="0.00" />
          </div>
          <div>
            <label>ضريبة الخصم (%):</label>
            <select value={formData.tax_discount_percent} onChange={(e) => setFormData({...formData, tax_discount_percent: e.target.value})} style={{ width: '100%', padding: '8px' }}>
              <option value="0">0%</option>
              <option value="1">1%</option>
              <option value="3">3%</option>
            </select>
          </div>
          <div>
            <label>نوع المرجع:</label>
            <select value={formData.reference_type} onChange={(e) => setFormData({...formData, reference_type: e.target.value})} style={{ width: '100%', padding: '8px' }}>
              <option value="request">طلب صرف</option>
              <option value="receipt">اذن اضافة</option>
            </select>
          </div>
          <div>
            <label>رقم المرجع:</label>
            <input type="number" value={formData.reference_id} onChange={(e) => setFormData({...formData, reference_id: e.target.value})} style={{ width: '100%', padding: '8px' }} placeholder="رقم الطلب/الاذن" />
          </div>
        </div>

        {/* حسابات الضرائب */}
        <div style={{ backgroundColor: '#e2e8f0', padding: '15px', borderRadius: '8px', marginTop: '15px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>الاجمالي</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b' }}>{calculations.subtotal} ج.م</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>ضريبة 14%</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#dc2626' }}>+{calculations.tax14} ج.م</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>ضريبة خصم ({formData.tax_discount_percent}%)</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#059669' }}>-{calculations.taxDiscount} ج.م</div>
          </div>
          <div style={{ textAlign: 'center', border: '2px solid #ea580c', borderRadius: '8px', padding: '5px' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>الصافي</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ea580c' }}>{calculations.total} ج.م</div>
          </div>
        </div>

        <button type="submit" style={{ marginTop: '15px', padding: '10px 30px', backgroundColor: '#ea580c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          تسجيل الحركة
        </button>
      </form>

      <h3>سجل الحركات</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
        <thead>
          <tr style={{ backgroundColor: '#ea580c', color: 'white' }}>
            <th style={thStyle}>التاريخ</th>
            <th style={thStyle}>الصنف</th>
            <th style={thStyle}>المخزن</th>
            <th style={thStyle}>النوع</th>
            <th style={thStyle}>الكمية</th>
            <th style={thStyle}>سعر البيع</th>
            <th style={thStyle}>الاجمالي</th>
            <th style={thStyle}>ض.ق.م 14%</th>
            <th style={thStyle}>ض.خصم</th>
            <th style={thStyle}>الصافي</th>
          </tr>
        </thead>
        <tbody>
          {movements.length === 0 ? (
            <tr><td colSpan="10" style={{ textAlign: 'center', padding: '20px' }}>لا يوجد حركات</td></tr>
          ) : (
            movements.map(mov => (
              <tr key={mov.id} style={{ backgroundColor: mov.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                <td style={tdStyle}>{new Date(mov.moved_at).toLocaleString('ar-EG')}</td>
                <td style={tdStyle}>{mov.item_name}</td>
                <td style={tdStyle}>{mov.warehouse_name}</td>
                <td style={tdStyle}>
                  {mov.movement_type === 'in' ? <span style={{ color: '#28a745', fontWeight: 'bold' }}>اضافة</span> : <span style={{ color: '#dc3545', fontWeight: 'bold' }}>صرف</span>}
                </td>
                <td style={tdStyle}>{mov.quantity}</td>
                <td style={tdStyle}>{mov.unit_price} ج.م</td>
                <td style={tdStyle}>{(mov.quantity * mov.unit_price).toFixed(2)} ج.م</td>
                <td style={tdStyle}>{mov.tax_14_percent} ج.م</td>
                <td style={tdStyle}>{mov.tax_discount_amount} ج.م</td>
                <td style={tdStyle}><strong>{mov.total_amount} ج.م</strong></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Movements;