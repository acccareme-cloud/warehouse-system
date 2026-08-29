import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function CustodySettlementVoucher() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const [settlements, setSettlements] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState('');
  const [voucher, setVoucher] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const token = localStorage.getItem('token');

  useEffect(() => {
    axios.get('http://localhost:5000/api/custody-reports/employees', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => setEmployees(res.data || []))
      .catch(() => setError('خطأ في تحميل قائمة الموظفين'));
  }, []);

  const handleEmployeeChange = async (id) => {
    setEmployeeId(id);
    setSettlements([]);
    setSelectedNumber('');
    setVoucher(null);
    setError('');
    if (!id) return;

    try {
      const res = await axios.get('http://localhost:5000/api/custody-reports/employee-settlements', {
        headers: { Authorization: `Bearer ${token}` },
        params: { employee_id: id }
      });
      setSettlements(res.data || []);
    } catch (err) {
      setError('خطأ في تحميل تسويات الموظف');
    }
  };

  const handleSelectSettlement = async (settlementNumber) => {
    setSelectedNumber(settlementNumber);
    setVoucher(null);
    setError('');
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:5000/api/custody-reports/settlement-detail/${settlementNumber}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVoucher(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ في تحميل تفاصيل التسوية');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1100px', margin: '0 auto', direction: 'rtl', fontFamily: 'Arial, sans-serif' }}>
      <style>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          body { background: white; }
          .no-print { display: none !important; }
          #printable-area {
            position: static !important;
            visibility: visible !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #333 !important; padding: 8px !important; }
        }
      `}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '15px', backgroundColor: '#1e293b', borderRadius: '12px', color: 'white' }}>
        <button onClick={() => navigate('/custody-module')} style={{ backgroundColor: '#64748b', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>← رجوع للعهود</button>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0 }}>🧾 طباعة سند تسوية</h1>
        <button onClick={() => navigate('/dashboard')} style={{ backgroundColor: '#64748b', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>🏠 الرئيسية</button>
      </div>

      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
        <div>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>1. اختر الموظف</label>
          <select value={employeeId} onChange={e => handleEmployeeChange(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
            <option value="">-- اختر الموظف --</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.full_name} {e.employee_number ? `(${e.employee_number})` : ''}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>2. اختر التسوية</label>
          <select
            value={selectedNumber}
            onChange={e => handleSelectSettlement(e.target.value)}
            disabled={settlements.length === 0}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
          >
            <option value="">-- اختر رقم التسوية --</option>
            {settlements.map(s => (
              <option key={s.settlement_number} value={s.settlement_number}>
                {s.settlement_number} — {new Date(s.settlement_date).toLocaleDateString('ar-EG')} — {parseFloat(s.total_amount).toFixed(2)} ج.م ({s.items_count} بند)
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="no-print" style={{ padding: '12px', borderRadius: '8px', marginBottom: '15px', backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 'bold' }}>{error}</div>}
      {loading && <div className="no-print" style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>⏳ جاري التحميل...</div>}

      {voucher && (
        <>
          <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
            <button onClick={handlePrint} style={{ padding: '10px 25px', backgroundColor: '#1e293b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              🖨️ طباعة السند
            </button>
          </div>

          <div id="printable-area" style={{ border: '2px solid #1e293b', borderRadius: '12px', padding: '25px', backgroundColor: 'white' }}>
            {/* عنوان السند */}
            <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #1e293b', paddingBottom: '15px' }}>
              <h2 style={{ margin: '0 0 5px 0', fontSize: '24px' }}>سند تسوية عهدة</h2>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#dc2626' }}>
                رقم التسوية: {voucher.header.settlement_number}
              </div>
            </div>

            {/* بيانات رأسية */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', border: '1px solid #ccc' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 12px', border: '1px solid #ccc', fontWeight: 'bold', backgroundColor: '#f8fafc', width: '20%' }}>الموظف</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ccc', width: '30%' }}>
                    {voucher.header.employee_name} {voucher.header.employee_number ? `(${voucher.header.employee_number})` : ''}
                  </td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ccc', fontWeight: 'bold', backgroundColor: '#f8fafc', width: '20%' }}>تاريخ التسوية</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ccc', width: '30%' }}>
                    {new Date(voucher.header.settlement_date).toLocaleDateString('ar-EG')}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 12px', border: '1px solid #ccc', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>رقم العهدة</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ccc' }}>{voucher.header.custody_number}</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ccc', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>غرض العهدة</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ccc' }}>{voucher.header.custody_purpose || '-'}</td>
                </tr>
                {voucher.header.created_by_name && (
                  <tr>
                    <td style={{ padding: '8px 12px', border: '1px solid #ccc', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>تم الإدخال بواسطة</td>
                    <td style={{ padding: '8px 12px', border: '1px solid #ccc' }} colSpan={3}>{voucher.header.created_by_name}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* جدول البنود */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <thead>
                <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                  <th style={{ padding: '10px', border: '1px solid #333', textAlign: 'center', width: '5%' }}>#</th>
                  <th style={{ padding: '10px', border: '1px solid #333', textAlign: 'right', width: '25%' }}>بند المصروف</th>
                  <th style={{ padding: '10px', border: '1px solid #333', textAlign: 'right', width: '20%' }}>مركز التكلفة</th>
                  <th style={{ padding: '10px', border: '1px solid #333', textAlign: 'right', width: '25%' }}>البيان</th>
                  <th style={{ padding: '10px', border: '1px solid #333', textAlign: 'right', width: '10%' }}>رقم الإيصال</th>
                  <th style={{ padding: '10px', border: '1px solid #333', textAlign: 'right', width: '15%' }}>المبلغ (ج.م)</th>
                </tr>
              </thead>
              <tbody>
                {voucher.items.map((it, i) => (
                  <tr key={i}>
                    <td style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'right' }}>
                      {it.category_code ? `${it.category_code} - ` : ''}{it.category_name || '-'}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'right' }}>
                      {it.cost_center_code ? `${it.cost_center_code} - ` : ''}{it.cost_center_name || '-'}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'right' }}>{it.description || '-'}</td>
                    <td style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'right' }}>{it.receipt_number || '-'}</td>
                    <td style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'right', fontWeight: 'bold' }}>
                      {parseFloat(it.amount).toFixed(2)}
                    </td>
                  </tr>
                ))}
                <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold' }}>
                  <td style={{ padding: '10px', border: '1px solid #333', textAlign: 'center' }} colSpan={5}>الإجمالي</td>
                  <td style={{ padding: '10px', border: '1px solid #333', textAlign: 'right', color: '#dc2626' }}>
                    {voucher.total_amount.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* التوقيعات */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', padding: '0 20px' }}>
              <div style={{ textAlign: 'center', width: '30%' }}>
                <div style={{ borderTop: '2px solid #333', paddingTop: '8px', fontWeight: 'bold' }}>توقيع الموظف</div>
              </div>
              <div style={{ textAlign: 'center', width: '30%' }}>
                <div style={{ borderTop: '2px solid #333', paddingTop: '8px', fontWeight: 'bold' }}>توقيع المحاسب</div>
              </div>
              <div style={{ textAlign: 'center', width: '30%' }}>
                <div style={{ borderTop: '2px solid #333', paddingTop: '8px', fontWeight: 'bold' }}>اعتماد المدير المالي</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default CustodySettlementVoucher;