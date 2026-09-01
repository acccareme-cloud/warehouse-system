import ModuleHubLayout from '../components/ModuleHubLayout';

const MENUS = [
  { icon: '📋', key: 'salesOrders', color: '#059669', path: '/sales-orders' },
  { icon: '🧾', key: 'salesInvoices', color: '#2563eb', path: '/sales-invoices' },
  { icon: '👥', key: 'customers', color: '#17a2b8', path: '/customers' },
  { icon: '🔧', key: 'workOrders', color: '#f59e0b', path: '/work-orders' },
  { icon: '📦', key: 'deliveryNotes', color: '#22c55e', path: '/delivery-notes' },
  { icon: '📊', key: 'salesReports', color: '#7c3aed', path: '/sales-reports' },
  { icon: '💰', key: 'salesCommissions', color: '#059669', path: '/sales-commissions' },
  { icon: '🔒', key: 'refundableDeposits', color: '#0d9488', path: '/refundable-deposits' },
  { icon: '📜', key: 'workWarranties', color: '#f59e0b', path: '/work-warranties' },
  { icon: '📊', key: 'customerReports', color: '#2563eb', path: '/customer-reports' },
  { icon: '⚙️', key: 'taxSettings', color: '#6b7280', path: '/tax-settings' },
];

function SalesModule() {
  return <ModuleHubLayout icon="💰" titleKey="moduleHub.salesTitle" menus={MENUS} />;
}

export default SalesModule;
