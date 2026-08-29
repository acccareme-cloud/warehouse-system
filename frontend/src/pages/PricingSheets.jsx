import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function PricingSheets() {
  const navigate = useNavigate();
  const [sheets, setSheets] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    sheet_number: '',
    sheet_date: new Date().toISOString().split('T')[0],
    customer_id: '',
    customer_name: '',
    project_name: '',
    notes: '',
    discount: 0,
    sheetItems: []
  });

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchSheets();
    fetchCustomers();
    fetchItems();
  }, []);

  const fetchSheets = async () => {
    try {
      const res = await axios.get(`${API_URL}/pricing-sheets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSheets(res.data);
    } catch (err) {
      console.error(err);
      alert('خطأ في جلب البيانات');
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(`${API_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchItems = async () => {
    try {
      const res = await axios.get(`${API_URL}/items`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setItems(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // ============================================
  // توليد الرقم التسلسلي الجديد DDMMYYYY
  // ============================================
  const getNextNumber = async () => {
    try {
      const res = await axios.get(`${API_URL}/pricing-sheets/next-number`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data && res.data.nextNumber) {
        return res.data.nextNumber;
      }
      throw new Error('No next number returned');
    } catch (err) {
      console.error('getNextNumber error:', err);
      // fallback: نولد الرقم من الجهاز لو الـ Backend مش بيرد
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const suffix = mm + yyyy;

      // ندور على أكبر رقم موجود في القائمة
      const sameMonthSheets = sheets.filter(s => s.sheet_number && s.sheet_number.endsWith(suffix));
      let maxSeq = 0;
      sameMonthSheets.forEach(s => {
        const seq = parseInt(s.sheet_number.substring(0, 2));
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      });
      return String(maxSeq + 1).padStart(2, '0') + suffix;
    }
  };

  // ============================================
  // بيان جديد — بيجيب رقم جديد كل مرة
  // ============================================
  const handleNew = async () => {
    setLoading(true);
    try {
      const nextNum = await getNextNumber();
      setEditingId(null);
      setForm({
        sheet_number: nextNum,
        sheet_date: new Date().toISOString().split('T')[0],
        customer_id: '',
        customer_name: '',
        project_name: '',
        notes: '',
        discount: 0,
        sheetItems: []
      });
      setShowForm(true);
    } catch (err) {
      alert('خطأ في توليد الرقم: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // تعديل — بيحمل البيانات القديمة
  // ============================================
  const handleEdit = async (sheet) => {
    if (sheet.status !== 'draft') {
      alert('لا يمكن تعديل البيان المعتمد');
      return;
    }
    setEditingId(sheet.id);
    setForm({
      sheet_number: sheet.sheet_number,
      sheet_date: sheet.sheet_date ? sheet.sheet_date.split('T')[0] : '',
      customer_id: sheet.customer_id || '',
      customer_name: sheet.customer_name || '',
      project_name: sheet.project_name || '',
      notes: sheet.notes || '',
      discount: sheet.discount || 0,
      sheetItems: Array.isArray(sheet.items) ? sheet.items.map(it => ({...it})) : []
    });
    setShowForm(true);
  };

  // ============================================
  // تكرار — بيجيب رقم جديد + ينسخ الأصناف
  // ============================================
  const handleDuplicate = async (sheet) => {
    setLoading(true);
    try {
      const nextNum = await getNextNumber();
      setEditingId(null);
      setForm({
        sheet_number: nextNum,
        sheet_date: new Date().toISOString().split('T')[0],
        customer_id: sheet.customer_id || '',
        customer_name: sheet.customer_name || '',
        project_name: sheet.project_name || '',
        notes: sheet.notes || '',
        discount: sheet.discount || 0,
        sheetItems: Array.isArray(sheet.items) 
          ? sheet.items.map(it => ({
              item_id: it.item_id,
              item_name: it.item_name,
              quantity: it.quantity,
              unit_price: it.unit_price,
              unit: it.unit
            }))
          : []
      });
      setShowForm(true);
    } catch (err) {
      alert('خطأ في التكرار: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    try {
      await axios.delete(`${API_URL}/pricing-sheets/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchSheets();
    } catch (err) {
      alert(err.response?.data?.message || 'خطأ في الحذف');
    }
  };

  const handleCancel = async (id) => {
    if (!confirm('هل أنت متأكد من الإلغاء؟')) return;
    try {
      await axios.put(`${API_URL}/pricing-sheets/${id}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchSheets();
    } catch (err) {
      alert(err.response?.data?.message || 'خطأ في الإلغاء');
    }
  };

  const handleApprove = async (id) => {
    if (!confirm('هل تريد اعتماد البيان؟')) return;
    try {
      await axios.put(`${API_URL}/pricing-sheets/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchSheets();
    } catch (err) {
      alert(err.response?.data?.message || 'خطأ في الاعتماد');
    }
  };

  const addItem = () => {
    setForm(prev => ({
      ...prev,
      sheetItems: [...prev.sheetItems, { item_id: '', item_name: '', quantity: 1, unit_price: 0, unit: '' }]
    }));
  };

  const removeItem = (idx) => {
    setForm(prev => ({
      ...prev,
      sheetItems: prev.sheetItems.filter((_, i) => i !== idx)
    }));
  };

  const updateItem = (idx, field, value) => {
    setForm(prev => {
      const newItems = [...prev.sheetItems];
      newItems[idx] = { ...newItems[idx], [field]: value };

      if (field === 'item_id' && value) {
        const selected = items.find(it => it.id == value);
        if (selected) {
          newItems[idx].item_name = selected.name || '';
          newItems[idx].unit = selected.unit || '';
          newItems[idx].unit_price = selected.price || 0;
        }
      }
      return { ...prev, sheetItems: newItems };
    });
  };

  const calculateTotals = () => {
    const subtotal = form.sheetItems.reduce((sum, item) => 
      sum + (parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0)), 0);
    const discount = parseFloat(form.discount || 0);
    return { subtotal, total: subtotal - discount };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.sheetItems.length === 0) {
      alert('أضف صنف واحد على الأقل');
      return;
    }

    const payload = {
      sheet_number: form.sheet_number,
      sheet_date: form.sheet_date,
      customer_id: form.customer_id || null,
      customer_name: form.customer_name,
      project_name: form.project_name,
      items: form.sheetItems,
      discount: parseFloat(form.discount || 0)
    };

    setLoading(true);
    try {
      if (editingId) {
        await axios.put(`${API_URL}/pricing-sheets/${editingId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('تم التعديل بنجاح');
      } else {
        await axios.post(`${API_URL}/pricing-sheets`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('تم الحفظ بنجاح');
      }
      setShowForm(false);
      fetchSheets();
    } catch (err) {
      console.error('Submit error:', err);
      alert(err.response?.data?.message || err.response?.data?.error || 'خطأ في الحفظ');
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, total } = calculateTotals();

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    const labels = { draft: 'مسودة', approved: 'معتمد', cancelled: 'ملغي' };
    return <span className={`px-2 py-1 rounded text-xs ${styles[status] || 'bg-gray-100'}`}>{labels[status] || status}</span>;
  };

  if (showForm) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">
          {editingId ? 'تعديل بيان التسليم' : 'بيان تسليم مسعر جديد'}
          <span className="text-sm font-normal text-gray-500 mr-3">رقم: {form.sheet_number}</span>
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">رقم البيان</label>
              <input 
                type="text" 
                value={form.sheet_number} 
                readOnly 
                className="w-full border p-2 rounded bg-gray-100 font-mono text-lg" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">التاريخ</label>
              <input 
                type="date" 
                value={form.sheet_date} 
                onChange={e => setForm({...form, sheet_date: e.target.value})} 
                className="w-full border p-2 rounded" 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">العميل</label>
              <select 
                value={form.customer_id} 
                onChange={e => {
                  const cust = customers.find(c => c.id == e.target.value);
                  setForm({...form, customer_id: e.target.value, customer_name: cust?.name || ''});
                }} 
                className="w-full border p-2 rounded"
              >
                <option value="">اختر العميل</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">اسم المشروع / جهة التسليم</label>
            <input 
              type="text" 
              value={form.project_name} 
              onChange={e => setForm({...form, project_name: e.target.value})} 
              className="w-full border p-2 rounded" 
            />
          </div>

          <div className="border rounded p-4 bg-gray-50">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold">الأصناف</h3>
              <button type="button" onClick={addItem} className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                + إضافة صنف
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="p-2 text-right border w-12">#</th>
                    <th className="p-2 text-right border">الصنف</th>
                    <th className="p-2 text-right border w-24">الكمية</th>
                    <th className="p-2 text-right border w-24">الوحدة</th>
                    <th className="p-2 text-right border w-28">السعر</th>
                    <th className="p-2 text-right border w-28">الإجمالي</th>
                    <th className="p-2 text-center border w-12">حذف</th>
                  </tr>
                </thead>
                <tbody>
                  {form.sheetItems.map((item, idx) => (
                    <tr key={idx} className="border-b bg-white">
                      <td className="p-2 text-center border">{idx + 1}</td>
                      <td className="p-2 border">
                        <select 
                          value={item.item_id || ''} 
                          onChange={e => updateItem(idx, 'item_id', e.target.value)} 
                          className="w-full border p-1 rounded"
                        >
                          <option value="">اختر الصنف</option>
                          {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                        </select>
                      </td>
                      <td className="p-2 border">
                        <input 
                          type="number" 
                          value={item.quantity} 
                          onChange={e => updateItem(idx, 'quantity', e.target.value)} 
                          className="w-full border p-1 rounded" 
                          min="1" 
                        />
                      </td>
                      <td className="p-2 border">
                        <input 
                          type="text" 
                          value={item.unit || ''} 
                          onChange={e => updateItem(idx, 'unit', e.target.value)} 
                          className="w-full border p-1 rounded" 
                        />
                      </td>
                      <td className="p-2 border">
                        <input 
                          type="number" 
                          value={item.unit_price} 
                          onChange={e => updateItem(idx, 'unit_price', e.target.value)} 
                          className="w-full border p-1 rounded" 
                          step="0.01"
                        />
                      </td>
                      <td className="p-2 border text-center font-semibold">
                        {(parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0)).toFixed(2)}
                      </td>
                      <td className="p-2 border text-center">
                        <button type="button" onClick={() => removeItem(idx)} className="text-red-600 hover:text-red-800 text-lg">✕</button>
                      </td>
                    </tr>
                  ))}
                  {form.sheetItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-gray-500">لا يوجد أصناف — اضغط "إضافة صنف"</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">الخصم</label>
              <input 
                type="number" 
                value={form.discount} 
                onChange={e => setForm({...form, discount: e.target.value})} 
                className="w-full border p-2 rounded" 
                step="0.01"
              />
            </div>
            <div className="md:col-span-2 text-left space-y-1">
              <div className="text-sm text-gray-600">الإجمالي: <span className="font-mono">{subtotal.toFixed(2)}</span> ج.م</div>
              <div className="text-lg font-bold text-green-700">الصافي: <span className="font-mono">{total.toFixed(2)}</span> ج.م</div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">ملاحظات</label>
            <textarea 
              value={form.notes} 
              onChange={e => setForm({...form, notes: e.target.value})} 
              className="w-full border p-2 rounded" 
              rows="2" 
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="submit" 
              disabled={loading} 
              className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'جاري الحفظ...' : (editingId ? 'حفظ التعديلات' : '💾 حفظ البيان')}
            </button>
            <button 
              type="button" 
              onClick={() => setShowForm(false)} 
              className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
        <h1 className="text-2xl font-bold">بيانات التسليم المسعر</h1>
        <div className="flex gap-3">
          <button 
            onClick={handleNew} 
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '...' : '+ بيان جديد'}
          </button>
          <button 
            onClick={() => navigate('/sales-module')} 
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            ← العودة للمبيعات
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-right border">رقم البيان</th>
              <th className="p-3 text-right border">التاريخ</th>
              <th className="p-3 text-right border">العميل</th>
              <th className="p-3 text-right border">المشروع</th>
              <th className="p-3 text-right border">الإجمالي</th>
              <th className="p-3 text-right border">الحالة</th>
              <th className="p-3 text-right border">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {sheets.map(sheet => (
              <tr key={sheet.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-mono font-bold border">{sheet.sheet_number}</td>
                <td className="p-3 border">{sheet.sheet_date?.split('T')[0]}</td>
                <td className="p-3 border">{sheet.customer_name || sheet.customer_name_display || '-'}</td>
                <td className="p-3 border">{sheet.project_name || '-'}</td>
                <td className="p-3 border font-semibold">{parseFloat(sheet.total_amount || 0).toFixed(2)}</td>
                <td className="p-3 border">{getStatusBadge(sheet.status)}</td>
                <td className="p-3 border">
                  <div className="flex gap-1 flex-wrap">
                    {sheet.status === 'draft' && (
                      <>
                        <button onClick={() => handleEdit(sheet)} className="bg-yellow-500 text-white px-2 py-1 rounded text-xs hover:bg-yellow-600">تعديل</button>
                        <button onClick={() => handleDelete(sheet.id)} className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600">حذف</button>
                        <button onClick={() => handleApprove(sheet.id)} className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700">اعتماد</button>
                      </>
                    )}
                    <button onClick={() => handleDuplicate(sheet)} className="bg-blue-400 text-white px-2 py-1 rounded text-xs hover:bg-blue-500">تكرار</button>
                    {sheet.status === 'approved' && (
                      <button onClick={() => handleCancel(sheet.id)} className="bg-orange-500 text-white px-2 py-1 rounded text-xs hover:bg-orange-600">إلغاء</button>
                    )}
                    <button 
                      onClick={() => navigate(`/pricing-sheets/${sheet.id}/print`)} 
                      className="bg-purple-600 text-white px-2 py-1 rounded text-xs hover:bg-purple-700"
                    >
                      🖨️ طباعة
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sheets.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">لا يوجد بيانات</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
