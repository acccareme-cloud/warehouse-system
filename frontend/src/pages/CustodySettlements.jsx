import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function CustodySettlements() {
  const navigate = useNavigate();
  const [settlements, setSettlements] = useState([]);
  const [deletedSettlements, setDeletedSettlements] = useState([]);
  const [approvedSubmissions, setApprovedSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [submissionDetails, setSubmissionDetails] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending'); // pending | settled | deleted

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchSettlements();
    fetchApprovedSubmissions();
    fetchDeletedSettlements();
  }, []);

  const fetchSettlements = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/custody-settlements', { headers });
      // Group by settlement_number
      const grouped = groupSettlements(res.data || []);
      setSettlements(grouped);
    } catch (err) {
      console.error('خطأ في تحميل التسويات');
    }
  };

  const fetchDeletedSettlements = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/custody-settlements/deleted', { headers });
      const grouped = groupSettlements(res.data || []);
      setDeletedSettlements(grouped);
    } catch (err) {
      console.error('خطأ في تحميل التسويات الملغاة');
    }
  };

  const groupSettlements = (data) => {
    const map = {};
    for (const item of data) {
      const key = item.settlement_number;
      if (!map[key]) {
        map[key] = {
          settlement_number: item.settlement_number,
          settlement_date: item.settlement_date,
          custody_id: item.custody_id,
          custody_number: item.custody_number,
          employee_name: item.employee_name,
          submission_id: item.submission_id,
          created_by_name: item.created_by_name,
          items: [],
          total_amount: 0
        };
      }
      map[key].items.push(item);
      map[key].total_amount += parseFloat(item.amount || 0);
    }
    return Object.values(map).sort((a, b) => new Date(b.settlement_date) - new Date(a.settlement_date));
  };

  const fetchApprovedSubmissions = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/custody-settlements/approved-submissions', { headers });
      setApprovedSubmissions(res.data || []);
    } catch (err) {
      console.error('خطأ في تحميل التقديمات المعتمدة');
    }
  };

  const fetchSubmissionDetails = async (id) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/custody-submissions/${id}`, { headers });
      setSelectedSubmission(res.data);
      setSubmissionDetails(res.data.details || []);
    } catch (err) {
      console.error('Error fetching details:', err);
    }
  };

  const handleDeleteSettlement = async (settlementNumber) => {
    const confirmMsg = 'هل أنت متأكد من إلغاء هذه التسوية؟ العهدة هترجع نشطة والتقديم هيرجع مسودة.';
    if (!window.confirm(confirmMsg)) return;
    try {
      setLoading(true);
      await axios.delete(`http://localhost:5000/api/custody-settlements/${settlementNumber}`, { headers });
      setMessage('✅ تم إلغاء التسوية. العهدة رجعت نشطة والتقديم رجع مسودة.');
      fetchSettlements();
      fetchDeletedSettlements();
      fetchApprovedSubmissions();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || 'خطأ في الإلغاء'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSubmission = async (sub) => {
    setShowForm(true);
    setSelectedSubmission(sub);
    if (!sub.details || sub.details.length === 0) {
      await fetchSubmissionDetails(sub.id);
    } else {
      setSubmissionDetails(sub.details || []);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!selectedSubmission) return;

    try {
      setLoading(true);
      const res = await axios.post(
        'http://localhost:5000/api/custody-settlements',
        {
          submission_id: selectedSubmission.id,
          custody_id: selectedSubmission.custody_id,
          notes: ''
        },
        { headers }
      );

      const data = res.data.data || {};
      let msg = `✅ تم تسجيل التسوية بنجاح - رقم التسوية: ${data.settlement_number}`;

      if (data.treasury_record_number) {
        const diff = data.difference || 0;
        if (diff > 0) {
          msg += `\n📤 تم إنشاء أذن صرف ${data.treasury_record_number} بقيمة ${parseFloat(diff).toFixed(2)} للمراجعة`;
        } else {
          msg += `\n📥 تم إنشاء أذن إيراد ${data.treasury_record_number} بقيمة ${parseFloat(Math.abs(diff)).toFixed(2)} للمراجعة`;
        }
        msg += `\n⚠️ اذهب لشاشة الخزينة لمراجعة وتنفيذ السند`;
      }

      setMessage(msg);
      setShowForm(false);
      setSelectedSubmission(null);
      fetchSettlements();
      fetchApprovedSubmissions();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || 'حدث خطأ'));
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (v) => {
    const n = parseFloat(v) || 0;
    return n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getDifference = () => {
    if (!selectedSubmission) return 0;
    const total = parseFloat(selectedSubmission.total_amount || 0);
    const remaining = parseFloat(selectedSubmission.custody_remaining || 0);
    return total - remaining;
  };

  const difference = getDifference();
  const isOver = difference > 0.01;
  const isUnder = difference < -0.01;
  const isExact = Math.abs(difference) <= 0.01;

  const thStyle = { padding: '15px', backgroundColor: '#1e293b', color: 'white', textAlign: 'right', fontWeight: 'bold', fontSize: '14px' };
  const tdStyle = { padding: '12px 15px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', fontSize: '14px' };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '15px', backgroundColor: '#1e293b', borderRadius: '12px', color: 'white' }}>
        <button onClick={() => navigate('/custody-module')} style={{ backgroundColor: '#64748b', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>← رجوع للعهود</button>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>💰 تسوية العهد</h1>
        <button onClick={() => navigate('/dashboard')} style={{ backgroundColor: '#64748b', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>🏠 الرئيسية</button>
      </div>

      {message && (
        <div style={{
          padding: '12px', borderRadius: '8px', marginBottom: '15px', fontWeight: 'bold', whiteSpace: 'pre-line',
          backgroundColor: message.includes('✅') ? '#dcfce7' : '#fee2e2',
          color: message.includes('✅') ? '#166534' : '#991b1b'
        }}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('pending')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 'bold',
            backgroundColor: activeTab === 'pending' ? '#dc2626' : '#f3f4f6',
            color: activeTab === 'pending' ? 'white' : '#6b7280',
          }}
        >
          ⏳ بانتظار التسوية ({approvedSubmissions.length})
        </button>
        <button
          onClick={() => setActiveTab('settled')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 'bold',
            backgroundColor: activeTab === 'settled' ? '#16a34a' : '#f3f4f6',
            color: activeTab === 'settled' ? 'white' : '#6b7280',
          }}
        >
          ✅ سجل التسويات ({settlements.length})
        </button>
        <button
          onClick={() => setActiveTab('deleted')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 'bold',
            backgroundColor: activeTab === 'deleted' ? '#991b1b' : '#f3f4f6',
            color: activeTab === 'deleted' ? 'white' : '#6b7280',
          }}
        >
          🗑️ التسويات الملغاة ({deletedSettlements.length})
        </button>
      </div>

      {activeTab === 'pending' && (
        <>

      {/* التقديمات المعتمدة */}
      <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px', color: '#1e293b' }}>📋 تقديمات بانتظار التسوية المالية</h2>
      <table style={{ color: '#1e293b', width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '30px' }}>
        <thead>
          <tr>
            <th style={thStyle}>رقم التقديم</th>
            <th style={thStyle}>العهدة</th>
            <th style={thStyle}>الموظف</th>
            <th style={thStyle}>مبلغ العهدة</th>
            <th style={thStyle}>المتبقي</th>
            <th style={thStyle}>مبلغ التقديم</th>
            <th style={thStyle}>الفرق</th>
            <th style={thStyle}>تاريخ الاعتماد</th>
            <th style={thStyle}>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {approvedSubmissions.length === 0 ? (
            <tr><td colSpan="9" style={{...tdStyle, textAlign: 'center', color: '#6b7280', padding: '30px'}}>لا يوجد تقديمات معتمدة بانتظار التسوية</td></tr>
          ) : (
            approvedSubmissions.map(sub => {
              const diff = (parseFloat(sub.total_amount || 0) - parseFloat(sub.custody_remaining || 0));
              let diffColor = '#16a34a';
              let diffText = '✓ مطابق';
              if (diff > 0.01) { diffColor = '#dc2626'; diffText = `+${formatMoney(diff)} زيادة`; }
              else if (diff < -0.01) { diffColor = '#2563eb'; diffText = `${formatMoney(diff)} نقص`; }

              return (
                <tr key={sub.id}>
                  <td style={tdStyle}><strong>{sub.submission_number}</strong></td>
                  <td style={tdStyle}>{sub.custody_number}</td>
                  <td style={tdStyle}>{sub.employee_name}</td>
                  <td style={tdStyle}>{formatMoney(sub.custody_original_amount)}</td>
                  <td style={tdStyle}><strong style={{color: '#d97706'}}>{formatMoney(sub.custody_remaining)}</strong></td>
                  <td style={tdStyle}><strong style={{color: '#dc2626'}}>{formatMoney(sub.total_amount)}</strong></td>
                  <td style={tdStyle}><strong style={{color: diffColor}}>{diffText}</strong></td>
                  <td style={tdStyle}>{sub.approved_at ? new Date(sub.approved_at).toLocaleDateString('ar-EG') : '-'}</td>
                  <td style={tdStyle}>
                    <button onClick={() => handleSelectSubmission(sub)} style={{ backgroundColor: '#dc2626', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                      💰 تسوية
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* نموذج التسوية */}
      {showForm && selectedSubmission && (
        <form onSubmit={handleSubmit} style={{ color: '#1e293b', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '30px', border: '2px solid #dc2626' }}>
          <h3 style={{ color: '#dc2626', fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>
            💰 تسوية تقديم: {selectedSubmission.submission_number}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px' }}>
            <div style={{ color: '#1e293b', backgroundColor: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>الموظف</span>
              <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{selectedSubmission.employee_name || '-'}</span>
            </div>
            <div style={{ color: '#1e293b', backgroundColor: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>مبلغ العهدة الأصلي</span>
              <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{formatMoney(selectedSubmission.custody_original_amount)}</span>
            </div>
            <div style={{ color: '#1e293b', backgroundColor: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>المتبقي من العهدة</span>
              <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#d97706' }}>{formatMoney(selectedSubmission.custody_remaining)}</span>
            </div>
            <div style={{ color: '#1e293b', backgroundColor: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>مبلغ التقديم (المصروفات)</span>
              <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#dc2626' }}>{formatMoney(selectedSubmission.total_amount)}</span>
            </div>
            <div style={{ color: '#1e293b', backgroundColor: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>الفرق</span>
              <span style={{ fontWeight: 'bold', fontSize: '15px', color: isOver ? '#dc2626' : isUnder ? '#2563eb' : '#16a34a' }}>
                {isExact ? '✓ مطابق' : isOver ? `+${formatMoney(difference)} زيادة` : `${formatMoney(difference)} نقص`}
              </span>
            </div>
            <div style={{ color: '#1e293b', backgroundColor: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>العملة</span>
              <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{selectedSubmission.currency || 'EGP'}</span>
            </div>
          </div>

          {isOver && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '12px', borderRadius: '8px', marginBottom: '15px', color: '#991b1b' }}>
              <strong>⚠️ مبلغ التسوية أكبر من المتبقي</strong><br/>
              سيتم إنشاء <strong>أذن صرف</strong> بقيمة {formatMoney(difference)} من الخزينة للموظف.<br/>
              <small>الأذن سيكون بانتظار المراجعة في شاشة الخزينة.</small>
            </div>
          )}
          {isUnder && (
            <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '12px', borderRadius: '8px', marginBottom: '15px', color: '#1e40af' }}>
              <strong>ℹ️ مبلغ التسوية أقل من المتبقي</strong><br/>
              سيتم إنشاء <strong>أذن إيراد (رد عهدة)</strong> بقيمة {formatMoney(Math.abs(difference))} للخزينة.<br/>
              <small>الأذن سيكون بانتظار المراجعة في شاشة الخزينة.</small>
            </div>
          )}
          {isExact && (
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px', borderRadius: '8px', marginBottom: '15px', color: '#166534' }}>
              <strong>✓ مبلغ التسوية مطابق للمتبقي</strong><br/>
              العهدة ستغلق بالكامل بدون حركات خزينة إضافية.
            </div>
          )}

          <h4 style={{ fontWeight: 'bold', marginBottom: '10px', color: '#374151' }}>تفاصيل المصروفات:</h4>
          <table style={{ color: '#1e293b', width: '100%', borderCollapse: 'collapse', marginBottom: '20px', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            <thead>
              <tr style={{ backgroundColor: '#374151' }}>
                <th style={{...thStyle, backgroundColor: '#374151'}}>البند</th>
                <th style={{...thStyle, backgroundColor: '#374151'}}>مركز التكلفة</th>
                <th style={{...thStyle, backgroundColor: '#374151'}}>المبلغ</th>
                <th style={{...thStyle, backgroundColor: '#374151'}}>رقم الإيصال</th>
                <th style={{...thStyle, backgroundColor: '#374151'}}>البيان</th>
              </tr>
            </thead>
            <tbody>
              {submissionDetails.length === 0 ? (
                <tr><td colSpan="5" style={{...tdStyle, textAlign: 'center', color: '#6b7280'}}>جاري تحميل التفاصيل...</td></tr>
              ) : (
                submissionDetails.map((detail, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>{detail.category_name || detail.category_code || detail.expense_category_id}</td>
                    <td style={tdStyle}>{detail.cost_center_name || detail.center_name || '-'}</td>
                    <td style={tdStyle}><strong>{formatMoney(detail.amount)}</strong></td>
                    <td style={tdStyle}>{detail.receipt_number || '-'}</td>
                    <td style={tdStyle}>{detail.description || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" style={{ padding: '12px 40px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }} disabled={loading}>
              {loading ? '⏳ جاري التسوية...' : '💰 تأكيد التسوية'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setSelectedSubmission(null); setMessage(''); }} style={{ padding: '12px 30px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              إلغاء
            </button>
          </div>
        </form>
      )}

      {/* سجل التسويات — مجمعة */}
        </>
      )}

      {activeTab === 'settled' && (
        <>

      <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px', color: '#1e293b' }}>📋 سجل التسويات المالية</h2>
      <table style={{ color: '#1e293b', width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
            <th style={thStyle}>رقم التسوية</th>
            <th style={thStyle}>التاريخ</th>
            <th style={thStyle}>العهدة</th>
            <th style={thStyle}>الموظف</th>
            <th style={thStyle}>عدد البنود</th>
            <th style={thStyle}>الإجمالي</th>
            <th style={thStyle}>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {settlements.length === 0 ? (
            <tr><td colSpan="7" style={{...tdStyle, textAlign: 'center', color: '#6b7280', padding: '30px'}}>لا يوجد تسويات</td></tr>
          ) : (
            settlements.map(s => (
              <tr key={s.settlement_number}>
                <td style={tdStyle}><strong>{s.settlement_number}</strong></td>
                <td style={tdStyle}>{s.settlement_date ? new Date(s.settlement_date).toLocaleDateString('ar-EG') : new Date(s.created_at).toLocaleDateString('ar-EG')}</td>
                <td style={tdStyle}>{s.custody_number}</td>
                <td style={tdStyle}>{s.employee_name}</td>
                <td style={tdStyle}><span style={{ color: '#1e293b', backgroundColor: '#dbeafe', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>{s.items.length} بند</span></td>
                <td style={tdStyle}><strong style={{ color: '#dc2626' }}>{formatMoney(s.total_amount)}</strong></td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => navigate(`/custody-settlement-voucher?number=${s.settlement_number}`)} style={{ backgroundColor: '#3b82f6', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                      🧾 عرض
                    </button>
                    <button onClick={() => handleDeleteSettlement(s.settlement_number)} style={{ backgroundColor: '#dc2626', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                      🗑️ حذف
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
        </>
      )}

      {activeTab === 'deleted' && (
        <>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px', color: '#991b1b' }}>
            🗑️ التسويات الملغاة
          </h2>
          <table style={{ color: '#1e293b', width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                <th style={thStyle}>رقم التسوية</th>
                <th style={thStyle}>التاريخ</th>
                <th style={thStyle}>العهدة</th>
                <th style={thStyle}>الموظف</th>
                <th style={thStyle}>المبلغ</th>
                <th style={thStyle}>عدد البنود</th>
                <th style={thStyle}>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {deletedSettlements.length === 0 ? (
                <tr><td colSpan="7" style={{...tdStyle, textAlign: 'center', color: '#6b7280', padding: '30px'}}>لا يوجد تسويات ملغاة</td></tr>
              ) : (
                deletedSettlements.map((s, idx) => (
                  <tr key={idx} style={{ color: '#1e293b', backgroundColor: '#fef2f2' }}>
                    <td style={tdStyle}><strong>{s.settlement_number}</strong></td>
                    <td style={tdStyle}>{new Date(s.settlement_date).toLocaleDateString('ar-EG')}</td>
                    <td style={tdStyle}>{s.custody_number}</td>
                    <td style={tdStyle}>{s.employee_name}</td>
                    <td style={{...tdStyle, fontWeight: 'bold'}}>{s.total_amount.toFixed(2)} ج.م</td>
                    <td style={tdStyle}><span style={{ backgroundColor: '#fee2e2', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', color: '#991b1b' }}>{s.items.length} بند</span></td>
                    <td style={tdStyle}><span style={{ color: '#991b1b', fontWeight: 'bold' }}>❌ ملغاة</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </>
      )}

    </div>
  );
}

export default CustodySettlements;
