import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const STATUS_LABELS = {
  pending_review: { label: '⏳ إعداد', color: '#f59e0b', bg: '#fef3c7' },
  rejected_by_review: { label: '❌ مرفوض مراجعة', color: '#dc2626', bg: '#fee2e2' },
  pending_approval: { label: '👀 انتظار مراجعة', color: '#2563eb', bg: '#dbeafe' },
  rejected_by_finance: { label: '❌ مرفوض مالية', color: '#dc2626', bg: '#fee2e2' },
  approved: { label: '✅ معتمد', color: '#7c3aed', bg: '#ede9fe' },
  return_requested: { label: '⚠️ مشكلة صرف', color: '#ea580c', bg: '#ffedd5' },
  active: { label: '💸 تم الصرف', color: '#059669', bg: '#d1fae5' },
  cancelled: { label: '🚫 ملغي', color: '#6b7280', bg: '#f3f4f6' }
};



const WORKFLOW_TABS = [
  { key: 'all', label: '📋 الكل' },
  { key: 'pending_review', label: '📝 إعداد' },
  { key: 'pending_approval', label: '⏳ انتظار مراجعة' },
  { key: 'approved', label: '✅ معتمد' },
  { key: 'active', label: '💸 تم الصرف' }
];

const INCOME_TYPES = [
  { value: 'customer_payment', label: 'سداد من عميل', color: '#059669', icon: '💵' },
  { value: 'advance_return', label: 'رد سلفة', color: '#0891b2', icon: '↩️' },
  { value: 'custody_return', label: 'رد عهدة', color: '#d97706', icon: '📋' },
  { value: 'treasury_funding', label: 'تمويل الخزينة', color: '#7c3aed', icon: '💰' },
  { value: 'other_income', label: 'إيراد آخر', color: '#10b981', icon: '📈' }
];

const OUTCOME_TYPES = [
  { value: 'supplier_payment', label: 'سداد لمورد', color: '#dc2626', icon: '🏭' },
  { value: 'custody_payment', label: 'عهدة موظف', color: '#2563eb', icon: '👤' },
  { value: 'custody_settlement', label: 'تسوية عهدة (صرف فرق)', color: '#b91c1c', icon: '📤' },
  { value: 'salary_advance', label: 'سلفة موظف', color: '#ea580c', icon: '💳' },
  { value: 'non_employee_advance', label: 'سلف غير عاملين', color: '#db2777', icon: '👥' },
  { value: 'expense', label: 'مصروف', color: '#be185d', icon: '📊' },
  { value: 'other_outcome', label: 'صرف آخر', color: '#4b5563', icon: '📤' },
  { value: 'bank_transfer', label: 'تحويل بنكي', color: '#7c3aed', icon: '🏦' }
];

const PAYMENT_FILTERS = [
  { key: 'all', label: '📋 الكل' },
  { key: 'cash', label: '💵 نقدي' },
  { key: 'bank', label: '🏦 بنكي' },
  { key: 'transfer', label: '🔄 تحويل' }
];

function Treasury() {
  const { user } = useAuth();
  const role = user?.role;

  // ═══ Data ═══
  const [transactions, setTransactions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [balance, setBalance] = useState({
    cash: { EGP: { in: 0, out: 0, balance: 0 }, USD: { in: 0, out: 0, balance: 0 }, EUR: { in: 0, out: 0, balance: 0 } },
    bank: { EGP: { in: 0, out: 0, balance: 0 }, USD: { in: 0, out: 0, balance: 0 }, EUR: { in: 0, out: 0, balance: 0 } },
    total: { in: 0, out: 0, balance: 0 }
  });

  // ═══ Tabs ═══
  const [mainTab, setMainTab] = useState('outcome');
  const [subTab, setSubTab] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');

  // ═══ Form ═══
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // ═══ Expense Items (Multi-line) ═══
  const [expenseItems, setExpenseItems] = useState([
    { expense_category_id: '', cost_center_id: '', description: '', amount: '' }
  ]);

  // ═══ Attachments ═══
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [existingAttachments, setExistingAttachments] = useState([]);

  // ═══ Modals ═══
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [pendingSubmit, setPendingSubmit] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [viewModal, setViewModal] = useState(null);
  const [statementModal, setStatementModal] = useState(false);
  const [statementData, setStatementData] = useState(null);
  const [stmtFrom, setStmtFrom] = useState('');
  const [stmtTo, setStmtTo] = useState('');

  const [formData, setFormData] = useState({
    transaction_type: '', transaction_number: '', transaction_date: new Date().toISOString().split('T')[0],
    customer_id: '', supplier_id: '', employee_id: '', employee_name: '', party_type: 'employee', custody_id: '',
    amount: '', currency: 'EGP', exchange_rate: '1', payment_method: 'cash',
    bank_account_id: '', bank_name: '', account_number: '', check_number: '',
    description: '', purpose: '', expense_category_id: '', cost_center_id: '',
    transfer_from: '', transfer_to: '', transfer_from_currency: '', transfer_to_currency: '',
    party_name: '', attachment_url: ''
  });
  const [skipWorkflow, setSkipWorkflow] = useState(false);
  // ═══ رصيد عهدة الموظف (لما تختاره في وضع عهدة/رد عهدة/تسوية عهدة) ═══
  const [employeeCustody, setEmployeeCustody] = useState(null);
  const [loadingEmployeeCustody, setLoadingEmployeeCustody] = useState(false);

  const custodyLinkedTypes = ['custody_payment', 'custody_return', 'custody_settlement'];

  useEffect(() => {
    const shouldFetch = custodyLinkedTypes.includes(selectedType) && formData.party_type === 'employee' && formData.employee_id;
    if (!shouldFetch) {
      setEmployeeCustody(null);
      return;
    }
    let cancelled = false;
    setLoadingEmployeeCustody(true);
    api.get('/custodies/active?include_settled=true').then(r => {
      if (cancelled) return;
      const list = r.data || [];
      const match = list.find(c => String(c.employee_id) === String(formData.employee_id));
      setEmployeeCustody(match || null);
    }).catch(() => { if (!cancelled) setEmployeeCustody(null); })
      .finally(() => { if (!cancelled) setLoadingEmployeeCustody(false); });
    return () => { cancelled = true; };
  }, [selectedType, formData.party_type, formData.employee_id]);

  useEffect(() => {
    if (custodyLinkedTypes.includes(selectedType)) {
      setFormData(p => ({ ...p, custody_id: employeeCustody?.id || null }));
    }
  }, [employeeCustody, selectedType]);

  const outTypes = ['customer_refund','expense','other_outcome','custody_payment','salary_advance','supplier_payment','non_employee_advance','custody_settlement'];

  // ═══ Auto-set statement dates ═══
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setStmtFrom(firstDay.toISOString().split('T')[0]);
    setStmtTo(lastDay.toISOString().split('T')[0]);
  }, []);

  // ═══ Load data on mount ═══
  useEffect(() => { fetchAllData(); }, []);

  // ═══ Auto-load transactions when tab changes ═══
    useEffect(() => {
    if (mainTab === 'income' || mainTab === 'outcome') {
      fetchTransactions({ status: subTab }); // ← شيلنا type عشان نجيب كل الإذون
    } else if (mainTab === 'balance') {
      fetchBalance();
    }
  }, [subTab, mainTab]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchCustomers(), fetchSuppliers(), fetchEmployees(),
      fetchExpenseCategories(), fetchCostCenters(), fetchBankAccounts(),
      fetchCurrencies(), fetchBalance()
    ]);
    setLoading(false);
  };

    const fetchTransactions = async (opts = {}) => {
    try {
      let url = '/treasury';
      const params = [];
      const { status } = opts;
      if (status && status !== 'all') params.push(`status=${status}`);
      if (params.length > 0) url += '?' + params.join('&');
      const r = await api.get(url);
      setTransactions(r.data);
    } catch (err) {
      console.error('Error loading transactions');
    }
  };

  const fetchCustomers = async () => {
    try { const r = await api.get('/customers'); setCustomers(r.data); }
    catch (e) {}
  };

  const fetchSuppliers = async () => {
    try { const r = await api.get('/suppliers'); setSuppliers(r.data); }
    catch (e) {}
  };

  const fetchEmployees = async () => {
    // بنستخدم /treasury/for-treasury لأنها بترجع كل الموظفين حتى اللي مش شغالين حاليًا
    // (مطلوبين مثلاً لتسجيل "سلف غير عاملين" أو تسوية سلف موظفين سابقين)
    try { const r = await api.get('/treasury/for-treasury'); setEmployees(r.data || []); }
    catch (e) { setEmployees([]); }
  };

  const fetchExpenseCategories = async () => {
    try { const r = await api.get('/expense-categories'); setExpenseCategories(r.data.filter(c => c.category_type === 'sub')); }
    catch (e) {}
  };

  const fetchCostCenters = async () => {
    try { const r = await api.get('/cost-centers'); setCostCenters(r.data); }
    catch (e) {}
  };

  const fetchBankAccounts = async () => {
    try { const r = await api.get('/bank-accounts'); setBankAccounts(r.data); }
    catch (e) {}
  };

  const fetchCurrencies = async () => {
    try { const r = await api.get('/treasury/currencies'); setCurrencies(r.data); }
    catch (e) {
      setCurrencies([
        { code: 'EGP', name: 'جنيه مصري', symbol: 'ج.م', is_default: true, exchange_rate: 1 },
        { code: 'USD', name: 'دولار أمريكي', symbol: '$', is_default: false, exchange_rate: 50.5 },
        { code: 'EUR', name: 'يورو', symbol: '€', is_default: false, exchange_rate: 55.2 }
      ]);
    }
  };

  const fetchBalance = async () => {
    try { const r = await api.get('/treasury/balance'); setBalance(r.data); }
    catch (e) {
      setBalance({
        cash: { EGP: { in: 0, out: 0, balance: 0 }, USD: { in: 0, out: 0, balance: 0 }, EUR: { in: 0, out: 0, balance: 0 } },
        bank: { EGP: { in: 0, out: 0, balance: 0 }, USD: { in: 0, out: 0, balance: 0 }, EUR: { in: 0, out: 0, balance: 0 } },
        total: { in: 0, out: 0, balance: 0 }
      });
    }
  };

  const fetchNextNumber = async (type) => {
    try { const r = await api.get(`/treasury/next-number?type=${type}`); setFormData(p => ({...p, transaction_number: r.data.nextNumber})); }
    catch (e) {}
  };

  const handleBankChange = (bankId) => {
    const b = bankAccounts.find(x => x.id == bankId);
    setFormData(p => ({...p, bank_account_id: bankId, bank_name: b?.bank_name || '', account_number: b?.account_number || ''}));
  };

  const handleCurrencyChange = (code) => {
    const c = currencies.find(x => x.code === code);
    setFormData(p => ({...p, currency: code, exchange_rate: (c?.exchange_rate || (code === 'EGP' ? 1 : 1)).toString()}));
  };

  const getAmountLocal = () => {
    return (parseFloat(formData.amount) || 0) * (parseFloat(formData.exchange_rate) || 1);
  };

  const resetForm = () => {
    setFormData({
      transaction_type: '', transaction_number: '', transaction_date: new Date().toISOString().split('T')[0],
      customer_id: '', supplier_id: '', employee_id: '', employee_name: '', party_type: 'employee', custody_id: '', amount: '', currency: 'EGP',
      exchange_rate: '1', payment_method: 'cash', bank_account_id: '', bank_name: '', account_number: '', check_number: '',
      description: '', purpose: '', expense_category_id: '', cost_center_id: '',
      transfer_from: '', transfer_to: '', transfer_from_currency: '', transfer_to_currency: '', party_name: '', attachment_url: ''
    });
    setExpenseItems([{ expense_category_id: '', cost_center_id: '', description: '', amount: '' }]);
    setAttachmentFile(null);
    setExistingAttachments([]);
    setEditingId(null);
    setShowConfirm(false);
    setPendingSubmit(null);
    setSkipWorkflow(false);
  };

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    setShowForm(true);
    resetForm();
    setFormData(p => ({...p, transaction_type: type}));
    fetchNextNumber(type);
  };

  const handleEdit = async (t) => {
    setEditingId(t.id);
    setSelectedType(t.transaction_type);
    setShowForm(true);
    setFormData({
      transaction_type: t.transaction_type || '',
      transaction_number: t.transaction_number || '',
      transaction_date: t.transaction_date ? t.transaction_date.split('T')[0] : new Date().toISOString().split('T')[0],
      customer_id: t.customer_id || '', supplier_id: t.supplier_id || '', employee_id: t.employee_id || '',
      employee_name: t.employee_name || '', party_type: t.party_type || 'employee', amount: t.amount || '',
      currency: t.currency || 'EGP', exchange_rate: t.exchange_rate ? t.exchange_rate.toString() : '1',
      payment_method: t.payment_method || 'cash', bank_account_id: t.bank_account_id || '',
      bank_name: t.bank_name || '', account_number: t.account_number || '', check_number: t.check_number || '',
      description: t.description || '', purpose: t.purpose || t.description || '',
      expense_category_id: t.expense_category_id || '', cost_center_id: t.cost_center_id || '',
      transfer_from: t.transfer_from || '', transfer_to: t.transfer_to || '',
      transfer_from_currency: t.transfer_from_currency || '', transfer_to_currency: t.transfer_to_currency || '',
      party_name: t.party_name || '', attachment_url: t.attachment_url || ''
    });
    if (t.transaction_type === 'expense') {
      try {
        const r = await api.get(`/treasury/${t.id}`);
        setExpenseItems(r.data.items?.length ? r.data.items : [{expense_category_id:'',cost_center_id:'',description:'',amount:''}]);
        setExistingAttachments(r.data.attachments || []);
      } catch (e) {
        setExpenseItems([{expense_category_id:'',cost_center_id:'',description:'',amount:''}]);
      }
    } else {
      setExpenseItems([{expense_category_id:'',cost_center_id:'',description:'',amount:''}]);
      try {
        const r = await api.get(`/treasury/${t.id}`);
        setExistingAttachments(r.data.attachments || []);
      } catch (e) {}
    }
  };

  const handleDuplicate = async (t) => {
    if (!window.confirm(`تكرار السند ${t.transaction_number}؟`)) return;
    try {
      const r = await api.post(`/treasury/${t.id}/duplicate`);
      setMessage(`✅ ${r.data.message}`);
      refreshCurrentTab();
      fetchBalance();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || 'خطأ'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('حذف السند؟')) return;
    try {
      await api.delete(`/treasury/${id}`);
      setMessage('✅ تم الحذف');
      refreshCurrentTab();
      fetchBalance();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || err.message));
    }
  };

  const handleCancel = async (id) => {
    const reason = window.prompt('سبب الإلغاء:');
    if (!reason || !reason.trim()) return;
    try {
      const r = await api.put(`/treasury/${id}/cancel`, { cancel_reason: reason });
      setMessage(`✅ ${r.data.message}`);
      refreshCurrentTab();
      fetchBalance();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || err.message));
    }
  };

  const handleWorkflowAction = async (id, endpoint, body, successMsg) => {
    try {
      const r = await api.put(`/treasury/${id}/${endpoint}`, body);
      setMessage(`✅ ${r.data.message || successMsg}`);
      refreshCurrentTab();
      fetchBalance();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || err.message));
    }
  };

  const handleReviewApprove = (id) => handleWorkflowAction(id, 'review', { action: 'approve' }, 'تمت الموافقة');
  const handleFinanceApprove = (id) => handleWorkflowAction(id, 'approve', { action: 'approve' }, 'تم الاعتماد');
  const handleExecute = (id) => {
    if (!window.confirm('تأكيد الصرف؟')) return;
    handleWorkflowAction(id, 'execute', {}, 'تم الصرف');
  };
  const handleExecuteForce = (id) => {
    if (!window.confirm('صرف للضرورة؟')) return;
    handleWorkflowAction(id, 'execute', { force: true }, 'تم الصرف');
  };
  const handleResolveReturn = (id) => {
    if (!window.confirm('إرجاع لمحاسب الإدخالات؟')) return;
    handleWorkflowAction(id, 'resolve-return', {}, 'تم الإرجاع');
  };

  const openRejectModal = (id, kind) => {
    setRejectModal({ id, kind });
    setRejectReason('');
  };

  const submitRejectModal = () => {
    if (!rejectReason.trim()) {
      setMessage('❌ اكتب السبب');
      return;
    }
    const { id, kind } = rejectModal;
    if (kind === 'review') {
      handleWorkflowAction(id, 'review', { action: 'reject', rejection_reason: rejectReason }, 'تم الرفض');
    } else if (kind === 'approve') {
      handleWorkflowAction(id, 'approve', { action: 'reject', rejection_reason: rejectReason }, 'تم الرفض');
    } else if (kind === 'return') {
      handleWorkflowAction(id, 'return-request', { rejection_reason: rejectReason }, 'تم رفع المشكلة');
    }
    setRejectModal(null);
    setRejectReason('');
  };

  const getAvailableActions = (t) => {
    const actions = [];
    if ((role === 'review_accountant' || role === 'admin') && t.status === 'pending_review') {
      actions.push({ key: 'review_approve', label: '✅ موافقة', color: '#059669', onClick: () => handleReviewApprove(t.id) });
      actions.push({ key: 'review_reject', label: '❌ رفض', color: '#dc2626', onClick: () => openRejectModal(t.id, 'review') });
    }
    if ((role === 'finance' || role === 'admin') && t.status === 'pending_approval') {
      actions.push({ key: 'finance_approve', label: '✅ اعتماد', color: '#059669', onClick: () => handleFinanceApprove(t.id) });
      actions.push({ key: 'finance_reject', label: '❌ رفض', color: '#dc2626', onClick: () => openRejectModal(t.id, 'approve') });
    }
    if ((role === 'finance' || role === 'admin') && t.status === 'return_requested') {
      actions.push({ key: 'resolve_return', label: '↩️ إرجاع', color: '#ea580c', onClick: () => handleResolveReturn(t.id) });
      actions.push({ key: 'execute_anyway', label: '💸 تم الصرف', color: '#059669', onClick: () => handleExecute(t.id) });
    }
    if ((role === 'treasury_accountant' || role === 'finance' || role === 'admin') && t.status === 'approved') {
      actions.push({ key: 'execute', label: '💸 تم الصرف', color: '#059669', onClick: () => handleExecute(t.id) });
      actions.push({ key: 'execute_force', label: '⚡ صرف للضرورة', color: '#ea580c', onClick: () => handleExecuteForce(t.id) });
      actions.push({ key: 'return_request', label: '⚠️ مشكلة', color: '#ea580c', onClick: () => openRejectModal(t.id, 'return') });
    }
    if ((role === 'finance' || role === 'admin') && t.status === 'active') {
      actions.push({ key: 'cancel', label: '🚫 إلغاء', color: '#6b7280', onClick: () => handleCancel(t.id) });
    }
    return actions;
  };

  const canEditDelete = (t) => {
    if (role === 'admin' || role === 'finance') return true;
    if (role === 'entry_accountant') {
      return ['pending_review', 'rejected_by_review', 'rejected_by_finance'].includes(t.status) && t.created_by === user?.id;
    }
    return false;
  };

   const refreshCurrentTab = () => {
    if (mainTab === 'income' || mainTab === 'outcome') {
      fetchTransactions({ status: subTab }); // ← شيلنا type
    } else if (mainTab === 'balance') {
      fetchBalance();
    }
  };
  const validateBalance = () => {
    const numericAmount = parseFloat(formData.amount) || 0;
    if (!outTypes.includes(selectedType) && selectedType !== 'bank_transfer') return { ok: true };
    if (!editingId && role === 'entry_accountant') return { ok: true };
    const pm = formData.payment_method;
    const curr = formData.currency;
    let available = 0;
    let typeName = '';
    if (pm === 'cash') {
      if (curr === 'USD') { available = balance.cash?.USD?.balance || 0; typeName = 'الخزينة النقدية (USD)'; }
      else if (curr === 'EUR') { available = balance.cash?.EUR?.balance || 0; typeName = 'الخزينة النقدية (EUR)'; }
      else { available = balance.cash?.EGP?.balance || 0; typeName = 'الخزينة النقدية (EGP)'; }
    } else {
      if (curr === 'USD') { available = balance.bank?.USD?.balance || 0; typeName = 'البنك (USD)'; }
      else if (curr === 'EUR') { available = balance.bank?.EUR?.balance || 0; typeName = 'البنك (EUR)'; }
      else { available = balance.bank?.EGP?.balance || 0; typeName = 'البنك (EGP)'; }
    }
    if (available < numericAmount) {
      return {
        ok: false,
        message: `⚠️ الرصيد غير كافي في ${typeName}!\nالمتاح: ${available.toFixed(2)} ${curr}\nالمطلوب: ${numericAmount.toFixed(2)} ${curr}\n\nصرف للضرورة؟`,
        available: available,
        required: numericAmount
      };
    }
    return { ok: true };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validation = validateBalance();
    if (!validation.ok && !pendingSubmit) {
      // منع force للـ entry_accountant — يسمح بس للـ admin/finance
      if (role === 'entry_accountant') {
        setMessage('❌ ' + validation.message.replace(/\n/g, ' '));
        return;
      }
      setConfirmMessage(validation.message);
      setShowConfirm(true);
      setPendingSubmit({ force: true });
      return;
    }
    try {
      const submitData = { ...formData };
      if (pendingSubmit?.force) submitData.force = true;
      submitData.skip_workflow = skipWorkflow;
      submitData.amount = parseFloat(submitData.amount) || 0;
      submitData.exchange_rate = parseFloat(submitData.exchange_rate) || 1;

      if (submitData.employee_id) {
        const emp = employees.find(em => em.id == submitData.employee_id);
        submitData.employee_name = emp?.full_name || emp?.username || submitData.employee_name || '';
      }

      if ((selectedType === 'custody_payment' || selectedType === 'salary_advance') && submitData.party_type === 'employee' && !submitData.employee_id) {
        setMessage('❌ اختر الموظف');
        return;
      }
      if ((selectedType === 'custody_settlement' || selectedType === 'custody_return') && !submitData.custody_id) {
        setMessage('❌ الموظف ده مفهوش عهدة نشطة — مينفعش تعمل تسوية/رد عهدة بدون عهدة مرتبطة');
        return;
      }
      if ((selectedType === 'custody_payment' || selectedType === 'salary_advance') && submitData.party_type === 'supplier' && !submitData.supplier_id) {
        setMessage('❌ اختر المورد');
        return;
      }
      if (submitData.party_type === 'supplier' && submitData.supplier_id) {
        const sup = suppliers.find(s => s.id == submitData.supplier_id);
        submitData.employee_name = sup?.supplier_name || sup?.name || '';
        submitData.employee_id = null;
      } else if (submitData.party_type === 'employee' && submitData.employee_id) {
        const emp = employees.find(em => em.id == submitData.employee_id);
        submitData.employee_name = emp?.full_name || emp?.username || '';
        submitData.supplier_id = null;
      } else if (submitData.party_type === 'other') {
        submitData.employee_name = submitData.party_name;
        submitData.employee_id = null;
        submitData.supplier_id = null;
      }
      if (!submitData.employee_id) submitData.employee_id = null;
      if (!submitData.supplier_id) submitData.supplier_id = null;
      if (!submitData.customer_id) submitData.customer_id = null;
      if (!submitData.bank_account_id) submitData.bank_account_id = null;

      if (selectedType === 'expense') {
        const validItems = expenseItems.filter(i => parseFloat(i.amount) > 0);
        if (validItems.length === 0) {
          setMessage('❌ أضف بند مصروف واحد على الأقل');
          return;
        }
        let totalItems = 0;
        submitData.items = validItems.map((item, idx) => {
          const amt = parseFloat(item.amount) || 0;
          totalItems += amt;
          return { ...item, amount: amt, sort_order: idx };
        });
        if (Math.abs(totalItems - submitData.amount) > 0.01) {
          setMessage(`❌ مجموع البنود (${totalItems.toFixed(2)}) لا يساوي المبلغ الإجمالي (${submitData.amount.toFixed(2)})`);
          return;
        }
      }

      if (editingId) {
        await api.put(`/treasury/${editingId}`, submitData);
        setMessage('✅ تم التعديل');
      } else {
        const r = await api.post('/treasury', submitData);
        setMessage('✅ تم التسجيل');
        if (r.data?.data?.id && attachmentFile) {
          await uploadAttachment(r.data.data.id);
        }
      }
      setShowForm(false);
      setSelectedType('');
      setShowConfirm(false);
      setPendingSubmit(null);
      resetForm();
      refreshCurrentTab();
      fetchBalance();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || err.message || 'خطأ'));
      setShowConfirm(false);
      setPendingSubmit(null);
    }
  };

  const uploadAttachment = async (treasuryId) => {
    if (!attachmentFile) return;
    const fd = new FormData();
    fd.append('file', attachmentFile);
    try {
      await api.post(`/treasury/${treasuryId}/attachments`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    } catch (e) {
      console.error('Upload error', e);
    }
  };

  const handleConfirmYes = () => {
    setShowConfirm(false);
    handleSubmit({ preventDefault: () => {} });
  };

  const handleConfirmNo = () => {
    setShowConfirm(false);
    setPendingSubmit(null);
    setMessage('❌ تم الإلغاء - الرصيد غير كافي');
  };

  const handleDownloadCSV = async () => {
    try {
      const response = await api.get('/treasury/export/csv', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `treasury_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setMessage('✅ تم التصدير بنجاح');
    } catch (err) {
      setMessage('❌ خطأ في التصدير');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const r = await api.get('/treasury/import/template', { responseType: 'blob' });
      const blob = new Blob([r.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'treasury_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setMessage('✅ تم تحميل القالب');
    } catch (err) {
      setMessage('❌ خطأ في التحميل');
    }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      setLoading(true);
      const r = await api.post('/treasury/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setLoading(false);
      if (r.data.errors?.length > 0) {
        setMessage(`⚠️ تم استيراد ${r.data.imported} سند\n❌ أخطاء:\n${r.data.errors.map(e => `صف ${e.row}: ${e.message}`).join('\n')}`);
      } else {
        setMessage(`✅ ${r.data.message}`);
      }
      refreshCurrentTab();
      fetchBalance();
    } catch (err) {
      setLoading(false);
      setMessage('❌ ' + (err.response?.data?.message || 'خطأ في الاستيراد'));
    }
    e.target.value = '';
  };

  const loadStatement = async () => {
    try {
      const params = new URLSearchParams();
      if (stmtFrom) params.append('from', stmtFrom);
      if (stmtTo) params.append('to', stmtTo);
      const r = await api.get(`/treasury/report/statement?${params.toString()}`);
      setStatementData(r.data);
    } catch (err) {
      setMessage('❌ خطأ في تحميل كشف الحساب');
    }
  };

    const getTypeLabel = (type) => {
    const all = [...INCOME_TYPES, ...OUTCOME_TYPES, { value: 'outcome', label: 'صرف' }, { value: 'income', label: 'إيراد' }];
    return all.find(t => t.value === type)?.label || type;
  };

    const getTypeColor = (type) => {
    const all = [...INCOME_TYPES, ...OUTCOME_TYPES, { value: 'outcome', color: '#dc2626' }, { value: 'income', color: '#059669' }];
    return all.find(t => t.value === type)?.color || '#6c757d';
  };

  const getCurrencySymbol = (code) => {
    return currencies.find(c => c.code === code)?.symbol || code;
  };

  const getPaymentMethodLabel = (pm) => {
    if (pm === 'cash') return '💵 نقدي';
    if (pm === 'bank') return '🏦 بنكي';
    if (pm === 'check') return '📝 شيك';
    return pm || '-';
  };

  const filterByPayment = (list) => {
    if (paymentFilter === 'all') return list;
    if (paymentFilter === 'transfer') return list.filter(t => t.transaction_type === 'bank_transfer');
    if (paymentFilter === 'cash') return list.filter(t => t.payment_method === 'cash' && t.transaction_type !== 'bank_transfer');
    if (paymentFilter === 'bank') return list.filter(t => (t.payment_method === 'bank' || t.payment_method === 'check') && t.transaction_type !== 'bank_transfer');
    return list;
  };

  const thStyle = { padding: '12px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold' };
  const tdStyle = { padding: '10px', border: '1px solid #ddd', textAlign: 'center', color: '#1e293b' };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>جاري التحميل...</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl' }}>
       <h1 style={{ textAlign: 'center', marginBottom: '20px', color: '#1f2937' }}>
        نظام الخزينة والبنك
      </h1>

      {/* ═══ NAVIGATION BAR ═══ */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', justifyContent: 'center' }}>
        <button onClick={() => window.location.href = '/dashboard'} style={{
          padding: '8px 20px', backgroundColor: '#6b7280', color: 'white',
          border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold',
          fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px'
        }}>
          🏠 الرئيسية
        </button>
        <button onClick={() => window.location.href = '/treasury-module'} style={{
  padding: '8px 20px', backgroundColor: '#2563eb', color: 'white',
  border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold',
  fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px'
}}>
  💰 الخزينة
</button>
      </div>

      {/* ═══ MAIN TABS ═══ */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '3px solid #e5e7eb', paddingBottom: '0' }}>
        {[
          { key: 'outcome', label: '📤 إذن صرف', color: '#dc2626' },
          { key: 'income', label: '📥 إذن إيراد', color: '#059669' },
          { key: 'balance', label: '📊 الأرصدة', color: '#2563eb' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => {
              setMainTab(tab.key);
              setShowForm(false);
              setSubTab('all');
              setPaymentFilter('all');
            }}
            style={{
              padding: '14px 32px',
              backgroundColor: mainTab === tab.key ? tab.color : '#f3f4f6',
              color: mainTab === tab.key ? 'white' : '#4b5563',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              borderBottom: mainTab === tab.key ? `3px solid ${tab.color}` : '3px solid transparent',
              marginBottom: mainTab === tab.key ? '-3px' : '0',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ MESSAGE ═══ */}
      {message && (
        <p style={{
          padding: '12px',
          backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da',
          color: message.includes('✅') ? '#155724' : '#721c24',
          borderRadius: '4px',
          marginBottom: '15px',
          fontWeight: 'bold',
          whiteSpace: 'pre-line'
        }}>
          {message}
        </p>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* ═══ OUTCOME TAB ═══ */}
      {/* ═══════════════════════════════════════ */}
      {mainTab === 'outcome' && !showForm && (
        <div>
          {/* Outcome Type Selection */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#dc2626', marginBottom: '15px' }}>
              📤 إذن صرف جديد — اختر النوع
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '12px'
            }}>
              {OUTCOME_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => handleTypeSelect(t.value)}
                  style={{
                    padding: '20px',
                    backgroundColor: t.color + '15',
                    color: t.color,
                    border: `2px solid ${t.color}40`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = t.color + '30';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = t.color + '15';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <span style={{ fontSize: '24px' }}>{t.icon}</span> {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Workflow Sub-tabs */}
          <div style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '10px',
            borderBottom: '2px solid #e5e7eb'
          }}>
            {WORKFLOW_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => {
                  setSubTab(tab.key);
                  setPaymentFilter('all');
                }}
                style={{
                  padding: '10px 24px',
                  backgroundColor: subTab === tab.key ? '#fee2e2' : 'transparent',
                  color: subTab === tab.key ? '#dc2626' : '#6b7280',
                  border: 'none',
                  borderBottom: subTab === tab.key ? '2px solid #dc2626' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  marginBottom: '-2px'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Payment Filter */}
          <div style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '15px'
          }}>
            {PAYMENT_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setPaymentFilter(f.key)}
                style={{
                  padding: '6px 16px',
                  backgroundColor: paymentFilter === f.key ? '#dc2626' : '#f3f4f6',
                  color: paymentFilter === f.key ? 'white' : '#6b7280',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 'bold'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Outcome Table */}
          <h3 style={{ marginBottom: '12px', color: '#dc2626' }}>
            📤 إذون الصرف — {WORKFLOW_TABS.find(t => t.key === subTab)?.label}
            {' '}({filterByPayment(transactions.filter(t => t.transaction_type === 'outcome' || OUTCOME_TYPES.some(it => it.value === t.transaction_type))).length})
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ color: '#1e293b',
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
              backgroundColor: 'white',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#dc2626', color: 'white' }}>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>رقم السند</th>
                  <th style={thStyle}>التاريخ</th>
                  <th style={thStyle}>النوع</th>
                  <th style={thStyle}>المبلغ</th>
                  <th style={thStyle}>العملة</th>
                  <th style={thStyle}>الجهة</th>
                  <th style={thStyle}>طريقة الدفع</th>
                  <th style={thStyle}>المرحلة</th>
                  <th style={thStyle}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filterByPayment(transactions.filter(t => t.transaction_type === 'outcome' || OUTCOME_TYPES.some(it => it.value === t.transaction_type))).length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>
                      لا توجد إذون صرف
                    </td>
                  </tr>
                ) : (
                  filterByPayment(transactions.filter(t => t.transaction_type === 'outcome' || OUTCOME_TYPES.some(it => it.value === t.transaction_type))).map((t, idx) => {
                    const party = t.employee_name || t.party_name || t.customer_name || t.supplier_name || '-';
                    const actions = getAvailableActions(t);
                    return (
                      <tr
                        key={t.id}
                        style={{ borderBottom: '1px solid #e5e7eb' }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <td style={tdStyle}>{idx + 1}</td>
                        <td style={{ ...tdStyle, fontWeight: 'bold', color: '#1f2937' }}>
                          {t.transaction_number}
                        </td>
                        <td style={tdStyle}>
                          {t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('ar-EG') : '-'}
                        </td>
                        <td style={tdStyle}>
                          <span style={{ color: getTypeColor(t.transaction_type), fontWeight: 'bold', fontSize: '12px' }}>
                            {getTypeLabel(t.transaction_type)}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 'bold' }}>
                          {parseFloat(t.amount || 0).toFixed(2)}
                        </td>
                        <td style={tdStyle}>{t.currency}</td>
                        <td style={{ ...tdStyle, fontSize: '12px' }}>{party}</td>
                        <td style={tdStyle}>{getPaymentMethodLabel(t.payment_method)}</td>
                        <td style={tdStyle}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            backgroundColor: STATUS_LABELS[t.status]?.bg,
                            color: STATUS_LABELS[t.status]?.color
                          }}>
                            {STATUS_LABELS[t.status]?.label || t.status}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <button onClick={() => setViewModal(t)} style={{
                              padding: '4px 10px', backgroundColor: '#2563eb', color: 'white',
                              border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                            }}>👁️</button>
                            {canEditDelete(t) && (
                              <>
                                <button onClick={() => handleEdit(t)} style={{
                                  padding: '4px 10px', backgroundColor: '#f59e0b', color: 'white',
                                  border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                                }}>✏️</button>
                                <button onClick={() => handleDelete(t.id)} style={{
                                  padding: '4px 10px', backgroundColor: '#dc2626', color: 'white',
                                  border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                                }}>🗑️</button>
                              </>
                            )}
                            {(role === 'finance' || role === 'admin') && (
                              <button onClick={() => handleDuplicate(t)} style={{
                                padding: '4px 10px', backgroundColor: '#7c3aed', color: 'white',
                                border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                              }}>📋</button>
                            )}
                            {actions.map(a => (
                              <button key={a.key} onClick={a.onClick} style={{
                                padding: '4px 10px', backgroundColor: a.color, color: 'white',
                                border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                              }}>
                                {a.label}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* ═══ INCOME TAB ═══ */}
      {/* ═══════════════════════════════════════ */}
      {mainTab === 'income' && !showForm && (
        <div>
          {/* Income Type Selection */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#059669', marginBottom: '15px' }}>
              📥 إذن إيراد جديد — اختر النوع
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '12px'
            }}>
              {INCOME_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => handleTypeSelect(t.value)}
                  style={{
                    padding: '20px',
                    backgroundColor: t.color + '15',
                    color: t.color,
                    border: `2px solid ${t.color}40`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = t.color + '30';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = t.color + '15';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <span style={{ fontSize: '24px' }}>{t.icon}</span> {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Workflow Sub-tabs */}
          <div style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '10px',
            borderBottom: '2px solid #e5e7eb'
          }}>
            {WORKFLOW_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => {
                  setSubTab(tab.key);
                  setPaymentFilter('all');
                }}
                style={{
                  padding: '10px 24px',
                  backgroundColor: subTab === tab.key ? '#d1fae5' : 'transparent',
                  color: subTab === tab.key ? '#059669' : '#6b7280',
                  border: 'none',
                  borderBottom: subTab === tab.key ? '2px solid #059669' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  marginBottom: '-2px'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Payment Filter */}
          <div style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '15px'
          }}>
            {PAYMENT_FILTERS.filter(f => f.key !== 'transfer').map(f => (
              <button
                key={f.key}
                onClick={() => setPaymentFilter(f.key)}
                style={{
                  padding: '6px 16px',
                  backgroundColor: paymentFilter === f.key ? '#059669' : '#f3f4f6',
                  color: paymentFilter === f.key ? 'white' : '#6b7280',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 'bold'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Income Table */}
          <h3 style={{ marginBottom: '12px', color: '#059669' }}>
            📥 إذون الإيراد — {WORKFLOW_TABS.find(t => t.key === subTab)?.label}
            {' '}({filterByPayment(transactions.filter(t => t.transaction_type === 'income' || INCOME_TYPES.some(it => it.value === t.transaction_type))).length})
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ color: '#1e293b',
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
              backgroundColor: 'white',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#059669', color: 'white' }}>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>رقم السند</th>
                  <th style={thStyle}>التاريخ</th>
                  <th style={thStyle}>النوع</th>
                  <th style={thStyle}>المبلغ</th>
                  <th style={thStyle}>العملة</th>
                  <th style={thStyle}>الجهة</th>
                  <th style={thStyle}>طريقة الدفع</th>
                  <th style={thStyle}>المرحلة</th>
                  <th style={thStyle}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filterByPayment(transactions.filter(t => t.transaction_type === 'income' || INCOME_TYPES.some(it => it.value === t.transaction_type))).length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>
                      لا توجد إذون إيراد
                    </td>
                  </tr>
                ) : (
                  filterByPayment(transactions.filter(t => t.transaction_type === 'income' || INCOME_TYPES.some(it => it.value === t.transaction_type))).map((t, idx) => {
                    const party = t.employee_name || t.party_name || t.customer_name || t.supplier_name || '-';
                    const actions = getAvailableActions(t);
                    return (
                      <tr
                        key={t.id}
                        style={{ borderBottom: '1px solid #e5e7eb' }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <td style={tdStyle}>{idx + 1}</td>
                        <td style={{ ...tdStyle, fontWeight: 'bold', color: '#1f2937' }}>
                          {t.transaction_number}
                        </td>
                        <td style={tdStyle}>
                          {t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('ar-EG') : '-'}
                        </td>
                        <td style={tdStyle}>
                          <span style={{ color: getTypeColor(t.transaction_type), fontWeight: 'bold', fontSize: '12px' }}>
                            {getTypeLabel(t.transaction_type)}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 'bold' }}>
                          {parseFloat(t.amount || 0).toFixed(2)}
                        </td>
                        <td style={tdStyle}>{t.currency}</td>
                        <td style={{ ...tdStyle, fontSize: '12px' }}>{party}</td>
                        <td style={tdStyle}>{getPaymentMethodLabel(t.payment_method)}</td>
                        <td style={tdStyle}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            backgroundColor: STATUS_LABELS[t.status]?.bg,
                            color: STATUS_LABELS[t.status]?.color
                          }}>
                            {STATUS_LABELS[t.status]?.label || t.status}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <button onClick={() => setViewModal(t)} style={{
                              padding: '4px 10px', backgroundColor: '#2563eb', color: 'white',
                              border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                            }}>👁️</button>
                            {canEditDelete(t) && (
                              <>
                                <button onClick={() => handleEdit(t)} style={{
                                  padding: '4px 10px', backgroundColor: '#f59e0b', color: 'white',
                                  border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                                }}>✏️</button>
                                <button onClick={() => handleDelete(t.id)} style={{
                                  padding: '4px 10px', backgroundColor: '#dc2626', color: 'white',
                                  border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                                }}>🗑️</button>
                              </>
                            )}
                            {(role === 'finance' || role === 'admin') && (
                              <button onClick={() => handleDuplicate(t)} style={{
                                padding: '4px 10px', backgroundColor: '#7c3aed', color: 'white',
                                border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                              }}>📋</button>
                            )}
                            {actions.map(a => (
                              <button key={a.key} onClick={a.onClick} style={{
                                padding: '4px 10px', backgroundColor: a.color, color: 'white',
                                border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                              }}>
                                {a.label}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* ═══ BALANCE TAB ═══ */}
      {/* ═══════════════════════════════════════ */}
      {mainTab === 'balance' && (
        <>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <button onClick={() => window.location.href = '/dashboard'} style={{
              padding: '10px 20px', backgroundColor: '#6c757d', color: 'white',
              border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
            }}>رجوع للوحة التحكم</button>
            <button onClick={() => window.location.href = '/bank-accounts'} style={{
              padding: '10px 20px', backgroundColor: '#17a2b8', color: 'white',
              border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
            }}>حسابات البنوك</button>
            <button onClick={handleDownloadCSV} style={{
              padding: '10px 20px', backgroundColor: '#059669', color: 'white',
              border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
            }}>📥 تصدير CSV</button>
            <button onClick={() => setStatementModal(true)} style={{
              padding: '10px 20px', backgroundColor: '#7c3aed', color: 'white',
              border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
            }}>📋 كشف حساب</button>
            <button onClick={handleDownloadTemplate} style={{
              padding: '10px 20px', backgroundColor: '#ea580c', color: 'white',
              border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
            }}>📥 قالب Excel</button>
            <button onClick={() => document.getElementById('excel-import-input').click()} style={{
              padding: '10px 20px', backgroundColor: '#0891b2', color: 'white',
              border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
            }}>📤 استيراد Excel</button>
            <input id="excel-import-input" type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportExcel} />
          </div>

          {/* BALANCE CARDS */}
          <div style={{ marginBottom: '20px' }}>
            {['EGP', 'USD', 'EUR'].map(curr => (
              <div key={curr} style={{ marginBottom: '15px' }}>
                <h4 style={{
                  color: curr === 'EGP' ? '#059669' : curr === 'USD' ? '#2563eb' : '#7c3aed',
                  marginBottom: '8px'
                }}>
                  {curr === 'EGP' ? '🇪🇬 جنيه مصري' : curr === 'USD' ? '🇺🇸 دولار' : '🇪🇺 يورو'} ({curr})
                </h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '10px'
                }}>
                  <div style={{ color: '#1e293b',
                    backgroundColor: '#d1fae5', padding: '12px', borderRadius: '10px',
                    textAlign: 'center', border: '2px solid #28a745'
                  }}>
                    <div style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold' }}>💵 وارد نقدي</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#28a745' }}>
                      {(balance.cash?.[curr]?.in || 0).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ color: '#1e293b',
                    backgroundColor: '#fee2e2', padding: '12px', borderRadius: '10px',
                    textAlign: 'center', border: '2px solid #dc3545'
                  }}>
                    <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 'bold' }}>💵 صادر نقدي</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#dc3545' }}>
                      {(balance.cash?.[curr]?.out || 0).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ color: '#1e293b',
                    backgroundColor: '#dbeafe', padding: '12px', borderRadius: '10px',
                    textAlign: 'center', border: '2px solid #2563eb'
                  }}>
                    <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: 'bold' }}>💵 رصيد نقدي</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2563eb' }}>
                      {(balance.cash?.[curr]?.balance || 0).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ color: '#1e293b',
                    backgroundColor: '#d1fae5', padding: '12px', borderRadius: '10px',
                    textAlign: 'center', border: '2px solid #059669'
                  }}>
                    <div style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold' }}>🏦 وارد بنكي</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#059669' }}>
                      {(balance.bank?.[curr]?.in || 0).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ color: '#1e293b',
                    backgroundColor: '#fee2e2', padding: '12px', borderRadius: '10px',
                    textAlign: 'center', border: '2px solid #991b1b'
                  }}>
                    <div style={{ fontSize: '11px', color: '#991b1b', fontWeight: 'bold' }}>🏦 صادر بنكي</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#991b1b' }}>
                      {(balance.bank?.[curr]?.out || 0).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ color: '#1e293b',
                    backgroundColor: '#dbeafe', padding: '12px', borderRadius: '10px',
                    textAlign: 'center', border: '2px solid #1e40af'
                  }}>
                    <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 'bold' }}>🏦 رصيد بنكي</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e40af' }}>
                      {(balance.bank?.[curr]?.balance || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ color: '#1e293b',
              backgroundColor: '#f3e8ff', padding: '15px', borderRadius: '12px',
              textAlign: 'center', border: '2px solid #7c3aed'
            }}>
              <div style={{ fontSize: '14px', color: '#7c3aed', fontWeight: 'bold' }}>💰 الإجمالي (بالجنيه)</div>
              <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#7c3aed' }}>
                {(balance.total?.balance || 0).toFixed(2)} ج.م
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* ═══ FORM (Shared for Income & Outcome) ═══ */}
      {/* ═══════════════════════════════════════ */}
      {showForm && (
        <div style={{ color: '#1e293b',
          backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', marginBottom: '20px', border: '1px solid #e5e7eb'
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'
          }}>
            <h3 style={{ color: '#1f2937', margin: 0 }}>
              {editingId ? '✏️ تعديل سند' : '📝 سند جديد'} — {getTypeLabel(selectedType)}
            </h3>
            <button onClick={() => { setShowForm(false); setSelectedType(''); resetForm(); }} style={{
              padding: '8px 16px', backgroundColor: '#ef4444', color: 'white',
              border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
            }}>✕ إغلاق</button>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px'
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>رقم السند</label>
                <input type="text" value={formData.transaction_number} readOnly style={{
                  width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db',
                  backgroundColor: '#f3f4f6', fontWeight: 'bold', color: '#1f2937'
                }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>التاريخ</label>
                <input type="date" value={formData.transaction_date} onChange={e => setFormData(p => ({...p, transaction_date: e.target.value}))} required style={{
                  width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db'
                }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>العملة</label>
                <select value={formData.currency} onChange={e => handleCurrencyChange(e.target.value)} style={{
                  width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db'
                }}>
                  {currencies.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.name} ({c.code})</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>سعر الصرف</label>
                <input type="number" step="0.01" value={formData.exchange_rate} onChange={e => setFormData(p => ({...p, exchange_rate: e.target.value}))} style={{
                  width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db'
                }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>المبلغ الإجمالي</label>
                <input type="number" step="0.01" value={formData.amount} onChange={e => setFormData(p => ({...p, amount: e.target.value}))} required style={{
                  width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontWeight: 'bold'
                }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>المبلغ بالجنيه</label>
                <input type="text" value={getAmountLocal().toFixed(2)} readOnly style={{
                  width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db',
                  backgroundColor: '#f3f4f6', fontWeight: 'bold', color: '#059669'
                }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>طريقة الدفع</label>
                <select value={formData.payment_method} onChange={e => setFormData(p => ({...p, payment_method: e.target.value}))} style={{
                  width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db'
                }}>
                  <option value="cash">💵 نقدي</option>
                  <option value="bank">🏦 بنكي</option>
                  <option value="check">📝 شيك</option>
                </select>
              </div>
              {formData.payment_method !== 'cash' && (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>الحساب البنكي</label>
                    <select value={formData.bank_account_id} onChange={e => handleBankChange(e.target.value)} style={{
                      width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db'
                    }}>
                      <option value="">اختر حساب...</option>
                      {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bank_name} — {b.account_number}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>اسم البنك</label>
                    <input type="text" value={formData.bank_name} onChange={e => setFormData(p => ({...p, bank_name: e.target.value}))} placeholder="اسم البنك" style={{
                      width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db'
                    }} />
                  </div>
                </>
              )}
              {formData.payment_method === 'check' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>رقم الشيك</label>
                  <input type="text" value={formData.check_number} onChange={e => setFormData(p => ({...p, check_number: e.target.value}))} placeholder="رقم الشيك" style={{
                    width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db'
                  }} />
                </div>
              )}
              {(selectedType === 'customer_payment' || selectedType === 'customer_refund') && (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>العميل</label>
                  <select value={formData.customer_id} onChange={e => setFormData(p => ({...p, customer_id: e.target.value}))} style={{
                    width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db'
                  }}>
                    <option value="">اختر عميل...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              {selectedType === 'supplier_payment' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>المورد</label>
                  <select value={formData.supplier_id} onChange={e => setFormData(p => ({...p, supplier_id: e.target.value}))} style={{
                    width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db'
                  }}>
                    <option value="">اختر مورد...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name || s.name}</option>)}
                  </select>
                </div>
              )}
              {(selectedType === 'custody_payment' || selectedType === 'custody_settlement' || selectedType === 'salary_advance' || selectedType === 'non_employee_advance') && (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>نوع الجهة</label>
                  <select value={formData.party_type} onChange={e => setFormData(p => ({...p, party_type: e.target.value}))} style={{
                    width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db'
                  }}>
                    <option value="employee">👤 موظف</option>
                    <option value="supplier">🏭 مورد خدمة</option>
                    <option value="other">👥 أخرى</option>
                  </select>
                </div>
              )}
              {(selectedType === 'custody_payment' || selectedType === 'custody_settlement' || selectedType === 'salary_advance' || selectedType === 'non_employee_advance' || selectedType === 'advance_return' || selectedType === 'custody_return') && formData.party_type === 'employee' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>الموظف</label>
                  <select value={formData.employee_id} onChange={e => setFormData(p => ({...p, employee_id: e.target.value}))} style={{
                    width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db'
                  }}>
                    <option value="">اختر موظف...</option>
                    {employees.map(em => <option key={em.id} value={em.id}>{em.full_name || em.username} — {em.department_name || ''} {em.section_name || ''}{em.status && em.status !== 'active' ? ' (غير شغال حاليًا)' : ''}</option>)}
                  </select>
                  {custodyLinkedTypes.includes(selectedType) && formData.employee_id && (
                    <div style={{
                      marginTop: '8px', padding: '10px 14px', borderRadius: '8px',
                      backgroundColor: employeeCustody ? '#ecfdf5' : '#fef2f2',
                      border: `1px solid ${employeeCustody ? '#a7f3d0' : '#fecaca'}`,
                      fontSize: '13px', color: employeeCustody ? '#065f46' : '#991b1b'
                    }}>
                      {loadingEmployeeCustody ? '⏳ جاري تحميل رصيد العهدة...' : employeeCustody ? (
                        <>💼 عهدة <strong>{employeeCustody.custody_number}</strong> — المتبقي: <strong>{parseFloat(employeeCustody.remaining_amount).toFixed(2)} ج.م</strong> من أصل {parseFloat(employeeCustody.amount).toFixed(2)} ج.م</>
                      ) : (
                        <>⚠️ الموظف ده مفهوش عهدة نشطة حاليًا</>
                      )}
                    </div>
                  )}
                </div>
              )}
              {(selectedType === 'custody_payment' || selectedType === 'custody_settlement' || selectedType === 'salary_advance' || selectedType === 'non_employee_advance' || selectedType === 'advance_return' || selectedType === 'custody_return') && formData.party_type === 'supplier' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>مورد الخدمة (المخلص مثلاً)</label>
                  <select value={formData.supplier_id} onChange={e => setFormData(p => ({...p, supplier_id: e.target.value}))} style={{
                    width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db'
                  }}>
                    <option value="">اختر مورد خدمة...</option>
                    {suppliers.filter(s => s.is_service_provider).map(s => <option key={s.id} value={s.id}>{s.supplier_name || s.name}</option>)}
                  </select>
                </div>
              )}
              {(selectedType === 'non_employee_advance' || (selectedType === 'custody_payment' && formData.party_type === 'other')) && (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>اسم الجهة</label>
                  <input type="text" value={formData.party_name} onChange={e => setFormData(p => ({...p, party_name: e.target.value}))} placeholder="اسم الجهة" style={{
                    width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db'
                  }} />
                </div>
              )}
              {selectedType === 'bank_transfer' && (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>تحويل من</label>
                    <select value={formData.transfer_from} onChange={e => setFormData(p => ({...p, transfer_from: e.target.value}))} style={{
                      width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db'
                    }}>
                      <option value="">اختر...</option>
                      <option value="cash">💵 نقدي</option>
                      <option value="bank">🏦 بنك</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>عملة المصدر</label>
                    <select value={formData.transfer_from_currency} onChange={e => setFormData(p => ({...p, transfer_from_currency: e.target.value}))} style={{
                      width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db'
                    }}>
                      {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>تحويل إلى</label>
                    <select value={formData.transfer_to} onChange={e => setFormData(p => ({...p, transfer_to: e.target.value}))} style={{
                      width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db'
                    }}>
                      <option value="">اختر...</option>
                      <option value="cash">💵 نقدي</option>
                      <option value="bank">🏦 بنك</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>عملة الهدف</label>
                    <select value={formData.transfer_to_currency} onChange={e => setFormData(p => ({...p, transfer_to_currency: e.target.value}))} style={{
                      width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db'
                    }}>
                      {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* ═══ EXPENSE ITEMS (Multi-line) ═══ */}
            {selectedType === 'expense' && (
              <div style={{ color: '#1e293b',
                marginTop: '20px', padding: '16px', backgroundColor: '#fef3c7',
                borderRadius: '10px', border: '2px solid #f59e0b'
              }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#92400e' }}>
                  📊 بنود المصروف (المجموع لازم = {formData.amount || 0})
                </h4>
                <table style={{ color: '#1e293b',
                  width: '100%', borderCollapse: 'collapse', fontSize: '13px',
                  backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f59e0b', color: 'white' }}>
                      <th style={{ padding: '8px', textAlign: 'center' }}>البند</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>فئة المصروف</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>مركز التكلفة</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>المبلغ</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>حذف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '6px' }}>
                          <input type="text" placeholder="وصف البند" value={item.description} onChange={e => {
                            const newItems = [...expenseItems]; newItems[idx].description = e.target.value; setExpenseItems(newItems);
                          }} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                        </td>
                        <td style={{ padding: '6px' }}>
                          <select value={item.expense_category_id} onChange={e => {
                            const newItems = [...expenseItems]; newItems[idx].expense_category_id = e.target.value; setExpenseItems(newItems);
                          }} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db' }}>
                            <option value="">اختر...</option>
                            {expenseCategories.map(ec => <option key={ec.id} value={ec.id}>{ec.category_name}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '6px' }}>
                          <select value={item.cost_center_id} onChange={e => {
                            const newItems = [...expenseItems]; newItems[idx].cost_center_id = e.target.value; setExpenseItems(newItems);
                          }} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db' }}>
                            <option value="">اختر...</option>
                            {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.center_name}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '6px' }}>
                          <input type="number" step="0.01" placeholder="0.00" value={item.amount} onChange={e => {
                            const newItems = [...expenseItems]; newItems[idx].amount = e.target.value; setExpenseItems(newItems);
                          }} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                        </td>
                        <td style={{ padding: '6px', textAlign: 'center' }}>
                          <button type="button" onClick={() => setExpenseItems(expenseItems.filter((_, i) => i !== idx))} style={{
                            padding: '4px 10px', backgroundColor: '#dc2626', color: 'white',
                            border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px'
                          }}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" onClick={() => setExpenseItems([...expenseItems, { expense_category_id: '', cost_center_id: '', description: '', amount: '' }])} style={{
                  marginTop: '10px', padding: '8px 16px', backgroundColor: '#f59e0b', color: 'white',
                  border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
                }}>➕ إضافة بند</button>
                <div style={{ marginTop: '8px', fontWeight: 'bold', color: '#92400e' }}>
                  المجموع: {expenseItems.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0).toFixed(2)} / {formData.amount || 0}
                </div>
              </div>
            )}

            {/* ═══ FILE UPLOAD ═══ */}
            <div style={{ color: '#1e293b',
              marginTop: '20px', padding: '16px', backgroundColor: '#dbeafe',
              borderRadius: '10px', border: '2px solid #2563eb'
            }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#1e40af' }}>📎 المرفقات</h4>
              <input type="file" onChange={e => setAttachmentFile(e.target.files[0])} style={{ marginBottom: '10px' }} />
              {attachmentFile && <div style={{ color: '#059669', fontWeight: 'bold' }}>✅ تم اختيار: {attachmentFile.name}</div>}
              {existingAttachments.length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <strong>المرفقات الحالية:</strong>
                  {existingAttachments.map(att => (
                    <div key={att.id} style={{ color: '#1e293b',
                      display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px',
                      backgroundColor: 'white', padding: '8px', borderRadius: '6px'
                    }}>
                      <a href={`http://localhost:5000/uploads/treasury/${att.stored_name}`} target="_blank" rel="noopener noreferrer" style={{
                        color: '#2563eb', fontWeight: 'bold'
                      }}>📄 {att.file_name}</a>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>({(att.file_size / 1024).toFixed(1)} KB)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ═══ DESCRIPTION ═══ */}
            <div style={{ marginTop: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>البيان / الغرض</label>
              <textarea value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value, purpose: e.target.value}))} rows="3" placeholder="اكتب البيان هنا..." style={{
                width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', resize: 'vertical'
              }} />
            </div>

            {/* ═══ SKIP WORKFLOW CHECKBOX (Admin/Finance only) ═══ */}
            {(role === 'admin' || role === 'finance') && !editingId && (
              <div style={{ color: '#1e293b', marginTop: '20px', padding: '12px', backgroundColor: '#fef3c7', borderRadius: '8px', border: '2px solid #f59e0b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="skipWorkflow"
                  checked={skipWorkflow}
                  onChange={e => setSkipWorkflow(e.target.checked)}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
                <label htmlFor="skipWorkflow" style={{ fontWeight: 'bold', color: '#92400e', cursor: 'pointer', fontSize: '15px' }}>
                  ⚡ تخطي المراحل (إنشاء مباشر — بدون مراجعة/اعتماد)
                </label>
              </div>
            )}

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button type="submit" style={{
                padding: '12px 32px', backgroundColor: '#059669', color: 'white',
                border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold'
              }}>{editingId ? '💾 حفظ التعديل' : '💾 حفظ السند'}</button>
              <button type="button" onClick={() => { setShowForm(false); setSelectedType(''); resetForm(); }} style={{
                padding: '12px 24px', backgroundColor: '#6b7280', color: 'white',
                border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold'
              }}>إلغاء</button>
            </div>
          </form>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* ═══ STATEMENT MODAL ═══ */}
      {/* ═══════════════════════════════════════ */}
      {statementModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div id="print-statement" style={{ color: '#1e293b',
            backgroundColor: 'white', borderRadius: '12px', maxWidth: '1100px',
            width: '100%', maxHeight: '90vh', overflow: 'auto', padding: '24px', direction: 'rtl'
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '20px', borderBottom: '2px solid #e5e7eb', paddingBottom: '12px'
            }} className="no-print">
              <h2 style={{ margin: 0, color: '#1f2937' }}>📋 كشف حساب الخزينة</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => window.print()} style={{
                  padding: '8px 16px', backgroundColor: '#2563eb', color: 'white',
                  border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
                }}>🖨️ طباعة الكشف</button>
                <button onClick={() => { setStatementModal(false); setStatementData(null); }} style={{
                  padding: '8px 16px', backgroundColor: '#ef4444', color: 'white',
                  border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
                }}>✕ إغلاق</button>
              </div>
            </div>

            <div style={{
              textAlign: 'center', marginBottom: '20px',
              borderBottom: '2px solid #1f2937', paddingBottom: '12px'
            }} className="print-only">
              <h1 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>كشف حساب الخزينة</h1>
              <div>الفترة: {stmtFrom ? new Date(stmtFrom).toLocaleDateString('ar-EG') : 'البداية'} — {stmtTo ? new Date(stmtTo).toLocaleDateString('ar-EG') : 'الآن'}</div>
            </div>

            <div style={{
              display: 'flex', gap: '10px', marginBottom: '20px',
              flexWrap: 'wrap', alignItems: 'center'
            }} className="no-print">
              <label>من:</label>
              <input type="date" value={stmtFrom} onChange={e => setStmtFrom(e.target.value)} style={{
                padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db'
              }} />
              <label>إلى:</label>
              <input type="date" value={stmtTo} onChange={e => setStmtTo(e.target.value)} style={{
                padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db'
              }} />
              <button onClick={loadStatement} style={{
                padding: '8px 20px', backgroundColor: '#7c3aed', color: 'white',
                border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
              }}>عرض</button>
            </div>

            {statementData && (
              <div>
                <div style={{ display: 'flex', gap: '20px', marginBottom: '15px', flexWrap: 'wrap' }}>
                  <div style={{ color: '#1e293b', backgroundColor: '#dbeafe', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold' }}>
                    الرصيد الافتتاحي: {statementData.opening_balance?.toFixed(2)}
                  </div>
                  <div style={{ color: '#1e293b', backgroundColor: '#d1fae5', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold' }}>
                    الرصيد الختامي: {statementData.closing_balance?.toFixed(2)}
                  </div>
                  <div style={{ color: '#1e293b', backgroundColor: '#f3f4f6', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold' }}>
                    عدد الحركات: {statementData.count}
                  </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ color: '#1e293b', backgroundColor: '#f3f4f6' }}>
                      <th style={thStyle}>#</th>
                      <th style={thStyle}>التاريخ</th>
                      <th style={thStyle}>رقم السند</th>
                      <th style={thStyle}>النوع</th>
                      <th style={thStyle}>البيان</th>
                      <th style={thStyle}>مدين</th>
                      <th style={thStyle}>دائن</th>
                      <th style={thStyle}>الرصيد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementData.data?.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={tdStyle}>{idx + 1}</td>
                        <td style={tdStyle}>{row.transaction_date ? new Date(row.transaction_date).toLocaleDateString('ar-EG') : ''}</td>
                        <td style={tdStyle}>{row.transaction_number}</td>
                        <td style={tdStyle}>{getTypeLabel(row.transaction_type)}</td>
                        <td style={tdStyle}>{row.description || '-'}</td>
                        <td style={{...tdStyle, color: '#059669', fontWeight: 'bold'}}>{row.debit ? row.debit.toFixed(2) : ''}</td>
                        <td style={{...tdStyle, color: '#dc2626', fontWeight: 'bold'}}>{row.credit ? row.credit.toFixed(2) : ''}</td>
                        <td style={{...tdStyle, fontWeight: 'bold', color: '#1f2937'}}>{row.balance?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* ═══ CONFIRM MODAL ═══ */}
      {/* ═══════════════════════════════════════ */}
      {showConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{ color: '#1e293b',
            backgroundColor: 'white', borderRadius: '12px', maxWidth: '500px',
            width: '100%', padding: '24px', direction: 'rtl', textAlign: 'center'
          }}>
            <h3 style={{ color: '#ea580c', marginBottom: '15px' }}>⚠️ تأكيد</h3>
            <p style={{
              whiteSpace: 'pre-line', marginBottom: '20px',
              fontSize: '15px', color: '#374151', lineHeight: '1.6'
            }}>{confirmMessage}</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={handleConfirmYes} style={{
                padding: '10px 24px', backgroundColor: '#dc2626', color: 'white',
                border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px'
              }}>نعم، صرف للضرورة</button>
              <button onClick={handleConfirmNo} style={{
                padding: '10px 24px', backgroundColor: '#6b7280', color: 'white',
                border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px'
              }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* ═══ REJECT MODAL ═══ */}
      {/* ═══════════════════════════════════════ */}
      {rejectModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{ color: '#1e293b',
            backgroundColor: 'white', borderRadius: '12px', maxWidth: '500px',
            width: '100%', padding: '24px', direction: 'rtl'
          }}>
            <h3 style={{ color: '#dc2626', marginBottom: '15px' }}>
              {rejectModal.kind === 'return' ? '⚠️ الإبلاغ عن مشكلة' : '❌ سبب الرفض'}
            </h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows="4" placeholder="اكتب السبب هنا..." style={{
              width: '100%', padding: '10px', borderRadius: '6px',
              border: '1px solid #d1d5db', resize: 'vertical', marginBottom: '15px'
            }} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={submitRejectModal} style={{
                padding: '10px 24px', backgroundColor: '#dc2626', color: 'white',
                border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
              }}>تأكيد</button>
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }} style={{
                padding: '10px 24px', backgroundColor: '#6b7280', color: 'white',
                border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
              }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* ═══ VIEW & PRINT MODAL ═══ */}
      {/* ═══════════════════════════════════════ */}
      {viewModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div id="print-voucher" style={{ color: '#1e293b',
            backgroundColor: 'white', borderRadius: '12px', maxWidth: '700px',
            width: '100%', maxHeight: '90vh', overflow: 'auto', padding: '32px', direction: 'rtl'
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '20px', borderBottom: '3px double #1f2937', paddingBottom: '16px'
            }} className="no-print">
              <h2 style={{ margin: 0, color: '#1f2937' }}>👁️ عرض السند</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => window.print()} style={{
                  padding: '8px 16px', backgroundColor: '#2563eb', color: 'white',
                  border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
                }}>🖨️ طباعة الإذن</button>
                <button onClick={() => setViewModal(null)} style={{
                  padding: '8px 16px', backgroundColor: '#ef4444', color: 'white',
                  border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
                }}>✕ إغلاق</button>
              </div>
            </div>

            <div style={{
              textAlign: 'center', marginBottom: '24px',
              borderBottom: '2px solid #1f2937', paddingBottom: '16px'
            }}>
              <h1 style={{ margin: '0 0 8px 0', fontSize: '22px' }}>
                إذن {viewModal.transaction_type && (['customer_payment','advance_return','custody_return','treasury_funding','other_income'].includes(viewModal.transaction_type) ? 'إيراد' : 'صرف')}
              </h1>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>رقم السند: {viewModal.transaction_number}</div>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
              marginBottom: '20px', fontSize: '14px'
            }}>
              <div><strong>التاريخ:</strong> {viewModal.transaction_date ? new Date(viewModal.transaction_date).toLocaleDateString('ar-EG') : '-'}</div>
              <div><strong>النوع:</strong> {getTypeLabel(viewModal.transaction_type)}</div>
              <div><strong>الحالة:</strong> <span style={{ color: STATUS_LABELS[viewModal.status]?.color, fontWeight: 'bold' }}>{STATUS_LABELS[viewModal.status]?.label || viewModal.status}</span></div>
              <div><strong>طريقة الدفع:</strong> {getPaymentMethodLabel(viewModal.payment_method)}</div>
              <div><strong>المبلغ:</strong> <span style={{ fontSize: '18px', color: '#1f2937', fontWeight: 'bold' }}>{parseFloat(viewModal.amount || 0).toFixed(2)} {viewModal.currency}</span></div>
              <div><strong>المبلغ بالجنيه:</strong> {parseFloat(viewModal.amount_local || 0).toFixed(2)} ج.م</div>
              {viewModal.bank_name && <div><strong>البنك:</strong> {viewModal.bank_name}</div>}
              {viewModal.check_number && <div><strong>رقم الشيك:</strong> {viewModal.check_number}</div>}
              {viewModal.employee_name && <div><strong>الموظف/الجهة:</strong> {viewModal.employee_name}</div>}
              {viewModal.party_name && <div><strong>الجهة:</strong> {viewModal.party_name}</div>}
              {viewModal.customer_name && <div><strong>العميل:</strong> {viewModal.customer_name}</div>}
              {viewModal.supplier_name && <div><strong>المورد:</strong> {viewModal.supplier_name}</div>}
              {viewModal.transfer_from && <div><strong>تحويل من:</strong> {viewModal.transfer_from} ({viewModal.transfer_from_currency})</div>}
              {viewModal.transfer_to && <div><strong>تحويل إلى:</strong> {viewModal.transfer_to} ({viewModal.transfer_to_currency})</div>}
            </div>

            {viewModal.items && viewModal.items.length > 0 && (
              <div style={{ color: '#1e293b',
                marginBottom: '20px', backgroundColor: '#fef3c7',
                padding: '12px', borderRadius: '8px', border: '1px solid #f59e0b'
              }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#92400e' }}>📊 بنود المصروف</h4>
                <table style={{ color: '#1e293b', width: '100%', borderCollapse: 'collapse', fontSize: '12px', backgroundColor: 'white' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f59e0b', color: 'white' }}>
                      <th style={{ padding: '6px' }}>البند</th>
                      <th style={{ padding: '6px' }}>فئة المصروف</th>
                      <th style={{ padding: '6px' }}>مركز التكلفة</th>
                      <th style={{ padding: '6px' }}>المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewModal.items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '6px' }}>{item.description || '-'}</td>
                        <td style={{ padding: '6px' }}>{item.category_name || item.expense_category_id || '-'}</td>
                        <td style={{ padding: '6px' }}>{item.center_name || item.cost_center_id || '-'}</td>
                        <td style={{ padding: '6px', fontWeight: 'bold' }}>{parseFloat(item.amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ color: '#1e293b',
              backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px',
              marginBottom: '20px', border: '1px solid #e5e7eb'
            }}>
              <strong>البيان:</strong>
              <p style={{ margin: '8px 0 0 0', color: '#374151', lineHeight: '1.6' }}>{viewModal.description || '-'}</p>
            </div>

            {viewModal.attachments && viewModal.attachments.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <strong>📎 المرفقات:</strong>
                {viewModal.attachments.map(att => (
                  <div key={att.id} style={{ marginTop: '6px' }}>
                    <a href={`http://localhost:5000/uploads/treasury/${att.stored_name}`} target="_blank" rel="noopener noreferrer" style={{
                      color: '#2563eb', fontWeight: 'bold'
                    }}>📄 {att.file_name}</a>
                  </div>
                ))}
              </div>
            )}

            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px',
              marginTop: '30px', textAlign: 'center'
            }}>
              <div style={{ borderTop: '1px solid #1f2937', paddingTop: '8px' }}>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>أعده</div>
                <div style={{ fontWeight: 'bold' }}>{viewModal.created_by_name || '-'}</div>
              </div>
              <div style={{ borderTop: '1px solid #1f2937', paddingTop: '8px' }}>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>راجعه</div>
                <div style={{ fontWeight: 'bold' }}>{viewModal.reviewed_by ? 'تم المراجعة' : '-'}</div>
              </div>
              <div style={{ borderTop: '1px solid #1f2937', paddingTop: '8px' }}>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>اعتمدته</div>
                <div style={{ fontWeight: 'bold' }}>{viewModal.approved_by ? 'تم الاعتماد' : '-'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* ═══ PRINT STYLES ═══ */}
      {/* ═══════════════════════════════════════ */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-voucher, #print-voucher * { visibility: visible; }
          #print-voucher {
            position: absolute; left: 0; top: 0; width: 100%;
            max-height: none; overflow: visible; box-shadow: none; border: none;
          }
          #print-statement, #print-statement * { visibility: visible; }
          #print-statement {
            position: absolute; left: 0; top: 0; width: 100%;
            max-height: none; overflow: visible; box-shadow: none; border: none;
          }
          .no-print { display: none !important; }
        }
        .print-only { display: none; }
        @media print { .print-only { display: block !important; } }
      `}</style>
    </div>
  );
}

export default Treasury;