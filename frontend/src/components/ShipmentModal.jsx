import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { 
  FaPlus, FaTrash, FaTimes, FaCalculator, FaShip, FaDollarSign,
  FaMoneyBill, FaUserTie, FaReceipt, FaFileInvoice, FaPercentage,
  FaCoins, FaArrowRight
} from 'react-icons/fa';

const ShipmentModal = ({ shipment, purchases, suppliers, onClose, isDark, colors }) => {
  const API_URL = import.meta.env.VITE_API_URL;
  const isEdit = !!shipment;

  const [formData, setFormData] = useState({
    shipment_number: '',
    purchase_id: '',
    supplier_id: '',
    shipment_date: new Date().toISOString().split('T')[0],
    arrival_date: '',
    invoice_amount_usd: 0,
    invoice_amount_egp: 0,
    bank_exchange_rate: 50,

    // مصاريف الشحنة
    customs_duty: 0,
    vat_14: 0,
    profit_tax_1: 0,
    clearance_fees: 0,
    shipping_fees: 0,
    bank_fees: 0,
    bank_commission: 0,
    other_fees: 0,

    // عهدة المخلص
    custodian_id: '',
    custody_amount: 0,
    custody_settled: false,

    notes: '',
    status: 'open'
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/employees`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setEmployees(response.data || []);
      } catch (error) {
        console.error('Error fetching employees:', error);
      }
    };
    fetchEmployees();
  }, [API_URL]);

  useEffect(() => {
    if (shipment) {
      setFormData({
        shipment_number: shipment.shipment_number || '',
        purchase_id: shipment.purchase_id || '',
        supplier_id: shipment.supplier_id || '',
        shipment_date: shipment.shipment_date ? shipment.shipment_date.split('T')[0] : new Date().toISOString().split('T')[0],
        arrival_date: shipment.arrival_date ? shipment.arrival_date.split('T')[0] : '',
        invoice_amount_usd: shipment.invoice_amount_usd || 0,
        invoice_amount_egp: shipment.invoice_amount_egp || 0,
        bank_exchange_rate: shipment.bank_exchange_rate || 50,
        customs_duty: shipment.customs_duty || 0,
        vat_14: shipment.vat_14 || 0,
        profit_tax_1: shipment.profit_tax_1 || 0,
        clearance_fees: shipment.clearance_fees || 0,
        shipping_fees: shipment.shipping_fees || 0,
        bank_fees: shipment.bank_fees || 0,
        bank_commission: shipment.bank_commission || 0,
        other_fees: shipment.other_fees || 0,
        custodian_id: shipment.custodian_id || '',
        custody_amount: shipment.custody_amount || 0,
        custody_settled: shipment.custody_settled || false,
        notes: shipment.notes || '',
        status: shipment.status || 'open'
      });
    }
  }, [shipment]);

  const handlePurchaseSelect = (purchaseId) => {
    const selectedPurchase = purchases.find(p => p.id === parseInt(purchaseId));
    if (selectedPurchase) {
      setFormData(prev => ({
        ...prev,
        purchase_id: purchaseId,
        supplier_id: selectedPurchase.supplier_id || '',
        invoice_amount_usd: selectedPurchase.total_amount || 0,
        invoice_amount_egp: selectedPurchase.total_amount_local || 0,
        bank_exchange_rate: selectedPurchase.exchange_rate || 50
      }));
    }
  };

  const calculateTotalExpenses = () => {
    return (
      parseFloat(formData.customs_duty || 0) +
      parseFloat(formData.vat_14 || 0) +
      parseFloat(formData.profit_tax_1 || 0) +
      parseFloat(formData.clearance_fees || 0) +
      parseFloat(formData.shipping_fees || 0) +
      parseFloat(formData.bank_fees || 0) +
      parseFloat(formData.bank_commission || 0) +
      parseFloat(formData.other_fees || 0)
    );
  };

  const calculateTotalLandedCost = () => {
    return (parseFloat(formData.invoice_amount_egp) || 0) + calculateTotalExpenses();
  };

  const calculateActualExchangeRate = () => {
    const invoiceUsd = parseFloat(formData.invoice_amount_usd) || 0;
    if (invoiceUsd === 0) return 0;
    return calculateTotalLandedCost() / invoiceUsd;
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.shipment_number.trim()) newErrors.shipment_number = 'رقم الشحنة مطلوب';
    if (!formData.purchase_id) newErrors.purchase_id = 'الفاتورة مطلوبة';
    if (!formData.supplier_id) newErrors.supplier_id = 'المورد مطلوب';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const url = isEdit 
        ? `${API_URL}/api/shipments/${shipment.id}`
        : `${API_URL}/api/shipments`;
      const method = isEdit ? 'put' : 'post';

      const payload = {
        ...formData,
        total_expenses: calculateTotalExpenses(),
        total_landed_cost: calculateTotalLandedCost(),
        actual_exchange_rate: calculateActualExchangeRate()
      };

      await axios[method](url, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      toast.success(isEdit ? 'تم التعديل بنجاح' : 'تم إنشاء الشحنة بنجاح');
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className={`absolute inset-0 ${isDark ? 'bg-black/70' : 'bg-black/50'}`} onClick={onClose} />

      <div className={`relative w-full max-w-6xl max-h-[90vh] overflow-auto rounded-xl shadow-2xl ${colors.modal}`}>
        <div className={`flex justify-between items-center p-6 border-b ${colors.border}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isDark ? 'bg-purple-900/30' : 'bg-purple-100'}`}>
              <FaShip className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{isEdit ? 'تعديل شحنة' : 'شحنة جديدة'}</h2>
              <p className={`text-sm mt-1 ${colors.textMuted}`}>
                {isEdit ? shipment?.shipment_number : 'إنشاء شحنة استيراد'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}>
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className={`block text-sm font-medium mb-1 ${colors.text}`}>
                رقم الشحنة <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.shipment_number}
                onChange={(e) => setFormData(prev => ({ ...prev, shipment_number: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input} ${errors.shipment_number ? 'border-red-500' : ''}`}
                placeholder="SH-2026-001"
              />
              {errors.shipment_number && <p className="text-red-500 text-xs mt-1">{errors.shipment_number}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${colors.text}`}>
                الفاتورة <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.purchase_id}
                onChange={(e) => handlePurchaseSelect(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input} ${errors.purchase_id ? 'border-red-500' : ''}`}
              >
                <option value="">اختر الفاتورة</option>
                {purchases.map(p => (
                  <option key={p.id} value={p.id}>{p.purchase_number} - {p.supplier_name}</option>
                ))}
              </select>
              {errors.purchase_id && <p className="text-red-500 text-xs mt-1">{errors.purchase_id}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${colors.text}`}>
                المورد <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData(prev => ({ ...prev, supplier_id: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input} ${errors.supplier_id ? 'border-red-500' : ''}`}
              >
                <option value="">اختر المورد</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.supplier_code} - {s.name}</option>
                ))}
              </select>
              {errors.supplier_id && <p className="text-red-500 text-xs mt-1">{errors.supplier_id}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${colors.text}`}>تاريخ الشحنة</label>
              <input
                type="date"
                value={formData.shipment_date}
                onChange={(e) => setFormData(prev => ({ ...prev, shipment_date: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${colors.text}`}>تاريخ الوصول المتوقع</label>
              <input
                type="date"
                value={formData.arrival_date}
                onChange={(e) => setFormData(prev => ({ ...prev, arrival_date: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${colors.text}`}>الحالة</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
              >
                <option value="open">مفتوحة</option>
                <option value="in_progress">قيد التنفيذ</option>
                <option value="cleared">تم الإفراج</option>
                <option value="completed">مكتملة</option>
              </select>
            </div>
          </div>

          {/* Invoice Amounts */}
          <div className={`p-4 rounded-xl border ${colors.border} mb-6 ${isDark ? 'bg-blue-900/10' : 'bg-blue-50'}`}>
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <FaFileInvoice className="w-5 h-5 text-blue-500" />
              قيمة الفاتورة
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${colors.text}`}>قيمة الفاتورة بالدولار</label>
                <div className="relative">
                  <FaDollarSign className={`absolute right-3 top-3 w-4 h-4 ${colors.textMuted}`} />
                  <input
                    type="number"
                    step="0.01"
                    value={formData.invoice_amount_usd}
                    onChange={(e) => setFormData(prev => ({ ...prev, invoice_amount_usd: e.target.value }))}
                    className={`w-full pr-10 px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
                  />
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${colors.text}`}>قيمة الفاتورة بالجنيه (من البنك)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.invoice_amount_egp}
                  onChange={(e) => setFormData(prev => ({ ...prev, invoice_amount_egp: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${colors.text}`}>معامل التحويل (البنك)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.bank_exchange_rate}
                  onChange={(e) => setFormData(prev => ({ ...prev, bank_exchange_rate: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
                />
              </div>
            </div>
          </div>

          {/* Expenses */}
          <div className={`p-4 rounded-xl border ${colors.border} mb-6 ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <FaMoneyBill className="w-5 h-5 text-green-500" />
              مصاريف الشحنة
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${colors.text}`}>ضريبة الوارد (جمارك)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.customs_duty}
                  onChange={(e) => setFormData(prev => ({ ...prev, customs_duty: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${colors.text}`}>ضريبة 14% (قيمة مضافة)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.vat_14}
                  onChange={(e) => setFormData(prev => ({ ...prev, vat_14: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${colors.text}`}>ضريبة 1% (أرباح)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.profit_tax_1}
                  onChange={(e) => setFormData(prev => ({ ...prev, profit_tax_1: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${colors.text}`}>مصاريف التخليص</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.clearance_fees}
                  onChange={(e) => setFormData(prev => ({ ...prev, clearance_fees: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${colors.text}`}>مصاريف الشحن</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.shipping_fees}
                  onChange={(e) => setFormData(prev => ({ ...prev, shipping_fees: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${colors.text}`}>مصاريف البنك</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.bank_fees}
                  onChange={(e) => setFormData(prev => ({ ...prev, bank_fees: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${colors.text}`}>عمولة البنك (تدبير)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.bank_commission}
                  onChange={(e) => setFormData(prev => ({ ...prev, bank_commission: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${colors.text}`}>مصاريف أخرى</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.other_fees}
                  onChange={(e) => setFormData(prev => ({ ...prev, other_fees: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
                />
              </div>
            </div>
          </div>

          {/* Custody */}
          <div className={`p-4 rounded-xl border ${colors.border} mb-6 ${isDark ? 'bg-yellow-900/10' : 'bg-yellow-50'}`}>
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <FaUserTie className="w-5 h-5 text-yellow-500" />
              عهدة المخلص
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${colors.text}`}>المخلص</label>
                <select
                  value={formData.custodian_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, custodian_id: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
                >
                  <option value="">اختر المخلص</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${colors.text}`}>مبلغ العهدة</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.custody_amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, custody_amount: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.custody_settled}
                  onChange={(e) => setFormData(prev => ({ ...prev, custody_settled: e.target.checked }))}
                  className="w-5 h-5 rounded ml-2"
                />
                <label className={`text-sm font-medium ${colors.text}`}>تم التسوية</label>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className={`block text-sm font-medium mb-1 ${colors.text}`}>ملاحظات</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
              rows="2"
            />
          </div>

          {/* Summary - Landed Cost */}
          <div className={`p-6 rounded-xl border-2 ${isDark ? 'border-green-700 bg-green-900/10' : 'border-green-300 bg-green-50'} mb-6`}>
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <FaCalculator className="w-6 h-6 text-green-500" />
              ملخص التكلفة النهائية (Landed Cost)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} border ${colors.border}`}>
                <p className={`text-sm ${colors.textMuted}`}>قيمة الفاتورة</p>
                <p className="text-xl font-bold">{parseFloat(formData.invoice_amount_egp || 0).toLocaleString('ar-EG')} ج.م</p>
              </div>
              <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} border ${colors.border}`}>
                <p className={`text-sm ${colors.textMuted}`}>إجمالي المصاريف</p>
                <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                  {calculateTotalExpenses().toLocaleString('ar-EG')} ج.م
                </p>
              </div>
              <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} border ${colors.border}`}>
                <p className={`text-sm ${colors.textMuted}`}>التكلفة النهائية</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  {calculateTotalLandedCost().toLocaleString('ar-EG')} ج.م
                </p>
              </div>
              <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} border ${colors.border}`}>
                <p className={`text-sm ${colors.textMuted}`}>معامل التحويل الفعلي</p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {calculateActualExchangeRate().toFixed(2)} ج.م/$
                </p>
              </div>
            </div>
            <div className={`mt-4 p-3 rounded-lg ${isDark ? 'bg-blue-900/20' : 'bg-blue-100'}`}>
              <p className="text-sm">
                <strong>المعادلة:</strong> معامل التحويل الفعلي = التكلفة النهائية ÷ قيمة الفاتورة بالدولار
              </p>
              <p className="text-sm mt-1">
                {calculateTotalLandedCost().toLocaleString('ar-EG')} ÷ {parseFloat(formData.invoice_amount_usd || 0).toLocaleString('ar-EG')} = {calculateActualExchangeRate().toFixed(2)} ج.م/$
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className={`px-6 py-2.5 rounded-lg border transition-colors ${colors.buttonSecondary}`}>
              إلغاء
            </button>
            <button type="submit" disabled={loading} className={`px-6 py-2.5 rounded-lg transition-colors ${colors.buttonPrimary} disabled:opacity-50`}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  جاري الحفظ...
                </span>
              ) : (
                isEdit ? 'حفظ التعديلات' : 'حفظ الشحنة'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShipmentModal;
