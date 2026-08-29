import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Employees = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [empFilter, setEmpFilter] = useState('all'); // all | active | inactive
  const [message, setMessage] = useState('');

  // Get current user role from token payload (simple decode)
  const token = localStorage.getItem('token');
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserRole(payload.role || '');
      } catch (e) { setUserRole(''); }
    }
  }, [token]);

  const [formData, setFormData] = useState({
    employee_number: '', full_name: '', national_id: '', phone: '',
    email: '', address: '', department_id: '', section_id: '',
    job_title: '', hire_date: '', salary: ''
  });
  const [deptForm, setDeptForm] = useState({ name: '', code: '', description: '' });
  const [secForm, setSecForm] = useState({ name: '', code: '', department_id: '', description: '' });
  const [editingDeptId, setEditingDeptId] = useState(null);
  const [editingSecId, setEditingSecId] = useState(null);

  useEffect(() => {
    fetchData();
  }, [activeTab, empFilter]);

  const fetchData = async () => {
    try {
      const urls = [
        axios.get(`http://localhost:5000/api/employees?status=${empFilter}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:5000/api/employees/departments', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:5000/api/employees/sections', { headers: { Authorization: `Bearer ${token}` } })
      ];
      const [empRes, deptRes, secRes] = await Promise.all(urls);
      setEmployees(empRes.data);
      setDepartments(deptRes.data);
      setSections(secRes.data);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  // ========== الموظفين ==========
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`http://localhost:5000/api/employees/${editingId}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessage('✅ تم تحديث الموظف بنجاح!');
      } else {
        await axios.post('http://localhost:5000/api/employees', formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessage('✅ تم إضافة الموظف بنجاح!');
      }
      setShowForm(false);
      setEditingId(null);
      resetForm();
      fetchData();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || 'خطأ في الحفظ'));
    }
  };

  const handleEdit = (emp) => {
    const formattedDate = emp.hire_date ? new Date(emp.hire_date).toISOString().split('T')[0] : '';
    setFormData({ 
      employee_number: emp.employee_number || '',
      full_name: emp.full_name || '',
      national_id: emp.national_id || '',
      phone: emp.phone || '',
      email: emp.email || '',
      address: emp.address || '',
      department_id: emp.department_id || '',
      section_id: emp.section_id || '',
      job_title: emp.job_title || '',
      hire_date: formattedDate,
      salary: emp.salary || ''
    });
    setEditingId(emp.id);
    setShowForm(true);
  };

  const handleToggleStatus = async (emp) => {
    const isActive = emp.status === 'active';
    const actionText = isActive ? 'إلغاء تفعيل' : 'إعادة تفعيل';
    if (!window.confirm(`هل تريد ${actionText} الموظف "${emp.full_name}"؟`)) return;

    try {
      const r = await axios.put(`http://localhost:5000/api/employees/${emp.id}/toggle-status`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('✅ ' + r.data.message);
      fetchData();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || 'خطأ في التحديث'));
    }
  };

  const resetForm = () => {
    setFormData({
      employee_number: '', 
      full_name: '', 
      national_id: '', 
      phone: '',
      email: '', 
      address: '', 
      department_id: '', 
      section_id: '',
      job_title: '', 
      hire_date: '', 
      salary: ''
    });
  };

  // ========== الإدارات ==========
  const handleDeptSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDeptId) {
        await axios.put(`http://localhost:5000/api/employees/departments/${editingDeptId}`, deptForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post('http://localhost:5000/api/employees/departments', deptForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setEditingDeptId(null);
      setDeptForm({ name: '', code: '', description: '' });
      fetchData();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || 'خطأ'));
    }
  };

  const handleEditDept = (dept) => {
    setDeptForm({
      name: dept.name || '',
      code: dept.code || '',
      description: dept.description || ''
    });
    setEditingDeptId(dept.id);
  };

  const handleDeleteDept = async (id) => {
    if (!window.confirm('هل تريد حذف هذه الإدارة؟')) return;
    try {
      await axios.delete(`http://localhost:5000/api/employees/departments/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || 'خطأ في الحذف'));
    }
  };

  // ========== الأقسام ==========
  const handleSecSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSecId) {
        await axios.put(`http://localhost:5000/api/employees/sections/${editingSecId}`, secForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post('http://localhost:5000/api/employees/sections', secForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setEditingSecId(null);
      setSecForm({ name: '', code: '', department_id: '', description: '' });
      fetchData();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || 'خطأ'));
    }
  };

  const handleEditSec = (sec) => {
    setSecForm({
      name: sec.name || '',
      code: sec.code || '',
      department_id: sec.department_id || '',
      description: sec.description || ''
    });
    setEditingSecId(sec.id);
  };

  const handleDeleteSec = async (id) => {
    if (!window.confirm('هل تريد حذف هذا القسم؟')) return;
    try {
      await axios.delete(`http://localhost:5000/api/employees/sections/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || 'خطأ في الحذف'));
    }
  };

  // ========== Styles ==========
  const styles = {
    container: { padding: '20px', maxWidth: '1200px', margin: '0 auto', direction: 'rtl' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    title: { fontSize: '28px', fontWeight: 'bold', color: '#1e293b' },
    tabs: { display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px' },
    tab: (active) => ({
      padding: '10px 20px', border: 'none', borderRadius: '8px 8px 0 0',
      cursor: 'pointer', fontSize: '16px', fontWeight: 'bold',
      backgroundColor: active ? '#dc2626' : '#f3f4f6',
      color: active ? 'white' : '#374151'
    }),
    subTabs: { display: 'flex', gap: '6px', marginBottom: '15px' },
    subTab: (active, color) => ({
      padding: '8px 18px', border: 'none', borderRadius: '20px',
      cursor: 'pointer', fontSize: '14px', fontWeight: 'bold',
      backgroundColor: active ? color : '#f3f4f6',
      color: active ? 'white' : '#4b5563',
      transition: 'all 0.2s'
    }),
    btnPrimary: { backgroundColor: '#dc2626', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer' },
    btnSuccess: { backgroundColor: '#16a34a', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', marginRight: '10px' },
    btnSecondary: { backgroundColor: '#6b7280', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', marginRight: '10px' },
    btnWarning: { backgroundColor: '#f59e0b', color: 'white', padding: '5px 10px', border: 'none', borderRadius: '5px', cursor: 'pointer', marginLeft: '5px' },
    btnDanger: { backgroundColor: '#ef4444', color: 'white', padding: '5px 10px', border: 'none', borderRadius: '5px', cursor: 'pointer' },
    btnToggleOff: { backgroundColor: '#dc2626', color: 'white', padding: '5px 10px', border: 'none', borderRadius: '5px', cursor: 'pointer', marginLeft: '5px', fontSize: '12px' },
    btnToggleOn: { backgroundColor: '#059669', color: 'white', padding: '5px 10px', border: 'none', borderRadius: '5px', cursor: 'pointer', marginLeft: '5px', fontSize: '12px' },
    form: { backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #e2e8f0' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' },
    inputGroup: { display: 'flex', flexDirection: 'column' },
    label: { marginBottom: '5px', fontWeight: 'bold', color: '#374151', fontSize: '14px' },
    input: { padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', color: '#111827' },
    select: { padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', backgroundColor: 'white', color: '#111827' },
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    th: { backgroundColor: '#dc2626', color: 'white', padding: '12px', textAlign: 'right', fontWeight: 'bold' },
    td: { padding: '12px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: '#1f2937' },
    badge: (status) => ({
      padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
      backgroundColor: status === 'active' ? '#dcfce7' : '#fee2e2',
      color: status === 'active' ? '#166534' : '#991b1b'
    }),
    infoBox: { padding: '10px 14px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', color: '#1e40af', fontSize: '13px', marginBottom: '15px' }
  };

  const isAdmin = userRole === 'admin';

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button 
          onClick={() => navigate('/dashboard')}
          style={{ 
            backgroundColor: '#6b7280', color: 'white', padding: '10px 20px',
            border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px'
          }}
        >
          ← رجوع للرئيسية
        </button>
        <h1 style={styles.title}>👥 إدارة الموظفين والإدارات</h1>
        <div></div>
      </div>

      {/* Message */}
      {message && (
        <p style={{
          padding: '12px',
          backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da',
          color: message.includes('✅') ? '#155724' : '#721c24',
          borderRadius: '4px',
          marginBottom: '15px',
          fontWeight: 'bold'
        }}>
          {message}
        </p>
      )}

      {/* Tabs */}
      <div style={styles.tabs}>
        <button style={styles.tab(activeTab === 'employees')} onClick={() => setActiveTab('employees')}>
          👥 الموظفين
        </button>
        <button style={styles.tab(activeTab === 'departments')} onClick={() => setActiveTab('departments')}>
          🏢 الإدارات
        </button>
        <button style={styles.tab(activeTab === 'sections')} onClick={() => setActiveTab('sections')}>
          📂 الأقسام
        </button>
      </div>

      {/* ========== تاب الموظفين ========== */}
      {activeTab === 'employees' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ margin: 0 }}>قائمة الموظفين</h2>
            <button onClick={() => { setShowForm(!showForm); setEditingId(null); resetForm(); }} style={styles.btnPrimary}>
              {showForm ? '✕ إلغاء' : '+ موظف جديد'}
            </button>
          </div>

          {/* Sub-tabs filter */}
          <div style={styles.subTabs}>
            {[
              { key: 'all', label: '📋 الكل', color: '#2563eb' },
              { key: 'active', label: '✅ النشطين', color: '#059669' },
              { key: 'inactive', label: '🚫 ترك الخدمة', color: '#dc2626' }
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setEmpFilter(t.key)}
                style={styles.subTab(empFilter === t.key, t.color)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Info box for inactive employees */}
          {empFilter === 'inactive' && (
            <div style={styles.infoBox}>
              ℹ️ الموظفون هنا تم إلغاء تفعيلهم (تركوا الخدمة). لا يمكن اختيارهم في العمليات الجديدة، لكن سجلاتهم السابقة (عهدة، حضور، خزينة...) محفوظة.
            </div>
          )}

          {showForm && (
            <form onSubmit={handleSubmit} style={styles.form}>
              <h3>{editingId ? 'تعديل موظف' : 'موظف جديد'}</h3>
              <div style={styles.grid}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>الرقم الوظيفي *</label>
                  <input type="text" value={formData.employee_number} onChange={e => setFormData({...formData, employee_number: e.target.value})} style={styles.input} required />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>الاسم الكامل *</label>
                  <input type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} style={styles.input} required />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>الرقم القومي</label>
                  <input type="text" value={formData.national_id} onChange={e => setFormData({...formData, national_id: e.target.value})} style={styles.input} />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>التليفون</label>
                  <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} style={styles.input} />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>البريد الإلكتروني</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={styles.input} />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>العنوان</label>
                  <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} style={styles.input} />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>الإدارة</label>
                  <select value={formData.department_id} onChange={e => setFormData({...formData, department_id: e.target.value, section_id: ''})} style={styles.select}>
                    <option value="">اختر الإدارة</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>القسم</label>
                  <select value={formData.section_id} onChange={e => setFormData({...formData, section_id: e.target.value})} style={styles.select} disabled={!formData.department_id}>
                    <option value="">اختر القسم</option>
                    {sections.filter(s => s.department_id == formData.department_id).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>المسمى الوظيفي</label>
                  <input type="text" value={formData.job_title} onChange={e => setFormData({...formData, job_title: e.target.value})} style={styles.input} />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>تاريخ التعيين</label>
                  <input type="date" value={formData.hire_date} onChange={e => setFormData({...formData, hire_date: e.target.value})} style={styles.input} />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>الراتب</label>
                  <input type="number" value={formData.salary} onChange={e => setFormData({...formData, salary: e.target.value})} style={styles.input} />
                </div>
              </div>
              <div style={{ marginTop: '20px' }}>
                <button type="submit" style={styles.btnSuccess}>💾 {editingId ? 'تحديث' : 'حفظ'}</button>
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }} style={styles.btnSecondary}>إلغاء</button>
              </div>
            </form>
          )}

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>الرقم الوظيفي</th>
                <th style={styles.th}>الاسم</th>
                <th style={styles.th}>الإدارة</th>
                <th style={styles.th}>القسم</th>
                <th style={styles.th}>المسمى الوظيفي</th>
                <th style={styles.th}>الراتب</th>
                <th style={styles.th}>تاريخ التعيين</th>
                <th style={styles.th}>الحالة</th>
                <th style={styles.th}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr><td colSpan="9" style={{...styles.td, textAlign: 'center', color: '#6b7280'}}>لا يوجد موظفين</td></tr>
              ) : (
                employees.map(emp => (
                  <tr key={emp.id} style={{ opacity: emp.status === 'inactive' ? 0.7 : 1, backgroundColor: emp.status === 'inactive' ? '#f9fafb' : 'white' }}>
                    <td style={styles.td}><strong>{emp.employee_number}</strong></td>
                    <td style={styles.td}><strong>{emp.full_name}</strong></td>
                    <td style={styles.td}>{emp.department_name || '-'}</td>
                    <td style={styles.td}>{emp.section_name || '-'}</td>
                    <td style={styles.td}>{emp.job_title || '-'}</td>
                    <td style={styles.td}>{emp.salary ? `${Number(emp.salary).toLocaleString()} ج.م` : '-'}</td>
                    <td style={styles.td}>{emp.hire_date ? new Date(emp.hire_date).toLocaleDateString('ar-EG') : '-'}</td>
                    <td style={styles.td}>
                      <span style={styles.badge(emp.status)}>
                        {emp.status === 'active' ? '✓ نشط' : '✕ ترك الخدمة'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button onClick={() => handleEdit(emp)} style={styles.btnWarning}>✏️ تعديل</button>
                      {isAdmin && (
                        <button 
                          onClick={() => handleToggleStatus(emp)} 
                          style={emp.status === 'active' ? styles.btnToggleOff : styles.btnToggleOn}
                          title={emp.status === 'active' ? 'إلغاء تفعيل' : 'إعادة تفعيل'}
                        >
                          {emp.status === 'active' ? '🚫 إلغاء تفعيل' : '✅ إعادة تفعيل'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ========== تاب الإدارات ========== */}
      {activeTab === 'departments' && (
        <div>
          <h2 style={{ marginBottom: '20px' }}>🏢 الإدارات</h2>
          <form onSubmit={handleDeptSubmit} style={styles.form}>
            <h3>{editingDeptId ? 'تعديل إدارة' : 'إدارة جديدة'}</h3>
            <div style={styles.grid}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>اسم الإدارة *</label>
                <input type="text" value={deptForm.name} onChange={e => setDeptForm({...deptForm, name: e.target.value})} style={styles.input} required />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>كود الإدارة *</label>
                <input type="text" value={deptForm.code} onChange={e => setDeptForm({...deptForm, code: e.target.value})} style={styles.input} required />
              </div>
              <div style={{ ...styles.inputGroup, gridColumn: 'span 2' }}>
                <label style={styles.label}>الوصف</label>
                <input type="text" value={deptForm.description} onChange={e => setDeptForm({...deptForm, description: e.target.value})} style={styles.input} />
              </div>
            </div>
            <div style={{ marginTop: '20px' }}>
              <button type="submit" style={styles.btnSuccess}>💾 {editingDeptId ? 'تحديث' : 'حفظ'}</button>
              {editingDeptId && <button type="button" onClick={() => { setEditingDeptId(null); setDeptForm({ name: '', code: '', description: '' }); }} style={styles.btnSecondary}>إلغاء</button>}
            </div>
          </form>

          <table style={styles.table}>
            <thead>
              <tr><th style={styles.th}>الكود</th><th style={styles.th}>الاسم</th><th style={styles.th}>الوصف</th><th style={styles.th}>إجراءات</th></tr>
            </thead>
            <tbody>
              {departments.map(dept => (
                <tr key={dept.id}>
                  <td style={styles.td}><strong>{dept.code}</strong></td>
                  <td style={styles.td}><strong>{dept.name}</strong></td>
                  <td style={styles.td}>{dept.description || '-'}</td>
                  <td style={styles.td}>
                    <button onClick={() => handleEditDept(dept)} style={styles.btnWarning}>✏️ تعديل</button>
                    <button onClick={() => handleDeleteDept(dept.id)} style={styles.btnDanger}>🗑️ حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ========== تاب الأقسام ========== */}
      {activeTab === 'sections' && (
        <div>
          <h2 style={{ marginBottom: '20px' }}>📂 الأقسام</h2>
          <form onSubmit={handleSecSubmit} style={styles.form}>
            <h3>{editingSecId ? 'تعديل قسم' : 'قسم جديد'}</h3>
            <div style={styles.grid}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>اسم القسم *</label>
                <input type="text" value={secForm.name} onChange={e => setSecForm({...secForm, name: e.target.value})} style={styles.input} required />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>كود القسم *</label>
                <input type="text" value={secForm.code} onChange={e => setSecForm({...secForm, code: e.target.value})} style={styles.input} required />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>الإدارة *</label>
                <select value={secForm.department_id} onChange={e => setSecForm({...secForm, department_id: e.target.value})} style={styles.select} required>
                  <option value="">اختر الإدارة</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>الوصف</label>
                <input type="text" value={secForm.description} onChange={e => setSecForm({...secForm, description: e.target.value})} style={styles.input} />
              </div>
            </div>
            <div style={{ marginTop: '20px' }}>
              <button type="submit" style={styles.btnSuccess}>💾 {editingSecId ? 'تحديث' : 'حفظ'}</button>
              {editingSecId && <button type="button" onClick={() => { setEditingSecId(null); setSecForm({ name: '', code: '', department_id: '', description: '' }); }} style={styles.btnSecondary}>إلغاء</button>}
            </div>
          </form>

          <table style={styles.table}>
            <thead>
              <tr><th style={styles.th}>الكود</th><th style={styles.th}>الاسم</th><th style={styles.th}>الإدارة</th><th style={styles.th}>الوصف</th><th style={styles.th}>إجراءات</th></tr>
            </thead>
            <tbody>
              {sections.map(sec => (
                <tr key={sec.id}>
                  <td style={styles.td}><strong>{sec.code}</strong></td>
                  <td style={styles.td}><strong>{sec.name}</strong></td>
                  <td style={styles.td}>{sec.department_name}</td>
                  <td style={styles.td}>{sec.description || '-'}</td>
                  <td style={styles.td}>
                    <button onClick={() => handleEditSec(sec)} style={styles.btnWarning}>✏️ تعديل</button>
                    <button onClick={() => handleDeleteSec(sec.id)} style={styles.btnDanger}>🗑️ حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Employees;
