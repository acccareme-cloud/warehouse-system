import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function CustodyEmployeesSummaryReport() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const getDefaultMonthRange = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    return {
      from: `${year}-${month}-01`,
      to: `${year}-${month}-${String(lastDay).padStart(2, '0')}`
    };
  };

  const defaultRange = getDefaultMonthRange();
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
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

  const toggleEmployee = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([]);
    } else {
      setSelectedIds(employees.map(e => e.id));
    }
    setSelectAll(!selectAll);
  };

  const handleSearch = async () => {
    if (selectedIds.length === 0 || !from || !to) {
      setError('اختر موظف واحد على الأقل والفترة كاملة');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/custody-reports/employees-summary', {
        employee_ids: selectedIds,
        from,
        to
      }, {
        headers: { Authorization: `Bearer ${token}` }
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

  const thStyle = { padding: '12px', backgroundColor: '#1e293b', color: 'white', textAlign: 'right', fontSize: '13px' };
  const tdStyle = { padding: '10px 12px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', fontSize: '13px' };

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
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0 }}>📊 تقرير أرصدة الموظفين</h1>
        <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>الفترة: {from} إلى {to}</div>
        <button onClick={() => navigate('/dashboard')} style={{ backgroundColor: '#64748b', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>🏠 الرئيسية</button>
      </div>

      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '15px', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '15px', alignItems: 'end' }}>
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

      <div className="no-print" style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', marginBottom: '20px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', marginBottom: '10px', cursor: 'pointer' }}>
          <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} />
          تحديد الكل ({employees.length} موظف)
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px', maxHeight: '200px', overflowY: 'auto', padding: '10px', backgroundColor: 'white', borderRadius: '8px' }}>
          {employees.map(e => (
            <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
              <input
                type="checkbox"
                checked={selectedIds.includes(e.id)}
                onChange={() => toggleEmployee(e.id)}
              />
              {e.full_name} {e.employee_number ? `(${e.employee_number})` : ''}
            </label>
          ))}
        </div>
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
              <h2 style={{ margin: '0 0 5px 0', fontSize: '20px' }}>📊 تقرير أرصدة الموظفين</h2>
              <div style={{ fontSize: '13px', color: '#64748b' }}>الفترة من {report?.from || from} إلى {report?.to || to}</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <thead>
                <tr>
                  <th style={thStyle}>الموظف</th>
                  <th style={thStyle}>الرصيد السابق ({report.from})</th>
                  <th style={thStyle}>إجمالي العهد خلال الفترة</th>
                  <th style={thStyle}>إجمالي التسويات خلال الفترة</th>
                  <th style={thStyle}>رد عهدة (خزينة)</th>
                  <th style={thStyle}>سداد فرق عهدة (خزينة)</th>
                  <th style={thStyle}>الرصيد الحالي ({report.to})</th>
                </tr>
              </thead>
              <tbody>
                {report.employees.map(e => (
                  <tr key={e.employee_id}>
                    <td style={tdStyle}><strong>{e.employee_name}</strong> {e.employee_number ? `(${e.employee_number})` : ''}</td>
                    <td style={tdStyle}>{e.opening_balance.toFixed(2)} ج.م</td>
                    <td style={{ ...tdStyle, color: '#16a34a', fontWeight: 'bold' }}>{e.total_custody.toFixed(2)} ج.م</td>
                    <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 'bold' }}>{e.total_settlement.toFixed(2)} ج.م</td>
                    <td style={{ ...tdStyle, color: '#dc2626' }}>{(e.total_refund || 0).toFixed(2)} ج.م</td>
                    <td style={{ ...tdStyle, color: '#16a34a' }}>{(e.total_cset || 0).toFixed(2)} ج.م</td>
                    <td style={{ ...tdStyle, fontWeight: 'bold', color: e.closing_balance >= 0 ? '#16a34a' : '#dc2626' }}>{e.closing_balance.toFixed(2)} ج.م</td>
                  </tr>
                ))}
                <tr style={{ backgroundColor: '#f1f5f9' }}>
                  <td style={tdStyle}><strong>الإجمالي</strong></td>
                  <td style={{ ...tdStyle, fontWeight: 'bold' }}>{report.totals.opening_balance.toFixed(2)} ج.م</td>
                  <td style={{ ...tdStyle, fontWeight: 'bold', color: '#16a34a' }}>{report.totals.total_custody.toFixed(2)} ج.م</td>
                  <td style={{ ...tdStyle, fontWeight: 'bold', color: '#dc2626' }}>{report.totals.total_settlement.toFixed(2)} ج.م</td>
                  <td style={{ ...tdStyle, fontWeight: 'bold', color: '#dc2626' }}>{(report.totals.total_refund || 0).toFixed(2)} ج.م</td>
                  <td style={{ ...tdStyle, fontWeight: 'bold', color: '#16a34a' }}>{(report.totals.total_cset || 0).toFixed(2)} ج.م</td>
                  <td style={{ ...tdStyle, fontWeight: 'bold' }}>{report.totals.closing_balance.toFixed(2)} ج.م</td>
                </tr>
              </tbody>
            </table>

            <div className="no-print" style={{ marginTop: '15px', padding: '12px', backgroundColor: '#dbeafe', borderRadius: '8px', fontSize: '13px', color: '#1e40af' }}>
              💡 معادلة الرصيد الحالي = (إجمالي العهد) − (إجمالي التسويات) − (رد عهدة) + (سداد فرق عهدة)
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default CustodyEmployeesSummaryReport;