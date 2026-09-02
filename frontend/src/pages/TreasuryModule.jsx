// frontend/src/pages/TreasuryModule.jsx
import ModuleHubLayout from '../components/ModuleHubLayout';

const MENUS = [
  { icon: '', key: 'receiptVouchers', color: '#22C55E', path: '/receipt-vouchers' },
  { icon: '💸', key: 'payments', color: '#EF4444', path: '/payments' },
  { icon: '🏦', key: 'bankAccounts', color: '#3B82F6', path: '/bank-accounts' },
  { icon: '💰', key: 'treasury', color: '#14B8A6', path: '/treasury' },
  { icon: '', key: 'expenses', color: '#F59E0B', path: '/expenses' },
  { icon: '📋', key: 'expenseCategories', color: '#8B5CF6', path: '/expense-categories' },
  { icon: '🤝', key: 'partnerFinancing', color: '#06B6D4', path: '/partner-financing' },
  { icon: '💵', key: 'partnerPayment', color: '#EC4899', path: '/partner-payment' },
  { icon: '📈', key: 'equityReport', color: '#10B981', path: '/equity-report' },
];

function TreasuryModule() {
  return <ModuleHubLayout icon="💰" titleKey="moduleHub.treasuryTitle" menus={MENUS} />;
}

export default TreasuryModule;