import ModuleHubLayout from '../components/ModuleHubLayout';

const MENUS = [
  { icon: '📦', key: 'items', color: '#2563eb', path: '/items' },
  { icon: '📥', key: 'receipts', color: '#28a745', path: '/receipts' },
  { icon: '📤', key: 'requests', color: '#fd7e14', path: '/requests' },
  { icon: '🚚', key: 'movements', color: '#e83e8c', path: '/movements' },
  { icon: '🔍', key: 'quality', color: '#0891b2', path: '/quality' },
  { icon: '📋', key: 'warehouseIssues', color: '#dc2626', path: '/warehouse-issues' },
];

function WarehouseModule() {
  return <ModuleHubLayout icon="📦" titleKey="moduleHub.warehouseTitle" menus={MENUS} />;
}

export default WarehouseModule;
