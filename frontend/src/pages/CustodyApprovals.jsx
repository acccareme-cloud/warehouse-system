import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const CustodyApprovals = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pending'); // all | pending | approved | settled
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [approvedSubmissions, setApprovedSubmissions] = useState([]);
  const [settledSubmissions, setSettledSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [submissionDetails, setSubmissionDetails] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [editDetails, setEditDetails] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchPendingSubmissions();
    fetchApprovedSubmissions();
    fetchSettledSubmissions();
    fetchAllSubmissions();
    fetchExpenseCategories();
    fetchCostCenters();
  }, []);

  const fetchPendingSubmissions = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:5000/api/custody-submissions/pending', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingSubmissions(res.data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovedSubmissions = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:5000/api/custody-submissions/approved', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setApprovedSubmissions(res.data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettledSubmissions = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:5000/api/custody-submissions/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSettledSubmissions((res.data || []).filter(s => s.status === 'settled'));
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSubmissions = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:5000/api/custody-submissions/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllSubmissions(res.data || []);
    } catch (err) {
      console.error('Error:', err);
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
      console.error(err);
    }
  };

  const fetchCostCenters = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/cost-centers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCostCenters(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSubmissionDetails = async (id) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/custody-submissions/${id}/details`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSubmissionDetails(res.data || []);
      setEditDetails(res.data || []);
    } catch (err) {
      console.error('Error fetching details:', err);
    }
  };

  const handleViewDetails = async (sub) => {
    setSelectedSubmission(sub);
    setEditMode(false);
    await fetchSubmissionDetails(sub.id);
  };

  const handleApprove = async (id) => {
    if (!window.confirm('هل تريد اعتماد هذا التقديم؟')) return;
    try {
      setLoading(true);
      await axios.put(`http://localhost:5000/api/custody-submissions/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('✅ تم الاعتماد بنجاح!');
      setSelectedSubmission(null);
      fetchPendingSubmissions();
      fetchApprovedSubmissions();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || 'خطأ في الاعتماد'));
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm('هل تريد رفض هذا التقديم؟')) return;
    try {
      setLoading(true);
      await axios.put(`http://localhost:5000/api/custody-submissions/${id}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('❌ تم الرفض');
      setSelectedSubmission(null);
      fetchPendingSubmissions();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || 'خطأ'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل تريد حذف هذا التقديم؟ سيتم إرجاع العهدة للحالة النشطة.')) return;
    try {
      setLoading(true);
      await axios.delete(`http://localhost:5000/api/custody-submissions/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('✅ تم الحذف وإرجاع العهدة للحالة النشطة');
      setSelectedSubmission(null);
      fetchPendingSubmissions();
      fetchApprovedSubmissions();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || 'خطأ في الحذف'));
    } finally {
      setLoading(false);
    }
  };

  const handleEditStart = () => {
    setEditMode(true);
    setEditDetails([...submissionDetails]);
  };

  const handleEditCancel = () => {
    setEditMode(false);
    setEditDetails([...submissionDetails]);
  };

  const handleEditSave = async () => {
    if (!window.confirm('هل تريد حفظ التعديلات على البنود؟')) return;
    try {
      setLoading(true);
      await axios.put(`http://localhost:5000/api/custody-submissions/${selectedSubmission.id}`, {
        details: editDetails,
        notes: selectedSubmission.notes,
        status: 'pending'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('✅ تم تحديث البنود بنجاح');
      setEditMode(false);
      await fetchSubmissionDetails(selectedSubmission.id);
      fetchPendingSubmissions();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || 'خطأ في التحديث'));
    } finally {
      setLoading(false);
    }
  };

  const updateEditDetail = (index, field, value) => {
    const newDetails = [...editDetails];
    newDetails[index][field] = value;
    setEditDetails(newDetails);
  };

  const removeEditDetail = (index) => {
    setEditDetails(editDetails.filter((_, i) => i !== index));
  };

  const addEditDetail = () => {
    setEditDetails([...editDetails, {
      expense_category_id: '',
      cost_center_id: '',
      amount: '',
      description: '',
      receipt_number: '',
      receipt_attachment: ''
    }]);
  };

  const getTotalEditAmount = () => {
    return editDetails.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  };

  const getDifferenceText = (sub) => {
    const total = parseFloat(sub.total_amount || 0);
    const remaining = parseFloat(sub.custody_remaining || 0);
    const diff = total - remaining;
    if (Math.abs(diff) <= 0.01) return <span style={{ color: '#16a34a' }}>✓ مطابق</span>;
    if (diff > 0.01) return <span style={{ color: '#dc2626' }}>+{diff.toFixed(2)} زيادة (صرف فرق)</span>;
    return <span style={{ color: '#2563eb' }}>{diff.toFixed(2)} نقص (رد فرق)</span>;
  };

  const currentList = activeTab === 'all' ? allSubmissions : activeTab === 'pending' ? pendingSubmissions : activeTab === 'approved' ? approvedSubmissions : settledSubmissions;

  const styles = {
    container: { padding: '20px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl', fontFamily: 'Arial, sans-serif' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '15px', backgroundColor: '#1e293b', borderRadius: '12px', color: 'white' },
    title: { fontSize: '24px', fontWeight: 'bold', margin: 0 },
    btnBack: { backgroundColor: '#64748b', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
    tabs: { display: 'flex', gap: '10px', marginBottom: '20px' },
    tab: (active) => ({ padding: '10px 25px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', border: 'none', backgroundColor: active ? '#1e293b' : '#e5e7eb', color: active ? 'white' : '#374151' }),
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
    th: { backgroundColor: '#1e293b', color: 'white', padding: '15px', textAlign: 'right', fontWeight: 'bold', fontSize: '14px' },
    td: { padding: '12px 15px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', fontSize: '14px' },
    btnView: { backgroundColor: '#3b82f6', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', marginLeft: '5px' },
    btnApprove: { backgroundColor: '#16a34a', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', marginLeft: '5px' },
    btnReject: { backgroundColor: '#dc2626', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', marginLeft: '5px' },
    btnDelete: { backgroundColor: '#7f1d1d', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
    btnEdit: { backgroundColor: '#d97706', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', marginLeft: '5px' },
    badge: (status) => {
      const map = {
        pending: { bg: '#fef3c7', color: '#92400e', text: '⏳ بانتظار الاعتماد' },
        approved: { bg: '#dcfce7', color: '#166534', text: '✅ معتمد' },
        rejected: { bg: '#fee2e2', color: '#991b1b', text: '❌ مرفوض' }
      };
      const s = map[status] || map.pending;
      return { padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', backgroundColor: s.bg, color: s.color };
    },
    detailCard: { backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', marginTop: '20px', border: '2px solid #e2e8f0' },
    detailTitle: { fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', color: '#1e293b' },
    detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px' },
    detailItem: { backgroundColor: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' },
    detailLabel: { fontSize: '12px', color: '#6b7280', marginBottom: '4px' },
    detailValue: { fontSize: '16px', fontWeight: 'bold', color: '#1e293b' },
    messageBox: (type) => ({ padding: '12px', borderRadius: '8px', marginBottom: '15px', fontWeight: 'bold', backgroundColor: type === 'success' ? '#dcfce7' : '#fee2e2', color: type === 'success' ? '#166534' : '#991b1b' }),
    input: { padding: '8px', border: '2px solid #d1d5db', borderRadius: '6px', fontSize: '13px', width: '100%', boxSizing: 'border-box' },
    select: { padding: '8px', border: '2px solid #d1d5db', borderRadius: '6px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate('/custody-module')} style={styles.btnBack}>← رجوع للعهود</button>
        <h1 style={styles.title}>✅ إدارة تسويات العهد</h1>
        <button onClick={() => navigate('/dashboard')} style={styles.btnBack}>🏠 الرئيسية</button>
      </div>

      {message && <div style={styles.messageBox(message.includes('✅') ? 'success' : 'error')}>{message}</div>}

      <div style={styles.tabs}>
        <button onClick={() => { setActiveTab('all'); setSelectedSubmission(null); }} style={styles.tab(activeTab === 'all')}>
          📋 الكل ({allSubmissions.length})
        </button>
        <button onClick={() => { setActiveTab('pending'); setSelectedSubmission(null); }} style={styles.tab(activeTab === 'pending')}>
          ⏳ معلقة ({pendingSubmissions.length})
        </button>
        <button onClick={() => { setActiveTab('approved'); setSelectedSubmission(null); }} style={styles.tab(activeTab === 'approved')}>
          ✅ معتمدة — عند المالية ({approvedSubmissions.length})
        </button>
        <button onClick={() => { setActiveTab('settled'); setSelectedSubmission(null); }} style={styles.tab(activeTab === 'settled')}>
          💰 تم التسوية ({settledSubmissions.length})
        </button>
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>رقم التقديم</th>
            <th style={styles.th}>العهدة</th>
            <th style={styles.th}>الموظف</th>
            <th style={styles.th}>الإدارة</th>
            <th style={styles.th}>المبلغ الإجمالي</th>
            <th style={styles.th}>الفرق</th>
            <th style={styles.th}>التاريخ</th>
            <th style={styles.th}>الحالة</th>
            <th style={styles.th}>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {currentList.length === 0 ? (
            <tr>
              <td colSpan="9" style={{...styles.td, textAlign: 'center', color: '#6b7280', padding: '30px'}}>
                {loading ? '⏳ جاري التحميل...' : activeTab === 'all' ? 'لا يوجد تسويات' : activeTab === 'pending' ? 'لا يوجد تسويات بانتظار الاعتماد' : activeTab === 'approved' ? 'لا يوجد تسويات معتمدة عند المالية' : 'لا يوجد تسويات تمت'}
              </td>
            </tr>
          ) : (
            currentList.map(sub => (
              <tr key={sub.id}>
                <td style={styles.td}><strong>{sub.submission_number}</strong></td>
                <td style={styles.td}>{sub.custody_number}</td>
                <td style={styles.td}>{sub.employee_name}</td>
                <td style={styles.td}>{sub.department_name || '-'}</td>
                <td style={styles.td}><strong style={{color: '#dc2626'}}>{parseFloat(sub.total_amount).toFixed(2)} ج.م</strong></td>
                <td style={styles.td}>{getDifferenceText(sub)}</td>
                <td style={styles.td}>{new Date(sub.submitted_at).toLocaleDateString('ar-EG')}</td>
                <td style={styles.td}><span style={styles.badge(sub.status)}>{sub.status === 'pending' ? '⏳ بانتظار الاعتماد' : sub.status === 'settled' ? '💰 تم التسوية' : '✅ معتمد — عند المالية'}</span></td>
                <td style={styles.td}>
                  <button onClick={() => handleViewDetails(sub)} style={styles.btnView}>👁️ عرض</button>
                  {activeTab === 'pending' && (
                    <>
                      <button onClick={() => handleApprove(sub.id)} style={styles.btnApprove} disabled={loading}>✓ اعتماد</button>
                      <button onClick={() => handleReject(sub.id)} style={styles.btnReject} disabled={loading}>✕ رفض</button>
                      <button onClick={() => handleDelete(sub.id)} style={styles.btnDelete} disabled={loading}>🗑️ حذف</button>
                    </>
                  )}
                  {activeTab === 'settled' && (
                    <span style={{ color: '#1e40af', fontSize: '12px' }}>💰 تمت التسوية</span>
                  )}
                  {/* FIX: المدير ميعدلش/ميحذفش تقديم بعد ما يتاعتمد — يشوفه بس */}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {selectedSubmission && (
        <div style={styles.detailCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={styles.detailTitle}>📋 تفاصيل التقديم: {selectedSubmission.submission_number}</h3>
            <div>
              {activeTab === 'pending' && !editMode && (
                <button onClick={handleEditStart} style={styles.btnEdit}>✏️ تعديل البنود</button>
              )}
              {editMode && (
                <>
                  <button onClick={handleEditSave} style={{...styles.btnApprove, padding: '8px 20px'}} disabled={loading}>💾 حفظ التعديل</button>
                  <button onClick={handleEditCancel} style={{...styles.btnBack, marginRight: '10px'}}>إلغاء</button>
                </>
              )}
              <button onClick={() => setSelectedSubmission(null)} style={{...styles.btnBack, marginRight: '10px'}}>إغلاق</button>
            </div>
          </div>

          <div style={styles.detailGrid}>
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>الموظف</div>
              <div style={styles.detailValue}>{selectedSubmission.employee_name}</div>
            </div>
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>العهدة</div>
              <div style={styles.detailValue}>{selectedSubmission.custody_number}</div>
            </div>
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>المبلغ الإجمالي</div>
              <div style={styles.detailValue} style={{color: '#dc2626'}}>{parseFloat(selectedSubmission.total_amount).toFixed(2)} ج.م</div>
            </div>
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>الفرق</div>
              <div style={styles.detailValue}>{getDifferenceText(selectedSubmission)}</div>
            </div>
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>الحالة</div>
              <div style={styles.detailValue}><span style={styles.badge(selectedSubmission.status)}>{selectedSubmission.status === 'pending' ? '⏳ بانتظار الاعتماد' : selectedSubmission.status === 'settled' ? '💰 تم التسوية' : '✅ معتمد — عند المالية'}</span></div>
            </div>
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>التاريخ</div>
              <div style={styles.detailValue}>{new Date(selectedSubmission.submitted_at).toLocaleDateString('ar-EG')}</div>
            </div>
          </div>

          <h4 style={{fontWeight: 'bold', marginBottom: '10px'}}>تفاصيل المصروفات:</h4>

          {editMode ? (
            <div>
              {editDetails.map((detail, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 2fr 1fr auto', gap: '8px', marginBottom: '8px', padding: '8px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <select value={detail.expense_category_id} onChange={e => updateEditDetail(i, 'expense_category_id', e.target.value)} style={styles.select}>
                    <option value="">اختر البند...</option>
                    {expenseCategories.map(ec => <option key={ec.id} value={ec.id}>{ec.category_code} - {ec.category_name}</option>)}
                  </select>
                  <select value={detail.cost_center_id || ''} onChange={e => updateEditDetail(i, 'cost_center_id', e.target.value)} style={styles.select}>
                    <option value="">اختر المركز...</option>
                    {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.center_code} - {cc.center_name}</option>)}
                  </select>
                  <input type="number" step="0.01" value={detail.amount} onChange={e => updateEditDetail(i, 'amount', e.target.value)} style={styles.input} />
                  <input type="text" placeholder="البيان" value={detail.description || ''} onChange={e => updateEditDetail(i, 'description', e.target.value)} style={styles.input} />
                  <input type="text" placeholder="رقم الإيصال" value={detail.receipt_number || ''} onChange={e => updateEditDetail(i, 'receipt_number', e.target.value)} style={styles.input} />
                  <button onClick={() => removeEditDetail(i)} style={styles.btnReject}>🗑️</button>
                </div>
              ))}
              <button onClick={addEditDetail} style={{...styles.btnView, marginTop: '10px'}}>+ إضافة بند</button>
              <div style={{ marginTop: '10px', fontWeight: 'bold', color: '#1e40af' }}>
                الإجمالي: {getTotalEditAmount().toFixed(2)} ج.م
              </div>
            </div>
          ) : (
            <table style={{...styles.table, marginTop: '10px'}}>
              <thead>
                <tr style={{backgroundColor: '#374151'}}>
                  <th style={{...styles.th, backgroundColor: '#374151'}}>البند</th>
                  <th style={{...styles.th, backgroundColor: '#374151'}}>مركز التكلفة</th>
                  <th style={{...styles.th, backgroundColor: '#374151'}}>المبلغ</th>
                  <th style={{...styles.th, backgroundColor: '#374151'}}>البيان</th>
                  <th style={{...styles.th, backgroundColor: '#374151'}}>رقم الإيصال</th>
                </tr>
              </thead>
              <tbody>
                {submissionDetails.length === 0 ? (
                  <tr><td colSpan="5" style={{...styles.td, textAlign: 'center'}}>لا يوجد تفاصيل</td></tr>
                ) : (
                  submissionDetails.map((detail, i) => (
                    <tr key={i}>
                      <td style={styles.td}>{detail.category_code} - {detail.category_name}</td>
                      <td style={styles.td}>{detail.cost_center_code} - {detail.cost_center_name || '-'}</td>
                      <td style={styles.td}><strong>{parseFloat(detail.amount).toFixed(2)} ج.م</strong></td>
                      <td style={styles.td}>{detail.description || '-'}</td>
                      <td style={styles.td}>{detail.receipt_number || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {!editMode && activeTab === 'pending' && (
            <div style={{marginTop: '20px', display: 'flex', gap: '10px'}}>
              <button onClick={() => handleApprove(selectedSubmission.id)} style={{...styles.btnApprove, padding: '10px 30px', fontSize: '16px'}} disabled={loading}>
                {loading ? '⏳...' : '✓ اعتماد التقديم'}
              </button>
              <button onClick={() => handleReject(selectedSubmission.id)} style={{...styles.btnReject, padding: '10px 30px', fontSize: '16px'}} disabled={loading}>
                {loading ? '⏳...' : '✕ رفض التقديم'}
              </button>
              <button onClick={() => handleDelete(selectedSubmission.id)} style={{...styles.btnDelete, padding: '10px 30px', fontSize: '16px'}} disabled={loading}>
                🗑️ حذف وإرجاع العهدة
              </button>
            </div>
          )}
          {!editMode && activeTab === 'approved' && (
            <div style={{marginTop: '20px', padding: '12px', backgroundColor: '#dcfce7', borderRadius: '8px', color: '#166534'}}>
              ✅ التقديم معتمد من المدير ومرسل للمالية للتسوية.
            </div>
          )}
          {!editMode && activeTab === 'settled' && (
            <div style={{marginTop: '20px', padding: '12px', backgroundColor: '#dbeafe', borderRadius: '8px', color: '#1e40af'}}>
              💰 تمت تسوية العهدة من المالية.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustodyApprovals;
