import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const ExpenseCategories = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('main');

  const [mainCategories, setMainCategories] = useState([]);
  const [allSubCategories, setAllSubCategories] = useState([]);

  const [formData, setFormData] = useState({
    category_code: '',
    category_name: '',
    parent_id: '',
    account_number: ''
  });
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [searchTerm, setSearchTerm] = useState('');

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchMainCategories();
  }, []);

  useEffect(() => {
    if (activeTab === 'sub' && mainCategories.length > 0) {
      fetchAllSubCategories();
    }
  }, [activeTab, mainCategories]);

  const fetchMainCategories = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:5000/api/expense-categories/main', { headers });
      setMainCategories(res.data || []);
    } catch (err) {
      showMessage('خطأ في تحميل البنود الرئيسية', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSubCategories = async () => {
    try {
      setLoading(true);
      const requests = mainCategories.map(m =>
        axios.get(`http://localhost:5000/api/expense-categories/sub/${m.id}`, { headers })
          .then(res => res.data.map(sub => ({ ...sub, parent_name: m.category_name, parent_code: m.category_code })))
      );
      const results = await Promise.all(requests);
      setAllSubCategories(results.flat());
    } catch (err) {
      showMessage('خطأ في تحميل البنود الفرعية', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  const fetchNextCode = async (type) => {
    try {
      const res = await axios.get('http://localhost:5000/api/expense-categories/next-code', {
        headers,
        params: { type }
      });
      setFormData(prev => ({ ...prev, category_code: res.data.nextCode }));
    } catch (err) {
      console.error('خطأ في توليد الكود');
    }
  };

  const openAddForm = () => {
    resetForm();
    setShowForm(true);
    fetchNextCode(activeTab === 'main' ? 'gen' : 'sub');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (cat) => {
    setFormData({
      category_code: cat.category_code,
      category_name: cat.category_name,
      parent_id: cat.parent_id || '',
      account_number: cat.account_number || ''
    });
    setEditingId(cat.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.category_code.trim() || !formData.category_name.trim()) {
      showMessage('الكود والاسم مطلوبين', 'error');
      return;
    }

    if (activeTab === 'sub' && !formData.parent_id) {
      showMessage('اختر البند الرئيسي التابع له', 'error');
      return;
    }

    const payload = {
      category_code: formData.category_code,
      category_name: formData.category_name,
      category_type: activeTab === 'sub' ? 'sub' : 'main',
      parent_id: activeTab === 'sub' ? formData.parent_id : null,
      cost_center_id: null,
      account_number: formData.account_number || null
    };

    try {
      setLoading(true);
      if (editingId) {
        await axios.put(`http://localhost:5000/api/expense-categories/${editingId}`, payload, { headers });
        showMessage('تم التعديل بنجاح', 'success');
      } else {
        await axios.post('http://localhost:5000/api/expense-categories', payload, { headers });
        showMessage('تم الإضافة بنجاح', 'success');
      }

      resetForm();
      await fetchMainCategories();
      if (activeTab === 'sub') fetchAllSubCategories();
    } catch (err) {
      showMessage(err.response?.data?.message || 'خطأ في الحفظ', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (cat) => {
    const confirmMsg = cat.parent_id
      ? 'هل أنت متأكد من حذف هذا البند الفرعي؟'
      : 'هل أنت متأكد من حذف هذا البند الرئيسي؟ سيتم حذف كل البنود الفرعية التابعة له أيضاً';
    if (!window.confirm(confirmMsg)) return;

    try {
      setLoading(true);
      await axios.delete(`http://localhost:5000/api/expense-categories/${cat.id}`, { headers });
      showMessage('تم الحذف بنجاح', 'success');
      await fetchMainCategories();
      if (activeTab === 'sub') fetchAllSubCategories();
    } catch (err) {
      showMessage(err.response?.data?.message || 'خطأ في الحذف', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      category_code: '',
      category_name: '',
      parent_id: '',
      account_number: ''
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    resetForm();
    setSearchTerm('');
  };

  const handlePrint = () => window.print();
  const handleGoBack = () => navigate(-1);
  const handleGoHome = () => navigate('/dashboard');

  const filteredMain = mainCategories.filter(c =>
    c.category_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.category_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSub = allSubCategories.filter(c =>
    c.category_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.parent_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Styles
  const containerStyle = { padding: '20px', direction: 'rtl', fontFamily: 'Segoe UI, Tahoma, sans-serif' };
  const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
  const titleStyle = { fontSize: '24px', fontWeight: 'bold', color: '#1e3a5f' };
  const btnStyle = { padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' };
  const primaryBtn = { ...btnStyle, backgroundColor: '#2563eb', color: 'white' };
  const successBtn = { ...btnStyle, backgroundColor: '#16a34a', color: 'white' };
  const secondaryBtn = { ...btnStyle, backgroundColor: '#6b7280', color: 'white' };
  const navBtn = { ...btnStyle, backgroundColor: '#374151', color: 'white' };
  const formStyle = { backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #e2e8f0' };
  const inputStyle = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', marginBottom: '10px' };
  const labelStyle = { fontWeight: 'bold', marginBottom: '5px', display: 'block', color: '#374151' };
  const tableStyle = { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
  const thStyle = { backgroundColor: '#1e3a5f', color: 'white', padding: '12px', textAlign: 'right', fontWeight: 'bold', fontSize: '13px' };
  const tdStyle = { padding: '10px 12px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', fontSize: '13px', color: '#1e293b' };
  const actionBtnStyle = { padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', marginLeft: '5px' };
  const alertStyle = (type) => ({ padding: '12px', borderRadius: '8px', marginBottom: '15px', backgroundColor: type === 'success' ? '#dcfce7' : '#fee2e2', color: type === 'success' ? '#166534' : '#991b1b', border: `1px solid ${type === 'success' ? '#86efac' : '#fecaca'}` });
  const searchStyle = { padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', width: '300px', fontSize: '14px' };

  const tabStyle = (isActive) => ({
    padding: '12px 30px',
    border: 'none',
    borderBottom: isActive ? '3px solid #2563eb' : '3px solid transparent',
    backgroundColor: 'transparent',
    color: isActive ? '#2563eb' : '#6b7280',
    fontWeight: 'bold',
    fontSize: '15px',
    cursor: 'pointer'
  });

  return (
    <div style={containerStyle}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-title { display: block !important; }
          body { padding: 20px; }
          table { border: 1px solid #333 !important; }
          th, td { border: 1px solid #333 !important; }
          th { background-color: #1e3a5f !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', padding: '10px 0', borderBottom: '2px solid #e2e8f0' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleGoBack} style={navBtn}>⬅️ رجوع</button>
          <button onClick={handleGoHome} style={navBtn}>🏠 الرئيسية</button>
        </div>
        <div style={{ fontSize: '14px', color: '#6b7280' }}>📍 الخزينة / البنك / بنود المصروفات</div>
      </div>

      <div className="no-print" style={headerStyle}>
        <h1 style={titleStyle}>📂 بنود المصروفات</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={openAddForm} style={primaryBtn}>
            {activeTab === 'main' ? '➕ بند رئيسي جديد' : '➕ بند فرعي جديد'}
          </button>
          <button onClick={handlePrint} style={secondaryBtn}>🖨️ طباعة</button>
        </div>
      </div>

      <div className="no-print" style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '20px' }}>
        <button onClick={() => handleTabChange('main')} style={tabStyle(activeTab === 'main')}>
          📁 البنود الرئيسية ({mainCategories.length})
        </button>
        <button onClick={() => handleTabChange('sub')} style={tabStyle(activeTab === 'sub')}>
          📄 البنود الفرعية ({allSubCategories.length})
        </button>
      </div>

      {message.text && <div className="no-print" style={alertStyle(message.type)}>{message.text}</div>}

      {showForm && (
        <div className="no-print" style={formStyle}>
          <h3 style={{ marginTop: 0, color: '#1e3a5f' }}>
            {editingId ? '✏️ تعديل بند' : (activeTab === 'sub' ? '➕ إضافة بند فرعي' : '➕ إضافة بند رئيسي')}
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              {activeTab === 'sub' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>البند الرئيسي التابع له *</label>
                  <select
                    value={formData.parent_id}
                    onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                    style={inputStyle}
                    required
                  >
                    <option value="">-- اختر البند الرئيسي --</option>
                    {mainCategories.map(m => (
                      <option key={m.id} value={m.id}>{m.category_code} - {m.category_name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label style={labelStyle}>الكود *</label>
                <input
                  type="text"
                  value={formData.category_code}
                  onChange={(e) => setFormData({ ...formData, category_code: e.target.value })}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>الاسم *</label>
                <input
                  type="text"
                  placeholder={activeTab === 'sub' ? 'مثال: قرطاسية' : 'مثال: مصاريف مكتبية'}
                  value={formData.category_name}
                  onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>رقم الحساب (اختياري)</label>
                <input
                  type="text"
                  placeholder="رقم الحساب في الدليل المحاسبي"
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
              <button type="submit" style={successBtn} disabled={loading}>
                {loading ? '⏳ جاري الحفظ...' : (editingId ? '💾 حفظ التعديل' : '💾 حفظ')}
              </button>
              <button type="button" onClick={resetForm} style={secondaryBtn}>إلغاء</button>
            </div>
          </form>
        </div>
      )}

      <div className="no-print" style={{ marginBottom: '15px' }}>
        <input
          type="text"
          placeholder="🔍 بحث بالكود أو الاسم..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={searchStyle}
        />
      </div>

      <div className="print-area">
        <h2 style={{ textAlign: 'center', color: '#1e3a5f', marginBottom: '20px', display: 'none' }} className="print-title">
          تقرير بنود المصروفات - {activeTab === 'main' ? 'البنود الرئيسية' : 'البنود الفرعية'}
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#6b7280' }}>⏳ جاري التحميل...</div>
        ) : activeTab === 'main' ? (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={thStyle}>الكود</th>
                <th style={thStyle}>الاسم</th>
                <th style={thStyle}>رقم الحساب</th>
                <th style={{ ...thStyle, textAlign: 'center' }} className="no-print">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredMain.length === 0 ? (
                <tr><td colSpan="5" style={{ ...tdStyle, textAlign: 'center', color: '#6b7280' }}>لا توجد بنود رئيسية</td></tr>
              ) : (
                filteredMain.map((cat, index) => (
                  <tr key={cat.id}>
                    <td style={tdStyle}>{index + 1}</td>
                    <td style={tdStyle}><strong>{cat.category_code}</strong></td>
                    <td style={tdStyle}>{cat.category_name}</td>
                    <td style={tdStyle}>{cat.account_number || '-'}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }} className="no-print">
                      <button onClick={() => handleEdit(cat)} style={{ ...actionBtnStyle, backgroundColor: '#f59e0b', color: 'white' }}>✏️ تعديل</button>
                      <button onClick={() => handleDelete(cat)} style={{ ...actionBtnStyle, backgroundColor: '#dc2626', color: 'white' }}>🗑️ حذف</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={thStyle}>الكود</th>
                <th style={thStyle}>الاسم</th>
                <th style={thStyle}>البند الرئيسي</th>
                <th style={thStyle}>رقم الحساب</th>
                <th style={{ ...thStyle, textAlign: 'center' }} className="no-print">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredSub.length === 0 ? (
                <tr><td colSpan="6" style={{ ...tdStyle, textAlign: 'center', color: '#6b7280' }}>لا توجد بنود فرعية</td></tr>
              ) : (
                filteredSub.map((cat, index) => (
                  <tr key={cat.id}>
                    <td style={tdStyle}>{index + 1}</td>
                    <td style={tdStyle}><strong>{cat.category_code}</strong></td>
                    <td style={tdStyle}>{cat.category_name}</td>
                    <td style={tdStyle}>{cat.parent_code} - {cat.parent_name}</td>
                    <td style={tdStyle}>{cat.account_number || '-'}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }} className="no-print">
                      <button onClick={() => handleEdit(cat)} style={{ ...actionBtnStyle, backgroundColor: '#f59e0b', color: 'white' }}>✏️ تعديل</button>
                      <button onClick={() => handleDelete(cat)} style={{ ...actionBtnStyle, backgroundColor: '#dc2626', color: 'white' }}>🗑️ حذف</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ExpenseCategories;