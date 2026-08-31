
// ============================================
// pages/SupplierReports.jsx - تقارير الموردين
// ============================================
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from "../services/api";

function SupplierReports() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' | 'balances'

  // 📊 كشف حساب المورد
  const [ledgerData, setLedgerData] = useState(null);
  const [ledgerSupplier, setLedgerSupplier] = useState('');
  const [ledgerFromDate, setLedgerFromDate] = useState('');
  const [ledgerToDate, setLedgerToDate] = useState('');

  // 📊 أرصدة الموردين
  const [balancesData, setBalancesData] = useState(null);
  const [balancesFromDate, setBalancesFromDate] = useState('');
  const [balancesToDate, setBalancesToDate] = useState('');

  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ⏰ أعمار الديون
  const [agingData, setAgingData] = useState(null);
  const [expandedBucket, setExpandedBucket] = useState(null);

  // 📊 تقرير الأصناف (مورد و/أو صنف خلال فترة)
  const [itemsReportData, setItemsReportData] = useState(null);
  const [reportSupplier, setReportSupplier] = useState('');
  const [reportItem, setReportItem] = useState('');
  const [supplierItemsList, setSupplierItemsList] = useState(null); // null = مفيش مورد محدد، فنستخدم كل الأصناف
  const [reportFromDate, setReportFromDate] = useState('');
  const [reportToDate, setReportToDate] = useState('');
  const [reportMonth, setReportMonth] = useState('');

  // 📅 اختيار الفترة بالشهر (بدل كتابة تاريخين يدويًا)
  const [ledgerMonth, setLedgerMonth] = useState('');
  const [balancesMonth, setBalancesMonth] = useState('');

  // بيرجع أول وآخر يوم في الشهر المختار (بصيغة YYYY-MM-DD)
  const getMonthRange = (monthValue) => {
    if (!monthValue) return { from: '', to: '' };
    const [year, month] = monthValue.split('-').map(Number);
    const from = `${monthValue}-01`;
    const lastDay = new Date(year, month, 0).getDate(); // آخر يوم في الشهر
    const to = `${monthValue}-${String(lastDay).padStart(2, '0')}`;
    return { from, to };
  };

  const handleLedgerMonthChange = (value) => {
    setLedgerMonth(value);
    const { from, to } = getMonthRange(value);
    setLedgerFromDate(from);
    setLedgerToDate(to);
  };

  const handleBalancesMonthChange = (value) => {
    setBalancesMonth(value);
    const { from, to } = getMonthRange(value);
    setBalancesFromDate(from);
    setBalancesToDate(to);
  };

  const handleReportMonthChange = (value) => {
    setReportMonth(value);
    const { from, to } = getMonthRange(value);
    setReportFromDate(from);
    setReportToDate(to);
  };

  useEffect(() => {
    fetchSuppliers();
    fetchItems();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/suppliers');
      setSuppliers(response.data);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  };

  const fetchItems = async () => {
    try {
      const response = await api.get('/items');
      setItems(response.data);
    } catch (err) {
      console.error('Error fetching items:', err);
    }
  };

  // 📊 جلب كشف حساب المورد
  const fetchLedger = async () => {
    if (!ledgerSupplier || !ledgerFromDate || !ledgerToDate) {
      setError('يرجى اختيار المورد والفترة');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/supplier-reports/ledger?supplier_id=${ledgerSupplier}&from_date=${ledgerFromDate}&to_date=${ledgerToDate}`);
      setLedgerData(response.data);
    } catch (err) {
      setError('خطأ في تحميل التقرير: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // 📊 جلب أرصدة الموردين
  const fetchBalances = async () => {
    if (!balancesFromDate || !balancesToDate) {
      setError('يرجى اختيار الفترة');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/supplier-reports/balances?from_date=${balancesFromDate}&to_date=${balancesToDate}`);
      setBalancesData(response.data);
    } catch (err) {
      setError('خطأ في تحميل التقرير: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // ⏰ جلب تقرير أعمار الديون
  const fetchAging = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/supplier-reports/aging');
      setAgingData(response.data);
    } catch (err) {
      setError('خطأ في تحميل التقرير: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // 📦 لما يختار مورد، نجيب أصنافه بس ونصفّي قائمة الصنف
  const handleReportSupplierChange = async (value) => {
    setReportSupplier(value);
    setReportItem(''); // نصفّر اختيار الصنف السابق لأنه ممكن يكون مش من أصناف المورد الجديد

    if (!value) {
      setSupplierItemsList(null); // رجّع كل الأصناف
      return;
    }

    try {
      const response = await api.get(`/supplier-reports/supplier-items?supplier_id=${value}`);
      setSupplierItemsList(response.data);
    } catch (err) {
      console.error('Error fetching supplier items:', err);
      setSupplierItemsList([]);
    }
  };

  // 📊 جلب تقرير الأصناف
  const fetchItemsReport = async () => {
    if (!reportFromDate || !reportToDate) {
      setError('يرجى تحديد الفترة');
      return;
    }
    if (!reportSupplier && !reportItem) {
      setError('يرجى اختيار مورد أو صنف على الأقل');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ from_date: reportFromDate, to_date: reportToDate });
      if (reportSupplier) params.append('supplier_id', reportSupplier);
      if (reportItem) params.append('item_id', reportItem);
      const response = await api.get(`/supplier-reports/items-report?${params.toString()}`);
      setItemsReportData(response.data);
    } catch (err) {
      setError('خطأ في تحميل التقرير: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
        <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          ← رجوع
        </button>
        <h1 style={{ color: '#2563eb', margin: 0 }}>📊 تقارير الموردين</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px' }}>
        <button 
          onClick={() => setActiveTab('ledger')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'ledger' ? '#2563eb' : '#f3f4f6',
            color: activeTab === 'ledger' ? 'white' : '#374151',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '16px'
          }}
        >
          📋 كشف حساب المورد
        </button>
        <button 
          onClick={() => setActiveTab('balances')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'balances' ? '#2563eb' : '#f3f4f6',
            color: activeTab === 'balances' ? 'white' : '#374151',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '16px'
          }}
        >
          💰 أرصدة الموردين
        </button>
        <button 
          onClick={() => setActiveTab('itemsReport')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'itemsReport' ? '#2563eb' : '#f3f4f6',
            color: activeTab === 'itemsReport' ? 'white' : '#374151',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '16px'
          }}
        >
          📦 تقرير الأصناف
        </button>
        <button 
          onClick={() => { setActiveTab('aging'); fetchAging(); }}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'aging' ? '#2563eb' : '#f3f4f6',
            color: activeTab === 'aging' ? 'white' : '#374151',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '16px'
          }}
        >
          ⏰ أعمار الديون
        </button>
      </div>

      {error && <div style={{ padding: '15px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '8px', marginBottom: '15px' }}>{error}</div>}

      {/* ============================================ */}
      {/* 📋 كشف حساب المورد */}
      {/* ============================================ */}
      {activeTab === 'ledger' && (
        <div>
          {/* Filters */}
          <div style={{ color: '#1e293b', display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#374151' }}>المورد:</label>
              <select 
                value={ledgerSupplier} 
                onChange={(e) => setLedgerSupplier(e.target.value)}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', minWidth: '250px' }}
              >
                <option value="">اختر المورد...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#374151' }}>اختر الشهر:</label>
              <input 
                type="month" 
                value={ledgerMonth} 
                onChange={(e) => handleLedgerMonthChange(e.target.value)}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#374151' }}>من تاريخ:</label>
              <input 
                type="date" 
                value={ledgerFromDate} 
                onChange={(e) => { setLedgerFromDate(e.target.value); setLedgerMonth(''); }}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#374151' }}>إلى تاريخ:</label>
              <input 
                type="date" 
                value={ledgerToDate} 
                onChange={(e) => { setLedgerToDate(e.target.value); setLedgerMonth(''); }}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button 
                onClick={fetchLedger}
                disabled={loading}
                style={{ padding: '10px 24px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {loading ? 'جاري التحميل...' : '🔍 عرض التقرير'}
              </button>
            </div>
          </div>

          {/* Report Content */}
          {ledgerData && (
            <div className="print-area">
              {/* Report Header */}
              <div style={{ color: '#1e293b', textAlign: 'center', marginBottom: '20px', padding: '20px', backgroundColor: '#f0f9ff', borderRadius: '12px' }}>
                <h2 style={{ margin: '0 0 10px 0', color: '#1e40af' }}>📋 كشف حساب المورد</h2>
                <p style={{ margin: '5px 0', fontSize: '18px', fontWeight: 'bold' }}>
                  {ledgerData.supplier_code} - {ledgerData.supplier}
                </p>
                <p style={{ margin: '5px 0', color: '#6b7280' }}>
                  الفترة من {ledgerData.from_date} إلى {ledgerData.to_date}
                </p>
              </div>

              {/* Opening Balance */}
              <div style={{ color: '#1e293b', display: 'flex', justifyContent: 'space-between', padding: '15px', backgroundColor: '#fef3c7', borderRadius: '8px', marginBottom: '15px' }}>
                <span style={{ fontWeight: 'bold', color: '#92400e' }}>الرصيد الافتتاحي:</span>
                <span style={{ fontWeight: 'bold', color: '#92400e', fontSize: '18px' }}>
                  {parseFloat(ledgerData.opening_balance).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                </span>
              </div>

              {/* Transactions Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e40af', color: 'white' }}>
                    <th style={{ padding: '12px', border: '1px solid #1e40af' }}>التاريخ</th>
                    <th style={{ padding: '12px', border: '1px solid #1e40af' }}>البيان</th>
                    <th style={{ padding: '12px', border: '1px solid #1e40af' }}>رقم المرجع</th>
                    <th style={{ padding: '12px', border: '1px solid #1e40af' }}>مدين (علينا)</th>
                    <th style={{ padding: '12px', border: '1px solid #1e40af' }}>دائن (له)</th>
                    <th style={{ padding: '12px', border: '1px solid #1e40af' }}>الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerData.transactions.map((t, index) => (
                    <tr key={t.id} style={{ backgroundColor: index % 2 === 0 ? '#f8fafc' : 'white' }}>
                      <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                        {new Date(t.transaction_date).toLocaleDateString('ar-EG')}
                      </td>
                      <td style={{ padding: '10px', border: '1px solid #e5e7eb' }}>
                        {t.notes || t.transaction_type}
                      </td>
                      <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                        {t.reference_number}
                      </td>
                      <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#dc2626' }}>
                        {parseFloat(t.debit) > 0 ? parseFloat(t.debit).toLocaleString('ar-EG', { minimumFractionDigits: 2 }) : '-'}
                      </td>
                      <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#16a34a' }}>
                        {parseFloat(t.credit) > 0 ? parseFloat(t.credit).toLocaleString('ar-EG', { minimumFractionDigits: 2 }) : '-'}
                      </td>
                      <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold', color: '#1e40af' }}>
                        {parseFloat(t.running_balance).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginTop: '20px' }}>
                <div style={{ color: '#1e293b', padding: '20px', backgroundColor: '#fee2e2', borderRadius: '12px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 10px 0', color: '#991b1b', fontWeight: 'bold' }}>إجمالي الفواتير (مدين)</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>
                    {parseFloat(ledgerData.summary.period_debit).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div style={{ color: '#1e293b', padding: '20px', backgroundColor: '#dcfce7', borderRadius: '12px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 10px 0', color: '#166534', fontWeight: 'bold' }}>إجمالي المدفوعات (دائن)</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}>
                    {parseFloat(ledgerData.summary.period_credit).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div style={{ color: '#1e293b', padding: '20px', backgroundColor: '#dbeafe', borderRadius: '12px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 10px 0', color: '#1e40af', fontWeight: 'bold' }}>الرصيد الحالي</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#2563eb' }}>
                    {parseFloat(ledgerData.summary.closing_balance).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Print Button */}
              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <button onClick={printReport} style={{ padding: '12px 30px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>
                  🖨️ طباعة التقرير
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* 💰 أرصدة الموردين */}
      {/* ============================================ */}
      {activeTab === 'balances' && (
        <div>
          {/* Filters */}
          <div style={{ color: '#1e293b', display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#374151' }}>اختر الشهر:</label>
              <input 
                type="month" 
                value={balancesMonth} 
                onChange={(e) => handleBalancesMonthChange(e.target.value)}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#374151' }}>من تاريخ:</label>
              <input 
                type="date" 
                value={balancesFromDate} 
                onChange={(e) => { setBalancesFromDate(e.target.value); setBalancesMonth(''); }}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#374151' }}>إلى تاريخ:</label>
              <input 
                type="date" 
                value={balancesToDate} 
                onChange={(e) => { setBalancesToDate(e.target.value); setBalancesMonth(''); }}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button 
                onClick={fetchBalances}
                disabled={loading}
                style={{ padding: '10px 24px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {loading ? 'جاري التحميل...' : '🔍 عرض التقرير'}
              </button>
            </div>
          </div>

          {/* Report Content */}
          {balancesData && (
            <div className="print-area">
              {/* Report Header */}
              <div style={{ color: '#1e293b', textAlign: 'center', marginBottom: '20px', padding: '20px', backgroundColor: '#f0fdf4', borderRadius: '12px' }}>
                <h2 style={{ margin: '0 0 10px 0', color: '#166534' }}>💰 أرصدة الموردين</h2>
                <p style={{ margin: '5px 0', color: '#6b7280' }}>
                  الفترة من {balancesData.from_date} إلى {balancesData.to_date}
                </p>
              </div>

              {/* Balances Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#166534', color: 'white' }}>
                    <th style={{ padding: '12px', border: '1px solid #166534' }}>كود المورد</th>
                    <th style={{ padding: '12px', border: '1px solid #166534' }}>اسم المورد</th>
                    <th style={{ padding: '12px', border: '1px solid #166534' }}>رصيد أول المدة</th>
                    <th style={{ padding: '12px', border: '1px solid #166534' }}>إجمالي الفواتير</th>
                    <th style={{ padding: '12px', border: '1px solid #166534' }}>إجمالي المدفوعات</th>
                    <th style={{ padding: '12px', border: '1px solid #166534' }}>الرصيد الحالي</th>
                  </tr>
                </thead>
                <tbody>
                  {balancesData.suppliers.map((s, index) => (
                    <tr key={s.supplier_id} style={{ backgroundColor: index % 2 === 0 ? '#f0fdf4' : 'white' }}>
                      <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold' }}>
                        {s.supplier_code}
                      </td>
                      <td style={{ padding: '10px', border: '1px solid #e5e7eb', fontWeight: 'bold' }}>
                        {s.supplier_name}
                      </td>
                      <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                        {parseFloat(s.opening_balance).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#dc2626' }}>
                        {parseFloat(s.total_invoices).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#16a34a' }}>
                        {parseFloat(s.total_payments).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ 
                        padding: '10px', 
                        border: '1px solid #e5e7eb', 
                        textAlign: 'center', 
                        fontWeight: 'bold',
                        color: parseFloat(s.closing_balance) > 0 ? '#dc2626' : '#16a34a',
                        fontSize: '16px'
                      }}>
                        {parseFloat(s.closing_balance).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#166534', color: 'white', fontWeight: 'bold' }}>
                    <td style={{ padding: '12px', border: '1px solid #166534', textAlign: 'center' }} colSpan="2">
                      الإجمالي
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #166534', textAlign: 'center' }}>
                      {parseFloat(balancesData.summary.total_opening).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #166534', textAlign: 'center' }}>
                      {parseFloat(balancesData.summary.total_invoices).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #166534', textAlign: 'center' }}>
                      {parseFloat(balancesData.summary.total_payments).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #166534', textAlign: 'center' }}>
                      {parseFloat(balancesData.summary.total_closing).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Print Button */}
              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <button onClick={printReport} style={{ padding: '12px 30px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>
                  🖨️ طباعة التقرير
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* 📦 تقرير الأصناف */}
      {/* ============================================ */}
      {activeTab === 'itemsReport' && (
        <div>
          {/* Filters */}
          <div style={{ color: '#1e293b', display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#374151' }}>المورد (اختياري):</label>
              <select 
                value={reportSupplier} 
                onChange={(e) => handleReportSupplierChange(e.target.value)}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', minWidth: '220px' }}
              >
                <option value="">-- كل الموردين --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#374151' }}>
                الصنف (اختياري){reportSupplier && supplierItemsList !== null ? ` — أصناف ${suppliers.find(s => String(s.id) === String(reportSupplier))?.name || 'المورد'} فقط` : ''}:
              </label>
              <select 
                value={reportItem} 
                onChange={(e) => setReportItem(e.target.value)}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', minWidth: '220px' }}
              >
                <option value="">
                  {supplierItemsList !== null ? '-- كل أصناف المورد ده --' : '-- كل الأصناف --'}
                </option>
                {(supplierItemsList !== null ? supplierItemsList : items).map(i => (
                  <option key={i.id} value={i.id}>{i.code} - {i.name}</option>
                ))}
              </select>
              {supplierItemsList !== null && supplierItemsList.length === 0 && (
                <div style={{ fontSize: '13px', color: '#dc2626', marginTop: '4px' }}>
                  المورد ده مالوش أي أصناف مسجلة
                </div>
              )}
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#374151' }}>اختر الشهر:</label>
              <input 
                type="month" 
                value={reportMonth} 
                onChange={(e) => handleReportMonthChange(e.target.value)}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#374151' }}>من تاريخ:</label>
              <input 
                type="date" 
                value={reportFromDate} 
                onChange={(e) => { setReportFromDate(e.target.value); setReportMonth(''); }}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#374151' }}>إلى تاريخ:</label>
              <input 
                type="date" 
                value={reportToDate} 
                onChange={(e) => { setReportToDate(e.target.value); setReportMonth(''); }}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button 
                onClick={fetchItemsReport}
                disabled={loading}
                style={{ padding: '10px 24px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {loading ? 'جاري التحميل...' : '🔍 عرض التقرير'}
              </button>
            </div>
          </div>
          <div style={{ marginBottom: '15px', color: '#6b7280', fontSize: '14px' }}>
            💡 اختر مورد بس = كل الأصناف اللي جابها المورد ده. اختر صنف بس = كل الموردين اللي جابوا الصنف ده. اختر الاتنين = حركة الصنف مع المورد ده بالذات.
          </div>

          {/* Report Content */}
          {itemsReportData && (
            <div className="print-area">
              {/* Report Header */}
              <div style={{ color: '#1e293b', textAlign: 'center', marginBottom: '20px', padding: '20px', backgroundColor: '#f0f9ff', borderRadius: '12px' }}>
                <h2 style={{ margin: '0 0 10px 0', color: '#1e40af' }}>📦 تقرير الأصناف</h2>
                <div style={{ color: '#6b7280' }}>
                  الفترة من {itemsReportData.from_date} إلى {itemsReportData.to_date}
                </div>
              </div>

              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                <div style={{ color: '#1e293b', backgroundColor: '#eff6ff', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ color: '#1e40af', fontWeight: 'bold', marginBottom: '8px' }}>عدد الحركات</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{itemsReportData.summary.transactions_count}</div>
                </div>
                <div style={{ color: '#1e293b', backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ color: '#166534', fontWeight: 'bold', marginBottom: '8px' }}>إجمالي الكمية</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold' }}>
                    {itemsReportData.summary.total_quantity.toLocaleString('ar-EG')}
                  </div>
                </div>
                <div style={{ color: '#1e293b', backgroundColor: '#fef2f2', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ color: '#dc2626', fontWeight: 'bold', marginBottom: '8px' }}>إجمالي القيمة</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold' }}>
                    {itemsReportData.summary.total_amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                  </div>
                </div>
              </div>

              {/* الإجمالي حسب الصنف - يظهر لو مفيش صنف محدد بالذات */}
              {!reportItem && itemsReportData.summary_by_item.length > 0 && (
                <>
                  <h3 style={{ color: '#1e40af', marginBottom: '10px' }}>📊 الإجمالي حسب الصنف</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#2563eb', color: 'white' }}>
                        <th style={{ padding: '10px', border: '1px solid #1e40af' }}>كود الصنف</th>
                        <th style={{ padding: '10px', border: '1px solid #1e40af' }}>اسم الصنف</th>
                        <th style={{ padding: '10px', border: '1px solid #1e40af' }}>عدد الحركات</th>
                        <th style={{ padding: '10px', border: '1px solid #1e40af' }}>إجمالي الكمية</th>
                        <th style={{ padding: '10px', border: '1px solid #1e40af' }}>إجمالي القيمة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsReportData.summary_by_item.map((it, idx) => (
                        <tr key={it.item_id} style={{ backgroundColor: idx % 2 === 0 ? '#f8fafc' : 'white' }}>
                          <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold' }}>{it.item_code}</td>
                          <td style={{ padding: '10px', border: '1px solid #e5e7eb' }}>{it.item_name}</td>
                          <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{it.transactions_count}</td>
                          <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                            {it.total_quantity.toLocaleString('ar-EG')} {it.unit || ''}
                          </td>
                          <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold' }}>
                            {it.total_amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {/* الإجمالي حسب المورد - يظهر لو مفيش مورد محدد بالذات */}
              {!reportSupplier && itemsReportData.summary_by_supplier.length > 0 && (
                <>
                  <h3 style={{ color: '#1e40af', marginBottom: '10px' }}>📊 الإجمالي حسب المورد</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#2563eb', color: 'white' }}>
                        <th style={{ padding: '10px', border: '1px solid #1e40af' }}>كود المورد</th>
                        <th style={{ padding: '10px', border: '1px solid #1e40af' }}>اسم المورد</th>
                        <th style={{ padding: '10px', border: '1px solid #1e40af' }}>عدد الحركات</th>
                        <th style={{ padding: '10px', border: '1px solid #1e40af' }}>إجمالي الكمية</th>
                        <th style={{ padding: '10px', border: '1px solid #1e40af' }}>إجمالي القيمة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsReportData.summary_by_supplier.map((sp, idx) => (
                        <tr key={sp.supplier_id || sp.supplier_name} style={{ backgroundColor: idx % 2 === 0 ? '#f8fafc' : 'white' }}>
                          <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold' }}>{sp.supplier_code || '-'}</td>
                          <td style={{ padding: '10px', border: '1px solid #e5e7eb' }}>{sp.supplier_name}</td>
                          <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{sp.transactions_count}</td>
                          <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                            {sp.total_quantity.toLocaleString('ar-EG')}
                          </td>
                          <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold' }}>
                            {sp.total_amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {/* الحركة التفصيلية */}
              <h3 style={{ color: '#1e40af', marginBottom: '10px' }}>📋 الحركة التفصيلية</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#374151', color: 'white' }}>
                    <th style={{ padding: '10px', border: '1px solid #1f2937' }}>التاريخ</th>
                    <th style={{ padding: '10px', border: '1px solid #1f2937' }}>رقم الفاتورة</th>
                    <th style={{ padding: '10px', border: '1px solid #1f2937' }}>المورد</th>
                    <th style={{ padding: '10px', border: '1px solid #1f2937' }}>الصنف</th>
                    <th style={{ padding: '10px', border: '1px solid #1f2937' }}>الكمية</th>
                    <th style={{ padding: '10px', border: '1px solid #1f2937' }}>السعر</th>
                    <th style={{ padding: '10px', border: '1px solid #1f2937' }}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsReportData.transactions.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>
                        لا توجد حركات في الفترة المحددة
                      </td>
                    </tr>
                  ) : (
                    itemsReportData.transactions.map((t, idx) => (
                      <tr key={t.transaction_id} style={{ backgroundColor: idx % 2 === 0 ? '#f8fafc' : 'white' }}>
                        <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                          {new Date(t.purchase_date).toLocaleDateString('ar-EG')}
                        </td>
                        <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{t.purchase_number}</td>
                        <td style={{ padding: '10px', border: '1px solid #e5e7eb' }}>{t.supplier_name || '-'}</td>
                        <td style={{ padding: '10px', border: '1px solid #e5e7eb' }}>{t.item_code} - {t.item_name}</td>
                        <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                          {parseFloat(t.quantity).toLocaleString('ar-EG')} {t.unit || ''}
                        </td>
                        <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                          {parseFloat(t.unit_price).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold' }}>
                          {parseFloat(t.total_amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Print Button */}
              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <button onClick={printReport} style={{ padding: '12px 30px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>
                  🖨️ طباعة التقرير
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* ⏰ أعمار الديون */}
      {/* ============================================ */}
      {activeTab === 'aging' && (
        <div>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>جاري التحميل...</div>
          ) : agingData ? (
            <div className="print-area">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '25px' }}>
                {[
                  { key: 'current', label: '0-30 يوم', color: '#16a34a' },
                  { key: '31_60', label: '31-60 يوم', color: '#eab308' },
                  { key: '61_90', label: '61-90 يوم', color: '#f97316' },
                  { key: 'over_90', label: 'أكتر من 90 يوم', color: '#dc2626' }
                ].map(b => (
                  <div key={b.key}
                    onClick={() => setExpandedBucket(expandedBucket === b.key ? null : b.key)}
                    style={{
                      padding: '18px', borderRadius: '10px', cursor: 'pointer',
                      backgroundColor: '#f9fafb', border: `2px solid ${expandedBucket === b.key ? b.color : '#e5e7eb'}`,
                      color: '#1e293b'
                    }}>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '6px' }}>{b.label}</div>
                    <div style={{ fontSize: '22px', fontWeight: 'bold', color: b.color }}>
                      {(agingData.totals[b.key] || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                      {(agingData.buckets[b.key] || []).length} مورد
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ padding: '15px 18px', backgroundColor: '#eff6ff', borderRadius: '8px', marginBottom: '20px', color: '#1e293b', fontWeight: 'bold', fontSize: '16px' }}>
                إجمالي المديونية القائمة: {(agingData.grand_total || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م
              </div>

              {expandedBucket && (
                <table style={{ width: '100%', borderCollapse: 'collapse', color: '#1e293b' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f3f4f6' }}>
                      <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #e5e7eb' }}>المورد</th>
                      <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #e5e7eb' }}>الرصيد</th>
                      <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #e5e7eb' }}>عدد الأيام</th>
                      <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #e5e7eb' }}>أقدم فاتورة مفتوحة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(agingData.buckets[expandedBucket] || []).map(row => (
                      <tr key={row.supplier_id}>
                        <td style={{ padding: '10px', border: '1px solid #e5e7eb' }}>{row.supplier_name}</td>
                        <td style={{ padding: '10px', border: '1px solid #e5e7eb', fontWeight: 'bold' }}>{parseFloat(row.balance).toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م</td>
                        <td style={{ padding: '10px', border: '1px solid #e5e7eb' }}>{row.days_outstanding ?? '-'}</td>
                        <td style={{ padding: '10px', border: '1px solid #e5e7eb' }}>{row.oldest_open_invoice_date ? new Date(row.oldest_open_invoice_date).toLocaleDateString('ar-EG') : '-'}</td>
                      </tr>
                    ))}
                    {(agingData.buckets[expandedBucket] || []).length === 0 && (
                      <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>لا يوجد موردين في هذه الفئة</td></tr>
                    )}
                  </tbody>
                </table>
              )}
              {!expandedBucket && (
                <p style={{ textAlign: 'center', color: '#6b7280' }}>اضغط على أي فئة بالأعلى لعرض تفاصيل الموردين فيها</p>
              )}
            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>جاري تحميل التقرير...</div>
          )}
        </div>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          button { display: none !important; }
        }
      `}</style>
    </div>
  );
}

export default SupplierReports;
