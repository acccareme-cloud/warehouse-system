import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const CustodySubmissions = () => {
  const navigate = useNavigate();
  const [custodies, setCustodies] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [details, setDetails] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    submission_number: '',
    custody_id: '',
    notes: ''
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCustody, setSelectedCustody] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchCustodies();
    fetchExpenseCategories();
    fetchCostCenters();
    fetchMySubmissions();
  }, []);

  const fetchCustodies = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:5000/api/custodies/active', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const employeeCustodies = (res.data || []).filter(c => c.party_type === 'employee' || !c.party_type);
      setCustodies(employeeCustodies);
    } catch (err) {
      setMessage('خطأ في جلب العهد: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenseCategories = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/expense-categories', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExpenseCategories((res.data || []).filter(c => c.category_type === 'sub'));
    } catch (err) {
      console.error('Error fetching expense categories:', err);
    }
  };

  const fetchCostCenters = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/cost-centers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCostCenters(res.data || []);
    } catch (err) {
      console.error('Error fetching cost centers:', err);
    }
  };

  const fetchMySubmissions = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/custody-submissions/my-submissions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMySubmissions(res.data || []);
    } catch (err) {
      console.error('Error fetching my submissions:', err);
    }
  };

  const fetchNextNumber = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/custody-submissions/next-number', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFormData(prev => ({ ...prev, submission_number: res.data.nextNumber }));
    } catch (err) {
      setFormData(prev => ({ ...prev, submission_number: 'SUB-0001' }));
    }
  };

  const fetchSubmissionForEdit = async (id) => {
    try {
      setLoading(true);
      const res = await axios.get(`http://localhost:5000/api/custody-submissions/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data;
      setFormData({
        submission_number: data.submission_number,
        custody_id: data.custody_id,
        notes: data.notes || ''
      });
      setDetails(data.details || []);
      setEditingId(id);
      setShowForm(true);
      // Set selected custody for difference calculation
      const custody = custodies.find(c => c.id === data.custody_id);
      setSelectedCustody(custody || null);
    } catch (err) {
      setMessage('❌ خطأ في تحميل بيانات التعديل');
    } finally {
      setLoading(false);
    }
  };

  const addDetail = () => {
    setDetails([...details, {
      expense_category_id: '',
      cost_center_id: '',
      amount: '',
      description: '',
      receipt_number: '',
      receipt_attachment: ''
    }]);
  };

  const updateDetail = (index, field, value) => {
    const newDetails = [...details];
    newDetails[index][field] = value;
    setDetails(newDetails);
  };

  const removeDetail = (index) => {
    setDetails(details.filter((_, i) => i !== index));
  };

  const getTotalAmount = () => {
    return details.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  };

  const getDifference = () => {
    if (!selectedCustody) return 0;
    return getTotalAmount() - parseFloat(selectedCustody.remaining_amount || 0);
  };

  const handleCustodyChange = (custodyId) => {
    setFormData({ ...formData, custody_id: custodyId });
    const custody = custodies.find(c => String(c.id) === String(custodyId));
    setSelectedCustody(custody || null);
  };

  const handleSubmit = async (e, asDraft = false) => {
    e.preventDefault();
    setMessage('');

    if (!formData.custody_id) {
      setMessage('❌ اختر العهدة أولاً');
      return;
    }
    if (details.length === 0) {
      setMessage('❌ أضف مصروف واحد على الأقل');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...formData,
        details,
        status: asDraft ? 'draft' : 'pending'
      };

      if (editingId) {
        await axios.put(`http://localhost:5000/api/custody-submissions/${editingId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessage(asDraft ? '✅ تم تحديث المسودة بنجاح!' : '✅ تم تحديث التقديم بنجاح!');
      } else {
        await axios.post('http://localhost:5000/api/custody-submissions', payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessage(asDraft ? '✅ تم حفظ المسودة بنجاح!' : '✅ تم تقديم التسوية بنجاح!');
      }

      setShowForm(false);
      setDetails([]);
      setFormData({ submission_number: '', custody_id: '', notes: '' });
      setEditingId(null);
      setSelectedCustody(null);
      fetchMySubmissions();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || 'خطأ في الحفظ'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا التقديم؟ سيتم إرجاع العهدة للحالة النشطة.')) return;
    try {
      setLoading(true);
      await axios.delete(`http://localhost:5000/api/custody-submissions/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('✅ تم حذف التقديم وإرجاع العهدة للحالة النشطة');
      fetchMySubmissions();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || 'خطأ في الحذف'));
    } finally {
      setLoading(false);
    }
  };

  const handleNewSubmission = () => {
    setShowForm(true);
    setEditingId(null);
    setDetails([]);
    setFormData({ submission_number: '', custody_id: '', notes: '' });
    setSelectedCustody(null);
    setMessage('');
    fetchNextNumber();
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: { bg: '#f3f4f6', color: '#374151', text: '📝 مسودة' },
      pending: { bg: '#fef3c7', color: '#92400e', text: '⏳ عند المدير' },
      approved: { bg: '#dcfce7', color: '#166534', text: '✅ معتمد من المدير (عند المالية)' },
      rejected: { bg: '#fee2e2', color: '#991b1b', text: '❌ مرفوض' },
      settled: { bg: '#dbeafe', color: '#1e40af', text: '💰 تم التسوية' }
    };
    const s = styles[status] || styles.pending;
    return <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', backgroundColor: s.bg, color: s.color }}>{s.text}</span>;
  };

  const getDifferenceBadge = (sub) => {
    const total = parseFloat(sub.total_amount || 0);
    const remaining = parseFloat(sub.custody_remaining || 0);
    const diff = total - remaining;
    if (Math.abs(diff) <= 0.01) {
      return <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✓ مطابق</span>;
    } else if (diff > 0.01) {
      return <span style={{ color: '#dc2626', fontWeight: 'bold' }}>+{diff.toFixed(2)} زيادة</span>;
    } else {
      return <span style={{ color: '#2563eb', fontWeight: 'bold' }}>{diff.toFixed(2)} نقص</span>;
    }
  };

  const filterSubmissions = (subs) => {
    if (activeTab === 'all') return subs;
    return subs.filter(s => s.status === activeTab);
  };

  const tabCounts = {
    all: mySubmissions.length,
    draft: mySubmissions.filter(s => s.status === 'draft').length,
    pending: mySubmissions.filter(s => s.status === 'pending').length,
    approved: mySubmissions.filter(s => s.status === 'approved').length,
    settled: mySubmissions.filter(s => s.status === 'settled').length,
    rejected: mySubmissions.filter(s => s.status === 'rejected').length,
  };

  const difference = getDifference();
  const isOver = difference > 0.01;
  const isUnder = difference < -0.01;
  const isExact = Math.abs(difference) <= 0.01;

  const styles = {
    container: { padding: '20px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl', fontFamily: 'Arial, sans-serif' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '15px', backgroundColor: '#1e293b', borderRadius: '12px', color: 'white' },
    title: { fontSize: '24px', fontWeight: 'bold', margin: 0 },
    btnBack: { backgroundColor: '#64748b', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
    btnPrimary: { backgroundColor: '#2563eb', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' },
    btnSuccess: { backgroundColor: '#16a34a', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
    btnWarning: { backgroundColor: '#d97706', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', marginLeft: '5px' },
    btnDanger: { backgroundColor: '#dc2626', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
    btnDraft: { backgroundColor: '#6b7280', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', marginLeft: '10px' },
    message: (type) => ({ padding: '12px', borderRadius: '8px', marginBottom: '15px', fontWeight: 'bold', backgroundColor: type === 'success' ? '#dcfce7' : '#fee2e2', color: type === 'success' ? '#166534' : '#991b1b' }),
    form: { backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '2px solid #e2e8f0' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' },
    inputGroup: { display: 'flex', flexDirection: 'column' },
    label: { marginBottom: '8px', fontWeight: 'bold', color: '#374151', fontSize: '14px' },
    input: { padding: '12px', border: '2px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' },
    select: { padding: '12px', border: '2px solid #d1d5db', borderRadius: '8px', fontSize: '14px', backgroundColor: 'white', outline: 'none', width: '100%', boxSizing: 'border-box' },
    detailsHeader: { display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 2fr 1fr 1fr auto', gap: '10px', fontWeight: 'bold', fontSize: '12px', color: '#6b7280', marginBottom: '5px', padding: '5px' },
    detailRow: { display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 2fr 1fr 1fr auto', gap: '10px', marginBottom: '10px', padding: '10px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center' },
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
    th: { backgroundColor: '#1e293b', color: 'white', padding: '15px', textAlign: 'right', fontWeight: 'bold', fontSize: '14px' },
    td: { padding: '12px 15px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', fontSize: '14px', color: '#1e293b' },
    totalBox: { backgroundColor: '#dbeafe', padding: '15px', borderRadius: '8px', marginTop: '15px', fontWeight: 'bold', fontSize: '16px', color: '#1e40af' },
    diffBoxOver: { backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '12px', borderRadius: '8px', marginTop: '15px', color: '#991b1b' },
    diffBoxUnder: { backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '12px', borderRadius: '8px', marginTop: '15px', color: '#1e40af' },
    diffBoxExact: { backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px', borderRadius: '8px', marginTop: '15px', color: '#166534' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate('/custody-module')} style={styles.btnBack}>← رجوع للعهود</button>
        <h1 style={styles.title}>📝 تقديم تسوية العهدة</h1>
        <button onClick={() => navigate('/dashboard')} style={styles.btnBack}>🏠 الرئيسية</button>
      </div>

      {message && <div style={styles.message(message.includes('✅') ? 'success' : 'error')}>{message}</div>}

      <button onClick={handleNewSubmission} style={{...styles.btnPrimary, backgroundColor: showForm ? '#dc2626' : '#2563eb'}}>
        {showForm ? '✕ إلغاء' : '+ تقديم تسوية جديدة'}
      </button>

      {showForm && (
        <form style={styles.form}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', color: '#1e293b' }}>
            {editingId ? '✏️ تعديل تقديم' : 'بيانات التسوية'}
          </h2>

          <div style={styles.grid}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>رقم التقديم</label>
              <input type="text" value={formData.submission_number} readOnly style={{ color: '#1e293b',...styles.input, backgroundColor: '#f3f4f6'}} />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>العهدة *</label>
              <select
                value={formData.custody_id}
                onChange={e => handleCustodyChange(e.target.value)}
                style={styles.select}
                required
                disabled={!!editingId}
              >
                <option value="">-- اختر العهدة --</option>
                {custodies.length === 0 && <option value="" disabled>⚠️ لا يوجد عهد متاحة</option>}
                {custodies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.custody_number} - {c.employee_full_name || c.employee_name || 'بدون موظف'}
                    {c.department_name && ` [${c.department_name}]`}
                    - متبقي: {parseFloat(c.remaining_amount).toFixed(2)} ج.م
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedCustody && (
            <div style={{ color: '#1e293b', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', margin: '15px 0', padding: '12px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div><span style={{ fontSize: '12px', color: '#6b7280' }}>مبلغ العهدة</span><br/><strong>{parseFloat(selectedCustody.amount || 0).toFixed(2)} ج.م</strong></div>
              <div><span style={{ fontSize: '12px', color: '#6b7280' }}>المتبقي</span><br/><strong style={{ color: '#d97706' }}>{parseFloat(selectedCustody.remaining_amount || 0).toFixed(2)} ج.م</strong></div>
              <div><span style={{ fontSize: '12px', color: '#6b7280' }}>إجمالي التسوية</span><br/><strong style={{ color: '#dc2626' }}>{getTotalAmount().toFixed(2)} ج.م</strong></div>
            </div>
          )}

          {selectedCustody && (
            <div style={isOver ? styles.diffBoxOver : isUnder ? styles.diffBoxUnder : styles.diffBoxExact}>
              {isOver ? (
                <><strong>⚠️ مبلغ التسوية أكبر من المتبقي</strong><br/>بعد اعتماد المدير، المالية هتسوّي العهدة وتعمل سند صرف يدوي (CSET) بفرق {difference.toFixed(2)} ج.م من شاشة الخزينة.</>
              ) : isUnder ? (
                <><strong>ℹ️ مبلغ التسوية أقل من المتبقي</strong><br/>بعد اعتماد المدير، المالية هتسوّي العهدة وتعمل سند رد يدوي (CRET) بفرق {Math.abs(difference).toFixed(2)} ج.م من شاشة الخزينة.</>
              ) : (
                <><strong>✓ مبلغ التسوية مطابق للمتبقي</strong><br/>العهدة هتتقفل بالكامل بدون حركات خزينة إضافية.</>
              )}
            </div>
          )}

          <h3 style={{ marginTop: '20px', marginBottom: '10px', fontWeight: 'bold', color: '#1e293b' }}>تفاصيل المصروفات:</h3>

          <div style={styles.detailsHeader}>
            <div>بند المصروف *</div>
            <div>مركز التكلفة</div>
            <div>المبلغ *</div>
            <div>البيان</div>
            <div>رقم الإيصال</div>
            <div>مرفق</div>
            <div></div>
          </div>

          {details.map((detail, index) => (
            <div key={index} style={styles.detailRow}>
              <select
                value={detail.expense_category_id}
                onChange={e => updateDetail(index, 'expense_category_id', e.target.value)}
                style={styles.select}
                required
              >
                <option value="">اختر البند...</option>
                {expenseCategories.map(ec => (
                  <option key={ec.id} value={ec.id}>{ec.category_code} - {ec.category_name}</option>
                ))}
              </select>

              <select
                value={detail.cost_center_id}
                onChange={e => updateDetail(index, 'cost_center_id', e.target.value)}
                style={styles.select}
              >
                <option value="">اختر المركز...</option>
                {costCenters.map(cc => (
                  <option key={cc.id} value={cc.id}>{cc.center_code} - {cc.center_name}</option>
                ))}
              </select>

              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={detail.amount || ''}
                onChange={e => updateDetail(index, 'amount', e.target.value)}
                style={styles.input}
                required
              />

              <input
                type="text"
                placeholder="وصف المصروف"
                value={detail.description || ''}
                onChange={e => updateDetail(index, 'description', e.target.value)}
                style={styles.input}
              />

              <input
                type="text"
                placeholder="رقم الإيصال"
                value={detail.receipt_number || ''}
                onChange={e => updateDetail(index, 'receipt_number', e.target.value)}
                style={styles.input}
              />

              <input
                type="text"
                placeholder="رابط المرفق"
                value={detail.receipt_attachment || ''}
                onChange={e => updateDetail(index, 'receipt_attachment', e.target.value)}
                style={styles.input}
              />

              <button type="button" onClick={() => removeDetail(index)} style={styles.btnDanger}>
                🗑️
              </button>
            </div>
          ))}

          <button type="button" onClick={addDetail} style={{...styles.btnPrimary, backgroundColor: '#16a34a', marginTop: '10px'}}>
            + إضافة مصروف
          </button>

          {details.length > 0 && (
            <div style={styles.totalBox}>
              الإجمالي: {getTotalAmount().toFixed(2)} ج.م
            </div>
          )}

          <div style={{ marginTop: '20px' }}>
            <label style={styles.label}>ملاحظات</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              style={{...styles.input, width: '100%', minHeight: '80px'}}
              placeholder="أي ملاحظات إضافية..."
            />
          </div>

          <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            <button type="button" onClick={(e) => handleSubmit(e, false)} style={{...styles.btnSuccess, fontSize: '16px'}} disabled={loading}>
              {loading ? '⏳ جاري الحفظ...' : (editingId ? '💾 حفظ التعديلات' : '📤 تقديم التسوية')}
            </button>
            <button type="button" onClick={(e) => handleSubmit(e, true)} style={{...styles.btnDraft, fontSize: '16px'}} disabled={loading}>
              {loading ? '⏳...' : (editingId ? '💾 حفظ كمسودة' : '📝 حفظ كمسودة')}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setSelectedCustody(null); }} style={styles.btnBack}>إلغاء</button>
          </div>
        </form>
      )}

      {/* جدول تقديماتي السابقة */}
      <h2 style={{ marginTop: '30px', marginBottom: '15px', fontSize: '20px', fontWeight: 'bold', color: '#1e293b' }}>
        📋 سجل تقديماتي
      </h2>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '15px', flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: '📋 الكل', color: '#1e293b' },
          { key: 'draft', label: '📝 مسودة', color: '#6b7280' },
          { key: 'pending', label: '⏳ عند المدير', color: '#d97706' },
          { key: 'approved', label: '✅ معتمد — عند المالية', color: '#16a34a' },
          { key: 'settled', label: '💰 تم التسوية', color: '#1e40af' },
          { key: 'rejected', label: '❌ مرفوض', color: '#dc2626' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 'bold',
              backgroundColor: activeTab === tab.key ? tab.color : '#f3f4f6',
              color: activeTab === tab.key ? 'white' : '#6b7280',
            }}
          >
            {tab.label} ({tabCounts[tab.key]})
          </button>
        ))}
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>رقم التقديم</th>
            <th style={styles.th}>العهدة</th>
            <th style={styles.th}>إجمالي التسوية</th>
            <th style={styles.th}>الفرق</th>
            <th style={styles.th}>التاريخ</th>
            <th style={styles.th}>الحالة</th>
            <th style={styles.th}>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {filterSubmissions(mySubmissions).length === 0 ? (
            <tr>
              <td colSpan="7" style={{...styles.td, textAlign: 'center', color: '#6b7280', padding: '30px'}}>
                لا يوجد تقديمات سابقة
              </td>
            </tr>
          ) : (
            filterSubmissions(mySubmissions).map(sub => (
              <tr key={sub.id}>
                <td style={styles.td}><strong>{sub.submission_number}</strong></td>
                <td style={styles.td}>{sub.custody_number} - {sub.employee_name}</td>
                <td style={styles.td}><strong>{parseFloat(sub.total_amount).toFixed(2)} ج.م</strong></td>
                <td style={styles.td}>{getDifferenceBadge(sub)}</td>
                <td style={styles.td}>{new Date(sub.submitted_at).toLocaleDateString('ar-EG')}</td>
                <td style={styles.td}>{getStatusBadge(sub.status)}</td>
                <td style={styles.td}>
                  {(sub.status === 'draft' || sub.status === 'pending') && (
                    <>
                      <button onClick={() => fetchSubmissionForEdit(sub.id)} style={styles.btnWarning}>✏️ تعديل</button>
                      <button onClick={() => handleDelete(sub.id)} style={styles.btnDanger}>🗑️ حذف</button>
                    </>
                  )}
                  {sub.status === 'approved' && <span style={{ color: '#16a34a', fontSize: '12px' }}>✅ عند المالية للتسوية</span>}
                  {sub.status === 'settled' && <span style={{ color: '#1e40af', fontSize: '12px' }}>💰 تم التسوية</span>}
                  {sub.status === 'rejected' && <span style={{ color: '#991b1b', fontSize: '12px' }}>❌ مرفوض</span>}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default CustodySubmissions;
