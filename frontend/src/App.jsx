import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { LanguageProvider } from './context/LanguageContext';
import { BrandingProvider } from './context/BrandingContext';
// Purchases Module
import PurchasesModule from './pages/PurchasesModule';
import Currencies from './pages/Currencies';
import PurchaseRequests from './pages/PurchaseRequests';
import PurchaseOrders from './pages/PurchaseOrders';
import Purchases from './pages/Purchases';
import Suppliers from './pages/Suppliers';
import SupplierReports from './pages/SupplierReports';
import VatReport from './pages/VatReport';
import AgingReport from './pages/AgingReport';
import PurchaseApprovals from './pages/PurchaseApprovals';
import Shipments from './pages/Shipments';

// Sales Module
import SalesModule from './pages/SalesModule';
import SalesOrders from './pages/SalesOrders';
import SalesInvoices from './pages/SalesInvoices';
import Customers from './pages/Customers';
import TaxSettings from './pages/TaxSettings';
import PricingSheets from './pages/PricingSheets';
import TaxInvoices from './pages/TaxInvoices';
import PriceQuotes from './pages/PriceQuotes';
import SalesCommissions from './pages/SalesCommissions';
import RefundableDeposits from './pages/RefundableDeposits';
import WorkWarranties from './pages/WorkWarranties';
import CustomerReports from './pages/CustomerReports';
import SalesReports from './pages/SalesReports';
import WarehouseIssues from './pages/WarehouseIssues';
import AuthorityTrackingReport from './pages/AuthorityTrackingReport';
import WorkOrders from './pages/WorkOrders';
import DeliveryNotes from './pages/DeliveryNotes';

// Treasury Module
import TreasuryModule from './pages/TreasuryModule';
import Treasury from './pages/Treasury';
import BankAccounts from './pages/BankAccounts';

import CostCenters from './pages/CostCenters';
import ExpenseCategories from './pages/ExpenseCategories';
import ExpenseReport from './pages/ExpenseReport';
import PartnerManagement from './pages/PartnerManagement';

// Warehouse Module
import WarehouseModule from './pages/WarehouseModule';
import Items from './pages/Items';
import Receipts from './pages/Receipts';
import Requests from './pages/Requests';
import Movements from './pages/Movements';
import Quality from './pages/Quality';

// Custody Module (جديد - شاشة واحدة)
import CustodyModule from './pages/CustodyModule';
import CustodySubmissions from './pages/CustodySubmissions';
import CustodyApprovals from './pages/CustodyApprovals';
import CustodySettlements from './pages/CustodySettlements';
import CustodyEmployeeStatement from './pages/CustodyEmployeeStatement';
import CustodyEmployeesSummaryReport from './pages/CustodyEmployeesSummaryReport';
import CustodySettlementVoucher from './pages/CustodySettlementVoucher';

// Other
import Employees from './pages/Employees';
import Approvals from './pages/Approvals';
import Reports from './pages/Reports';
import ChangePassword from './pages/ChangePassword';
import Locations from './pages/Locations';

// Settings (جديد)
import Settings from './pages/Settings';

function App() {
  return (
    <LanguageProvider>
  <BrandingProvider>
    <ThemeProvider>
      <AuthProvider>
       <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Purchases Module */}
          <Route path="/purchases-module" element={<PurchasesModule />} />
          <Route path="/currencies" element={<Currencies />} />
          <Route path="/purchase-requests" element={<PurchaseRequests />} />
          <Route path="/purchase-orders" element={<PurchaseOrders />} />
          <Route path="/purchases" element={<Purchases />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/purchase-approvals" element={<PurchaseApprovals />} />
          <Route path="/supplier-reports" element={<SupplierReports />} />
          <Route path="/vat-report" element={<VatReport />} />
          <Route path="/aging-report" element={<AgingReport />} />
          <Route path="/shipments" element={<Shipments />} />

          {/* Sales Module */}
          <Route path="/sales-module" element={<SalesModule />} />
          <Route path="/sales-orders" element={<SalesOrders />} />
          <Route path="/sales-invoices" element={<SalesInvoices />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/tax-settings" element={<TaxSettings />} />
          <Route path="/pricing-sheets" element={<PricingSheets />} />
          <Route path="/tax-invoices" element={<TaxInvoices />} />
          <Route path="/price-quotes" element={<PriceQuotes />} />
          <Route path="/sales-commissions" element={<SalesCommissions />} />
          <Route path="/refundable-deposits" element={<RefundableDeposits />} />
          <Route path="/work-warranties" element={<WorkWarranties />} />
          <Route path="/customer-reports" element={<CustomerReports />} />
          <Route path="/sales-reports" element={<SalesReports />} />
          <Route path="/warehouse-issues" element={<WarehouseIssues />} />
          <Route path="/authority-tracking" element={<AuthorityTrackingReport />} />
          <Route path="/work-orders" element={<WorkOrders />} />
          <Route path="/delivery-notes" element={<DeliveryNotes />} />

          {/* Treasury Module */}
          <Route path="/treasury-module" element={<TreasuryModule />} />
          <Route path="/treasury" element={<Treasury />} />
          <Route path="/custody-settlements" element={<CustodySettlements />} />
          <Route path="/cost-centers" element={<CostCenters />} />
          <Route path="/expense-categories" element={<ExpenseCategories />} />
          <Route path="/bank-accounts" element={<BankAccounts />} />
          <Route path="/expense-report" element={<ExpenseReport />} />
          <Route path="/partner-management" element={<PartnerManagement />} />

          {/* Warehouse Module */}
          <Route path="/warehouse-module" element={<WarehouseModule />} />
          <Route path="/items" element={<Items />} />
          <Route path="/receipts" element={<Receipts />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/movements" element={<Movements />} />
          <Route path="/quality" element={<Quality />} />

          {/* Custody Module - جديد */}
          <Route path="/custody-module" element={<CustodyModule />} />
          <Route path="/custody-submissions" element={<CustodySubmissions />} />
          <Route path="/custody-approvals" element={<CustodyApprovals />} />
          <Route path="/custody-employee-statement" element={<CustodyEmployeeStatement />} />
          <Route path="/custody-employees-summary" element={<CustodyEmployeesSummaryReport />} />
          <Route path="/custody-settlement-voucher" element={<CustodySettlementVoucher />} />

          {/* Other */}
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/locations" element={<Locations />} />

          <Route path="*" element={<Navigate to="/" />} />
         </Routes>
       </Router>
       </AuthProvider>
    </ThemeProvider>
  </BrandingProvider>
</LanguageProvider>
  );
}

export default App;
