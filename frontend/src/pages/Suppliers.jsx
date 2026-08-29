import { useState, useEffect } from 'react';
import api from '../services/api';

function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // Locations
  const [countries, setCountries] = useState([]);
  const [governorates, setGovernorates] = useState([]);
  const [cities, setCities] = useState([]);
  
  const [formData, setFormData] = useState({
    supplier_code: '',
    supplier_name: '',
    supplier_type: 'local',
    is_service_provider: false,
    tax_number: '',
    commercial_registration: '',
    address: '',
    phone: '',
    email: '',
    contact_person: '',
    credit_limit: 0,
    country_id: '',
    governorate_id: '',
    city_id: '',
    is_active: true
  });
  
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSuppliers();
    fetchCountries();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/suppliers');
      setSuppliers(response.data);
    } catch (err) {
      console.error('خطأ في تحميل الموردين');
    }
  };

  const fetchCountries = async () => {
    try {
      const response = await api.get('/locations/countries');
      setCountries(response.data);
    } catch (err) {
      console.error('خطأ في تحميل الدول');
    }
  };

  const fetchGovernorates = async (countryId) => {
    if (!countryId) {
      setGovernorates([]);
      setCities([]);
      return;
    }
    try {
      const response = await api.get(`/locations/governorates/${countryId}`);
      setGovernorates(response.data);
    } catch (err) {
      console.error('خطأ في تحميل المحافظات');
    }
  };

  const fetchCities = async (governorateId) => {
    if (!governorateId) {
      setCities([]);
      return;
    }
    try {
      const response = await api.get(`/locations/cities/${governorateId}`);
      setCities(response.data);
    } catch (err) {
      console.error('خطأ في تحميل المدن');
    }
  };

  const fetchNextCode = async () => {
    try {
      const response = await api.get('/suppliers/next-code');
      setFormData(prev => ({
        ...prev, 
        supplier_code: response.data.code || ''
      }));
    } catch (err) {
      console.error('خطأ في توليد الكود:', err);
      setFormData(prev => ({ ...prev, supplier_code: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/suppliers/${editingId}`, formData);
        setMessage('تم تعديل المورد بنجاح');
      } else {
        await api.post('/suppliers', formData);
        setMessage('تم اضافة المورد بنجاح');
      }
      setShowForm(false);
      setEditingId(null);
      resetForm();
      fetchSuppliers();
    } catch (err) {
      setMessage('خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const resetForm = () => {
    setFormData({
      supplier_code: '',
      supplier_name: '',
      supplier_type: 'local',
      is_service_provider: false,
      tax_number: '',
      commercial_registration: '',
      address: '',
      phone: '',
      email: '',
      contact_person: '',
      credit_limit: 0,
      country_id: '',
      governorate_id: '',
      city_id: '',
      is_active: true
    });
    setGovernorates([]);
    setCities([]);
  };

  const handleEdit = (supplier) => {
    setEditingId(supplier.id);
    setFormData({
      supplier_code: supplier.supplier_code || '',
      supplier_name: supplier.name || '',
      supplier_type: supplier.supplier_type || 'local',
      is_service_provider: !!supplier.is_service_provider,
      tax_number: supplier.tax_number || '',
      commercial_registration: supplier.commercial_registration || '',
      address: supplier.address || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      contact_person: supplier.contact_person || '',
      credit_limit: supplier.credit_limit || 0,
      country_id: supplier.country_id || '',
      governorate_id: supplier.governorate_id || '',
      city_id: supplier.city_id || '',
      is_active: supplier.is_active !== false
    });
    
    // نحمل المحافظات والمدن لو موجودين
    if (supplier.country_id) fetchGovernorates(supplier.country_id);
    if (supplier.governorate_id) fetchCities(supplier.governorate_id);
    
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المورد؟')) return;
    try {
      await api.delete(`/suppliers/${id}`);
      setMessage('تم حذف المورد بنجاح');
      fetchSuppliers();
    } catch (err) {
      setMessage('خطأ في الحذف: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const handleCountryChange = (e) => {
    const countryId = e.target.value;
    setFormData(prev => ({
      ...prev,
      country_id: countryId,
      governorate_id: '',
      city_id: ''
    }));
    fetchGovernorates(countryId);
    setCities([]);
  };

  const handleGovernorateChange = (e) => {
    const governorateId = e.target.value;
    setFormData(prev => ({
      ...prev,
      governorate_id: governorateId,
      city_id: ''
    }));
    fetchCities(governorateId);
  };

  const safeValue = (val) => val === undefined || val === null ? '' : val;

  const thStyle = { padding: '12px', border: '1px solid #ddd' };
  const tdStyle = { padding: '10px', border: '1px solid #ddd' };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>تكويد الموردين</h1>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={() => window.location.href = '/purchases-module'}
          style={{ padding: '10px 20px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          ← رجوع للمشتريات
        </button>
        <button 
          onClick={() => window.location.href = '/dashboard'}
          style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          🏠 رجوع للرئيسية
        </button>
      </div>

      {message && <p style={{ padding: '10px', backgroundColor: message.includes('نجاح') ? '#d4edda' : '#f8d7da', borderRadius: '4px' }}>{message}</p>}

      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => { 
          if (showForm) {
            setShowForm(false);
            setEditingId(null);
            resetForm();
          } else {
            setShowForm(true);
            fetchNextCode();
          }
        }} style={{ padding: '12px 25px', backgroundColor: showForm ? '#dc3545' : '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
          {showForm ? '❌ إلغاء' : '➕ مورد جديد'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ color: '#1e293b', backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
          <h3>{editingId ? 'تعديل مورد' : 'مورد جديد'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            
            {/* كود المورد */}
            <div>
              <label>كود المورد (تلقائي):</label>
              <input type="text" value={safeValue(formData.supplier_code)} readOnly style={{ color: '#1e293b', width: '100%', padding: '8px', backgroundColor: '#e2e8f0' }} />
            </div>
            
            {/* اسم المورد */}
            <div>
              <label>اسم المورد:</label>
              <input type="text" value={safeValue(formData.supplier_name)} onChange={(e) => setFormData({...formData, supplier_name: e.target.value})} required style={{ width: '100%', padding: '8px' }} />
            </div>
            
            {/* نوع المورد */}
            <div>
              <label>نوع المورد:</label>
              <select value={safeValue(formData.supplier_type)} onChange={(e) => setFormData({...formData, supplier_type: e.target.value})} style={{ width: '100%', padding: '8px' }}>
                <option value="local">محلي</option>
                <option value="import">استيراد</option>
                <option value="both">كلاهما</option>
              </select>
            </div>

            {/* مورد خدمة */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '22px' }}>
              <input type="checkbox" id="is_service_provider" checked={!!formData.is_service_provider} onChange={(e) => setFormData({...formData, is_service_provider: e.target.checked})} />
              <label htmlFor="is_service_provider">🏭 مورد خدمة (زي مخلص جمركي) — يظهر في قوائم عهد الخدمة</label>
            </div>
            
            {/* الدولة */}
            <div>
              <label>الدولة:</label>
              <select value={safeValue(formData.country_id)} onChange={handleCountryChange} style={{ width: '100%', padding: '8px' }}>
                <option value="">اختر الدولة</option>
                {countries.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            
            {/* المحافظة */}
            <div>
              <label>المحافظة:</label>
              <select value={safeValue(formData.governorate_id)} onChange={handleGovernorateChange} style={{ width: '100%', padding: '8px' }}>
                <option value="">اختر المحافظة</option>
                {governorates.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            
            {/* المدينة/المنطقة */}
            <div>
              <label>المدينة / المنطقة:</label>
              <select value={safeValue(formData.city_id)} onChange={(e) => setFormData({...formData, city_id: e.target.value})} style={{ width: '100%', padding: '8px' }}>
                <option value="">اختر المدينة</option>
                {cities.map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.area ? `- ${c.area}` : ''}</option>
                ))}
              </select>
            </div>
            
            {/* الرقم الضريبي */}
            <div>
              <label>الرقم الضريبي:</label>
              <input type="text" value={safeValue(formData.tax_number)} onChange={(e) => setFormData({...formData, tax_number: e.target.value})} style={{ width: '100%', padding: '8px' }} />
            </div>
            
            {/* السجل التجاري */}
            <div>
              <label>السجل التجاري:</label>
              <input type="text" value={safeValue(formData.commercial_registration)} onChange={(e) => setFormData({...formData, commercial_registration: e.target.value})} style={{ width: '100%', padding: '8px' }} />
            </div>
            
            {/* العنوان */}
            <div>
              <label>العنوان التفصيلي:</label>
              <input type="text" value={safeValue(formData.address)} onChange={(e) => setFormData({...formData, address: e.target.value})} style={{ width: '100%', padding: '8px' }} />
            </div>
            
            {/* التليفون */}
            <div>
              <label>التليفون:</label>
              <input type="text" value={safeValue(formData.phone)} onChange={(e) => setFormData({...formData, phone: e.target.value})} style={{ width: '100%', padding: '8px' }} />
            </div>
            
            {/* البريد */}
            <div>
              <label>البريد الإلكتروني:</label>
              <input type="email" value={safeValue(formData.email)} onChange={(e) => setFormData({...formData, email: e.target.value})} style={{ width: '100%', padding: '8px' }} />
            </div>
            
            {/* الشخص المسؤول */}
            <div>
              <label>الشخص المسؤول:</label>
              <input type="text" value={safeValue(formData.contact_person)} onChange={(e) => setFormData({...formData, contact_person: e.target.value})} style={{ width: '100%', padding: '8px' }} />
            </div>
            
            {/* حد الائتمان */}
            <div>
              <label>حد الائتمان:</label>
              <input type="number" value={formData.credit_limit || 0} onChange={(e) => setFormData({...formData, credit_limit: parseFloat(e.target.value) || 0})} style={{ width: '100%', padding: '8px' }} />
            </div>
            
            {/* الحالة (في التعديل بس) */}
            {editingId && (
              <div>
                <label>الحالة:</label>
                <select value={formData.is_active ? 'true' : 'false'} onChange={(e) => setFormData({...formData, is_active: e.target.value === 'true'})} style={{ width: '100%', padding: '8px' }}>
                  <option value="true">نشط</option>
                  <option value="false">غير نشط</option>
                </select>
              </div>
            )}
          </div>
          
          <button type="submit" style={{ marginTop: '15px', padding: '12px 40px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
            💾 {editingId ? 'تحديث المورد' : 'حفظ المورد'}
          </button>
        </form>
      )}

      <h3>قائمة الموردين</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
        <thead>
          <tr style={{ backgroundColor: '#dc2626', color: 'white' }}>
            <th style={thStyle}>الكود</th>
            <th style={thStyle}>الاسم</th>
            <th style={thStyle}>النوع</th>
            <th style={thStyle}>التليفون</th>
            <th style={thStyle}>الرقم الضريبي</th>
            <th style={thStyle}>حد الائتمان</th>
            <th style={thStyle}>الرصيد</th>
            <th style={thStyle}>الحالة</th>
            <th style={thStyle}>تعديل</th>
            <th style={thStyle}>حذف</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.length === 0 ? (
            <tr><td colSpan="10" style={{ textAlign: 'center', padding: '20px' }}>لا يوجد موردين</td></tr>
          ) : (
            suppliers.map(s => (
              <tr key={s.id} style={{ backgroundColor: s.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                <td style={tdStyle}><strong>{s.supplier_code}</strong></td>
                <td style={tdStyle}>{s.name}</td>
                <td style={tdStyle}>
                  {s.supplier_type === 'local' && <span style={{ color: '#0d9488' }}>محلي</span>}
                  {s.supplier_type === 'import' && <span style={{ color: '#92400e' }}>استيراد</span>}
                  {s.supplier_type === 'both' && <span style={{ color: '#7c3aed' }}>كلاهما</span>}
                  {s.is_service_provider && <div><span style={{ color: '#be185d', fontSize: '12px' }}>🏭 مورد خدمة</span></div>}
                </td>
                <td style={tdStyle}>{s.phone || '-'}</td>
                <td style={tdStyle}>{s.tax_number || '-'}</td>
                <td style={tdStyle}>{s.credit_limit} ج.م</td>
                <td style={tdStyle}><strong style={{ color: (s.balance || 0) >= 0 ? '#dc2626' : '#28a745' }}>{s.balance || 0} ج.م</strong></td>
                <td style={tdStyle}>
                  {s.is_active !== false ? <span style={{ color: '#28a745' }}>نشط</span> : <span style={{ color: '#ffc107' }}>غير نشط</span>}
                </td>
                <td style={tdStyle}>
                  <button onClick={() => handleEdit(s)} style={{ padding: '5px 10px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    ✏️ تعديل
                  </button>
                </td>
                <td style={tdStyle}>
                  <button onClick={() => handleDelete(s.id)} style={{ padding: '5px 10px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    🗑️ حذف
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Suppliers;