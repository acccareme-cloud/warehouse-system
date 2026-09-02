const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const fs = require('fs');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Create uploads directory if not exists
if (!fs.existsSync('uploads/attachments')) {
  fs.mkdirSync('uploads/attachments', { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================
// Routes - كل الـ Routes هنا
// ============================================

const authRoutes = require('./routes/auth');
const itemRoutes = require('./routes/items');
const warehouseRoutes = require('./routes/warehouses');
const requestRoutes = require('./routes/requests');
const receiptRoutes = require('./routes/receipts');
const qualityRoutes = require('./routes/quality');
const approvalRoutes = require('./routes/approvals');
const movementRoutes = require('./routes/movements');
const serialRoutes = require('./routes/serialNumbers');
const purchaseRoutes = require('./routes/purchases');
const currenciesRoutes = require('./routes/currencies');
const attachmentRoutes = require('./routes/attachments');
const purchaseRequestRoutes = require('./routes/purchaseRequests');
const purchaseOrderRoutes = require('./routes/purchaseOrders');
const purchaseInvoiceRoutes = require('./routes/purchaseInvoices');
const supplierRoutes = require('./routes/suppliers');
const receiptVoucherRoutes = require('./routes/receiptVouchers');
const customerRoutes = require('./routes/customers');
const treasuryRoutes = require('./routes/treasury');
const expenseRoutes = require('./routes/expenses');
const costCenterRoutes = require('./routes/costCenters');
const expenseCategoryRoutes = require('./routes/expenseCategories');
const custodyRoutes = require('./routes/custodies');
const custodySettlementRoutes = require('./routes/custodySettlements');
const supplierReportsRoutes = require('./routes/supplierReports');
const employeesRoutes = require('./routes/employees');
const custodySubmissionsRoutes = require('./routes/custodySubmissions');
const bankAccountRoutes = require('./routes/bankAccounts');
const expenseReportRoutes = require('./routes/expenseReport');
const salesInvoiceRoutes = require('./routes/salesInvoices');
const categoriesRouter = require('./routes/categories');
const unitsRouter = require('./routes/units');
const shipmentsRoutes = require('./routes/shipments');
const settingsRoutes = require('./routes/settings');
const partnerFinancingRoutes = require('./routes/partnerFinancing');
const partnerPaymentRoutes = require('./routes/partnerPayments');
const equityReportRoutes = require('./routes/equityReport');



// Routes جديدة للمبيعات
const taxSettingsRoutes = require('./routes/taxSettings');
const pricingSheetRoutes = require('./routes/pricingSheets');
const taxInvoiceRoutes = require('./routes/taxInvoices');
const priceQuoteRoutes = require('./routes/priceQuotes');
const salesCommissionRoutes = require('./routes/salesCommissions');
const refundableDepositRoutes = require('./routes/refundableDeposits');
const workWarrantyRoutes = require('./routes/workWarranties');
const customerReportRoutes = require('./routes/customerReports');
const warehouseIssueRoutes = require('./routes/warehouseIssues');
const customerTaxSettingRoutes = require('./routes/customerTaxSettings');
const salesOrderRoutes = require('./routes/salesOrders');
const deliveryNoteRoutes = require('./routes/deliveryNotes');
const workOrderRoutes = require('./routes/workOrders');
const adminRoutes = require('./routes/admin');
const locationsRouter = require('./routes/locations');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/quality', qualityRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/movements', movementRoutes);
app.use('/api/serials', serialRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/currencies', currenciesRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/purchase-requests', purchaseRequestRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/purchase-invoices', purchaseInvoiceRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/receipt-vouchers', receiptVoucherRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/treasury', treasuryRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/cost-centers', costCenterRoutes);
app.use('/api/expense-categories', expenseCategoryRoutes);
app.use('/api/custodies', custodyRoutes);
app.use('/api/custody-settlements', custodySettlementRoutes);
app.use('/api/supplier-reports', supplierReportsRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/custody-submissions', custodySubmissionsRoutes);
app.use('/api/custody-reports', require('./routes/custodyReports'));
app.use('/api/bank-accounts', bankAccountRoutes);
app.use('/api/expense-reports', expenseReportRoutes);
app.use('/api/sales-invoices', salesInvoiceRoutes);
app.use('/api/categories', categoriesRouter);
app.use('/api/units', unitsRouter);
app.use('/api/shipments', shipmentsRoutes);  // ✅ صح
app.use('/api/settings', settingsRoutes);
app.use('/api/partner-financing', partnerFinancingRoutes);
app.use('/api/partner-payments', partnerPaymentRoutes);
app.use('/api/equity-report', equityReportRoutes);

// API Routes جديدة للمبيعات
app.use('/api/tax-settings', taxSettingsRoutes);
app.use('/api/pricing-sheets', pricingSheetRoutes);
app.use('/api/tax-invoices', taxInvoiceRoutes);
app.use('/api/price-quotes', priceQuoteRoutes);
app.use('/api/sales-commissions', salesCommissionRoutes);
app.use('/api/refundable-deposits', refundableDepositRoutes);
app.use('/api/work-warranties', workWarrantyRoutes);
app.use('/api/customer-reports', customerReportRoutes);
app.use('/api/warehouse-issues', warehouseIssueRoutes);
app.use('/api/customer-tax-settings', customerTaxSettingRoutes);
app.use('/api/sales-orders', salesOrderRoutes);
app.use('/api/delivery-notes', deliveryNoteRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/locations', locationsRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log('Server running on port ' + PORT));

module.exports = app;