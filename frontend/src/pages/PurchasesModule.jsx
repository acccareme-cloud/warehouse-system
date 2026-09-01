import ModuleHubLayout from '../components/ModuleHubLayout';

const MENUS = [
  { icon: '📝', key: 'purchaseRequests', color: '#17a2b8', path: '/purchase-requests' },
  { icon: '📦', key: 'purchaseOrders', color: '#28a745', path: '/purchase-orders' },
  { icon: '🧾', key: 'purchaseInvoices', color: '#92400e', path: '/purchases' },
  { icon: '🚢', key: 'shipments', color: '#0d9488', path: '/shipments' },
  { icon: '🏭', key: 'suppliers', color: '#dc2626', path: '/suppliers' },
  { icon: '📊', key: 'supplierReports', color: '#2563eb', path: '/supplier-reports' },
  { icon: '🧾', key: 'vatReport', color: '#dc2626', path: '/vat-report' },
  { icon: '⏰', key: 'agingReport', color: '#d97706', path: '/aging-report' },
  { icon: '💱', key: 'currencies', color: '#0d9488', path: '/currencies' },
];

function PurchasesModule() {
  return <ModuleHubLayout icon="🛒" titleKey="moduleHub.purchasesTitle" menus={MENUS} />;
}

export default PurchasesModule;
