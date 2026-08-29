import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function Customers() {
  const navigate = useNavigate();

  // Tabs
  const [activeTab, setActiveTab] = useState('main');

  // Data
  const [customers, setCustomers] = useState([]);
  const [mainCustomers, setMainCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Locations
  const [countries, setCountries] = useState([]);
  const [governorates, setGovernorates] = useState([]);
  const [cities, setCities] = useState([]);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    code: '', name: '', phone: '', email: '', address: '', tax_number: '',
    customer_type: 'regular', parent_id: '', notes: '',
    country_id: '', governorate_id: '', city_id: ''
  });

  // Print
  const [showPrintAll, setShowPrintAll] = useState(false);
  const [printAllData, setPrintAllData] = useState(null);

  useEffect(() => {
    fetchData();
    fetchMainCustomers();
    fetchCountries();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const type = activeTab === 'main' ? 'regular' : 'hospital';
      const res = await api.get(`/customers?customer_type=${type}`);
      setCustomers(res.data);
    } catch (err) {
      console.error('Error:', err);
    }
    setLoading(false);
  };

  const fetchMainCustomers = async () => {
    try {
      const res = await api.get('/customers?customer_type=regular');
      setMainCustomers(res.data);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const fetchCountries = async () => {
    try {
      const res = await api.get('/locations/countries');
      setCountries(res.data);
    } catch (err) {
      console.error('Error fetching countries:', err);
    }
  };

  const fetchGovernorates = async (countryId) => {
    if (!countryId) {
      setGovernorates([]);
      setCities([]);
      return;
    }
    try {
      const res = await api.get(`/locations/governorates/${countryId}`);
      setGovernorates(res.data);
    } catch (err) {
      console.error('Error fetching governorates:', err);
    }
  };

  const fetchCities = async (governorateId) => {
    if (!governorateId) {
      setCities([]);
      return;
    }
    try {
      const res = await api.get(`/locations/cities/${governorateId}`);
      setCities(res.data);
    } catch (err) {
      console.error('Error fetching cities:', err);
    }
  };

  const fetchNextCode = async () => {
    const type = activeTab === 'main' ? 'regular' : 'hospital';
    try {
      const res = await api.get(`/customers/next-code?customer_type=${type}`);
      setFormData(prev => ({ ...prev, code: res.data.nextCode }));
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleShowForm = () => {
    setEditingId(null);
    setShowForm(true);
    setGovernorates([]);
    setCities([]);
    setFormData({
      code: '', name: '', phone: '', email: '', address: '', tax_number: '',
      customer_type: activeTab === 'main' ? 'regular' : 'hospital',
      parent_id: '', notes: '',
      country_id: '', governorate_id: '', city_id: ''
    });
    fetchNextCode();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/customers/${editingId}`, formData);
        setMessage('تم التحديث بنجاح');
      } else {
        await api.post('/customers', formData);
        setMessage('تم الإنشاء بنجاح');
      }
      setShowForm(false);
      setEditingId(null);
      setGovernorates([]);
      setCities([]);
      fetchData();
      fetchMainCustomers();
    } catch (err) {
      setMessage('خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const handleEdit = (customer) => {
    setEditingId(customer.id);
    setFormData({
      code: customer.code, name: customer.name, phone: customer.phone || '',
      email: customer.email || '', address: customer.address || '',
      tax_number: customer.tax_number || '', customer_type: customer.customer_type || 'regular',
      parent_id: customer.parent_id || '', notes: customer.notes || '',
      country_id: customer.country_id || '',
      governorate_id: customer.governorate_id || '',
      city_id: customer.city_id || ''
    });

    if (customer.country_id) fetchGovernorates(customer.country_id);
    if (customer.governorate_id) fetchCities(customer.governorate_id);

    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد؟')) return;
    try {
      await api.delete(`/customers/${id}`);
      setMessage('تم الحذف');
      fetchData();
      fetchMainCustomers();
    } catch (err) {
      setMessage('خطأ في الحذف');
    }
  };

  const handleCountryChange = (e) => {
    const countryId = e.target.value;
    setFormData(prev => ({ ...prev, country_id: countryId, governorate_id: '', city_id: '' }));
    fetchGovernorates(countryId);
    setCities([]);
  };

  const handleGovernorateChange = (e) => {
    const governorateId = e.target.value;
    setFormData(prev => ({ ...prev, governorate_id: governorateId, city_id: '' }));
    fetchCities(governorateId);
  };

  const handlePrintAll = async () => {
    try {
      const res = await api.get('/customers/print/all');
      setPrintAllData(res.data);
      setShowPrintAll(true);
    } catch (err) {
      setMessage('فشل في جلب التقرير');
    }
  };

  const getTypeBadge = (type) => {
    const badges = {
      'regular': { text: 'رئيسي', color: '#1e40af', bg: '#dbeafe' },
      'hospital': { text: 'فرعي', color: '#047857', bg: '#d1fae5' }
    };
    const b = badges[type] || badges['regular'];
    return <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', color: b.color, backgroundColor: b.bg }}>{b.text}</span>;
  };

  const safeValue = (val) => val === undefined || val === null ? '' : val;

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>👥 تكويد العملاء</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => navigate('/sales-module')} style={{ padding: '10px 20px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>← المبيعات</button>
          <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🏠 الرئيسية</button>
        </div>
      </div>

      {message && <p style={{ padding: '10px', backgroundColor: message.includes('نجاح') ? '#d4edda' : '#f8d7da', borderRadius: '4px', fontWeight: 'bold', marginBottom: '20px' }}>{message}</p>}

      {/* Tabs */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button onClick={() => setActiveTab('main')} style={{ padding: '12px 30px', backgroundColor: activeTab === 'main' ? '#1e40af' : '#e2e8f0', color: activeTab === 'main' ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
          👤 العملاء الرئيسيين
        </button>
        <button onClick={() => setActiveTab('sub')} style={{ padding: '12px 30px', backgroundColor: activeTab === 'sub' ? '#047857' : '#e2e8f0', color: activeTab === 'sub' ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
          🏥 العملاء الفرعيين (المستشفيات)
        </button>
      </div>

      {/* Action Buttons */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button onClick={handleShowForm} style={{ padding: '12px 30px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          ➕ إضافة {activeTab === 'main' ? 'عميل رئيسي' : 'مستشفى فرعي'}
        </button>
        <button onClick={handlePrintAll} style={{ padding: '12px 30px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          🖨️ طباعة تقرير الكل
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '2px solid #2563eb' }}>
          <h3 style={{ color: '#2563eb', marginTop: 0 }}>
            {editingId ? '✏️ تعديل' : '➕ إضافة'} {activeTab === 'main' ? 'عميل رئيسي' : 'مستشفى فرعي'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>الكود:</label>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <input type="text" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} required style={{ flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  <button type="button" onClick={fetchNextCode} style={{ padding: '10px 15px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>توليد</button>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>الاسم:</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>التليفون:</label>
                <input type="text" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>البريد:</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>العنوان:</label>
                <input type="text" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>الرقم الضريبي:</label>
                <input type="text" value={formData.tax_number} onChange={(e) => setFormData({...formData, tax_number: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>الدولة:</label>
                <select value={safeValue(formData.country_id)} onChange={handleCountryChange} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <option value="">اختر الدولة</option>
                  {countries.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>المحافظة:</label>
                <select value={safeValue(formData.governorate_id)} onChange={handleGovernorateChange} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <option value="">اختر المحافظة</option>
                  {governorates.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>المدينة / المنطقة:</label>
                <select value={safeValue(formData.city_id)} onChange={(e) => setFormData({...formData, city_id: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <option value="">اختر المدينة</option>
                  {cities.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.area ? `- ${c.area}` : ''}</option>
                  ))}
                </select>
              </div>

              {activeTab === 'sub' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>العميل الرئيسي: <span style={{ color: 'red' }}>*</span></label>
                  <select value={formData.parent_id} onChange={(e) => setFormData({...formData, parent_id: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                    <option value="">← اختر العميل الرئيسي</option>
                    {mainCustomers.map(main => (
                      <option key={main.id} value={main.id}>{main.code} - {main.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>ملاحظات:</label>
                <input type="text" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button type="submit" style={{ padding: '12px 30px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>{editingId ? '💾 تحديث' : '💾 حفظ'}</button>
              <button type="button" onClick={() => { setShowForm(false); setGovernorates([]); setCities([]); }} style={{ padding: '12px 30px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>❌ إلغاء</button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {loading ? <p>جاري التحميل...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <thead>
            <tr style={{ backgroundColor: '#1e40af', color: 'white' }}>
              <th style={{ padding: '15px', textAlign: 'right' }}>الكود</th>
              <th style={{ padding: '15px', textAlign: 'right' }}>الاسم</th>
              <th style={{ padding: '15px', textAlign: 'right' }}>النوع</th>
              {activeTab === 'sub' && <th style={{ padding: '15px', textAlign: 'right' }}>العميل الرئيسي</th>}
              <th style={{ padding: '15px', textAlign: 'right' }}>التليفون</th>
              <th style={{ padding: '15px', textAlign: 'right' }}>الرقم الضريبي</th>
              <th style={{ padding: '15px', textAlign: 'right' }}>المدينة</th>
              <th style={{ padding: '15px', textAlign: 'center' }}>إجراء</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr><td colSpan={activeTab === 'sub' ? 8 : 7} style={{ textAlign: 'center', padding: '30px', color: '#999' }}>لا يوجد بيانات</td></tr>
            ) : customers.map(c => (
              <tr key={c.id} style={{ backgroundColor: c.id % 2 === 0 ? '#f8f9fa' : 'white', borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px', fontWeight: 'bold' }}>{c.code}</td>
                <td style={{ padding: '12px' }}>{c.name}</td>
                <td style={{ padding: '12px' }}>{getTypeBadge(c.customer_type)}</td>
                {activeTab === 'sub' && <td style={{ padding: '12px' }}>{c.parent_code ? `${c.parent_code} - ${c.parent_name}` : '-'}</td>}
                <td style={{ padding: '12px' }}>{c.phone || '-'}</td>
                <td style={{ padding: '12px' }}>{c.tax_number || '-'}</td>
                <td style={{ padding: '12px' }}>{c.city_name || '-'}</td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button onClick={() => handleEdit(c)} style={{ padding: '6px 12px', background: '#ffc107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '5px' }}>✏️</button>
                  <button onClick={() => handleDelete(c.id)} style={{ padding: '6px 12px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Print All Modal */}
      {showPrintAll && printAllData && (
        <div className="no-print-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', zIndex: 1000, padding: '20px', overflowY: 'auto' }}>
          <div id="printable-report" style={{ background: 'white', borderRadius: '8px', width: '100%', maxWidth: '900px', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>

            {/* Report Header */}
            <div style={{ background: '#1e40af', color: 'white', padding: '25px 30px', textAlign: 'center', borderRadius: '8px 8px 0 0' }}>
              <h1 style={{ margin: 0, fontSize: '26px' }}>📋 تقرير العملاء</h1>
              <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '14px' }}>
                تاريخ الطباعة: {new Date(printAllData.report_date).toLocaleDateString('ar-EG')}
              </p>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', padding: '25px 30px', background: '#f8fafc' }}>
              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center', border: '2px solid #1e40af', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e40af' }}>{printAllData.total_main}</div>
                <div style={{ color: '#1e40af', marginTop: '5px', fontSize: '14px' }}>👤 عملاء رئيسيين</div>
              </div>
              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center', border: '2px solid #047857', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#047857' }}>{printAllData.total_sub}</div>
                <div style={{ color: '#047857', marginTop: '5px', fontSize: '14px' }}>🏥 عملاء فرعيين</div>
              </div>
              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center', border: '2px solid #7c3aed', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#7c3aed' }}>
                  {Number(printAllData.customers.reduce((sum, m) => sum + (m.invoices_total || 0), 0)).toFixed(2)}
                </div>
                <div style={{ color: '#7c3aed', marginTop: '5px', fontSize: '14px' }}>💰 إجمالي المبيعات</div>
              </div>
            </div>

            {/* Customers List */}
            <div style={{ padding: '0 30px 30px 30px' }}>
              {printAllData.customers.map((main, idx) => (
                <div key={main.id} style={{ marginBottom: '20px', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: 'white' }}>

                  {/* Main Customer Header */}
                  <div style={{ background: '#1e40af', color: 'white', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '20px', fontWeight: 'bold', background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '20px' }}>#{idx + 1}</span>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{main.code} — {main.name}</div>
                        <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '3px' }}>
                          📞 {main.phone || 'لا يوجد'} &nbsp;|&nbsp; 🏷️ {main.tax_number || 'لا يوجد'} &nbsp;|&nbsp; 📍 {main.city_name || 'لا يوجد'}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'left', direction: 'ltr' }}>
                      <div style={{ fontSize: '13px' }}>🧾 {main.invoices_count || 0} فاتورة</div>
                      <div style={{ fontSize: '15px', fontWeight: 'bold' }}>💰 {Number(main.invoices_total || 0).toFixed(2)} ج.م</div>
                    </div>
                  </div>

                  {/* Main Customer Details */}
                  <div style={{ padding: '15px 20px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', fontSize: '13px' }}>
                      <div><strong>الدولة:</strong> {main.country_name || '-'}</div>
                      <div><strong>المحافظة:</strong> {main.governorate_name || '-'}</div>
                      <div><strong>المدينة:</strong> {main.city_name || '-'}</div>
                      <div><strong>العنوان:</strong> {main.address || '-'}</div>
                      <div><strong>البريد:</strong> {main.email || '-'}</div>
                      <div><strong>الملاحظات:</strong> {main.notes || '-'}</div>
                    </div>
                  </div>

                  {/* Sub Customers Table */}
                  {main.subCustomers && main.subCustomers.length > 0 ? (
                    <div style={{ padding: '15px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid #047857' }}>
                        <span style={{ fontSize: '18px' }}>🏥</span>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#047857' }}>العملاء الفرعيين ({main.subCustomers.length})</span>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ background: '#d1fae5' }}>
                            <th style={{ padding: '8px 10px', textAlign: 'right', border: '1px solid #047857', fontWeight: 'bold' }}>الكود</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right', border: '1px solid #047857', fontWeight: 'bold' }}>الاسم</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right', border: '1px solid #047857', fontWeight: 'bold' }}>التليفون</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right', border: '1px solid #047857', fontWeight: 'bold' }}>المدينة</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right', border: '1px solid #047857', fontWeight: 'bold' }}>الرقم الضريبي</th>
                          </tr>
                        </thead>
                        <tbody>
                          {main.subCustomers.map((sub, sIdx) => (
                            <tr key={sub.id} style={{ backgroundColor: sIdx % 2 === 0 ? 'white' : '#f0fdf4' }}>
                              <td style={{ padding: '8px 10px', border: '1px solid #ddd', fontWeight: 'bold', color: '#047857' }}>{sub.code}</td>
                              <td style={{ padding: '8px 10px', border: '1px solid #ddd' }}>{sub.name}</td>
                              <td style={{ padding: '8px 10px', border: '1px solid #ddd' }}>{sub.phone || '-'}</td>
                              <td style={{ padding: '8px 10px', border: '1px solid #ddd' }}>{sub.city_name || '-'}</td>
                              <td style={{ padding: '8px 10px', border: '1px solid #ddd' }}>{sub.tax_number || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: '12px 20px', background: '#fef3c7', textAlign: 'center', color: '#92400e', fontSize: '13px', fontStyle: 'italic' }}>
                      ⚠️ لا يوجد عملاء فرعيين لهذا العميل
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', padding: '20px', borderTop: '2px solid #e2e8f0', color: '#64748b', fontSize: '13px' }}>
              <p style={{ margin: 0 }}>تم إنشاء هذا التقرير بتاريخ: {new Date().toLocaleDateString('ar-EG')}</p>
            </div>

            {/* Buttons */}
            <div className="no-print-btns" style={{ display: 'flex', gap: '10px', justifyContent: 'center', padding: '20px', background: '#f8fafc', borderRadius: '0 0 8px 8px' }}>
              <button onClick={() => window.print()} style={{ padding: '12px 40px', background: '#1e40af', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>🖨️ طباعة التقرير</button>
              <button onClick={() => setShowPrintAll(false)} style={{ padding: '12px 40px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #printable-report, #printable-report * { visibility: visible !important; }
          #printable-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .no-print-overlay {
            position: static !important;
            background: white !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .no-print-btns {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default Customers;
