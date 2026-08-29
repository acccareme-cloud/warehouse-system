import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function Locations() {
  const navigate = useNavigate();

  // Tabs
  const [activeTab, setActiveTab] = useState('countries');

  // Data
  const [countries, setCountries] = useState([]);
  const [governorates, setGovernorates] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '', code: '', country_id: '', governorate_id: '', area: ''
  });

  useEffect(() => {
    fetchData();
    fetchCountries();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'countries') {
        const res = await api.get('/locations/countries');
        setCountries(res.data);
      } else if (activeTab === 'governorates') {
        const res = await api.get('/locations/governorates');
        setGovernorates(res.data);
      } else if (activeTab === 'cities') {
        const res = await api.get('/locations/cities');
        setCities(res.data);
      }
    } catch (err) {
      console.error('Error:', err);
    }
    setLoading(false);
  };

  const fetchCountries = async () => {
    try {
      const res = await api.get('/locations/countries');
      setCountries(res.data);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleShowForm = () => {
    setEditingId(null);
    setShowForm(true);
    setFormData({ name: '', code: '', country_id: '', governorate_id: '', area: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let endpoint = '';
      if (activeTab === 'countries') endpoint = '/locations/countries';
      else if (activeTab === 'governorates') endpoint = '/locations/governorates';
      else if (activeTab === 'cities') endpoint = '/locations/cities';

      if (editingId) {
        await api.put(`${endpoint}/${editingId}`, formData);
        setMessage('تم التحديث بنجاح');
      } else {
        await api.post(endpoint, formData);
        setMessage('تم الإضافة بنجاح');
      }
      setShowForm(false);
      setEditingId(null);
      fetchData();
    } catch (err) {
      setMessage('خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormData({
      name: item.name || '',
      code: item.code || '',
      country_id: item.country_id || '',
      governorate_id: item.governorate_id || '',
      area: item.area || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من الحذف؟')) return;
    try {
      let endpoint = '';
      if (activeTab === 'countries') endpoint = '/locations/countries';
      else if (activeTab === 'governorates') endpoint = '/locations/governorates';
      else if (activeTab === 'cities') endpoint = '/locations/cities';

      await api.delete(`${endpoint}/${id}`);
      setMessage('تم الحذف بنجاح');
      fetchData();
    } catch (err) {
      setMessage('خطأ في الحذف');
    }
  };

  const safeValue = (val) => val === undefined || val === null ? '' : val;

  const thStyle = { padding: '15px', textAlign: 'right', borderBottom: '2px solid #ddd' };
  const tdStyle = { padding: '12px', textAlign: 'right', borderBottom: '1px solid #eee' };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>🌍 تكويد الدول والمحافظات والمدن</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            🏠 الرئيسية
          </button>
        </div>
      </div>

      {message && (
        <p style={{ padding: '10px', backgroundColor: message.includes('نجاح') ? '#d4edda' : '#f8d7da', borderRadius: '4px', fontWeight: 'bold', marginBottom: '20px' }}>
          {message}
        </p>
      )}

      {/* Tabs */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button onClick={() => { setActiveTab('countries'); setShowForm(false); }}
          style={{ padding: '12px 30px', backgroundColor: activeTab === 'countries' ? '#1e40af' : '#e2e8f0', color: activeTab === 'countries' ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
          🌍 الدول
        </button>
        <button onClick={() => { setActiveTab('governorates'); setShowForm(false); }}
          style={{ padding: '12px 30px', backgroundColor: activeTab === 'governorates' ? '#047857' : '#e2e8f0', color: activeTab === 'governorates' ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
          🏛️ المحافظات
        </button>
        <button onClick={() => { setActiveTab('cities'); setShowForm(false); }}
          style={{ padding: '12px 30px', backgroundColor: activeTab === 'cities' ? '#7c3aed' : '#e2e8f0', color: activeTab === 'cities' ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
          🏙️ المدن / المناطق
        </button>
      </div>

      {/* Add Button */}
      <div style={{ marginBottom: '20px' }}>
        <button onClick={handleShowForm} style={{ padding: '12px 30px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          ➕ إضافة {activeTab === 'countries' ? 'دولة' : activeTab === 'governorates' ? 'محافظة' : 'مدينة'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '2px solid #2563eb' }}>
          <h3 style={{ color: '#2563eb', marginTop: 0 }}>
            {editingId ? '✏️ تعديل' : '➕ إضافة'} {activeTab === 'countries' ? 'دولة' : activeTab === 'governorates' ? 'محافظة' : 'مدينة'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>

              {/* Name */}
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>الاسم:</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>

              {/* Code */}
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>الكود (اختياري):</label>
                <input type="text" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>

              {/* Country Select (for Governorates) */}
              {activeTab === 'governorates' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>الدولة: <span style={{ color: 'red' }}>*</span></label>
                  <select value={safeValue(formData.country_id)} onChange={(e) => setFormData({...formData, country_id: e.target.value})} required
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                    <option value="">اختر الدولة</option>
                    {countries.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Country & Governorate Select (for Cities) */}
              {activeTab === 'cities' && (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>الدولة: <span style={{ color: 'red' }}>*</span></label>
                    <select value={safeValue(formData.country_id)} onChange={(e) => {
                      setFormData({...formData, country_id: e.target.value, governorate_id: ''});
                      // نحمل المحافظات
                      if (e.target.value) {
                        api.get(`/locations/governorates/${e.target.value}`).then(res => {
                          setGovernorates(res.data);
                        });
                      }
                    }} required
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                      <option value="">اختر الدولة</option>
                      {countries.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>المحافظة: <span style={{ color: 'red' }}>*</span></label>
                    <select value={safeValue(formData.governorate_id)} onChange={(e) => setFormData({...formData, governorate_id: e.target.value})} required
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                      <option value="">اختر المحافظة</option>
                      {governorates.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>المنطقة / الحي (اختياري):</label>
                    <input type="text" value={formData.area} onChange={(e) => setFormData({...formData, area: e.target.value})}
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button type="submit" style={{ padding: '12px 30px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                💾 {editingId ? 'تحديث' : 'حفظ'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '12px 30px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                ❌ إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {loading ? <p>جاري التحميل...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <thead>
            <tr style={{ backgroundColor: activeTab === 'countries' ? '#1e40af' : activeTab === 'governorates' ? '#047857' : '#7c3aed', color: 'white' }}>
              <th style={thStyle}>#</th>
              <th style={thStyle}>الاسم</th>
              {activeTab === 'countries' && <th style={thStyle}>الكود</th>}
              {activeTab === 'governorates' && <th style={thStyle}>الدولة</th>}
              {activeTab === 'cities' && (
                <>
                  <th style={thStyle}>المحافظة</th>
                  <th style={thStyle}>الدولة</th>
                  <th style={thStyle}>المنطقة</th>
                </>
              )}
              <th style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>إجراء</th>
            </tr>
          </thead>
          <tbody>
            {activeTab === 'countries' && countries.length === 0 && (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#999' }}>لا يوجد دول</td></tr>
            )}
            {activeTab === 'governorates' && governorates.length === 0 && (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#999' }}>لا يوجد محافظات</td></tr>
            )}
            {activeTab === 'cities' && cities.length === 0 && (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#999' }}>لا يوجد مدن</td></tr>
            )}

            {activeTab === 'countries' && countries.map((item, idx) => (
              <tr key={item.id} style={{ backgroundColor: idx % 2 === 0 ? '#f8f9fa' : 'white' }}>
                <td style={tdStyle}>{idx + 1}</td>
                <td style={tdStyle}>{item.name}</td>
                <td style={tdStyle}>{item.code || '-'}</td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button onClick={() => handleEdit(item)} style={{ padding: '6px 12px', background: '#ffc107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '5px' }}>✏️</button>
                  <button onClick={() => handleDelete(item.id)} style={{ padding: '6px 12px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🗑️</button>
                </td>
              </tr>
            ))}

            {activeTab === 'governorates' && governorates.map((item, idx) => (
              <tr key={item.id} style={{ backgroundColor: idx % 2 === 0 ? '#f8f9fa' : 'white' }}>
                <td style={tdStyle}>{idx + 1}</td>
                <td style={tdStyle}>{item.name}</td>
                <td style={tdStyle}>{item.country_name || '-'}</td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button onClick={() => handleEdit(item)} style={{ padding: '6px 12px', background: '#ffc107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '5px' }}>✏️</button>
                  <button onClick={() => handleDelete(item.id)} style={{ padding: '6px 12px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🗑️</button>
                </td>
              </tr>
            ))}

            {activeTab === 'cities' && cities.map((item, idx) => (
              <tr key={item.id} style={{ backgroundColor: idx % 2 === 0 ? '#f8f9fa' : 'white' }}>
                <td style={tdStyle}>{idx + 1}</td>
                <td style={tdStyle}>{item.name}</td>
                <td style={tdStyle}>{item.governorate_name || '-'}</td>
                <td style={tdStyle}>{item.country_name || '-'}</td>
                <td style={tdStyle}>{item.area || '-'}</td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button onClick={() => handleEdit(item)} style={{ padding: '6px 12px', background: '#ffc107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '5px' }}>✏️</button>
                  <button onClick={() => handleDelete(item.id)} style={{ padding: '6px 12px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Locations;
