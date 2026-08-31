import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';

const Shipments = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const inputBg = isDark ? '#334155' : '#ffffff';
  const inputBorder = isDark ? '#475569' : '#d1d5db';
  const hoverBg = isDark ? '#1e293b' : '#f8fafc';

  const [shipments, setShipments] = useState([]);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [activeTab, setActiveTab] = useState('info');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [taxSettings, setTaxSettings] = useState({ vat_rate: 0.14, profit_tax_rate: 0.01 });
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingClearance, setEditingClearance] = useState(null);
  const [isEditingShipment, setIsEditingShipment] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [custodyForm, setCustodyForm] = useState({
    custody_number: '', party_type: 'service_provider', employee_id: '', supplier_id: '', amount: '', purpose: '',
    payment_method: 'cash', bank_name: '', check_number: '', notes: ''
  });
  const [settlementExpenses, setSettlementExpenses] = useState([]);

  // ═══ استدعاء مصروف من الخزينة/البنك (غير مربوط بشحنة) ═══
  const [showExpensePicker, setShowExpensePicker] = useState(false);
  const [availableExpenses, setAvailableExpenses] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerFilters, setPickerFilters] = useState({ category: '', supplier: '', bank: '', search: '' });


  // Form states
  const [shipmentForm, setShipmentForm] = useState({
    shipment_number: '', supplier_id: '', country_of_origin: '',
    shipping_method: '', expected_arrival: '', notes: '',
    shipment_type: 'commercial', is_dummy: false, dummy_for_user_id: ''
  });
const calculateTaxes = (amount, vatRate, withholdingRate) => {
  const base = parseFloat(amount) || 0;
  const vat = base * (parseFloat(vatRate) || 0) / 100;
  const withholding = base * (parseFloat(withholdingRate) || 0) / 100;
  const net = base + vat - withholding;
  return { vat, withholding, net };
};
const handleTaxChange = (field, value) => {
  const updated = { ...expenseForm, [field]: value };
  if (updated.has_tax_invoice) {
    const base = parseFloat(updated.tax_invoice_amount || updated.amount_egp) || 0;
    const { vat, withholding, net } = calculateTaxes(base, updated.vat_rate, updated.withholding_rate);
    updated.vat_amount = vat.toFixed(2);
    updated.withholding_amount = withholding.toFixed(2);
    updated.net_amount = net.toFixed(2);
  }
  setExpenseForm(updated);
};

  const handleRateChange = (field, value) => {
    const numVal = parseFloat(value) || 0;
    const egp = parseFloat(expenseForm.amount_egp) || 0;
    const usd = parseFloat(expenseForm.amount_usd) || 0;
    const eur = parseFloat(expenseForm.amount_eur) || 0;
    const usdRate = field === 'exchange_rate_usd' ? numVal : (parseFloat(expenseForm.exchange_rate_usd) || 0);
    const eurRate = field === 'exchange_rate_eur' ? numVal : (parseFloat(expenseForm.exchange_rate_eur) || 0);

    let updates = { [field]: value };

    if (usdRate > 0 && eurRate > 0) {
      if (egp > 0 && usd === 0 && eur === 0) {
        updates.amount_usd = (egp / usdRate).toFixed(2);
        updates.amount_eur = (egp / eurRate).toFixed(2);
      } else if (usd > 0 && egp === 0 && eur === 0) {
        const newEgp = usd * usdRate;
        updates.amount_egp = newEgp.toFixed(2);
        updates.amount_eur = (newEgp / eurRate).toFixed(2);
      } else if (eur > 0 && egp === 0 && usd === 0) {
        const newEgp = eur * eurRate;
        updates.amount_egp = newEgp.toFixed(2);
        updates.amount_usd = (newEgp / usdRate).toFixed(2);
      }
    }
    setExpenseForm(prev => ({ ...prev, ...updates }));
  };

  const [expenseForm, setExpenseForm] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    expense_type: '', description: '', amount_egp: '', amount_usd: '',
    supplier_id: '', payment_method: 'cash',
    amount_eur: '', amount_other: '', other_currency: '',
    exchange_rate_usd: '', exchange_rate_eur: '', exchange_rate_other: '',
    treasury_id: '', custody_id: '', has_tax_invoice: false,
    vat_rate: 14,
  withholding_rate: 0,
  vat_amount: 0,
  withholding_amount: 0,
  net_amount: 0,
  tax_invoice_number: '', tax_invoice_amount: '', notes: '',
  is_dummy: false, expense_category_id: '', is_tax_only: false,
  is_custody_settlement: false, custody_invoice_type: 'real'
  });

  const [clearanceForm, setClearanceForm] = useState({
    clearance_number: '', clearance_date: new Date().toISOString().split('T')[0],
    declared_value: '', import_tax: '', is_vat_exempt: false,
    is_profit_tax_exempt: false, vat_rate: '', profit_tax_rate: '',
    notes: ''
  });

  const [suppliers, setSuppliers] = useState([]);
  const [treasuryList, setTreasuryList] = useState([]);
  const [custodyList, setCustodyList] = useState([]);
  const [purchaseList, setPurchaseList] = useState([]);
  const [costCalculation, setCostCalculation] = useState(null);

  useEffect(() => {
    fetchShipments();
    fetchSuppliers();
    fetchTreasury();
    fetchCustodies();
    fetchPurchases();
    fetchTaxSettings();
    fetchExpenseCategories();
    fetchUsers();
    fetchEmployees();
  }, [filterYear]);

  const fetchShipments = async () => {
    try { const res = await api.get(`/shipments?year=${filterYear}`); setShipments(res.data); }
    catch (err) { console.error(err); }
  };
  const fetchSuppliers = async () => {
    try { const res = await api.get('/suppliers'); setSuppliers(res.data); }
    catch (err) { console.error(err); }
  };
  const fetchTreasury = async () => {
    try { const res = await api.get('/treasury'); setTreasuryList(res.data); }
    catch (err) { console.error(err); }
  };
  const fetchCustodies = async () => {
    try { const res = await api.get('/custodies/active'); setCustodyList(res.data); }
    catch (err) { console.error(err); }
  };
  const fetchPurchases = async () => {
    try { const res = await api.get('/purchases'); setPurchaseList(res.data.filter(p => !p.shipment_id)); }
    catch (err) { console.error(err); }
  };
  const fetchTaxSettings = async () => {
  try {
    const res = await api.get('/tax-settings');
    setTaxSettings({
      vat_rate: (parseFloat(res.data.vat_rate || res.data.default_tax_rate || 14)) / 100,
      profit_tax_rate: (parseFloat(res.data.customs_profit_tax_rate || 1)) / 100,
      withholding_rate: (parseFloat(res.data.withholding_rate || 20)) / 100
    });
  } catch (err) { console.error(err); }
};
  const fetchExpenseCategories = async () => {
    try { const res = await api.get('/expense-categories'); setExpenseCategories(res.data); }
    catch (err) { console.error(err); }
  };
  const fetchUsers = async () => {
    try { const res = await api.get('/employees'); setUsers(res.data); }
    catch (err) { console.error(err); }
  };
  const fetchEmployees = async () => {
    try { const res = await api.get('/employees'); setEmployees(res.data); }
    catch (err) { console.error(err); }
  };

  const fetchShipmentDetails = async (id) => {
    setLoading(true);
    try { const res = await api.get(`/shipments/${id}`); setSelectedShipment(res.data); setActiveTab('info'); }
    catch (err) { setMessage('❌ خطأ في جلب تفاصيل الشحنة'); }
    finally { setLoading(false); }
  };

  const getNextNumber = async () => {
    try { const res = await api.get('/shipments/next-number'); setShipmentForm(prev => ({ ...prev, shipment_number: res.data.nextNumber })); }
    catch (err) { console.error(err); }
  };
  const handleUpdateShipment = async (e) => {
    e.preventDefault(); 
    if (!selectedShipment) return;
    setLoading(true);
    try {
      await api.put(`/shipments/${selectedShipment.id}`, { 
        ...shipmentForm, 
        shipment_year: selectedShipment.shipment_year 
      });
      setMessage('✅ تم تعديل الشحنة بنجاح');
      setIsEditingShipment(false);
      setShipmentForm({ shipment_number: '', supplier_id: '', country_of_origin: '', shipping_method: '', expected_arrival: '', notes: '', shipment_type: 'commercial', is_dummy: false, dummy_for_user_id: '' });
      fetchShipmentDetails(selectedShipment.id);
      fetchShipments();
    } catch (err) { 
      setMessage('❌ ' + (err.response?.data?.message || err.message)); 
    }
    finally { setLoading(false); }
  };

  const handleCreateShipment = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await api.post('/shipments', { ...shipmentForm, shipment_year: filterYear });
      setMessage('✅ تم إنشاء الشحنة بنجاح');
      setShipmentForm({ shipment_number: '', supplier_id: '', country_of_origin: '', shipping_method: '', expected_arrival: '', notes: '', shipment_type: 'commercial', is_dummy: false, dummy_for_user_id: '' });
      fetchShipments();
    } catch (err) { setMessage('❌ ' + (err.response?.data?.message || err.message)); }
    finally { setLoading(false); }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault(); if (!selectedShipment) return; setLoading(true);
    try {
      const url = editingExpense
        ? `/shipments/${selectedShipment.id}/expenses/${editingExpense.id}`
        : `/shipments/${selectedShipment.id}/expenses`;
      const method = editingExpense ? 'put' : 'post';
      await api[method](url, expenseForm);
      setMessage(editingExpense ? '✅ تم تعديل المصروف' : '✅ تم إضافة المصروف');
      resetExpenseForm();
      setEditingExpense(null);
      fetchShipmentDetails(selectedShipment.id);
    } catch (err) { setMessage('❌ ' + (err.response?.data?.message || err.message)); }
    finally { setLoading(false); }
  };

  // ═══ استدعاء مصروف: بحث + ربط ═══
  const fetchAvailableExpenses = async () => {
    setPickerLoading(true);
    try {
      const params = {};
      if (pickerFilters.category) params.category = pickerFilters.category;
      if (pickerFilters.supplier) params.supplier = pickerFilters.supplier;
      if (pickerFilters.bank) params.bank = pickerFilters.bank;
      if (pickerFilters.search) params.search = pickerFilters.search;
      const res = await api.get('/shipments/available-expenses', { params });
      setAvailableExpenses(res.data || []);
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || err.message));
    } finally { setPickerLoading(false); }
  };

  const openExpensePicker = () => {
    setShowExpensePicker(true);
    setPickerFilters({ category: '', supplier: '', bank: '', search: '' });
    fetchAvailableExpenses();
  };

  // ربط مصروف مُستدعى بالشحنة: بيملأ فورم المصروف بالبيانات ويسجله فورًا
  const linkAvailableExpense = async (exp) => {
    if (!selectedShipment) return;
    setLoading(true);
    try {
      const amountEgp = exp.currency === 'EGP' ? exp.amount : (exp.amount_local || exp.amount);
      await api.post(`/shipments/${selectedShipment.id}/expenses`, {
        expense_date: exp.transaction_date,
        expense_type: exp.category_name || (exp.transaction_type === 'bank_transfer' ? 'سداد مورد' : 'أخرى'),
        description: exp.description || exp.transaction_number,
        amount_egp: amountEgp,
        supplier_id: exp.supplier_id || null,
        payment_method: exp.payment_method || 'bank',
        treasury_id: exp.treasury_id,
        custody_id: exp.custody_id || null,
        expense_category_id: exp.expense_category_id || null,
        notes: `مستدعى من الخزينة — ${exp.transaction_number}`
      });
      setMessage(`✅ تم ربط المصروف "${exp.transaction_number}" بالشحنة`);
      setShowExpensePicker(false);
      fetchShipmentDetails(selectedShipment.id);
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || err.message));
    } finally { setLoading(false); }
  };

  const resetExpenseForm = () => {
    setExpenseForm({
      expense_date: new Date().toISOString().split('T')[0], expense_type: '', description: '',
      amount_egp: '', amount_usd: '', amount_eur: '', amount_other: '', other_currency: '',
      supplier_id: '', payment_method: 'cash',
      exchange_rate_usd: '', exchange_rate_eur: '', exchange_rate_other: '',
      treasury_id: '', custody_id: '', has_tax_invoice: false,
      tax_invoice_number: '', tax_invoice_amount: '', notes: '',
      is_dummy: false, expense_category_id: '', is_tax_only: false,
      vat_rate: 14, withholding_rate: 0, vat_amount: 0,
      withholding_amount: 0, net_amount: 0,
      is_custody_settlement: false, custody_invoice_type: 'real'
    });
  };

  const startEditExpense = (exp) => {
    setEditingExpense(exp);
    setExpenseForm({
      expense_date: exp.expense_date ? exp.expense_date.split('T')[0] : new Date().toISOString().split('T')[0],
      expense_type: exp.expense_type || '', description: exp.description || '',
      amount_egp: exp.amount_egp || '', amount_usd: exp.amount_usd || '', amount_eur: exp.amount_eur || '',
      amount_other: exp.amount_other || '', other_currency: exp.other_currency || '',
      exchange_rate_usd: exp.exchange_rate_usd || '', exchange_rate_eur: exp.exchange_rate_eur || '',
      exchange_rate_other: exp.exchange_rate_other || '',
      treasury_id: exp.treasury_id || '', custody_id: exp.custody_id || '',
      has_tax_invoice: exp.has_tax_invoice || false, tax_invoice_number: exp.tax_invoice_number || '',
      tax_invoice_amount: exp.tax_invoice_amount || '', notes: exp.notes || '',
            is_dummy: exp.is_dummy || false, expense_category_id: exp.expense_category_id || '',
      is_tax_only: exp.is_tax_only || false,
      supplier_id: exp.supplier_id || '', payment_method: exp.payment_method || 'cash',
      vat_rate: exp.vat_rate || 14, withholding_rate: exp.withholding_rate || 0,
      vat_amount: exp.vat_amount || 0, withholding_amount: exp.withholding_amount || 0,
      net_amount: exp.net_amount || 0,
      is_custody_settlement: exp.is_custody_settlement || false,
      custody_invoice_type: exp.custody_invoice_type || 'real'
    });
  };
  const calculateClearancePreview = () => {
    const declared = parseFloat(clearanceForm.declared_value) || 0;
    const importTax = parseFloat(clearanceForm.import_tax) || 0;
    const vatRate = parseFloat(clearanceForm.vat_rate) || (taxSettings.vat_rate * 100);
    const profitRate = parseFloat(clearanceForm.profit_tax_rate) || (taxSettings.profit_tax_rate * 100);
    
    const vatAmount = clearanceForm.is_vat_exempt ? 0 : (declared * vatRate / 100);
    const profitAmount = clearanceForm.is_profit_tax_exempt ? 0 : (declared * profitRate / 100);
    const total = declared + importTax + vatAmount + profitAmount;
    
    return { vatAmount, profitAmount, total };
  };

  const handleAddClearance = async (e) => {
    e.preventDefault(); if (!selectedShipment) return; setLoading(true);
    try {
      const url = editingClearance
        ? `/shipments/${selectedShipment.id}/clearance/${editingClearance.id}`
        : `/shipments/${selectedShipment.id}/clearance`;
      const method = editingClearance ? 'put' : 'post';
      await api[method](url, {
  ...clearanceForm,
  clearance_number: String(clearanceForm.clearance_number || ''),
  declared_value: parseFloat(clearanceForm.declared_value) || 0,
  import_tax: parseFloat(clearanceForm.import_tax) || 0,
  vat_rate: parseFloat(clearanceForm.vat_rate) || (taxSettings.vat_rate * 100),
  profit_tax_rate: parseFloat(clearanceForm.profit_tax_rate) || (taxSettings.profit_tax_rate * 100)
});
      setMessage(editingClearance ? '✅ تم تعديل الإفراج' : '✅ تم إضافة الإفراج');
      resetClearanceForm();
      setEditingClearance(null);
      fetchShipmentDetails(selectedShipment.id);
    } catch (err) { setMessage('❌ ' + (err.response?.data?.message || err.message)); }
    finally { setLoading(false); }
  };

  const resetClearanceForm = () => {
    setClearanceForm({
      clearance_number: '', clearance_date: new Date().toISOString().split('T')[0],
      declared_value: '', import_tax: '', is_vat_exempt: false,
      is_profit_tax_exempt: false, vat_rate: '', profit_tax_rate: '', notes: ''
    });
  };

  const startEditClearance = (c) => {
    setEditingClearance(c);
    setClearanceForm({
      clearance_number: c.clearance_number || '',
      clearance_date: c.clearance_date ? c.clearance_date.split('T')[0] : new Date().toISOString().split('T')[0],
      declared_value: c.declared_value || '', import_tax: c.import_tax || '',
      is_vat_exempt: c.is_vat_exempt || false, is_profit_tax_exempt: c.is_profit_tax_exempt || false,
      vat_rate: c.vat_rate || '', profit_tax_rate: c.profit_tax_rate || '', notes: c.notes || ''
    });
  };

    const handleUnlinkInvoice = async () => {
    if (!selectedShipment?.purchase_id) return;
    if (!window.confirm('هل أنت متأكد من فك ربط الفاتورة؟')) return;
    setLoading(true);
    try {
      await api.put(`/shipments/${selectedShipment.id}/unlink-invoice`);
      setMessage('✅ تم فك ربط الفاتورة');
      fetchShipmentDetails(selectedShipment.id);
      fetchPurchases();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // ✅ دي اللي ناقصة — رجّعها تاني
  const handleLinkInvoice = async (purchaseId) => {
    if (!selectedShipment) return;
    setLoading(true);
    try {
      await api.put(`/shipments/${selectedShipment.id}/link-invoice`, { purchase_id: purchaseId });
      setMessage('✅ تم ربط الفاتورة');
      fetchShipmentDetails(selectedShipment.id);
      fetchPurchases();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelShipment = async () => {
    if (!selectedShipment) return;
    if (selectedShipment.status === 'cancelled') return;
    if (!window.confirm(
      `هل أنت متأكد من إلغاء شحنة #${selectedShipment.shipment_number}؟\n\n` +
      `⚠️ هذا الإجراء لا يمكن التراجع عنه. الرقم سيتاح للاستخدام مرة أخرى.`
    )) return;

    setLoading(true);
    try {
      await api.put(`/shipments/${selectedShipment.id}/cancel`);
      setMessage('✅ تم إلغاء الشحنة وإتاحة رقمها للاستخدام');
      setSelectedShipment(null);
      fetchShipments();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };
    const handleCreateCustody = async (e) => {
    e.preventDefault();
    if (!selectedShipment) return;
    if (custodyForm.party_type === 'employee' && !custodyForm.employee_id) { setMessage('❌ اختر الموظف'); return; }
    if (custodyForm.party_type === 'service_provider' && !custodyForm.supplier_id) { setMessage('❌ اختر مورد الخدمة (المخلص)'); return; }
    setLoading(true);
    try {
      const employee = employees.find(emp => emp.id == custodyForm.employee_id);
      const supplier = suppliers.find(s => s.id == custodyForm.supplier_id);
      await api.post('/treasury', {
        transaction_type: 'custody_payment',
        transaction_number: custodyForm.custody_number || `CUST-${Date.now()}`,
        transaction_date: new Date().toISOString().split('T')[0],
        party_type: custodyForm.party_type,
        employee_id: custodyForm.party_type === 'employee' ? custodyForm.employee_id : null,
        employee_name: custodyForm.party_type === 'employee' ? (employee?.full_name || '') : '',
        supplier_id: custodyForm.party_type === 'service_provider' ? custodyForm.supplier_id : null,
        party_name: custodyForm.party_type === 'service_provider' ? (supplier?.name || '') : '',
        amount: custodyForm.amount,
        payment_method: custodyForm.payment_method,
        bank_name: custodyForm.bank_name || null,
        check_number: custodyForm.check_number || null,
        description: custodyForm.purpose || custodyForm.notes || 'عهدة تخليص جمركي',
        purpose: custodyForm.purpose || 'عهدة تخليص جمركي',
        shipment_id: selectedShipment.id
      });
      setMessage('✅ تم صرف العهدة بنجاح');
      setCustodyForm({ custody_number: '', party_type: 'service_provider', employee_id: '', supplier_id: '', amount: '', purpose: '', payment_method: 'cash', bank_name: '', check_number: '', notes: '' });
      fetchCustodies();
      fetchTreasury(); // ← عشان نحدث الخزينة
      fetchShipmentDetails(selectedShipment.id);
    } catch (err) { setMessage('❌ ' + (err.response?.data?.message || err.message)); }
    finally { setLoading(false); }
  };

  const handleAddSettlementExpense = () => {
    setSettlementExpenses([...settlementExpenses, {
      expense_date: new Date().toISOString().split('T')[0], expense_type: '', description: '',
      amount_egp: '', amount_usd: '', exchange_rate_usd: '', has_tax_invoice: false,
      tax_invoice_amount: '', vat_rate: 14, vat_amount: 0, withholding_rate: 0, withholding_amount: 0, net_amount: 0,
      notes: '', expense_category_id: '', is_tax_only: false, is_dummy: false
    }]);
  };

  const updateSettlementExpense = (idx, field, value) => {
    const updated = [...settlementExpenses];
    updated[idx][field] = value;
    if (field === 'tax_invoice_amount' || field === 'vat_rate') {
      const base = parseFloat(updated[idx].tax_invoice_amount) || parseFloat(updated[idx].amount_egp) || 0;
      const vatRate = parseFloat(updated[idx].vat_rate) || 0;
      updated[idx].vat_amount = (base * vatRate / 100).toFixed(2);
      updated[idx].net_amount = (base + parseFloat(updated[idx].vat_amount)).toFixed(2);
    }
    if (field === 'amount_usd' && updated[idx].exchange_rate_usd) {
      updated[idx].amount_egp = (parseFloat(value || 0) * parseFloat(updated[idx].exchange_rate_usd)).toFixed(2);
    }
    setSettlementExpenses(updated);
  };

  const removeSettlementExpense = (idx) => {
    setSettlementExpenses(settlementExpenses.filter((_, i) => i !== idx));
  };

  const handleSubmitSettlement = async (custodyId) => {
    if (!selectedShipment || !custodyId || settlementExpenses.length === 0) return;
    setLoading(true);
    try {
      await api.post(`/shipments/${selectedShipment.id}/custody-settlement`, {
    custody_id: custodyId,
    expenses: settlementExpenses
  });  // ← دول لازم يكونوا موجودين!
  setMessage('✅ تم تسوية العهدة بنجاح');
      setSettlementExpenses([]);
      fetchCustodies();
      fetchShipmentDetails(selectedShipment.id);
    } catch (err) { setMessage('❌ ' + (err.response?.data?.message || err.message)); }
    finally { setLoading(false); }
  };

  const handleRecalculateCost = async () => {
    if (!selectedShipment) return;
    setLoading(true);
    try {
      const res = await api.put(`/shipments/${selectedShipment.id}/recalculate-cost`);
      setMessage(`✅ تم إعادة حساب التكلفة: ${res.data.total_cost_egp.toLocaleString()} ج.م`);
      fetchShipmentDetails(selectedShipment.id);
    } catch (err) { setMessage('❌ ' + (err.response?.data?.message || err.message)); }
    finally { setLoading(false); }
  };

  const fetchCostCalculation = async () => {
    if (!selectedShipment) return;
    try { const res = await api.get(`/shipments/${selectedShipment.id}/cost-calculation`); setCostCalculation(res.data); }
    catch (err) { console.error(err); }
  };
  const handleAmountChange = (field, value) => {
    const usdRate = parseFloat(expenseForm.exchange_rate_usd) || 0;
    const eurRate = parseFloat(expenseForm.exchange_rate_eur) || 0;
    const numVal = parseFloat(value);

    let updates = { [field]: value };

    if (!value || isNaN(numVal) || numVal === 0) {
      updates = { amount_egp: '', amount_usd: '', amount_eur: '' };
    } else if (usdRate > 0 && eurRate > 0) {
      if (field === 'amount_egp') {
        updates.amount_usd = (numVal / usdRate).toFixed(2);
        updates.amount_eur = (numVal / eurRate).toFixed(2);
      } else if (field === 'amount_usd') {
        const egp = numVal * usdRate;
        updates.amount_egp = egp.toFixed(2);
        updates.amount_eur = (egp / eurRate).toFixed(2);
      } else if (field === 'amount_eur') {
        const egp = numVal * eurRate;
        updates.amount_egp = egp.toFixed(2);
        updates.amount_usd = (egp / usdRate).toFixed(2);
      }
    }

    setExpenseForm(prev => ({ ...prev, ...updates }));
  };

    const calculateExpenseTotal = () => {
    const egp = parseFloat(expenseForm.amount_egp) || 0;
    const other = (parseFloat(expenseForm.amount_other) || 0) * (parseFloat(expenseForm.exchange_rate_other) || 0);
    return (egp + other).toFixed(2);
  };

  const expenseTypes = ['تدبير بنك','عمولة بنك','شحن بحري','شحن جوي','شحن بري','جمارك','تخليص جمركي','نقل','سياسات','تأمين شحن','رسوم ميناء','تفريغ','أرضيات','ضريبة','أخرى'];
  const shippingMethods = ['بحري','جوي','بري'];
  const shipmentTypes = [
    { value: 'commercial', label: 'تجاري (يظهر في المخزون)' },
    { value: 'tax_only', label: 'ضريبي فقط (لا يظهر في المخزون)' },
    { value: 'dummy', label: 'وهمي (للتخلص من الضريبة)' }
  ];

  const getStatusBadge = (status) => {
    const map = {
      open: { bg: isDark ? '#1e3a5f' : '#dbeafe', text: isDark ? '#93c5fd' : '#1e40af', label: 'مفتوحة' },
      in_progress: { bg: isDark ? '#451a03' : '#fef3c7', text: isDark ? '#fcd34d' : '#92400e', label: 'قيد التنفيذ' },
      arrived: { bg: isDark ? '#064e3b' : '#d1fae5', text: isDark ? '#6ee7b7' : '#065f46', label: 'واصلة' },
      cleared: { bg: isDark ? '#3b0764' : '#f3e8ff', text: isDark ? '#d8b4fe' : '#7e22ce', label: 'مفرّغة' },
      linked: { bg: isDark ? '#1e1b4b' : '#e0e7ff', text: isDark ? '#a5b4fc' : '#3730a3', label: 'مرتبطة' },
      closed: { bg: isDark ? '#1c1917' : '#f3f4f6', text: isDark ? '#a8a29e' : '#374151', label: 'مغلقة' },
      cancelled: { bg: isDark ? '#7f1d1d' : '#fee2e2', text: isDark ? '#fca5a5' : '#991b1b', label: 'ملغاة' }
    };
    const s = map[status] || map.open;
    return <span style={{ background: s.bg, color: s.text, padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>{s.label}</span>;
  };

  const getShipmentTypeBadge = (type) => {
    const map = {
      commercial: { bg: isDark ? '#064e3b' : '#d1fae5', text: isDark ? '#6ee7b7' : '#065f46', label: 'تجاري' },
      tax_only: { bg: isDark ? '#1e3a5f' : '#dbeafe', text: isDark ? '#93c5fd' : '#1e40af', label: 'ضريبي' },
      dummy: { bg: isDark ? '#7f1d1d' : '#fee2e2', text: isDark ? '#fca5a5' : '#991b1b', label: 'وهمي' }
    };
    const s = map[type] || map.commercial;
    return <span style={{ background: s.bg, color: s.text, padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', marginRight: '6px' }}>{s.label}</span>;
  };

  const tabLabels = [
    { id: 'info', label: '📋 معلومات' },
    { id: 'expenses', label: '💰 المصاريف' },
    { id: 'clearance', label: '🏛️ الإفراج' },
    { id: 'clearance-settlement', label: '📋 تسوية المخلص' },
    { id: 'attachments', label: '📎 المرفقات' },
    { id: 'invoice', label: '🧾 الفواتير' },
    { id: 'supplier-payments', label: '💳 سداد المورد' },
    { id: 'cost', label: '🧮 التكلفة' }
  ];
  const mainCategories = expenseCategories.filter(ec => ec.parent_id === null);
  const subCategories = expenseCategories.filter(ec => ec.parent_id !== null);
  const inp = (extra = {}) => ({ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${inputBorder}`, background: inputBg, color: textColor, fontSize: '13px', boxSizing: 'border-box', ...extra });
  const thSt = { padding: '10px 8px', textAlign: 'right', fontWeight: '600', fontSize: '12px' };
  const tdSt = { padding: '10px 8px', textAlign: 'right' };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl', background: bgColor, minHeight: '100vh', color: textColor }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => navigate('/purchases-module')} style={{ padding: '10px 20px', background: isDark ? '#334155' : '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>← رجوع</button>
          <h1 style={{ color: '#0d9488', margin: 0 }}>📦 إدارة الشحنات</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={() => navigate('/tax-settings')} style={{ padding: '8px 16px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>⚙️ إعدادات الضرائب</button>
          <button onClick={openExpensePicker} style={{ padding: '8px 16px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>🔄 استدعاء مصروف</button>
          <ThemeToggle />
        </div>
      </div>

      {/* Message */}
      {message && (
        <div style={{ padding: '12px 16px', marginBottom: '16px', borderRadius: '8px', background: message.startsWith('✅') ? (isDark ? '#064e3b' : '#d1fae5') : (isDark ? '#7f1d1d' : '#fee2e2'), color: message.startsWith('✅') ? (isDark ? '#6ee7b7' : '#065f46') : (isDark ? '#fca5a5' : '#991b1b') }}>
          {message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
        {/* القائمة الجانبية */}
        <div style={{ background: cardBg, borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: `1px solid ${borderColor}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '18px' }}>الشحنات</h2>
            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${inputBorder}`, background: inputBg, color: textColor }}>
              <option value={2026}>2026</option><option value={2025}>2025</option><option value={2024}>2024</option>
            </select>
          </div>

          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {shipments.filter(s => s.status !== 'cancelled').map(s => (
              <div key={s.id} onClick={() => fetchShipmentDetails(s.id)} style={{
                padding: '12px', marginBottom: '8px', borderRadius: '8px', cursor: 'pointer',
                border: selectedShipment?.id === s.id ? '2px solid #0d9488' : `1px solid ${borderColor}`,
                background: selectedShipment?.id === s.id ? (isDark ? '#134e4a' : '#f0fdfa') : 'transparent'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold' }}>شحنة #{s.shipment_number}</span>
                  {getStatusBadge(s.status)}
                </div>
                <div style={{ fontSize: '13px', color: subTextColor, marginTop: '4px' }}>
                  {getShipmentTypeBadge(s.shipment_type)}
                  {s.supplier_name || 'بدون مورد'}
                </div>
                <div style={{ fontSize: '12px', color: subTextColor, marginTop: '4px' }}>المصاريف: {parseFloat(s.total_expenses_egp || 0).toLocaleString()} ج.م</div>
                {s.is_dummy && <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '2px' }}>⚠️ شحنة وهمية</div>}
              </div>
            ))}
            {shipments.length === 0 && <div style={{ textAlign: 'center', color: subTextColor, padding: '20px' }}>لا توجد شحنات</div>}
          </div>

          <button onClick={getNextNumber} style={{ width: '100%', marginTop: '12px', padding: '10px', background: '#0d9488', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>➕ شحنة جديدة</button>
        </div>

        {/* المحتوى الرئيسي */}
        <div>
          {/* نموذج شحنة جديدة */}
          {((shipmentForm.shipment_number && !selectedShipment) || (selectedShipment && isEditingShipment)) && (
            <div style={{ background: cardBg, borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: `1px solid ${borderColor}` }}>
              <h3 style={{ marginTop: 0 }}>{isEditingShipment ? '✏️ تعديل شحنة' : '🆕 شحنة جديدة'} #{shipmentForm.shipment_number}</h3>
              <form onSubmit={selectedShipment ? handleUpdateShipment : handleCreateShipment}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: '500' }}>نوع الشحنة</label>
                    <select value={shipmentForm.shipment_type} onChange={(e) => setShipmentForm({...shipmentForm, shipment_type: e.target.value, is_dummy: e.target.value === 'dummy'})} style={inp()}>
                      {shipmentTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: '500' }}>المورد</label>
                    <select value={shipmentForm.supplier_id} onChange={(e) => setShipmentForm({...shipmentForm, supplier_id: e.target.value})} style={inp()}>
                      <option value="">اختر المورد</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: '500' }}>بلد المنشأ</label>
                    <input type="text" value={shipmentForm.country_of_origin} onChange={(e) => setShipmentForm({...shipmentForm, country_of_origin: e.target.value})} placeholder="مثال: الصين" style={inp()} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: '500' }}>طريقة الشحن</label>
                    <select value={shipmentForm.shipping_method} onChange={(e) => setShipmentForm({...shipmentForm, shipping_method: e.target.value})} style={inp()}>
                      <option value="">اختر</option>
                      {shippingMethods.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: '500' }}>تاريخ الوصول المتوقع</label>
                    <input type="date" value={shipmentForm.expected_arrival} onChange={(e) => setShipmentForm({...shipmentForm, expected_arrival: e.target.value})} style={inp()} />
                  </div>
                  {shipmentForm.shipment_type === 'dummy' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: '500' }}>الشحنة باسم (اختياري)</label>
                      <select value={shipmentForm.dummy_for_user_id} onChange={(e) => setShipmentForm({...shipmentForm, dummy_for_user_id: e.target.value})} style={inp()}>
                        <option value="">بدون</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div style={{ marginTop: '12px' }}>
                  <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: '500' }}>ملاحظات</label>
                  <textarea value={shipmentForm.notes} onChange={(e) => setShipmentForm({...shipmentForm, notes: e.target.value})} rows="2" style={inp()} />
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <button type="submit" disabled={loading} style={{ padding: '10px 24px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>{loading ? 'جاري...' : (isEditingShipment ? '💾 حفظ التعديل' : '💾 حفظ')}</button>
                  <button type="button" onClick={() => { setIsEditingShipment(false); setShipmentForm({ shipment_number: '', supplier_id: '', country_of_origin: '', shipping_method: '', expected_arrival: '', notes: '', shipment_type: 'commercial', is_dummy: false, dummy_for_user_id: '' }); }} style={{ padding: '10px 16px', background: isDark ? '#475569' : '#e5e7eb', color: textColor, border: 'none', borderRadius: '8px', cursor: 'pointer' }}>إلغاء</button>
                </div>
              </form>
            </div>
          )}

          {/* تفاصيل الشحنة */}
          {selectedShipment && (
            <div style={{ background: cardBg, borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: `1px solid ${borderColor}` }}>
              {/* رأس الشحنة */}
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${borderColor}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <h2 style={{ margin: 0 }}>شحنة #{selectedShipment.shipment_number} - {selectedShipment.shipment_year}</h2>
                      {getShipmentTypeBadge(selectedShipment.shipment_type)}
                      {selectedShipment.is_dummy && <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 'bold' }}>⚠️ وهمية</span>}
                    </div>
                    <div style={{ fontSize: '14px', color: subTextColor }}>
                      المورد: {selectedShipment.supplier_name || '---'} | الحالة: {getStatusBadge(selectedShipment.status)} | الفاتورة: {selectedShipment.invoice_number || 'غير مربوطة'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '13px', color: subTextColor }}>إجمالي المصاريف</div>
                    <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#0d9488' }}>{parseFloat(selectedShipment.total_expenses_egp || 0).toLocaleString()} ج.م</div>
                  </div>
                </div>
              </div>

              {/* التبويبات */}
              <div style={{ display: 'flex', borderBottom: `1px solid ${borderColor}`, overflowX: 'auto' }}>
                {tabLabels.map(tab => (
                  <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === 'cost') fetchCostCalculation(); }}
                    style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap', border: 'none', borderBottom: activeTab === tab.id ? '3px solid #0d9488' : '3px solid transparent', background: activeTab === tab.id ? (isDark ? '#134e4a' : '#f0fdfa') : 'transparent', color: activeTab === tab.id ? '#0d9488' : subTextColor, cursor: 'pointer' }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* محتوى التبويب */}
              <div style={{ padding: '20px' }}>

                {/* تبويب المعلومات */}
                {activeTab === 'info' && (
  <div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '12px' }}>
      {selectedShipment.status !== 'cancelled' && (
        <button 
          onClick={handleCancelShipment}
          disabled={loading}
          style={{ 
            padding: '8px 16px', 
            background: '#ef4444', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px', 
            cursor: 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          ❌ إلغاء الشحنة
        </button>
      )}
      <button 
        onClick={() => {
          setIsEditingShipment(true);
          setShipmentForm({
            shipment_number: selectedShipment.shipment_number,
            supplier_id: selectedShipment.supplier_id || '',
            country_of_origin: selectedShipment.country_of_origin || '',
            shipping_method: selectedShipment.shipping_method || '',
            expected_arrival: selectedShipment.expected_arrival ? selectedShipment.expected_arrival.split('T')[0] : '',
            notes: selectedShipment.notes || '',
            shipment_type: selectedShipment.shipment_type || 'commercial',
            is_dummy: selectedShipment.is_dummy || false,
            dummy_for_user_id: selectedShipment.dummy_for_user_id || ''
          });
        }}
        style={{ padding: '8px 16px', background: '#0d9488', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
      >
        ✏️ تعديل بيانات الشحنة
      </button>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {[
                        { label: 'نوع الشحنة', value: shipmentTypes.find(t => t.value === selectedShipment.shipment_type)?.label || selectedShipment.shipment_type },
                        { label: 'بلد المنشأ', value: selectedShipment.country_of_origin || '---' },
                        { label: 'طريقة الشحن', value: selectedShipment.shipping_method || '---' },
                        { label: 'تاريخ الفتح', value: selectedShipment.open_date ? new Date(selectedShipment.open_date).toLocaleDateString('ar-EG') : '---' },
                        { label: 'تاريخ الوصول المتوقع', value: selectedShipment.expected_arrival ? new Date(selectedShipment.expected_arrival).toLocaleDateString('ar-EG') : '---' },
                        { label: 'تاريخ الوصول الفعلي', value: selectedShipment.actual_arrival ? new Date(selectedShipment.actual_arrival).toLocaleDateString('ar-EG') : '---' },
                        { label: 'معامل التحويل الفعلي', value: selectedShipment.actual_exchange_rate > 0 ? parseFloat(selectedShipment.actual_exchange_rate).toFixed(4) + ' ج/دولار' : 'غير محسوب', highlight: true },
                        { label: 'الشحنة باسم', value: selectedShipment.dummy_for_user_id ? (users.find(u => u.id === selectedShipment.dummy_for_user_id)?.full_name || '---') : 'الشركة' }
                      ].map((item, i) => (
                        <div key={i} style={{ background: hoverBg, padding: '12px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '13px', color: subTextColor, marginBottom: '4px' }}>{item.label}</div>
                          <div style={{ fontWeight: '500', color: item.highlight ? '#0d9488' : textColor }}>{item.value}</div>
                        </div>
                      ))}
                      {selectedShipment.notes && (
                        <div style={{ gridColumn: '1 / -1', background: isDark ? '#451a03' : '#fef3c7', padding: '12px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '13px', color: subTextColor }}>ملاحظات</div>
                          <div>{selectedShipment.notes}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* تبويب المصاريف */}
                {activeTab === 'expenses' && (
                  <div>
                    {/* ملخص تسوية العهدات */}
                    {selectedShipment.expenses?.some(e => e.custody_id) && (
                      <div style={{ background: isDark ? '#451a03' : '#fef3c7', padding: '16px', borderRadius: '10px', marginBottom: '16px', border: `1px solid ${isDark ? '#92400e' : '#fcd34d'}` }}>
                        <h4 style={{ margin: '0 0 12px 0', color: isDark ? '#fcd34d' : '#92400e' }}>📋 ملخص تسوية العهدات</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                          {(() => {
                            const custodyGroups = {};
                            selectedShipment.expenses.filter(e => e.custody_id).forEach(e => {
                              const cid = e.custody_id;
                              const cname = e.custody_number || 'عهدة';
                              if (!custodyGroups[cid]) custodyGroups[cid] = { number: cname, total: 0, count: 0, taxTotal: 0, actual: 0, dummy: 0 };
custodyGroups[cid].total += parseFloat(e.total_egp || 0);  // ← ده اللى ناقص
custodyGroups[cid].count += 1;
if (e.is_dummy) custodyGroups[cid].dummy += parseFloat(e.total_egp || 0);
                              else custodyGroups[cid].actual += parseFloat(e.total_egp || 0);
                              if (e.has_tax_invoice) custodyGroups[cid].taxTotal += parseFloat(e.tax_invoice_amount || e.total_egp || 0);
                            });
                            return Object.entries(custodyGroups).map(([cid, data]) => (
                              <div key={cid} style={{ background: isDark ? '#1c1917' : '#fffbeb', padding: '12px', borderRadius: '8px' }}>
                                <div style={{ fontSize: '13px', color: subTextColor }}>العهدة: <strong>{data.number}</strong></div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0d9488', marginTop: '4px' }}>{data.total.toLocaleString()} ج.م</div>
                                <div style={{ fontSize: '12px', color: subTextColor, marginTop: '4px' }}>فعلي: {data.actual.toLocaleString()} | وهمي: {data.dummy.toLocaleString()}</div>
                                <div style={{ fontSize: '12px', color: '#8b5cf6' }}>ضريبي: {data.taxTotal.toLocaleString()} | عدد: {data.count}</div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                    <form onSubmit={handleAddExpense} style={{ background: hoverBg, padding: '16px', borderRadius: '10px', marginBottom: '16px', border: editingExpense ? '2px solid #0d9488' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <h4 style={{ margin: 0 }}>{editingExpense ? '✏️ تعديل مصروف' : '➕ إضافة مصروف'}</h4>
                        <button
                          type="button"
                          onClick={openExpensePicker}
                          style={{ padding: '8px 14px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                        >
                          🔄 استدعاء مصروف من الخزينة/البنك
                        </button>
                      </div>

                      {/* نوع المصروف و الوهمي */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
  <div>
    <label style={{ fontSize: '12px', fontWeight: '500' }}>فئة المصروف (رئيسي)</label>
    <select 
      value={expenseForm.expense_category_id} 
      onChange={(e) => setExpenseForm({
        ...expenseForm, 
        expense_category_id: e.target.value,
        expense_type: ''  // نفضي الفرعي لما يغير الرئيسي
      })} 
      style={inp()}
    >
      <option value="">اختر الفئة</option>
      {mainCategories.map(ec => <option key={ec.id} value={ec.id}>{ec.category_name}</option>)}
    </select>
  </div>
  <div>
    <label style={{ fontSize: '12px', fontWeight: '500' }}>نوع المصروف (فرعي)</label>
    <select 
      value={expenseForm.expense_type} 
      onChange={(e) => setExpenseForm({...expenseForm, expense_type: e.target.value})} 
      style={inp()}
      disabled={!expenseForm.expense_category_id}
    >
      <option value="">اختر النوع</option>
      {subCategories
        .filter(sc => sc.parent_id == expenseForm.expense_category_id)
        .map(ec => <option key={ec.id} value={ec.category_name}>{ec.category_name}</option>)
      }
    </select>
  </div>
                                                    <div>
                          <label style={{ fontSize: '12px', fontWeight: '500' }}>التاريخ</label>
                          <input type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm({...expenseForm, expense_date: e.target.value})} style={inp()} />
                      </div>
</div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: '500' }}>المورد (للسداد)</label>
                          <select value={expenseForm.supplier_id} onChange={(e) => setExpenseForm({...expenseForm, supplier_id: e.target.value})} style={inp()}>
                            <option value="">بدون مورد</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: '500' }}>طريقة السداد</label>
                          <select value={expenseForm.payment_method} onChange={(e) => setExpenseForm({...expenseForm, payment_method: e.target.value})} style={inp()}>
                            <option value="cash">💵 نقدي</option>
                            <option value="bank">🏦 بنكي</option>
                            <option value="check">📝 شيك</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '10px' }}>
                        <div><label style={{ fontSize: '12px', fontWeight: '500' }}>💷 جنيه (EGP)</label><input type="number" step="0.01" value={expenseForm.amount_egp} onChange={(e) => handleAmountChange('amount_egp', e.target.value)} placeholder="0.00" style={inp()} /></div>
<div><label style={{ fontSize: '12px', fontWeight: '500' }}>💵 دولار (USD)</label><input type="number" step="0.01" value={expenseForm.amount_usd} onChange={(e) => handleAmountChange('amount_usd', e.target.value)} placeholder="0.00" style={inp()} /></div>
<div><label style={{ fontSize: '12px', fontWeight: '500' }}>💶 يورو (EUR)</label><input type="number" step="0.01" value={expenseForm.amount_eur} onChange={(e) => handleAmountChange('amount_eur', e.target.value)} placeholder="0.00" style={inp()} /></div>
                        <div><label style={{ fontSize: '12px', fontWeight: '500' }}>عملة أخرى</label><div style={{ display: 'flex', gap: '6px' }}><input type="number" step="0.01" value={expenseForm.amount_other} onChange={(e) => setExpenseForm({...expenseForm, amount_other: e.target.value})} placeholder="0.00" style={{...inp(), flex: 1}} /><input type="text" value={expenseForm.other_currency} onChange={(e) => setExpenseForm({...expenseForm, other_currency: e.target.value})} placeholder="CNY" style={{...inp(), width: '60px'}} /></div></div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '10px' }}>
                        <div><label style={{ fontSize: '12px', fontWeight: '500' }}>سعر الدولار (1 USD = ? EGP)</label><input type="number" step="0.0001" value={expenseForm.exchange_rate_usd} onChange={(e) => handleRateChange('exchange_rate_usd', e.target.value)} placeholder="مثال: 50.50" style={inp()} /></div>
                        <div><label style={{ fontSize: '12px', fontWeight: '500' }}>سعر اليورو (1 EUR = ? EGP)</label><input type="number" step="0.0001" value={expenseForm.exchange_rate_eur} onChange={(e) => handleRateChange('exchange_rate_eur', e.target.value)} placeholder="مثال: 55.20" style={inp()} /></div>
                        <div><label style={{ fontSize: '12px', fontWeight: '500' }}>سعر العملة الأخرى</label><input type="number" step="0.0001" value={expenseForm.exchange_rate_other} onChange={(e) => setExpenseForm({...expenseForm, exchange_rate_other: e.target.value})} placeholder="0.00" style={inp()} /></div>
                        <div><label style={{ fontSize: '12px', fontWeight: '500' }}>💡 الإجمالي (ج.م)</label><div style={{ padding: '8px', background: isDark ? '#064e3b' : '#d1fae5', borderRadius: '6px', fontWeight: 'bold', color: isDark ? '#6ee7b7' : '#065f46' }}>{calculateExpenseTotal()}</div></div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                        <div><label style={{ fontSize: '12px', fontWeight: '500' }}>ربط بسند خزينة/بنك</label><select value={expenseForm.treasury_id} onChange={(e) => setExpenseForm({...expenseForm, treasury_id: e.target.value})} style={inp()}><option value="">بدون ربط</option>{treasuryList.map(t => <option key={t.id} value={t.id}>{t.transaction_number} - {(t.description || '').substring(0, 30)}</option>)}</select></div>
                        <div><label style={{ fontSize: '12px', fontWeight: '500' }}>ربط بعهدة</label><select value={expenseForm.custody_id} onChange={(e) => setExpenseForm({...expenseForm, custody_id: e.target.value})} style={inp()}><option value="">بدون ربط</option>{custodyList.map(c => <option key={c.id} value={c.id}>{c.custody_number} - {c.employee_name}</option>)}</select></div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={expenseForm.has_tax_invoice} onChange={(e) => setExpenseForm({...expenseForm, has_tax_invoice: e.target.checked})} />
                          فاتورة ضريبية
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer', color: '#ef4444' }}>
                          <input type="checkbox" checked={expenseForm.is_dummy} onChange={(e) => setExpenseForm({...expenseForm, is_dummy: e.target.checked})} />
                          ⚠️ مصروف وهمي (للضرائب فقط)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer', color: '#7c3aed' }}>
                          <input type="checkbox" checked={expenseForm.is_tax_only} onChange={(e) => setExpenseForm({...expenseForm, is_tax_only: e.target.checked})} />
                          ضريبي فقط (لا يحسب في التكلفة)
                        </label>
                      </div>

                      {expenseForm.has_tax_invoice && (
                        <div style={{ marginBottom: '10px' }}>
                          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                            <input type="text" value={expenseForm.tax_invoice_number} onChange={(e) => setExpenseForm({...expenseForm, tax_invoice_number: e.target.value})} placeholder="رقم الفاتورة" style={{...inp(), width: '160px'}} />
                            <input type="number" value={expenseForm.tax_invoice_amount} onChange={(e) => setExpenseForm({...expenseForm, tax_invoice_amount: e.target.value})} placeholder="مبلغ الفاتورة" style={{...inp(), width: '120px'}} />
                           <select value={expenseForm.vat_rate} onChange={(e) => handleTaxChange('vat_rate', e.target.value)} style={{...inp(), width: '130px'}}>
  <option value="0">0% (معفاة)</option>
  <option value="14">14%</option>
</select>
<select value={expenseForm.withholding_rate} onChange={(e) => handleTaxChange('withholding_rate', e.target.value)} style={{...inp(), width: '150px'}}>
  <option value="0">بدون خصم</option>
  <option value="1">1% (أرباح تجارية)</option>
  <option value="3">3%</option>
  <option value="5">5%</option>
</select>
                          </div>
                          
                          {/* حقول الضريبة المحسوبة */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: '500' }}>مبلغ VAT</label>
                              <input type="text" value={expenseForm.vat_amount} readOnly style={{...inp(), background: isDark ? '#0f172a' : '#e2e8f0'}} />
                            </div>
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: '500' }}>مبلغ الخصم</label>
                              <input type="text" value={expenseForm.withholding_amount} readOnly style={{...inp(), background: isDark ? '#0f172a' : '#e2e8f0'}} />
                            </div>
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: '500', color: '#0d9488' }}>الصافي</label>
                              <input type="text" value={expenseForm.net_amount} readOnly style={{...inp(), fontWeight: 'bold', color: '#0d9488', background: isDark ? '#0f172a' : '#e2e8f0'}} />
                            </div>
                          </div>

                                                    {(() => {
                            const invAmt = parseFloat(expenseForm.tax_invoice_amount) || 0;
                            const vatAmt = invAmt * (parseFloat(expenseForm.vat_rate) || 0) / 100;
                            const whAmt = invAmt * (parseFloat(expenseForm.withholding_rate) || 0) / 100;
                            if (invAmt > 0 && (vatAmt > 0 || whAmt > 0)) {
                              return (
                                <div style={{ display: 'flex', gap: '16px', fontSize: '13px', padding: '8px 12px', background: isDark ? '#1e3a5f' : '#dbeafe', borderRadius: '6px' }}>
                                  {vatAmt > 0 && <span style={{ color: isDark ? '#93c5fd' : '#1e40af' }}>📋 VAT: <strong>{vatAmt.toFixed(2)}</strong> ج.م</span>}
                                  {whAmt > 0 && <span style={{ color: '#dc2626' }}>✂️ خصم: <strong>{whAmt.toFixed(2)}</strong> ج.م</span>}
                                  <span style={{ color: '#059669' }}>💰 صافي: <strong>{(invAmt + vatAmt - whAmt).toFixed(2)}</strong> ج.م</span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="submit" disabled={loading} style={{ padding: '10px 20px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>{loading ? 'جاري...' : (editingExpense ? '💾 حفظ التعديل' : '➕ إضافة المصروف')}</button>
                        {editingExpense && <button type="button" onClick={() => { resetExpenseForm(); setEditingExpense(null); }} style={{ padding: '10px 16px', background: isDark ? '#475569' : '#e5e7eb', color: textColor, border: 'none', borderRadius: '8px', cursor: 'pointer' }}>إلغاء التعديل</button>}
                      </div>
                    </form>

                    {/* جدول المصاريف */}
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                                                <thead><tr style={{ background: isDark ? '#334155' : '#f1f5f9' }}>
                          <th style={thSt}>#</th><th style={thSt}>التاريخ</th><th style={thSt}>النوع</th><th style={thSt}>الفئة</th><th style={thSt}>EGP</th><th style={thSt}>USD</th><th style={thSt}>EUR</th><th style={thSt}>إجمالي</th><th style={thSt}>الفاتورة</th><th style={thSt}>VAT</th><th style={thSt}>خصم</th><th style={thSt}>حالة</th><th style={thSt}></th>
                        </tr></thead>
                        <tbody>
                          {selectedShipment.expenses?.map((exp, idx) => (
                            <tr key={exp.id} style={{ borderBottom: `1px solid ${borderColor}`, background: exp.is_dummy ? (isDark ? '#3f1010' : '#fef2f2') : 'transparent' }}>
                              <td style={tdSt}>{idx + 1}</td>
                              <td style={tdSt}>{new Date(exp.expense_date).toLocaleDateString('ar-EG')}</td>
                              <td style={tdSt}>{exp.expense_type}</td>
                                                                                          <td style={tdSt}>{exp.category_name || '---'}</td>
                              <td style={tdSt}>{parseFloat(exp.amount_egp || 0).toLocaleString()}</td>
                              <td style={tdSt}>{parseFloat(exp.amount_usd || 0).toLocaleString()}</td>
                              <td style={tdSt}>{parseFloat(exp.amount_eur || 0).toLocaleString()}</td>
                              <td style={{...tdSt, fontWeight: 'bold', color: exp.is_dummy ? '#ef4444' : '#0d9488'}}>{parseFloat(exp.total_egp || 0).toLocaleString()}</td>
                              <td style={tdSt}>
                                {exp.has_tax_invoice && (
                                  <div style={{ fontSize: '11px' }}>
                                    <span style={{ background: '#2563eb', color: 'white', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginBottom: '2px' }}>فاتورة {exp.tax_invoice_number || '---'}</span>
                                    {parseFloat(exp.vat_rate) > 0 && <span style={{ background: '#7c3aed', color: 'white', padding: '2px 6px', borderRadius: '4px', marginRight: '4px', display: 'inline-block' }}>VAT {exp.vat_rate}%</span>}
                                    {parseFloat(exp.withholding_rate) > 0 && <span style={{ background: '#dc2626', color: 'white', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>خصم {exp.withholding_rate}%</span>}
                                  </div>
                                )}
                                {!exp.has_tax_invoice && <span style={{ fontSize: '11px', color: subTextColor }}>---</span>}
                              </td>
                              <td style={tdSt}>{exp.vat_amount ? parseFloat(exp.vat_amount).toLocaleString() : '---'}</td>
                              <td style={tdSt}>{exp.withholding_amount ? parseFloat(exp.withholding_amount).toLocaleString() : '---'}</td>
                              
                              <td style={tdSt}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {exp.is_dummy && <span style={{ fontSize: '10px', background: '#ef4444', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>وهمي</span>}
                                  {exp.is_tax_only && <span style={{ fontSize: '10px', background: '#7c3aed', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>ضريبي</span>}
                                  {exp.custody_id && <span style={{ fontSize: '10px', background: isDark ? '#451a03' : '#fef3c7', color: isDark ? '#fcd34d' : '#92400e', padding: '2px 6px', borderRadius: '4px' }}>عهدة</span>}
                                  {exp.treasury_id && <span style={{ fontSize: '10px', background: isDark ? '#064e3b' : '#d1fae5', color: isDark ? '#6ee7b7' : '#065f46', padding: '2px 6px', borderRadius: '4px' }}>خزينة</span>}
                                  {exp.supplier_id && <span style={{ fontSize: '10px', background: '#0d9488', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>مورد</span>}
                                  {exp.payment_method === 'bank' && <span style={{ fontSize: '10px', background: '#2563eb', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>🏦</span>}
                                </div>
                              </td>
                              <td style={tdSt}>
                                <button onClick={() => startEditExpense(exp)} style={{ background: 'none', border: 'none', color: '#0d9488', cursor: 'pointer', fontSize: '16px', marginLeft: '8px' }} title="تعديل">✏️</button>
                                <button onClick={async () => { if (!window.confirm('هل تريد حذف هذا المصروف؟')) return; try { await api.delete(`/shipments/${selectedShipment.id}/expenses/${exp.id}`); fetchShipmentDetails(selectedShipment.id); } catch (err) { setMessage('❌ خطأ في الحذف'); } }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }} title="حذف">🗑️</button>
                              </td>
                            </tr>
                          ))}
                          {(!selectedShipment.expenses || selectedShipment.expenses.length === 0) && <tr><td colSpan="13" style={{ textAlign: 'center', padding: '20px', color: subTextColor }}>لا توجد مصاريف</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* تبويب الإفراج */}
                {activeTab === 'clearance' && (
                  <div>
                    <form onSubmit={handleAddClearance} style={{ background: hoverBg, padding: '16px', borderRadius: '10px', marginBottom: '16px', border: editingClearance ? '2px solid #0d9488' : 'none' }}>
                      <h4 style={{ margin: '0 0 12px 0' }}>{editingClearance ? '✏️ تعديل إفراج' : '🏛️ إضافة إفراج جمركي'}</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        <div><label style={{ fontSize: '12px', fontWeight: '500' }}>رقم الإفراج (من الجمارك)</label><input type="text" value={clearanceForm.clearance_number} onChange={(e) => setClearanceForm({...clearanceForm, clearance_number: e.target.value})} required style={inp()} /></div>
                        <div><label style={{ fontSize: '12px', fontWeight: '500' }}>التاريخ</label><input type="date" value={clearanceForm.clearance_date} onChange={(e) => setClearanceForm({...clearanceForm, clearance_date: e.target.value})} style={inp()} /></div>
                        <div><label style={{ fontSize: '12px', fontWeight: '500' }}>القيمة المقرعنة</label><input type="number" step="0.01" value={clearanceForm.declared_value} onChange={(e) => setClearanceForm({...clearanceForm, declared_value: e.target.value})} placeholder="0.00" style={inp()} /></div>
                        <div><label style={{ fontSize: '12px', fontWeight: '500' }}>ضريبة وارد</label><input type="number" step="0.01" value={clearanceForm.import_tax} onChange={(e) => setClearanceForm({...clearanceForm, import_tax: e.target.value})} placeholder="0.00" style={inp()} /></div>
                        <div><label style={{ fontSize: '12px', fontWeight: '500' }}>نسبة VAT % (افتراضي: {(taxSettings.vat_rate * 100).toFixed(0)}%)</label><input type="number" step="0.01" value={clearanceForm.vat_rate} onChange={(e) => setClearanceForm({...clearanceForm, vat_rate: e.target.value})} placeholder={taxSettings.vat_rate} style={inp()} /></div>
                        <div><label style={{ fontSize: '12px', fontWeight: '500' }}>نسبة أرباح % (افتراضي: {(taxSettings.profit_tax_rate * 100).toFixed(0)}%)</label><input type="number" step="0.01" value={clearanceForm.profit_tax_rate} onChange={(e) => setClearanceForm({...clearanceForm, profit_tax_rate: e.target.value})} placeholder={taxSettings.profit_tax_rate} style={inp()} /></div>
                      </div>
                      <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={clearanceForm.is_vat_exempt} onChange={(e) => setClearanceForm({...clearanceForm, is_vat_exempt: e.target.checked})} />
                          معفاة من VAT
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={clearanceForm.is_profit_tax_exempt} onChange={(e) => setClearanceForm({...clearanceForm, is_profit_tax_exempt: e.target.checked})} />
                          معفاة من أرباح
                        </label>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '12px', marginBottom: '12px', padding: '12px', background: isDark ? '#1e3a5f' : '#dbeafe', borderRadius: '8px' }}>
                        {(() => {
                          const { vatAmount, profitAmount, total } = calculateClearancePreview();
                          return (
                            <>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '12px', color: subTextColor }}>VAT مبلغ ({clearanceForm.is_vat_exempt ? 'معفاة' : (parseFloat(clearanceForm.vat_rate) || (taxSettings.vat_rate * 100)) + '%'})</div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: isDark ? '#93c5fd' : '#1e40af' }}>{vatAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '12px', color: subTextColor }}>أرباح مبلغ ({clearanceForm.is_profit_tax_exempt ? 'معفاة' : (parseFloat(clearanceForm.profit_tax_rate) || (taxSettings.profit_tax_rate * 100)) + '%'})</div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: isDark ? '#93c5fd' : '#1e40af' }}>{profitAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '12px', color: subTextColor }}>ضريبة وارد</div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#7c3aed' }}>{(parseFloat(clearanceForm.import_tax) || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '12px', color: subTextColor }}>الإجمالي</div>
                                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#059669' }}>{total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                        <button type="submit" disabled={loading} style={{ padding: '10px 20px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>{loading ? 'جاري...' : (editingClearance ? '💾 حفظ التعديل' : '➕ إضافة الإفراج')}</button>
                        {editingClearance && <button type="button" onClick={() => { resetClearanceForm(); setEditingClearance(null); }} style={{ padding: '10px 16px', background: isDark ? '#475569' : '#e5e7eb', color: textColor, border: 'none', borderRadius: '8px', cursor: 'pointer' }}>إلغاء التعديل</button>}
                      </div>
                    </form>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                        <thead><tr style={{ background: isDark ? '#334155' : '#f1f5f9' }}>
                          <th style={thSt}>رقم الإفراج</th><th style={thSt}>التاريخ</th><th style={thSt}>قيمة مقرعنة</th><th style={thSt}>وارد</th><th style={thSt}>VAT %</th><th style={thSt}>VAT مبلغ</th><th style={thSt}>أرباح %</th><th style={thSt}>أرباح مبلغ</th><th style={thSt}>الإجمالي</th><th style={thSt}></th>
                        </tr></thead>
                        <tbody>
                          {selectedShipment.clearances?.map((c) => (
                            <tr key={c.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                              <td style={{...tdSt, fontWeight: 'bold'}}>{c.clearance_number}</td>
                              <td style={tdSt}>{new Date(c.clearance_date).toLocaleDateString('ar-EG')}</td>
                              <td style={tdSt}>{parseFloat(c.declared_value || 0).toLocaleString()}</td>
                              <td style={tdSt}>{parseFloat(c.import_tax || 0).toLocaleString()}</td>
                              <td style={tdSt}>{c.is_vat_exempt ? 'معفاة' : (parseFloat(c.vat_rate) > 1 ? parseFloat(c.vat_rate) : (parseFloat(c.vat_rate || taxSettings.vat_rate) * 100)).toFixed(0) + '%'}</td>
                              <td style={tdSt}>{c.is_vat_exempt ? '-' : parseFloat(c.vat_14_amount || 0).toLocaleString()}</td>
                              <td style={tdSt}>{c.is_profit_tax_exempt ? 'معفاة' : (parseFloat(c.profit_tax_rate) > 1 ? parseFloat(c.profit_tax_rate) : (parseFloat(c.profit_tax_rate || taxSettings.profit_tax_rate) * 100)).toFixed(0) + '%'}</td>
                              <td style={tdSt}>{c.is_profit_tax_exempt ? '-' : parseFloat(c.profit_tax_amount || 0).toLocaleString()}</td>
                              <td style={{...tdSt, fontWeight: 'bold', color: '#7e22ce'}}>{parseFloat(c.total_clearance || 0).toLocaleString()}</td>
                              <td style={tdSt}>
                                <button onClick={() => startEditClearance(c)} style={{ background: 'none', border: 'none', color: '#0d9488', cursor: 'pointer', fontSize: '16px', marginLeft: '8px' }} title="تعديل">✏️</button>
                                <button onClick={async () => { if (!window.confirm('هل تريد حذف هذا الإفراج؟')) return; try { await api.delete(`/shipments/${selectedShipment.id}/clearance/${c.id}`); fetchShipmentDetails(selectedShipment.id); } catch (err) { setMessage('❌ خطأ في الحذف'); } }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }} title="حذف">🗑️</button>
                              </td>
                            </tr>
                          ))}
                          {(!selectedShipment.clearances || selectedShipment.clearances.length === 0) && <tr><td colSpan="10" style={{ textAlign: 'center', padding: '20px', color: subTextColor }}>لا توجد إفراجات</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* تبويب تسوية المخلص */}
                   
                {activeTab === 'clearance-settlement' && (
                  <div>
                    {/* صرف عهدة جديدة */}
                    <div style={{ background: isDark ? '#064e3b' : '#d1fae5', padding: '16px', borderRadius: '10px', marginBottom: '16px' }}>
                      <h4 style={{ margin: '0 0 12px 0', color: isDark ? '#6ee7b7' : '#065f46' }}>💰 صرف عهدة جديدة للمخلص</h4>
                      <form onSubmit={handleCreateCustody}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                          <div><label style={{ fontSize: '12px' }}>رقم العهدة</label><input type="text" value={custodyForm.custody_number} onChange={(e) => setCustodyForm({...custodyForm, custody_number: e.target.value})} placeholder="CUST-0001" style={inp()} required /></div>
                          <div><label style={{ fontSize: '12px' }}>نوع الجهة</label><select value={custodyForm.party_type} onChange={(e) => setCustodyForm({...custodyForm, party_type: e.target.value, employee_id: '', supplier_id: ''})} style={inp()}>
                            <option value="service_provider">🏭 مورد خدمة (مخلص)</option>
                            <option value="employee">👤 موظف</option>
                          </select></div>
                          {custodyForm.party_type === 'employee' ? (
                            <div><label style={{ fontSize: '12px' }}>الموظف</label><select value={custodyForm.employee_id} onChange={(e) => setCustodyForm({...custodyForm, employee_id: e.target.value})} style={inp()} required><option value="">اختر الموظف</option>{employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}</select></div>
                          ) : (
                            <div><label style={{ fontSize: '12px' }}>مورد الخدمة (المخلص)</label><select value={custodyForm.supplier_id} onChange={(e) => setCustodyForm({...custodyForm, supplier_id: e.target.value})} style={inp()} required><option value="">اختر مورد الخدمة</option>{suppliers.filter(s => s.is_service_provider).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                          )}
                          <div><label style={{ fontSize: '12px' }}>المبلغ</label><input type="number" value={custodyForm.amount} onChange={(e) => setCustodyForm({...custodyForm, amount: e.target.value})} placeholder="50000" style={inp()} required /></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                          <div><label style={{ fontSize: '12px' }}>طريقة الصرف</label><select value={custodyForm.payment_method} onChange={(e) => setCustodyForm({...custodyForm, payment_method: e.target.value})} style={inp()}><option value="cash">نقدي</option><option value="bank">بنكي</option><option value="check">شيك</option></select></div>
                          <div><label style={{ fontSize: '12px' }}>البنك</label><input type="text" value={custodyForm.bank_name} onChange={(e) => setCustodyForm({...custodyForm, bank_name: e.target.value})} placeholder="اسم البنك" style={inp()} /></div>
                          <div><label style={{ fontSize: '12px' }}>رقم الشيك</label><input type="text" value={custodyForm.check_number} onChange={(e) => setCustodyForm({...custodyForm, check_number: e.target.value})} placeholder="رقم الشيك" style={inp()} /></div>
                        </div>
                        <div style={{ marginBottom: '10px' }}><label style={{ fontSize: '12px' }}>الغرض</label><input type="text" value={custodyForm.purpose} onChange={(e) => setCustodyForm({...custodyForm, purpose: e.target.value})} placeholder="عهدة تخليص جمركي" style={inp()} /></div>
                        <button type="submit" disabled={loading} style={{ padding: '10px 20px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>{loading ? 'جاري...' : '💾 صرف العهدة'}</button>
                      </form>
                    </div>

                    {/* تسوية عهدة */}
                    <div style={{ background: isDark ? '#1e3a5f' : '#dbeafe', padding: '16px', borderRadius: '10px', marginBottom: '16px' }}>
                      <h4 style={{ margin: '0 0 12px 0', color: isDark ? '#93c5fd' : '#1e40af' }}>📝 تسوية عهدة مباشرة</h4>
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '13px' }}>اختر العهدة:</label>
                        <select id="settlement-custody-select" style={inp({ marginTop: '4px' })}>
                          <option value="">اختر عهدة...</option>
                          {custodyList.filter(c => !c.shipment_id || c.shipment_id === selectedShipment.id).map(c => (
                            <option key={c.id} value={c.id}>{c.custody_number} - {c.employee_name} - متبقي: {parseFloat(c.remaining_amount || 0).toLocaleString()} ج.م</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ marginBottom: '12px' }}>
                        <button onClick={handleAddSettlementExpense} style={{ padding: '4px 10px', background: '#0d9488', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>➕ إضافة بند</button>
                      </div>
                      {settlementExpenses.map((se, idx) => (
                        <div key={idx} style={{ background: cardBg, padding: '12px', borderRadius: '8px', marginBottom: '8px', border: `1px solid ${borderColor}` }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                            <select value={se.expense_type} onChange={(e) => updateSettlementExpense(idx, 'expense_type', e.target.value)} style={inp({ fontSize: '12px' })}>
                              <option value="">نوع المصروف</option>
                              <option value="أرضيات">🏠 أرضيات</option>
                              <option value="غرامات">⚠️ غرامات</option>
                              <option value="كارتات">💳 كارتات</option>
                              <option value="نقل">🚛 نقل</option>
                              <option value="مخلص">👤 مخلص</option>
                              <option value="تنمية">🏗️ تنمية</option>
                              <option value="أخرى">📦 أخرى</option>
                            </select>
                            <input type="date" value={se.expense_date} onChange={(e) => updateSettlementExpense(idx, 'expense_date', e.target.value)} style={inp({ fontSize: '12px' })} />
                            <input type="text" value={se.description} onChange={(e) => updateSettlementExpense(idx, 'description', e.target.value)} placeholder="وصف" style={inp({ fontSize: '12px' })} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                            <input type="number" value={se.amount_egp} onChange={(e) => updateSettlementExpense(idx, 'amount_egp', e.target.value)} placeholder="المبلغ (ج.م)" style={inp({ fontSize: '12px' })} />
                            <input type="number" value={se.amount_usd} onChange={(e) => updateSettlementExpense(idx, 'amount_usd', e.target.value)} placeholder="المبلغ ($)" style={inp({ fontSize: '12px' })} />
                            <input type="number" value={se.exchange_rate_usd} onChange={(e) => updateSettlementExpense(idx, 'exchange_rate_usd', e.target.value)} placeholder="سعر الدولار" style={inp({ fontSize: '12px' })} />
                          </div>
                          <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                            <label style={{ fontSize: '12px' }}><input type="checkbox" checked={se.has_tax_invoice} onChange={(e) => updateSettlementExpense(idx, 'has_tax_invoice', e.target.checked)} /> فاتورة ضريبية</label>
                            <label style={{ fontSize: '12px', color: '#ef4444' }}><input type="checkbox" checked={se.is_tax_only} onChange={(e) => updateSettlementExpense(idx, 'is_tax_only', e.target.checked)} /> ضريبي فقط</label>
                          </div>
                          {se.has_tax_invoice && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', background: isDark ? '#1e3a5f' : '#eff6ff', padding: '8px', borderRadius: '6px' }}>
                              <input type="text" value={se.tax_invoice_number} onChange={(e) => updateSettlementExpense(idx, 'tax_invoice_number', e.target.value)} placeholder="رقم الفاتورة" style={inp({ fontSize: '12px' })} />
                              <input type="number" value={se.tax_invoice_amount} onChange={(e) => updateSettlementExpense(idx, 'tax_invoice_amount', e.target.value)} placeholder="المبلغ الأساسي" style={inp({ fontSize: '12px' })} />
                              <select value={se.vat_rate} onChange={(e) => updateSettlementExpense(idx, 'vat_rate', e.target.value)} style={inp({ fontSize: '12px' })}><option value="0">0% VAT</option><option value="14">14% VAT</option></select>
                            </div>
                          )}
                          <button onClick={() => removeSettlementExpense(idx)} style={{ marginTop: '8px', padding: '4px 10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>🗑️ حذف</button>
                        </div>
                      ))}
                      {settlementExpenses.length > 0 && (
                        <button onClick={() => { const select = document.getElementById('settlement-custody-select'); if (select && select.value) handleSubmitSettlement(select.value); else setMessage('❌ اختر العهدة أولاً'); }} disabled={loading} style={{ padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>{loading ? 'جاري...' : '✅ تسجيل تسوية العهدة'}</button>
                      )}
                    </div>

                    {/* زرار إعادة حساب التكلفة */}
                    <div style={{ textAlign: 'center', marginTop: '16px' }}>
                      <button onClick={handleRecalculateCost} disabled={loading} style={{ padding: '12px 24px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
                        🔄 إعادة حساب التكلفة
                      </button>
                    </div>
                  </div>
                )}
                {/* تبويب المرفقات */}
                {activeTab === 'attachments' && (
                  <div>
                    <div style={{ background: hoverBg, padding: '16px', borderRadius: '10px', marginBottom: '16px' }}>
                      <h4 style={{ margin: '0 0 12px 0' }}>📎 رفع مرفق</h4>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input type="text" placeholder="اسم الملف" style={{...inp(), flex: 1}} />
                        <select style={inp()}><option value="invoice">فاتورة</option><option value="customs_doc">مستند جمركي</option><option value="shipping_doc">بوليصة شحن</option><option value="other">أخرى</option></select>
                        <button style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>📤 رفع</button>
                      </div>
                      <p style={{ fontSize: '12px', color: subTextColor, marginTop: '8px' }}>* يتطلب إعداد خدمة رفع الملفات (مثل Cloudinary أو S3)</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {selectedShipment.attachments?.map(att => (
                        <div key={att.id} style={{ border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: '500' }}>{att.file_name}</div>
                            <div style={{ fontSize: '12px', color: subTextColor }}>{att.file_type}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <a href={att.file_url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontSize: '13px', textDecoration: 'none' }}>عرض</a>
                            <button style={{ color: '#ef4444', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer' }}>حذف</button>
                          </div>
                        </div>
                      ))}
                      {(!selectedShipment.attachments || selectedShipment.attachments.length === 0) && <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: subTextColor, padding: '30px' }}>لا توجد مرفقات</div>}
                    </div>
                  </div>
                )}

                {/* تبويب ربط الفاتورة */}
                {activeTab === 'invoice' && (
  <div>
    {selectedShipment.purchase_id ? (
      <div style={{ background: isDark ? '#064e3b' : '#d1fae5', padding: '20px', borderRadius: '10px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: isDark ? '#6ee7b7' : '#065f46' }}>✅ تم ربط الفاتورة</h4>
        <p>رقم الفاتورة: <strong>{selectedShipment.invoice_number}</strong></p>
        <p style={{ marginTop: '8px' }}>معامل التحويل الفعلي: <strong style={{ fontSize: '20px' }}>{parseFloat(selectedShipment.actual_exchange_rate || 0).toFixed(4)} ج/دولار</strong></p>
        
        {/* زرار فك الربط */}
        <button 
          onClick={handleUnlinkInvoice}
          disabled={loading}
          style={{
            marginTop: '16px',
            padding: '10px 20px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            opacity: loading ? 0.6 : 1
          }}
        >
          🔓 فك ربط الفاتورة
        </button>
      </div>
    ) : (
                      <div>
                        <h4 style={{ margin: '0 0 12px 0' }}>🔗 ربط بفاتورة استيراد</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {purchaseList.map(p => (
                            <div key={p.id} style={{ border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontWeight: '500' }}>{p.purchase_number}</div>
                                <div style={{ fontSize: '13px', color: subTextColor }}>المورد: {p.supplier} | القيمة: {parseFloat(p.total_amount || 0).toLocaleString()}</div>
                              </div>
                              <button onClick={() => handleLinkInvoice(p.id)} disabled={loading} style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>ربط</button>
                            </div>
                          ))}
                          {purchaseList.length === 0 && <div style={{ textAlign: 'center', color: subTextColor, padding: '30px' }}>لا توجد فواتير استيراد غير مربوطة</div>}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* تبويب سداد المورد */}
                {activeTab === 'supplier-payments' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h4 style={{ margin: 0 }}>💳 سداد المورد</h4>
                      <div style={{ fontSize: '12px', color: subTextColor, background: hoverBg, padding: '8px 12px', borderRadius: '6px' }}>
                        💡 لإضافة سداد: اذهب لتبويب "المصاريف" وأضف مصروف مع اختيار المورد وطريقة السداد
                      </div>
                    </div>
                    {selectedShipment.expenses?.filter(exp => exp.supplier_id).length > 0 ? (
                      <div>
                        {/* إجمالي لكل مورد */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                          {(() => {
                            const supplierTotals = {};
                            selectedShipment.expenses.filter(exp => exp.supplier_id).forEach(exp => {
                              const sid = exp.supplier_id;
                              const sname = exp.supplier_name || suppliers.find(s => s.id == sid)?.name || 'مورد';
                              if (!supplierTotals[sid]) supplierTotals[sid] = { name: sname, total: 0, count: 0 };
                              supplierTotals[sid].total += parseFloat(exp.total_egp || 0);
                              supplierTotals[sid].count += 1;
                            });
                            return Object.entries(supplierTotals).map(([sid, data]) => (
                              <div key={sid} style={{ background: isDark ? '#1e3a5f' : '#dbeafe', padding: '16px', borderRadius: '10px', textAlign: 'center' }}>
                                <div style={{ fontSize: '13px', color: subTextColor }}>{data.name}</div>
                                <div style={{ fontSize: '22px', fontWeight: 'bold', color: isDark ? '#93c5fd' : '#1e40af' }}>{data.total.toLocaleString()} ج.م</div>
                                <div style={{ fontSize: '12px', color: subTextColor }}>{data.count} مصروف</div>
                              </div>
                            ));
                          })()}
                        </div>
                        {/* جدول التفاصيل */}
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                            <thead><tr style={{ background: isDark ? '#334155' : '#f1f5f9' }}>
                              <th style={thSt}>#</th><th style={thSt}>التاريخ</th><th style={thSt}>المورد</th><th style={thSt}>النوع</th><th style={thSt}>المبلغ</th><th style={thSt}>طريقة السداد</th><th style={thSt}>الخزينة</th><th style={thSt}>العهدة</th>
                            </tr></thead>
                            <tbody>
                              {selectedShipment.expenses.filter(exp => exp.supplier_id).map((exp, idx) => (
                                <tr key={exp.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                                  <td style={tdSt}>{idx + 1}</td>
                                  <td style={tdSt}>{new Date(exp.expense_date).toLocaleDateString('ar-EG')}</td>
                                  <td style={{...tdSt, fontWeight: 'bold'}}>{exp.supplier_name || suppliers.find(s => s.id == exp.supplier_id)?.name || '---'}</td>
                                  <td style={tdSt}>{exp.expense_type}</td>
                                  <td style={{...tdSt, fontWeight: 'bold', color: '#0d9488'}}>{parseFloat(exp.total_egp || 0).toLocaleString()} ج.م</td>
                                  <td style={tdSt}>{exp.payment_method === 'bank' ? '🏦 بنكي' : exp.payment_method === 'check' ? '📝 شيك' : '💵 نقدي'}</td>
                                  <td style={tdSt}>{exp.treasury_number ? <span style={{ fontSize: '11px', background: isDark ? '#064e3b' : '#d1fae5', color: isDark ? '#6ee7b7' : '#065f46', padding: '2px 6px', borderRadius: '4px' }}>{exp.treasury_number}</span> : '---'}</td>
                                  <td style={tdSt}>{exp.custody_number ? <span style={{ fontSize: '11px', background: isDark ? '#451a03' : '#fef3c7', color: isDark ? '#fcd34d' : '#92400e', padding: '2px 6px', borderRadius: '4px' }}>{exp.custody_number}</span> : '---'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', color: subTextColor, padding: '40px' }}>
                        <div style={{ fontSize: '40px', marginBottom: '10px' }}>💳</div>
                        <div>لا توجد مصاريف مرتبطة بمورد</div>
                        <div style={{ fontSize: '12px', marginTop: '8px' }}>قم بإضافة مصروف واختيار المورد وطريقة السداد من تبويب المصاريف</div>
                      </div>
                    )}
                  </div>
                )}

                {/* تبويب التكلفة */}
                {activeTab === 'cost' && (
                  <div>
                    {costCalculation ? (
                      <div>
                        <div style={{ background: isDark ? '#1e3a5f' : '#dbeafe', padding: '20px', borderRadius: '10px', marginBottom: '16px' }}>
                          <h4 style={{ margin: '0 0 12px 0', color: isDark ? '#93c5fd' : '#1e40af' }}>🧮 حساب تكلفة القطعة</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', textAlign: 'center' }}>
                            <div><div style={{ fontSize: '13px', color: subTextColor }}>معامل التحويل</div><div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb' }}>{parseFloat(costCalculation.exchange_rate || 0).toFixed(4)}</div><div style={{ fontSize: '12px' }}>ج.م / دولار</div></div>
                            <div><div style={{ fontSize: '13px', color: subTextColor }}>إجمالي المصاريف</div><div style={{ fontSize: '24px', fontWeight: 'bold', color: '#059669' }}>{parseFloat(costCalculation.total_expenses_egp || 0).toLocaleString()}</div><div style={{ fontSize: '12px' }}>ج.م</div></div>
                            <div><div style={{ fontSize: '13px', color: subTextColor }}>قيمة الفاتورة</div><div style={{ fontSize: '24px', fontWeight: 'bold', color: '#7e22ce' }}>{parseFloat(costCalculation.invoice_value_usd || 0).toLocaleString()}</div><div style={{ fontSize: '12px' }}>دولار</div></div>
                          </div>
                        </div>
                        <h5 style={{ margin: '0 0 10px 0' }}>تكلفة الأصناف:</h5>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                            <thead><tr style={{ background: isDark ? '#334155' : '#f1f5f9' }}>
                              <th style={thSt}>الصنف</th><th style={thSt}>الكمية</th><th style={thSt}>سعر الدولار</th><th style={thSt}>تكلفة الوحدة (ج.م)</th><th style={thSt}>إجمالي (ج.م)</th>
                            </tr></thead>
                            <tbody>
                              {costCalculation.items?.map(item => (
                                <tr key={item.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                                  <td style={tdSt}>{item.item_name}</td>
                                  <td style={tdSt}>{item.quantity}</td>
                                  <td style={tdSt}>{parseFloat(item.unit_price_usd || 0).toLocaleString()} $</td>
                                  <td style={{...tdSt, fontWeight: 'bold', color: '#2563eb'}}>{parseFloat(item.unit_cost_egp || 0).toLocaleString()}</td>
                                  <td style={tdSt}>{parseFloat(item.total_cost_egp || 0).toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', color: subTextColor, padding: '40px' }}>
                        {selectedShipment.purchase_id ? 'جاري الحساب...' : 'يجب ربط الفاتورة أولاً'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Modal: استدعاء مصروف من الخزينة/البنك ═══ */}
      {showExpensePicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: cardBg, borderRadius: '12px', padding: '20px', width: '90%', maxWidth: '900px', maxHeight: '85vh', overflowY: 'auto', color: textColor }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#8b5cf6' }}>🔄 استدعاء مصروف من الخزينة/البنك</h3>
              <button onClick={() => setShowExpensePicker(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: textColor }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '14px' }}>
              <input placeholder="التصنيف (مثال: تخليص)" value={pickerFilters.category} onChange={e => setPickerFilters({ ...pickerFilters, category: e.target.value })} style={inp()} />
              <input placeholder="اسم المورد" value={pickerFilters.supplier} onChange={e => setPickerFilters({ ...pickerFilters, supplier: e.target.value })} style={inp()} />
              <input placeholder="اسم البنك" value={pickerFilters.bank} onChange={e => setPickerFilters({ ...pickerFilters, bank: e.target.value })} style={inp()} />
              <input placeholder="بحث نصي (وصف/رقم)" value={pickerFilters.search} onChange={e => setPickerFilters({ ...pickerFilters, search: e.target.value })} style={inp()} />
            </div>
            <button onClick={fetchAvailableExpenses} style={{ marginBottom: '14px', padding: '8px 16px', background: '#0d9488', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              🔍 بحث
            </button>

            {pickerLoading ? (
              <div style={{ textAlign: 'center', padding: '30px', color: subTextColor }}>جاري التحميل...</div>
            ) : availableExpenses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: subTextColor }}>مفيش مصاريف منتظرة الربط مطابقة للبحث</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${borderColor}`, textAlign: 'right' }}>
                    <th style={{ padding: '8px' }}>التاريخ</th>
                    <th style={{ padding: '8px' }}>الوصف</th>
                    <th style={{ padding: '8px' }}>التصنيف</th>
                    <th style={{ padding: '8px' }}>المورد/البنك</th>
                    <th style={{ padding: '8px' }}>المبلغ</th>
                    <th style={{ padding: '8px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {availableExpenses.map(exp => (
                    <tr key={exp.treasury_id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                      <td style={{ padding: '8px' }}>{exp.transaction_date ? new Date(exp.transaction_date).toLocaleDateString('ar-EG') : '-'}</td>
                      <td style={{ padding: '8px' }}>{exp.description || exp.transaction_number}</td>
                      <td style={{ padding: '8px' }}>{exp.category_name || '-'}</td>
                      <td style={{ padding: '8px' }}>{exp.supplier_name || exp.bank_name || '-'}</td>
                      <td style={{ padding: '8px', fontWeight: 'bold', color: '#0d9488' }}>{parseFloat(exp.amount_local || exp.amount || 0).toLocaleString()} {exp.currency || 'ج.م'}</td>
                      <td style={{ padding: '8px' }}>
                        <button
                          onClick={() => linkAvailableExpense(exp)}
                          style={{ padding: '6px 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          ربط بالشحنة
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Shipments;
