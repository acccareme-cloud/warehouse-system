import { useState, useEffect } from 'react';
import api from '../services/api';

function Requests() {
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [requests, setRequests] = useState([]);
  const [availableSerials, setAvailableSerials] = useState([]);
  const [selectedSerials, setSelectedSerials] = useState([]);
  
  const [formData, setFormData] = useState({
    request_number: '',
    department: '',
    item_id: '',
    warehouse_id: '',
    quantity: 1,
    work_order: '',
    customer_name: '',
    salesperson: '',
    notes: ''
  });
  
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchItems();
    fetchWarehouses();
    fetchRequests();
    generateRequestNumber();
  }, []);

  // لما يختار الصنف والمخزن، نجيب السريالات المتوفرة
  useEffect(() => {
    if (formData.item_id && formData.warehouse_id) {
      fetchAvailableSerials();
    } else {
      setAvailableSerials([]);
      setSelectedSerials([]);
    }
  }, [formData.item_id, formData.warehouse_id, formData.quantity]);

  const generateRequestNumber = () => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setFormData(prev => ({...prev, request_number: `REQ-${date}-${random}`}));
  };

  const fetchAvailableSerials = async () => {
    try {
      const response = await api.get(`/serials/available?item_id=${formData.item_id}&warehouse_id=${formData.warehouse_id}`);
      setAvailableSerials(response.data);
    } catch (err) {
      console.error('خطأ في تحميل السريالات:', err);
      setAvailableSerials([]);
    }
  };

  const handleSerialSelect = (serialId) => {
    setSelectedSerials(prev => {
      if (prev.includes(serialId)) {
        return prev.filter(id => id !== serialId);
      }
      if (prev.length >= parseInt(formData.quantity)) {
        setMessage('لا يمكن اختيار أكثر من ' + formData.quantity + ' سريال');
        setTimeout(() => setMessage(''), 3000);
        return prev;
      }
      return [...prev, serialId];
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

  const fetchRequests = async () => {
    try {
      const response = await api.get('/requests/my-requests');
      setRequests(response.data);
    } catch (err) {
      console.error('خطأ في تحميل الطلبات');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // التحقق من السريالات
    const selectedItem = items.find(i => i.id == formData.item_id);
    if (selectedItem?.has_serial && selectedSerials.length !== parseInt(formData.quantity)) {
      setMessage('خطأ: يجب اختيار ' + formData.quantity + ' سريال');
      return;
    }
    
    try {
      const dataToSend = {
        ...formData,
        selected_serials: selectedSerials
      };
      
      await api.post('/requests', dataToSend);
      setMessage('تم ارسال طلب الصرف بنجاح');
      
      setFormData({
        request_number: '',
        department: '',
        item_id: '',
        warehouse_id: '',
        quantity: 1,
        work_order: '',
        customer_name: '',
        salesperson: '',
        notes: ''
      });
      setSelectedSerials([]);
      setAvailableSerials([]);
      
      generateRequestNumber();
      fetchRequests();
    } catch (err) {
      setMessage('خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const thStyle = { padding: '12px', border: '1px solid #ddd' };
  const tdStyle = { padding: '10px', border: '1px solid #ddd', color: '#1e293b' };

  // نجيب معلومات الصنف المختار
  const selectedItem = items.find(i => i.id == formData.item_id);

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1>طلب صرف من المخزن</h1>
      
      <button 
        onClick={() => window.location.href = '/dashboard'}
        style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', marginBottom: '20px', cursor: 'pointer' }}
      >
        رجوع للوحة التحكم
      </button>

      {message && <p style={{ padding: '10px', backgroundColor: message.includes('نجاح') ? '#d4edda' : '#f8d7da', borderRadius: '4px' }}>{message}</p>}

      <form onSubmit={handleSubmit} style={{ color: '#1e293b', backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3>طلب صرف جديد</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div>
            <label>رقم الطلب (تلقائي):</label>
            <div style={{ display: 'flex', gap: '5px' }}>
              <input 
                type="text" 
                value={formData.request_number} 
                readOnly
                style={{ color: '#1e293b', flex: 1, padding: '8px', backgroundColor: '#e2e8f0' }} 
              />
              <button 
                type="button" 
                onClick={generateRequestNumber} 
                style={{ padding: '8px 15px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                توليد
              </button>
            </div>
          </div>
          <div>
            <label>القسم:</label>
            <select value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} required style={{ width: '100%', padding: '8px' }}>
              <option value="">اختر القسم</option>
              <option value="المبيعات">المبيعات</option>
              <option value="الصيانة">الصيانة</option>
              <option value="الإنتاج">الإنتاج</option>
              <option value="المخازن">المخازن</option>
              <option value="الإدارة">الإدارة</option>
            </select>
          </div>
          <div>
            <label>الصنف:</label>
            <select value={formData.item_id} onChange={(e) => setFormData({...formData, item_id: e.target.value, quantity: 1, selected_serials: []})} required style={{ width: '100%', padding: '8px' }}>
              <option value="">اختر الصنف</option>
              {items.map(item => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name} {item.has_serial ? '✓' : ''}
                </option>
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
            <label>الكمية:</label>
            <input 
              type="number" 
              step="1" 
              min="1" 
              max={availableSerials.length || 999}
              value={formData.quantity} 
              onChange={(e) => {
                const qty = parseInt(e.target.value) || 1;
                setFormData({...formData, quantity: qty});
                setSelectedSerials([]); // إعادة تعيين السريالات المختارة
              }} 
              required 
              style={{ width: '100%', padding: '8px' }} 
            />
          </div>
          <div>
            <label>رقم أمر العمل (اختياري):</label>
            <input type="text" value={formData.work_order} onChange={(e) => setFormData({...formData, work_order: e.target.value})} style={{ width: '100%', padding: '8px' }} placeholder="مثال: WO-2024-001" />
          </div>
          
          <div>
            <label>اسم العميل:</label>
            <input 
              type="text" 
              value={formData.customer_name} 
              onChange={(e) => setFormData({...formData, customer_name: e.target.value})} 
              required 
              style={{ width: '100%', padding: '8px' }} 
              placeholder="اسم العميل الكريم" 
            />
          </div>
          <div>
            <label>القائم بالبيع:</label>
            <input 
              type="text" 
              value={formData.salesperson} 
              onChange={(e) => setFormData({...formData, salesperson: e.target.value})} 
              required 
              style={{ width: '100%', padding: '8px' }} 
              placeholder="اسم موظف المبيعات" 
            />
          </div>
          <div>
            <label>ملاحظات:</label>
            <input type="text" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} style={{ width: '100%', padding: '8px' }} placeholder="أي ملاحظات إضافية" />
          </div>
        </div>

        {/* اختيار السريالات */}
        {formData.item_id && formData.warehouse_id && availableSerials.length > 0 && (
          <div style={{ color: '#1e293b', marginTop: '20px', backgroundColor: '#e0f2fe', padding: '15px', borderRadius: '8px', border: '2px solid #0d9488' }}>
            <h4 style={{ color: '#0d9488', marginBottom: '15px' }}>
              🔢 اختيار السريالات ({selectedSerials.length} / {formData.quantity})
            </h4>
            <p style={{ color: '#64748b', marginBottom: '10px', fontSize: '14px' }}>
              متوفر {availableSerials.length} سريال. اختر {formData.quantity} سريال
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              {availableSerials.map(serial => (
                <div 
                  key={serial.id}
                  onClick={() => handleSerialSelect(serial.id)}
                  style={{ 
                    padding: '10px', 
                    border: '2px solid',
                    borderColor: selectedSerials.includes(serial.id) ? '#0d9488' : '#ddd',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: selectedSerials.includes(serial.id) ? '#d1fae5' : 'white',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '12px', color: '#64748b' }}>سريال #</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: selectedSerials.includes(serial.id) ? '#0d9488' : '#1e293b' }}>
                    {serial.serial_number}
                  </div>
                  {selectedSerials.includes(serial.id) && (
                    <div style={{ color: '#0d9488', fontSize: '12px' }}>✓ تم الاختيار</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {formData.item_id && formData.warehouse_id && availableSerials.length === 0 && (
          <p style={{ color: '#dc2626', marginTop: '10px' }}>
            ⚠️ لا يوجد سريالات متوفرة لهذا الصنف في المخزن المختار
          </p>
        )}

        <button type="submit" style={{ marginTop: '15px', padding: '12px 40px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
          📤 إرسال الطلب
        </button>
      </form>

      <h3>الطلبات المرسلة</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
        <thead>
          <tr style={{ backgroundColor: '#007bff', color: 'white' }}>
            <th style={thStyle}>رقم الطلب</th>
            <th style={thStyle}>القسم</th>
            <th style={thStyle}>الصنف</th>
            <th style={thStyle}>المخزن</th>
            <th style={thStyle}>الكمية</th>
            <th style={thStyle}>العميل</th>
            <th style={thStyle}>القائم بالبيع</th>
            <th style={thStyle}>أمر العمل</th>
            <th style={thStyle}>الحالة</th>
          </tr>
        </thead>
        <tbody>
          {requests.length === 0 ? (
            <tr><td colSpan="9" style={{ textAlign: 'center', padding: '20px' }}>لا يوجد طلبات</td></tr>
          ) : (
            requests.map(r => (
              <tr key={r.id} style={{ backgroundColor: r.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                <td style={tdStyle}>{r.request_number}</td>
                <td style={tdStyle}>{r.department}</td>
                <td style={tdStyle}>{r.item_name}</td>
                <td style={tdStyle}>{r.warehouse_name}</td>
                <td style={tdStyle}>{r.quantity}</td>
                <td style={tdStyle}><strong>{r.customer_name || '-'}</strong></td>
                <td style={tdStyle}>{r.salesperson || '-'}</td>
                <td style={tdStyle}>{r.work_order || '-'}</td>
                <td style={tdStyle}>
                  {r.status === 'pending' && <span style={{ color: '#ffc107' }}>بانتظار الاعتماد</span>}
                  {r.status === 'approved' && <span style={{ color: '#28a745' }}>معتمد</span>}
                  {r.status === 'rejected' && <span style={{ color: '#dc3545' }}>مرفوض</span>}
                  {r.status === 'completed' && <span style={{ color: '#007bff' }}>تم الصرف</span>}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Requests;