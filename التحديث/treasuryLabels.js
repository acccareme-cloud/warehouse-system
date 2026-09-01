// frontend/src/pages/treasuryLabels.js
//
// نسخة مترجمة من قواميس الليبلز في Treasury.jsx (STATUS_LABELS / WORKFLOW_TABS /
// INCOME_TYPES / OUTCOME_TYPES / PAYMENT_FILTERS) من غير ما نلمس أي منطق/state.
//
// طريقة الاستخدام جوه Treasury.jsx (ديف مينيمال، صفر تغيير في الـ logic):
//
//   import { useLanguage } from '../context/LanguageContext';
//   import { getStatusLabels, getWorkflowTabs, getIncomeTypes, getOutcomeTypes, getPaymentFilters } from './treasuryLabels';
//   ...
//   function Treasury() {
//     const { t } = useLanguage();
//     const STATUS_LABELS = getStatusLabels(t);
//     const WORKFLOW_TABS = getWorkflowTabs(t);
//     const INCOME_TYPES = getIncomeTypes(t);
//     const OUTCOME_TYPES = getOutcomeTypes(t);
//     const PAYMENT_FILTERS = getPaymentFilters(t);
//     // ... باقي الكود يفضل زي ما هو بالظبط (بيستخدم STATUS_LABELS[...] إلخ زي الأول)
//
// شيل تعريفات الـ const القديمة (اللي فوق function Treasury) واستبدلها بالسطور دي
// جوه الفانكشن. القيم (colors, icons, values) هي هي بالظبط — بس الـ label بقى
// بييجي من translations.js.

export const getStatusLabels = (t) => ({
  pending_review: { label: `⏳ ${t('treasury.status.pending_review')}`, color: '#f59e0b', bg: '#fef3c7' },
  rejected_by_review: { label: `❌ ${t('treasury.status.rejected_by_review')}`, color: '#dc2626', bg: '#fee2e2' },
  pending_approval: { label: `👀 ${t('treasury.status.pending_approval')}`, color: '#2563eb', bg: '#dbeafe' },
  rejected_by_finance: { label: `❌ ${t('treasury.status.rejected_by_finance')}`, color: '#dc2626', bg: '#fee2e2' },
  approved: { label: `✅ ${t('treasury.status.approved')}`, color: '#7c3aed', bg: '#ede9fe' },
  return_requested: { label: `⚠️ ${t('treasury.status.return_requested')}`, color: '#ea580c', bg: '#ffedd5' },
  active: { label: `💸 ${t('treasury.status.active')}`, color: '#059669', bg: '#d1fae5' },
  cancelled: { label: `🚫 ${t('treasury.status.cancelled')}`, color: '#6b7280', bg: '#f3f4f6' },
});

export const getWorkflowTabs = (t) => [
  { key: 'all', label: `📋 ${t('treasury.tabs.all')}` },
  { key: 'pending_review', label: `📝 ${t('treasury.tabs.pending_review')}` },
  { key: 'pending_approval', label: `⏳ ${t('treasury.tabs.pending_approval')}` },
  { key: 'approved', label: `✅ ${t('treasury.tabs.approved')}` },
  { key: 'active', label: `💸 ${t('treasury.tabs.active')}` },
];

export const getIncomeTypes = (t) => [
  { value: 'customer_payment', label: t('treasury.incomeTypes.customer_payment'), color: '#059669', icon: '💵' },
  { value: 'advance_return', label: t('treasury.incomeTypes.advance_return'), color: '#0891b2', icon: '↩️' },
  { value: 'custody_return', label: t('treasury.incomeTypes.custody_return'), color: '#d97706', icon: '📋' },
  { value: 'treasury_funding', label: t('treasury.incomeTypes.treasury_funding'), color: '#7c3aed', icon: '💰' },
  { value: 'other_income', label: t('treasury.incomeTypes.other_income'), color: '#10b981', icon: '📈' },
];

export const getOutcomeTypes = (t) => [
  { value: 'supplier_payment', label: t('treasury.outcomeTypes.supplier_payment'), color: '#dc2626', icon: '🏭' },
  { value: 'custody_payment', label: t('treasury.outcomeTypes.custody_payment'), color: '#2563eb', icon: '👤' },
  { value: 'custody_settlement', label: t('treasury.outcomeTypes.custody_settlement'), color: '#b91c1c', icon: '📤' },
  { value: 'salary_advance', label: t('treasury.outcomeTypes.salary_advance'), color: '#ea580c', icon: '💳' },
  { value: 'non_employee_advance', label: t('treasury.outcomeTypes.non_employee_advance'), color: '#db2777', icon: '👥' },
  { value: 'expense', label: t('treasury.outcomeTypes.expense'), color: '#be185d', icon: '📊' },
  { value: 'other_outcome', label: t('treasury.outcomeTypes.other_outcome'), color: '#4b5563', icon: '📤' },
  { value: 'bank_transfer', label: t('treasury.outcomeTypes.bank_transfer'), color: '#7c3aed', icon: '🏦' },
];

export const getPaymentFilters = (t) => [
  { key: 'all', label: `📋 ${t('treasury.paymentFilters.all')}` },
  { key: 'cash', label: `💵 ${t('treasury.paymentFilters.cash')}` },
  { key: 'bank', label: `🏦 ${t('treasury.paymentFilters.bank')}` },
  { key: 'transfer', label: `🔄 ${t('treasury.paymentFilters.transfer')}` },
];
