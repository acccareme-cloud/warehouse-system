import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function CustodyEmployeeStatement() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const getDefaultFrom = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; };
  const getDefaultTo = () => { const d = new Date(); const last = new Date(d.getFullYear(), d.getMonth()+1, 0); return `${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,'0')}-${String(last.getDate()).padStart(2,'0')}`; };
  const [from, setFrom] = useState(getDefaultFrom());
  const [to, setTo] = useState(getDefaultTo());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const token = localStorage.getItem('token');

  useEffect(() => {
    axios.get('http://localhost:5000/api/custody-reports/employees', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => setEmployees(res.data || []))
      .catch(() => setError('خطأ في تحميل قائمة الموظفين'));
  }, []);

  const handleSearch = async () => {
    if (!employeeId || !from || !to) {
      setError('اختر الموظف والفترة كاملة');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:5000/api/custody-reports/employee-statement', {
        headers: { Authorization: `Bearer ${token}` },
        params: { employee_id: employeeId, from, to }
      });
      setReport(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ');
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const thStyle = { padding: '10px', backgroundColor: '#1e293b', color: 'white', textAlign: 'right', fontSize: '12px' };
  const tdStyle = { padding: '9px 10px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', fontSize: '12px', color: '#1e293b' };

  // بيان مختصر لكل تسوية (عدد البنود بدل تفصيلها بالكامل)
  const getSettlementSummaryText = (m) => {
    if (!m.items || m.items.length === 0) return '-';
    if (m.items.length === 1) {
      const it = m.items[0];
      return `${it.category}${it.cost_center ? ' - ' + it.cost_center : ''}`;
    }
    return `${m.items.length} بنود مصروفات (اضغط على رقم التسوية لعرض التفاصيل)`;
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1300px', margin: '0 auto', direction: 'rtl', fontFamily: 'Arial, sans-serif' }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-area, #printable-area * { visibility: visible; }
          #printable-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '15px', backgroundColor: '#1e293b', borderRadius: '12px', color: 'white' }}>
        <button onClick={() => navigate('/custody-module')} style={{ backgroundColor: '#64748b', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>← رجوع للعهود</button>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0 }}>📊 كشف حساب عهدة موظف</h1>
        <button onClick={() => navigate('/dashboard')} style={{ backgroundColor: '#64748b', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>🏠 الرئيسية</button>
      </div>

      <div className="no-print" style={{ color: '#1e293b', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '15px', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '20px', alignItems: 'end' }}>
        <div>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>الموظف</label>
          <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
            <option value="">-- اختر الموظف --</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.full_name} {e.employee_number ? `(${e.employee_number})` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>من تاريخ</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
        </div>
        <div>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>إلى تاريخ</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
        </div>
        <button onClick={handleSearch} disabled={loading} style={{ padding: '10px 25px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          {loading ? '⏳...' : '🔍 عرض التقرير'}
        </button>
      </div>

      {error && <div className="no-print" style={{ padding: '12px', borderRadius: '8px', marginBottom: '15px', backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 'bold' }}>{error}</div>}

      {report && (
        <>
          <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
            <button onClick={handlePrint} style={{ padding: '10px 25px', backgroundColor: '#1e293b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              🖨️ طباعة التقرير
            </button>
          </div>

          <div id="printable-area">
            <div style={{ textAlign: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0 }}>كشف حساب عهدة</h2>
              <div style={{ fontSize: '14px', color: '#374151' }}>
                الموظف: <strong>{report.employee.full_name}</strong>
                {report.employee.employee_number ? ` (${report.employee.employee_number})` : ''}
                &nbsp;&nbsp;|&nbsp;&nbsp; الفترة من {report.from} إلى {report.to}
              </div>
            </div>

            <table style={{ color: '#1e293b', width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' }}>
              <thead>
                <tr>
                  <th style={thStyle}>التاريخ</th>
                  <th style={thStyle}>نوع الحركة</th>
                  <th style={thStyle}>رقم المرجع</th>
                  <th style={thStyle}>البيان</th>
                  <th style={thStyle}>مدين (عهدة)</th>
                  <th style={thStyle}>دائن (تسوية)</th>
                  <th style={thStyle}>الرصيد</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ color: '#1e293b', backgroundColor: '#f1f5f9' }}>
                  <td style={tdStyle} colSpan={6}><strong>الرصيد السابق ({report.from})</strong></td>
                  <td style={tdStyle}><strong>{report.opening_balance.toFixed(2)}</strong></td>
                </tr>
                {report.movements.length === 0 ? (
                  <tr><td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#6b7280', padding: '20px' }}>لا يوجد حركات خلال الفترة</td></tr>
                ) : (
                  report.movements.map((m, i) => (
                    <tr key={i}>
                      <td style={tdStyle}>{new Date(m.date).toLocaleDateString('ar-EG')}</td>
                      <td style={tdStyle}>{m.type === 'custody' ? '📤 صرف عهدة' : '💰 تسوية'}</td>
                      <td style={tdStyle}><strong>{m.reference}</strong></td>
                      <td style={tdStyle}>{m.type === 'custody' ? (m.purpose || '-') : getSettlementSummaryText(m)}</td>
                      <td style={{ ...tdStyle, color: '#16a34a', fontWeight: 'bold' }}>{m.type === 'custody' ? m.amount.toFixed(2) : '-'}</td>
                      <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 'bold' }}>{m.type === 'settlement' ? m.amount.toFixed(2) : '-'}</td>
                      <td style={{ ...tdStyle, fontWeight: 'bold' }}>{m.balance.toFixed(2)}</td>
                    </tr>
                  ))
                )}
                <tr style={{ color: '#1e293b', backgroundColor: '#f1f5f9' }}>
                  <td style={tdStyle} colSpan={6}><strong>الرصيد الختامي ({report.to})</strong></td>
                  <td style={tdStyle}><strong>{report.closing_balance.toFixed(2)}</strong></td>
                </tr>
              </tbody>
            </table>

            <div className="no-print" style={{ marginTop: '15px', padding: '12px', backgroundColor: '#dbeafe', borderRadius: '8px', fontSize: '13px', color: '#1e40af' }}>
              💡 لعرض تفاصيل بنود أي تسوية بالكامل وطباعتها كسند مستقل، استخدم صفحة "طباعة سند تسوية" من شاشة العهود.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default CustodyEmployeeStatement;