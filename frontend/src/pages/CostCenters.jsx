import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const CostCenters = () => {
  const navigate = useNavigate();
  const [centers, setCenters] = useState([]);
  const [formData, setFormData] = useState({
    center_code: '',
    center_name: '',
    budget_amount: ''
  });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchCenters();
  }, []);

  const fetchCenters = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:5000/api/cost-centers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCenters(res.data || []);
    } catch (err) {
      showMessage('خطأ في تحميل البيانات', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.center_code.trim() || !formData.center_name.trim()) {
      showMessage('الكود والاسم مطلوبين', 'error');
      return;
    }

    try {
      setLoading(true);

      if (editingId) {
        await axios.put(`http://localhost:5000/api/cost-centers/${editingId}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        showMessage('تم التعديل بنجاح', 'success');
      } else {
        await axios.post('http://localhost:5000/api/cost-centers', formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        showMessage('تم الإضافة بنجاح', 'success');
      }

      resetForm();
      fetchCenters();
    } catch (err) {
      showMessage(err.response?.data?.message || 'خطأ في الحفظ', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (center) => {
    setFormData({
      center_code: center.center_code,
      center_name: center.center_name,
      budget_amount: center.budget_amount || ''
    });
    setEditingId(center.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من الحذف؟')) return;

    try {
      setLoading(true);
      await axios.delete(`http://localhost:5000/api/cost-centers/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showMessage('تم الحذف بنجاح', 'success');
      fetchCenters();
    } catch (err) {
      showMessage(err.response?.data?.message || 'خطأ في الحذف', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ center_code: '', center_name: '', budget_amount: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleGoBack = () => {
    navigate(-1); // الرجوع للصفحة اللي كنت فيها
  };

  const handleGoHome = () => {
    navigate('/'); // الرجوع للصفحة الرئيسية
  };

  const filteredCenters = centers.filter(c =>
    c.center_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.center_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Styles
  const containerStyle = { padding: '20px', direction: 'rtl', fontFamily: 'Segoe UI, Tahoma, sans-serif' };
  const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
  const titleStyle = { fontSize: '24px', fontWeight: 'bold', color: '#1e3a5f' };
  const btnStyle = { padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' };
  const primaryBtn = { ...btnStyle, backgroundColor: '#2563eb', color: 'white' };
  const successBtn = { ...btnStyle, backgroundColor: '#16a34a', color: 'white' };
  const dangerBtn = { ...btnStyle, backgroundColor: '#dc2626', color: 'white' };
  const warningBtn = { ...btnStyle, backgroundColor: '#f59e0b', color: 'white' };
  const secondaryBtn = { ...btnStyle, backgroundColor: '#6b7280', color: 'white' };
  const navBtn = { ...btnStyle, backgroundColor: '#374151', color: 'white' };
  const formStyle = { backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #e2e8f0' };
  const inputStyle = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', marginBottom: '10px' };
  const labelStyle = { fontWeight: 'bold', marginBottom: '5px', display: 'block', color: '#374151' };
  const tableStyle = { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
  const thStyle = { backgroundColor: '#1e3a5f', color: 'white', padding: '12px', textAlign: 'right', fontWeight: 'bold' };
  const tdStyle = { padding: '12px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: '#1e293b' };
  const actionBtnStyle = { padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', marginLeft: '5px' };
  const alertStyle = (type) => ({ padding: '12px', borderRadius: '8px', marginBottom: '15px', backgroundColor: type === 'success' ? '#dcfce7' : '#fee2e2', color: type === 'success' ? '#166534' : '#991b1b', border: `1px solid ${type === 'success' ? '#86efac' : '#fecaca'}` });
  const searchStyle = { padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', width: '300px', fontSize: '14px' };

  return (
    <div style={containerStyle}>
      {/* Navigation Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', padding: '10px 0', borderBottom: '2px solid #e2e8f0' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleGoBack} style={navBtn}>⬅️ رجوع</button>
          <button onClick={handleGoHome} style={navBtn}>🏠 الرئيسية</button>
        </div>
        <div style={{ fontSize: '14px', color: '#6b7280' }}>
          📍 الخزينة / البنك / مراكز التكلفة
        </div>
      </div>

      <div style={headerStyle}>
        <h1 style={titleStyle}>🏢 مراكز التكلفة</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowForm(!showForm)} style={primaryBtn}>
            {showForm ? '✕ إغلاق' : '➕ إضافة مركز'}
          </button>
          <button onClick={handlePrint} style={secondaryBtn}>🖨️ طباعة</button>
        </div>
      </div>

      {message.text && (
        <div style={alertStyle(message.type)}>{message.text}</div>
      )}

      {showForm && (
        <div style={formStyle}>
          <h3 style={{ marginTop: 0, color: '#1e3a5f' }}>
            {editingId ? '✏️ تعديل مركز التكلفة' : '➕ إضافة مركز تكلفة جديد'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={labelStyle}>كود المركز *</label>
                <input
                  type="text"
                  placeholder="مثال: CC-ADM-001"
                  value={formData.center_code}
                  onChange={(e) => setFormData({...formData, center_code: e.target.value})}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>اسم المركز *</label>
                <input
                  type="text"
                  placeholder="مثال: مصاريف إدارية"
                  value={formData.center_name}
                  onChange={(e) => setFormData({...formData, center_name: e.target.value})}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>الميزانية (اختياري)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={formData.budget_amount}
                  onChange={(e) => setFormData({...formData, budget_amount: e.target.value})}
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
              <button type="submit" style={successBtn} disabled={loading}>
                {loading ? '⏳ جاري الحفظ...' : (editingId ? '💾 حفظ التعديل' : '💾 حفظ')}
              </button>
              <button type="button" onClick={resetForm} style={secondaryBtn}>إلغاء</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ marginBottom: '15px' }}>
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
          تقرير مراكز التكلفة
        </h2>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>الكود</th>
              <th style={thStyle}>اسم المركز</th>
              <th style={thStyle}>الميزانية</th>
              <th style={thStyle}>الحالة</th>
              <th style={{ ...thStyle, textAlign: 'center' }} className="no-print">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredCenters.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ ...tdStyle, textAlign: 'center', color: '#6b7280' }}>
                  لا توجد مراكز تكلفة
                </td>
              </tr>
            ) : (
              filteredCenters.map((center, index) => (
                <tr key={center.id}>
                  <td style={tdStyle}>{index + 1}</td>
                  <td style={tdStyle}><strong>{center.center_code}</strong></td>
                  <td style={tdStyle}>{center.center_name}</td>
                  <td style={tdStyle}>
                    {center.budget_amount ? parseFloat(center.budget_amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 }) : '0.00'}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      backgroundColor: center.status === 'active' ? '#dcfce7' : '#fee2e2',
                      color: center.status === 'active' ? '#166534' : '#991b1b'
                    }}>
                      {center.status === 'active' ? '✅ نشط' : '❌ معطل'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }} className="no-print">
                    <button onClick={() => handleEdit(center)} style={{ ...actionBtnStyle, backgroundColor: '#f59e0b', color: 'white' }}>
                      ✏️ تعديل
                    </button>
                    <button onClick={() => handleDelete(center.id)} style={{ ...actionBtnStyle, backgroundColor: '#dc2626', color: 'white' }}>
                      🗑️ حذف
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-title { display: block !important; }
          body { padding: 20px; }
        }
      `}</style>
    </div>
  );
};

export default CostCenters;
