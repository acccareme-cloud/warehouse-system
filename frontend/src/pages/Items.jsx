import { useState, useEffect } from 'react';
import api from '../services/api';

function Items() {
  // ========== Tabs ==========
  const [activeTab, setActiveTab] = useState('items');

  // ========== Data States ==========
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [message, setMessage] = useState('');

  // ========== Item Form ==========
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    code: '', name: '', category_id: '', unit_id: '', warehouse_id: '',
    reorder_level: 0, unit_cost: 0, has_serial: false
  });

  // ========== Category Form ==========
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ code: '', name: '', description: '' });

  // ========== Warehouse Form ==========
  const [showWarehouseForm, setShowWarehouseForm] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [warehouseForm, setWarehouseForm] = useState({ code: '', name: '', location: '', manager: '', type: 'general' });

  // ========== Unit Form ==========
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [unitForm, setUnitForm] = useState({ unit_name: '', unit_code: '', conversion_rate: 1, is_base_unit: false });

  // ========== useEffect ==========
  useEffect(() => {
    fetchItems();
    fetchWarehouses();
    fetchCategories();
    fetchUnits();
    fetchEmployees();
  }, []);

  // ========== Fetch Functions ==========
  const fetchItems = async () => {
    try { const res = await api.get('/items'); setItems(res.data); }
    catch (err) { console.error('Error fetching items:', err); }
  };

  const fetchWarehouses = async () => {
    try { const res = await api.get('/warehouses'); setWarehouses(res.data); }
    catch (err) { console.error('Error fetching warehouses:', err); }
  };

  const fetchCategories = async () => {
    try { const res = await api.get('/categories'); setCategories(res.data); }
    catch (err) { console.error('Error fetching categories:', err); }
  };

  const fetchUnits = async () => {
    try { const res = await api.get('/units'); setUnits(res.data); }
    catch (err) { console.error('Error fetching units:', err); }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/warehouses/employees');
      setEmployees(res.data);
    } catch (err) {
      console.error('خطأ في تحميل الموظفين:', err);
    }
  };

  const generateCode = async () => {
    try {
      const res = await api.get('/items/next-code');
      setFormData(prev => ({ ...prev, code: res.data.nextCode }));
    } catch (err) {
      setFormData(prev => ({ ...prev, code: '0001' }));
    }
  };

  // ========== ITEMS HANDLERS ==========
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        unit: units.find(u => u.id == formData.unit_id)?.unit_name || 'عدد'
      };
      if (editingItem) {
        await api.put(`/items/${editingItem.id}`, payload);
        setMessage('تم تحديث الصنف');
      } else {
        await api.post('/items', payload);
        setMessage('تم إضافة الصنف');
      }
      resetItemForm();
      setShowForm(false);
      setEditingItem(null);
      fetchItems();
    } catch (err) {
      setMessage('خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const resetItemForm = () => {
    setFormData({
      code: '', name: '', category_id: '', unit_id: '', warehouse_id: '',
      reorder_level: 0, unit_cost: 0, has_serial: false
    });
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      code: item.code,
      name: item.name,
      category_id: item.category_id || '',
      unit_id: item.unit_id || '',
      warehouse_id: item.warehouse_id || '',
      reorder_level: item.reorder_level || 0,
      unit_cost: item.unit_cost || 0,
      has_serial: item.has_serial || false
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد؟')) return;
    try {
      await api.delete(`/items/${id}`);
      setMessage('تم حذف الصنف');
      fetchItems();
    } catch (err) {
      setMessage('خطأ في الحذف');
    }
  };

  // ========== CATEGORIES HANDLERS ==========
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, categoryForm);
        setMessage('تم تحديث التصنيف');
      } else {
        await api.post('/categories', categoryForm);
        setMessage('تم إضافة التصنيف');
      }
      setCategoryForm({ code: '', name: '', description: '' });
      setShowCategoryForm(false);
      setEditingCategory(null);
      fetchCategories();
    } catch (err) {
      setMessage('خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const handleEditCategory = (cat) => {
    setEditingCategory(cat);
    setCategoryForm({
      code: cat.code,
      name: cat.name,
      description: cat.description || ''
    });
    setShowCategoryForm(true);
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('هل أنت متأكد؟')) return;
    try {
      await api.delete(`/categories/${id}`);
      setMessage('تم حذف التصنيف');
      fetchCategories();
    } catch (err) {
      setMessage('خطأ في الحذف');
    }
  };

  // ========== WAREHOUSES HANDLERS ==========
  const handleWarehouseSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingWarehouse) {
        await api.put(`/warehouses/${editingWarehouse.id}`, warehouseForm);
        setMessage('تم تحديث المخزن');
      } else {
        await api.post('/warehouses', warehouseForm);
        setMessage('تم إضافة المخزن');
      }
      setWarehouseForm({ code: '', name: '', location: '', manager: '', type: 'general' });
      setShowWarehouseForm(false);
      setEditingWarehouse(null);
      fetchWarehouses();
    } catch (err) {
      setMessage('خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const handleEditWarehouse = (wh) => {
    setEditingWarehouse(wh);
    setWarehouseForm({
      code: wh.code,
      name: wh.name,
      location: wh.location || '',
      manager: wh.manager || '',
      type: wh.type || 'general'
    });
    setShowWarehouseForm(true);
  };

  const handleDeleteWarehouse = async (id) => {
    if (!window.confirm('هل أنت متأكد؟')) return;
    try {
      await api.delete(`/warehouses/${id}`);
      setMessage('تم حذف المخزن');
      fetchWarehouses();
    } catch (err) {
      setMessage('خطأ في الحذف');
    }
  };

  // ========== UNITS HANDLERS ==========
  const handleUnitSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUnit) {
        await api.put(`/units/${editingUnit.id}`, unitForm);
        setMessage('تم تحديث الوحدة');
      } else {
        await api.post('/units', unitForm);
        setMessage('تم إضافة الوحدة');
      }
      setUnitForm({ unit_name: '', unit_code: '', conversion_rate: 1, is_base_unit: false });
      setShowUnitForm(false);
      setEditingUnit(null);
      fetchUnits();
    } catch (err) {
      setMessage('خطأ: ' + (err.response?.data?.message || 'حدث خطأ'));
    }
  };

  const handleEditUnit = (u) => {
    setEditingUnit(u);
    setUnitForm({
      unit_name: u.unit_name,
      unit_code: u.unit_code,
      conversion_rate: u.conversion_rate || 1,
      is_base_unit: u.is_base_unit || false
    });
    setShowUnitForm(true);
  };

  const handleDeleteUnit = async (id) => {
    if (!window.confirm('هل أنت متأكد؟')) return;
    try {
      await api.delete(`/units/${id}`);
      setMessage('تم حذف الوحدة');
      fetchUnits();
    } catch (err) {
      setMessage('خطأ في الحذف');
    }
  };

  // ========== PRINT REPORTS ==========
  const handlePrint = (type) => {
    const printWindow = window.open('', '_blank');
    let content = '';
    const date = new Date().toLocaleDateString('ar-EG');

    if (type === 'items') {
      content = `
        <html dir="rtl"><head><title>تقرير الأصناف</title>
        <style>body{font-family:Arial;padding:20px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:10px;text-align:right} th{background:#007bff;color:white} h1{color:#007bff}</style></head>
        <body><h1>📦 تقرير الأصناف</h1><p>التاريخ: ${date}</p>
        <table><thead><tr><th>كود</th><th>الاسم</th><th>التصنيف</th><th>الوحدة</th><th>المخزن</th><th>الكمية</th><th>التكلفة</th></tr></thead>
        <tbody>${items.map(i => `<tr><td>${i.code}</td><td>${i.name}</td><td>${i.category_name || '-'}</td><td>${i.unit || '-'}</td><td>${i.warehouse_name || '-'}</td><td>${i.quantity || 0}</td><td>${i.unit_cost || 0} ج.م</td></tr>`).join('')}</tbody></table>
        <p><strong>إجمالي الأصناف: ${items.length}</strong></p></body></html>`;
    } else if (type === 'categories') {
      content = `
        <html dir="rtl"><head><title>تقرير التصنيفات</title>
        <style>body{font-family:Arial;padding:20px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:10px;text-align:right} th{background:#28a745;color:white} h1{color:#28a745}</style></head>
        <body><h1>📁 تقرير التصنيفات</h1><p>التاريخ: ${date}</p>
        <table><thead><tr><th>كود</th><th>الاسم</th><th>الوصف</th></tr></thead>
        <tbody>${categories.map(c => `<tr><td>${c.code}</td><td>${c.name}</td><td>${c.description || '-'}</td></tr>`).join('')}</tbody></table>
        <p><strong>إجمالي التصنيفات: ${categories.length}</strong></p></body></html>`;
    } else if (type === 'warehouses') {
      content = `
        <html dir="rtl"><head><title>تقرير المخازن</title>
        <style>body{font-family:Arial;padding:20px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:10px;text-align:right} th{background:#6f42c1;color:white} h1{color:#6f42c1}</style></head>
        <body><h1>🏭 تقرير المخازن</h1><p>التاريخ: ${date}</p>
        <table><thead><tr><th>كود</th><th>الاسم</th><th>الموقع</th><th>النوع</th><th>المسؤول</th></tr></thead>
        <tbody>${warehouses.map(w => `<tr><td>${w.code}</td><td>${w.name}</td><td>${w.location || '-'}</td><td>${w.type === 'finished_product' ? 'منتج نهائي' : w.type === 'spare_parts' ? 'قطع غيار' : 'عام'}</td><td>${w.manager || '-'}</td></tr>`).join('')}</tbody></table>
        <p><strong>إجمالي المخازن: ${warehouses.length}</strong></p></body></html>`;
    } else if (type === 'units') {
      content = `
        <html dir="rtl"><head><title>تقرير الوحدات</title>
        <style>body{font-family:Arial;padding:20px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:10px;text-align:right} th{background:#fd7e14;color:white} h1{color:#fd7e14}</style></head>
        <body><h1>⚖️ تقرير الوحدات</h1><p>التاريخ: ${date}</p>
        <table><thead><tr><th>الاسم</th><th>الرمز</th><th>معامل التحويل</th><th>وحدة أساسية</th></tr></thead>
        <tbody>${units.map(u => `<tr><td>${u.unit_name}</td><td>${u.unit_code}</td><td>${u.conversion_rate}</td><td>${u.is_base_unit ? '✓' : '-'}</td></tr>`).join('')}</tbody></table>
        <p><strong>إجمالي الوحدات: ${units.length}</strong></p></body></html>`;
    }

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  const safeValue = (val) => val === undefined || val === null ? '' : val;
  const thStyle = { padding: '12px', border: '1px solid #ddd', backgroundColor: '#007bff', color: 'white' };
  const tdStyle = { padding: '10px', border: '1px solid #ddd', color: '#1e293b' };

  // ========== JSX ==========
  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1>إدارة الأصناف</h1>
      <button onClick={() => window.location.href = '/dashboard'} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', marginBottom: '20px', cursor: 'pointer' }}>
        رجوع للوحة التحكم
      </button>
      {message && <p style={{ padding: '10px', backgroundColor: message.includes('تم') ? '#d4edda' : '#f8d7da', borderRadius: '4px' }}>{message}</p>}

      {/* ========== TABS ========== */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('items')} style={{ padding: '12px 25px', backgroundColor: activeTab === 'items' ? '#007bff' : '#e2e8f0', color: activeTab === 'items' ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>📦 الأصناف</button>
        <button onClick={() => setActiveTab('categories')} style={{ padding: '12px 25px', backgroundColor: activeTab === 'categories' ? '#28a745' : '#e2e8f0', color: activeTab === 'categories' ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>📁 التصنيفات</button>
        <button onClick={() => setActiveTab('warehouses')} style={{ padding: '12px 25px', backgroundColor: activeTab === 'warehouses' ? '#6f42c1' : '#e2e8f0', color: activeTab === 'warehouses' ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>🏭 المخازن</button>
        <button onClick={() => setActiveTab('units')} style={{ padding: '12px 25px', backgroundColor: activeTab === 'units' ? '#fd7e14' : '#e2e8f0', color: activeTab === 'units' ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>⚖️ الوحدات</button>
      </div>

      {/* ========== ITEMS TAB ========== */}
      {activeTab === 'items' && (
        <>
          <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
            <button onClick={() => { setShowForm(!showForm); if (!showForm) generateCode(); }} style={{ padding: '12px 25px', backgroundColor: showForm ? '#dc3545' : '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
              {showForm ? '❌ إلغاء' : '➕ إضافة صنف'}
            </button>
            <button onClick={() => handlePrint('items')} style={{ padding: '12px 25px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
              🖨️ طباعة تقرير
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} style={{ color: '#1e293b', backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
              <h3>{editingItem ? 'تعديل صنف' : 'إضافة صنف جديد'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                <div>
                  <label>كود الصنف:</label>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <input type="text" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} required style={{ flex: 1, padding: '8px' }} />
                    <button type="button" onClick={generateCode} style={{ padding: '8px 15px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>توليد</button>
                  </div>
                </div>
                <div>
                  <label>اسم الصنف:</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required style={{ width: '100%', padding: '8px' }} placeholder="مثال: جهاز تنفس Neo" />
                </div>
                <div>
                  <label>التصنيف:</label>
                  <select value={safeValue(formData.category_id)} onChange={(e) => setFormData({...formData, category_id: e.target.value})} required style={{ width: '100%', padding: '8px' }}>
                    <option value="">اختر التصنيف</option>
                    {categories.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                </div>
                <div>
                  <label>الوحدة:</label>
                  <select value={safeValue(formData.unit_id)} onChange={(e) => setFormData({...formData, unit_id: e.target.value})} required style={{ width: '100%', padding: '8px' }}>
                    <option value="">اختر الوحدة</option>
                    {units.map(u => (<option key={u.id} value={u.id}>{u.unit_name} ({u.unit_code})</option>))}
                  </select>
                </div>
                <div>
                  <label>المخزن:</label>
                  <select value={safeValue(formData.warehouse_id)} onChange={(e) => setFormData({...formData, warehouse_id: e.target.value})} required style={{ width: '100%', padding: '8px' }}>
                    <option value="">اختر المخزن</option>
                    {warehouses.map(w => (<option key={w.id} value={w.id}>{w.name}</option>))}
                  </select>
                </div>
                <div>
                  <label>حد إعادة الطلب:</label>
                  <input type="number" value={formData.reorder_level} onChange={(e) => setFormData({...formData, reorder_level: e.target.value})} style={{ width: '100%', padding: '8px' }} />
                </div>
                <div>
                  <label>تكلفة القطعة:</label>
                  <input type="number" step="0.01" value={formData.unit_cost} onChange={(e) => setFormData({...formData, unit_cost: e.target.value})} style={{ width: '100%', padding: '8px' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px' }}>
                  <input type="checkbox" id="has_serial" checked={formData.has_serial} onChange={(e) => setFormData({...formData, has_serial: e.target.checked})} style={{ width: '20px', height: '20px' }} />
                  <label htmlFor="has_serial" style={{ cursor: 'pointer', fontWeight: 'bold' }}>الصنف له سريال نمبر</label>
                </div>
              </div>
              <button type="submit" style={{ marginTop: '15px', padding: '12px 40px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
                💾 {editingItem ? 'تحديث' : 'حفظ'}
              </button>
            </form>
          )}

          <h3>قائمة الأصناف</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr>
                <th style={thStyle}>كود</th>
                <th style={thStyle}>اسم الصنف</th>
                <th style={thStyle}>التصنيف</th>
                <th style={thStyle}>الوحدة</th>
                <th style={thStyle}>المخزن</th>
                <th style={thStyle}>الكمية</th>
                <th style={thStyle}>حد الطلب</th>
                <th style={thStyle}>التكلفة</th>
                <th style={thStyle}>سريال</th>
                <th style={thStyle}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="10" style={{ textAlign: 'center', padding: '20px' }}>لا يوجد أصناف</td></tr>
              ) : items.map(item => (
                <tr key={item.id} style={{ backgroundColor: item.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                  <td style={tdStyle}><strong>{item.code}</strong></td>
                  <td style={tdStyle}>{item.name}</td>
                  <td style={tdStyle}>{item.category_name || '-'}</td>
                  <td style={tdStyle}>
                    <span style={{ color: '#1e293b', backgroundColor: '#e3f2fd', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                      {item.unit || '-'}
                    </span>
                  </td>
                  <td style={tdStyle}>{item.warehouse_name || '-'}</td>
                  <td style={tdStyle}>{item.quantity || 0}</td>
                  <td style={tdStyle}>{item.reorder_level || 0}</td>
                  <td style={tdStyle}>{item.unit_cost || 0} ج.م</td>
                  <td style={tdStyle}>{item.has_serial ? <span style={{ color: '#0d9488', fontWeight: 'bold' }}>✓</span> : <span style={{ color: '#64748b' }}>-</span>}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button onClick={() => handleEdit(item)} style={{ padding: '5px 10px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>تعديل</button>
                      <button onClick={() => handleDelete(item.id)} style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ========== CATEGORIES TAB ========== */}
      {activeTab === 'categories' && (
        <>
          <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
            <button onClick={() => { setShowCategoryForm(!showCategoryForm); setEditingCategory(null); setCategoryForm({ code: '', name: '', description: '' }); }} style={{ padding: '12px 25px', backgroundColor: showCategoryForm ? '#dc3545' : '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
              {showCategoryForm ? '❌ إلغاء' : '➕ إضافة تصنيف'}
            </button>
            <button onClick={() => handlePrint('categories')} style={{ padding: '12px 25px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
              🖨️ طباعة تقرير
            </button>
          </div>

          {showCategoryForm && (
            <form onSubmit={handleCategorySubmit} style={{ color: '#1e293b', backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
              <h3>{editingCategory ? 'تعديل تصنيف' : 'إضافة تصنيف'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                <div>
                  <label>كود التصنيف:</label>
                  <input type="text" value={categoryForm.code} onChange={(e) => setCategoryForm({...categoryForm, code: e.target.value})} required style={{ width: '100%', padding: '8px' }} />
                </div>
                <div>
                  <label>اسم التصنيف:</label>
                  <input type="text" value={categoryForm.name} onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})} required style={{ width: '100%', padding: '8px' }} placeholder="مثال: أجهزة تنفس" />
                </div>
                <div>
                  <label>الوصف:</label>
                  <input type="text" value={categoryForm.description} onChange={(e) => setCategoryForm({...categoryForm, description: e.target.value})} style={{ width: '100%', padding: '8px' }} />
                </div>
              </div>
              <button type="submit" style={{ marginTop: '15px', padding: '12px 40px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
                💾 {editingCategory ? 'تحديث' : 'حفظ'}
              </button>
            </form>
          )}

          <h3>قائمة التصنيفات</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, backgroundColor: '#28a745' }}>كود</th>
                <th style={{ ...thStyle, backgroundColor: '#28a745' }}>الاسم</th>
                <th style={{ ...thStyle, backgroundColor: '#28a745' }}>الوصف</th>
                <th style={{ ...thStyle, backgroundColor: '#28a745' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>لا يوجد تصنيفات</td></tr>
              ) : categories.map(cat => (
                <tr key={cat.id} style={{ backgroundColor: cat.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                  <td style={tdStyle}><strong>{cat.code}</strong></td>
                  <td style={tdStyle}>{cat.name}</td>
                  <td style={tdStyle}>{cat.description || '-'}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button onClick={() => handleEditCategory(cat)} style={{ padding: '5px 10px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>تعديل</button>
                      <button onClick={() => handleDeleteCategory(cat.id)} style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ========== WAREHOUSES TAB ========== */}
      {activeTab === 'warehouses' && (
        <>
          <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
            <button onClick={() => { setShowWarehouseForm(!showWarehouseForm); setEditingWarehouse(null); setWarehouseForm({ code: '', name: '', location: '', manager: '', type: 'general' }); }} style={{ padding: '12px 25px', backgroundColor: showWarehouseForm ? '#dc3545' : '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
              {showWarehouseForm ? '❌ إلغاء' : '➕ إضافة مخزن'}
            </button>
            <button onClick={() => handlePrint('warehouses')} style={{ padding: '12px 25px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
              🖨️ طباعة تقرير
            </button>
          </div>

          {showWarehouseForm && (
            <form onSubmit={handleWarehouseSubmit} style={{ color: '#1e293b', backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
              <h3>{editingWarehouse ? 'تعديل مخزن' : 'إضافة مخزن'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                <div>
                  <label>كود المخزن:</label>
                  <input type="text" value={warehouseForm.code} onChange={(e) => setWarehouseForm({...warehouseForm, code: e.target.value})} required style={{ width: '100%', padding: '8px' }} />
                </div>
                <div>
                  <label>اسم المخزن:</label>
                  <input type="text" value={warehouseForm.name} onChange={(e) => setWarehouseForm({...warehouseForm, name: e.target.value})} required style={{ width: '100%', padding: '8px' }} placeholder="مثال: المخزن الرئيسي" />
                </div>
                <div>
                  <label>الموقع:</label>
                  <input type="text" value={warehouseForm.location} onChange={(e) => setWarehouseForm({...warehouseForm, location: e.target.value})} style={{ width: '100%', padding: '8px' }} />
                </div>
                <div>
                  <label>النوع:</label>
                  <select
                    value={warehouseForm.type || 'general'}
                    onChange={(e) => setWarehouseForm({...warehouseForm, type: e.target.value})}
                    style={{ width: '100%', padding: '8px' }}
                  >
                    <option value="general">عام</option>
                    <option value="finished_product">منتج نهائي</option>
                    <option value="spare_parts">قطع غيار</option>
                  </select>
                </div>
                <div>
                  <label>المسؤول:</label>
                  <select
                    value={warehouseForm.manager || ''}
                    onChange={(e) => setWarehouseForm({...warehouseForm, manager: e.target.value})}
                    style={{ width: '100%', padding: '8px' }}
                  >
                    <option value="">اختر المسؤول</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.name}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" style={{ marginTop: '15px', padding: '12px 40px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
                💾 {editingWarehouse ? 'تحديث' : 'حفظ'}
              </button>
            </form>
          )}

          <h3>قائمة المخازن</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, backgroundColor: '#6f42c1' }}>كود</th>
                <th style={{ ...thStyle, backgroundColor: '#6f42c1' }}>الاسم</th>
                <th style={{ ...thStyle, backgroundColor: '#6f42c1' }}>الموقع</th>
                <th style={{ ...thStyle, backgroundColor: '#6f42c1' }}>النوع</th>
                <th style={{ ...thStyle, backgroundColor: '#6f42c1' }}>المسؤول</th>
                <th style={{ ...thStyle, backgroundColor: '#6f42c1' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>لا يوجد مخازن</td></tr>
              ) : warehouses.map(wh => (
                <tr key={wh.id} style={{ backgroundColor: wh.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                  <td style={tdStyle}><strong>{wh.code}</strong></td>
                  <td style={tdStyle}>{wh.name}</td>
                  <td style={tdStyle}>{wh.location || '-'}</td>
                  <td style={tdStyle}>{wh.type === 'finished_product' ? 'منتج نهائي' : wh.type === 'spare_parts' ? 'قطع غيار' : 'عام'}</td>
                  <td style={tdStyle}>{wh.manager || '-'}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button onClick={() => handleEditWarehouse(wh)} style={{ padding: '5px 10px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>تعديل</button>
                      <button onClick={() => handleDeleteWarehouse(wh.id)} style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ========== UNITS TAB ========== */}
      {activeTab === 'units' && (
        <>
          <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
            <button onClick={() => { setShowUnitForm(!showUnitForm); setEditingUnit(null); setUnitForm({ unit_name: '', unit_code: '', conversion_rate: 1, is_base_unit: false }); }} style={{ padding: '12px 25px', backgroundColor: showUnitForm ? '#dc3545' : '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
              {showUnitForm ? '❌ إلغاء' : '➕ إضافة وحدة'}
            </button>
            <button onClick={() => handlePrint('units')} style={{ padding: '12px 25px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
              🖨️ طباعة تقرير
            </button>
          </div>

          {showUnitForm && (
            <form onSubmit={handleUnitSubmit} style={{ color: '#1e293b', backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
              <h3>{editingUnit ? 'تعديل وحدة' : 'إضافة وحدة'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                <div>
                  <label>اسم الوحدة:</label>
                  <input type="text" value={unitForm.unit_name} onChange={(e) => setUnitForm({...unitForm, unit_name: e.target.value})} required style={{ width: '100%', padding: '8px' }} placeholder="مثال: علبة" />
                </div>
                <div>
                  <label>الرمز:</label>
                  <input type="text" value={unitForm.unit_code} onChange={(e) => setUnitForm({...unitForm, unit_code: e.target.value})} required style={{ width: '100%', padding: '8px' }} placeholder="مثال: BOX" />
                </div>
                <div>
                  <label>معامل التحويل:</label>
                  <input type="number" step="0.0001" value={unitForm.conversion_rate} onChange={(e) => setUnitForm({...unitForm, conversion_rate: e.target.value})} required style={{ width: '100%', padding: '8px' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px' }}>
                  <input type="checkbox" id="is_base_unit" checked={unitForm.is_base_unit} onChange={(e) => setUnitForm({...unitForm, is_base_unit: e.target.checked})} style={{ width: '20px', height: '20px' }} />
                  <label htmlFor="is_base_unit" style={{ cursor: 'pointer', fontWeight: 'bold' }}>وحدة أساسية</label>
                </div>
              </div>
              <button type="submit" style={{ marginTop: '15px', padding: '12px 40px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
                💾 {editingUnit ? 'تحديث' : 'حفظ'}
              </button>
            </form>
          )}

          <h3>قائمة الوحدات</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr>
                <th style={{ color: '#1e293b', ...thStyle, backgroundColor: '#fd7e14' }}>الاسم</th>
                <th style={{ color: '#1e293b', ...thStyle, backgroundColor: '#fd7e14' }}>الرمز</th>
                <th style={{ color: '#1e293b', ...thStyle, backgroundColor: '#fd7e14' }}>معامل التحويل</th>
                <th style={{ color: '#1e293b', ...thStyle, backgroundColor: '#fd7e14' }}>وحدة أساسية</th>
                <th style={{ color: '#1e293b', ...thStyle, backgroundColor: '#fd7e14' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {units.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>لا يوجد وحدات</td></tr>
              ) : units.map(u => (
                <tr key={u.id} style={{ backgroundColor: u.id % 2 === 0 ? '#f8f9fa' : 'white' }}>
                  <td style={tdStyle}>{u.unit_name}</td>
                  <td style={tdStyle}><strong>{u.unit_code}</strong></td>
                  <td style={tdStyle}>{u.conversion_rate}</td>
                  <td style={tdStyle}>{u.is_base_unit ? <span style={{ color: '#28a745', fontWeight: 'bold' }}>✓ نعم</span> : <span style={{ color: '#64748b' }}>لا</span>}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button onClick={() => handleEditUnit(u)} style={{ padding: '5px 10px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>تعديل</button>
                      <button onClick={() => handleDeleteUnit(u.id)} style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export default Items;
