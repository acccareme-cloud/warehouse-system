import ModuleHubLayout from '../components/ModuleHubLayout';

const MENUS = [
  { icon: '💵', key: 'treasuryVouchers', color: '#6f42c1', path: '/treasury' },
  { icon: '🏦', key: 'bankAccounts', color: '#17a2b8', path: '/bank-accounts' },
  { icon: '📊', key: 'costCenters', color: '#fd7e14', path: '/cost-centers' },
  { icon: '📝', key: 'expenseCategories', color: '#92400e', path: '/expense-categories' },
  { icon: '📈', key: 'expenseReport', color: '#1565c0', path: '/expense-report' },
];

function TreasuryModule() {
  return <ModuleHubLayout icon="💵" titleKey="moduleHub.treasuryTitle" menus={MENUS} />;
}

export default TreasuryModule;
