import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { 
  FaPlus, FaTrash, FaTimes, FaCalculator, FaExclamationTriangle,
  FaDollarSign, FaCoins, FaSearch, FaCheck, FaArrowRight,
  FaFileInvoice, FaWarehouse, FaShip, FaGhost
} from 'react-icons/fa';

const PurchaseInvoiceModal = ({ invoice, items, suppliers, currencies, approvedOrders, onClose, isDark, colors }) => {
  const API_URL = import.meta.env.VITE_API_URL;
  const isEdit = !!invoice;

  const [formData, setFormData] = useState({
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    supplier_id: '',
    purchase_order_id: '',
    invoice_type: 'local_tax',
    currency_id: '',
    exchange_rate: 1,
    has_vat: true,
    vat_rate: 14,
    has_discount_tax: false,
    discount_tax_rate: 0,
    is_dummy: false,
    dummy_type: '',
    notes: '',
    items: [{ item_id: '', quantity: 1, unit_price: 0, is_vat_exempt: false, notes: '' }]
  });

  const [showOrderSelector, setShowOrderSelector] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (invoice) {
      setFormData({
        invoice_number: invoice.invoice_number || '',
        invoice_date: invoice.invoice_date ? invoice.invoice_date.split('T')[0] : new Date().toISOString().split('T')[0],
        supplier_id: invoice.supplier_id || '',
        purchase_order_id: invoice.purchase_order_id || '',
        invoice_type: invoice.invoice_type || 'local_tax',
        currency_id: invoice.currency_id || '',
        exchange_rate: invoice.exchange_rate || 1,
        has_vat: invoice.has_vat !== false,
        vat_rate: invoice.vat_rate || 14,
        has_discount_tax: invoice.has_discount_tax || false,
        discount_tax_rate: invoice.discount_tax_rate || 0,
        is_dummy: invoice.is_dummy || false,
        dummy_type: invoice.dummy_type || '',
        notes: invoice.notes || '',
        items: invoice.items?.map(i => ({
          item_id: i.item_id?.toString() || '',
          quantity: i.quantity || 1,
          unit_price: i.unit_price || 0,
          is_vat_exempt: i.is_vat_exempt || false,
          notes: i.notes || ''
        })) || [{ item_id: '', quantity: 1, unit_price: 0, is_vat_exempt: false, notes: '' }]
      });
    }
  }, [invoice]);

  const handleCurrencyChange = (currencyId) => {
    const selectedCurrency = currencies.find(c => c.id === parseInt(currencyId));
    if (selectedCurrency) {
      setFormData(prev => ({
        ...prev,
        currency_id: currencyId,
        exchange_rate: selectedCurrency.exchange_rate
      }));
    }
  };

  const handleTypeChange = (type) => {
    setFormData(prev => {
      const newData = { ...prev, invoice_type: type };
      if (type === 'local_no_tax') {
        newData.has_vat = false;
        newData.vat_rate = 0;
      } else if (type === 'local_tax') {
        newData.has_vat = true;
        newData.vat_rate = 14;
      } else if (type === 'dummy') {
        newData.is_dummy = true;
      }
      return newData;
    });
  };

  const handleOrderSelect = async (order) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/purchase-orders/${order.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      const orderData = response.data;

      setFormData(prev => ({
        ...prev,
        purchase_order_id: order.id,
        supplier_id: orderData.supplier_id || '',
        currency_id: orderData.currency_id || '',
        exchange_rate: orderData.exchange_rate || 1,
        invoice_type: orderData.purchase_type === 'import' ? 'import' : 'local_tax',
        items: orderData.items?.map(i => ({
          item_id: i.item_id?.toString() || '',
          quantity: i.quantity || 1,
          unit_price: i.unit_price || 0,
          is_vat_exempt: i.is_vat_exempt || false,
          notes: i.notes || ''
        })) || [{ item_id: '', quantity: 1, unit_price: 0, is_vat_exempt: false, notes: '' }]
      }));

      setShowOrderSelector(false);
      toast.success('تم استدعاء البنود من أمر الشراء');
    } catch (error) {
      toast.error('فشل في استدعاء البنود');
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { item_id: '', quantity: 1, unit_price: 0, is_vat_exempt: false, notes: '' }]
    }));
  };

  const removeItem = (index) => {
    if (formData.items.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index, field, value) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const getSelectedItem = (itemId) => {
    return items.find(i => i.id === parseInt(itemId));
  };

  const calculateItemTotal = (item) => {
    return (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
  };

  const calculateSubtotal = () => {
    return formData.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  const calculateVAT = () => {
    if (!formData.has_vat) return 0;
    return formData.items.reduce((sum, item) => {
      if (item.is_vat_exempt) return sum;
      return sum + (calculateItemTotal(item) * (formData.vat_rate / 100));
    }, 0);
  };

  const calculateDiscountTax = () => {
    if (!formData.has_discount_tax) return 0;
    return calculateSubtotal() * (formData.discount_tax_rate / 100);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateVAT() - calculateDiscountTax();
  };

  const calculateTotalLocal = () => {
    return calculateTotal() * (parseFloat(formData.exchange_rate) || 1);
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.invoice_number.trim()) newErrors.invoice_number = 'رقم الفاتورة مطلوب';
    if (!formData.invoice_date) newErrors.invoice_date = 'التاريخ مطلوب';
    if (!formData.supplier_id) newErrors.supplier_id = 'المورد مطلوب';
    if (!formData.currency_id) newErrors.currency_id = 'العملة مطلوبة';

    formData.items.forEach((item, index) => {
      if (!item.item_id) newErrors[`item_${index}`] = 'الصنف مطلوب';
      if (!item.quantity || item.quantity <= 0) newErrors[`qty_${index}`] = 'الكمية يجب أن تكون أكبر من صفر';
      if (!item.unit_price || item.unit_price < 0) newErrors[`price_${index}`] = 'السعر مطلوب';
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const url = isEdit 
        ? `${API_URL}/api/purchases/${invoice.id}`
        : `${API_URL}/api/purchases`;
      const method = isEdit ? 'put' : 'post';

      const payload = {
        ...formData,
        subtotal: calculateSubtotal(),
        tax_amount: calculateVAT(),
        discount_tax_amount: calculateDiscountTax(),
        total_amount: calculateTotal(),
        total_amount_local: calculateTotalLocal(),
        items: formData.items.map(item => ({
          ...item,
          item_id: parseInt(item.item_id),
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price),
          total_price: calculateItemTotal(item)
        }))
      };

      await axios[method](url, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      toast.success(isEdit ? 'تم التعديل بنجاح' : 'تم إنشاء الفاتورة بنجاح');
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  const getInvoiceTypeLabel = (type) => {
    const labels = {
      local_tax: 'محلي ضريبي',
      local_no_tax: 'محلي غير ضريبي',
      import: 'استيراد',
      dummy: 'وهمية'
    };
    return labels[type] || type;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className={`absolute inset-0 ${isDark ? 'bg-black/70' : 'bg-black/50'}`} onClick={onClose} />

      <div className={`relative w-full max-w-6xl max-h-[90vh] overflow-auto rounded-xl shadow-2xl ${colors.modal}`}>
        {/* Header */}
        <div className={`flex justify-between items-center p-6 border-b ${colors.border}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isDark ? 'bg-green-900/30' : 'bg-green-100'}`}>
              <FaFileInvoice className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {isEdit ? 'تعديل فاتورة' : 'فاتورة جديدة'}
              </h2>
              <p className={`text-sm mt-1 ${colors.textMuted}`}>
                {isEdit ? invoice?.invoice_number : 'إنشاء فاتورة مشتريات'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}>
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Invoice Type Selector */}
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 mb-6`}>
            {['local_tax', 'local_no_tax', 'import', 'dummy'].map(type => (
              <button
                key={type}
                type="button"
                onClick={() => handleTypeChange(type)}
                className={`p-3 rounded-xl border-2 transition-all ${
                  formData.invoice_type === type
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : `border-gray-200 dark:border-gray-700 ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  {type === 'local_tax' && <FaFileInvoice className="w-6 h-6 text-green-500" />}
                  {type === 'local_no_tax' && <FaFileInvoice className="w-6 h-6 text-blue-500" />}
                  {type === 'import' && <FaShip className="w-6 h-6 text-purple-500" />}
                  {type === 'dummy' && <FaGhost className="w-6 h-6 text-orange-500" />}
                  <span className="text-sm font-medium">{getInvoiceTypeLabel(type)}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Order Selector */}
          {!isEdit && (
            <div className={`p-4 rounded-xl border ${colors.border} mb-6 ${isDark ? 'bg-blue-900/10' : 'bg-blue-50'}`}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">استدعاء من أمر شراء معتمد</p>
                  <p className={`text-sm ${colors.textMuted}`}>يمكنك استدعاء البنود من أمر شراء معتمد</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOrderSelector(!showOrderSelector)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${colors.buttonPrimary}`}
                >
                  <FaSearch className="w-4 h-4" />
                  {showOrderSelector ? 'إخفاء' : 'اختيار أمر'}
                </button>
              </div>

              {showOrderSelector && (
                <div className={`mt-4 rounded-lg border ${colors.border} overflow-hidden`}>
                  {approvedOrders.length === 0 ? (
                    <p className="p-4 text-center">لا توجد أوامر شراء معتمدة متاحة</p>
                  ) : (
                    <table className="w-full">
                      <thead className={colors.tableHeader}>
                        <tr>
                          <th className="px-4 py-2 text-right text-sm">رقم الأمر</th>
                          <th className="px-4 py-2 text-right text-sm">المورد</th>
                          <th className="px-4 py-2 text-right text-sm">النوع</th>
                          <th className="px-4 py-2 text-right text-sm">الإجمالي</th>
                          <th className="px-4 py-2 text-right text-sm"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {approvedOrders.map(order => (
                          <tr key={order.id} className={`border-t ${colors.tableRow}`}>
                            <td className="px-4 py-2 text-sm font-mono">{order.order_number}</td>
                            <td className="px-4 py-2 text-sm">{order.supplier_name}</td>
                            <td className="px-4 py-2 text-sm">{order.purchase_type === 'import' ? 'استيراد' : 'محلي'}</td>
                            <td className="px-4 py-2 text-sm font-mono">
                              {parseFloat(order.total_amount || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-2">
                              <button
                                type="button"
                                onClick={() => handleOrderSelect(order)}
                                className={`flex items-center gap-1 px-3 py-1 rounded text-sm ${colors.buttonSuccess}`}
                              >
                                <FaArrowRight className="w-3 h-3" />
                                استدعاء
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <label className={`block text-sm font-medium mb-1 ${colors.text}`}>
                رقم الفاتورة <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.invoice_number}
                onChange={(e) => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input} ${errors.invoice_number ? 'border-red-500' : ''}`}
                placeholder="INV-2026-001"
              />
              {errors.invoice_number && <p className="text-red-500 text-xs mt-1">{errors.invoice_number}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${colors.text}`}>
                التاريخ <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.invoice_date}
                onChange={(e) => setFormData(prev => ({ ...prev, invoice_date: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input} ${errors.invoice_date ? 'border-red-500' : ''}`}
              />
              {errors.invoice_date && <p className="text-red-500 text-xs mt-1">{errors.invoice_date}</p>}
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
                  <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                ))}
              </select>
              {errors.supplier_id && <p className="text-red-500 text-xs mt-1">{errors.supplier_id}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${colors.text}`}>
                العملة <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.currency_id}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input} ${errors.currency_id ? 'border-red-500' : ''}`}
              >
                <option value="">اختر العملة</option>
                {currencies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name} (1 = {parseFloat(c.exchange_rate).toFixed(2)} ج.م)
                  </option>
                ))}
              </select>
              {errors.currency_id && <p className="text-red-500 text-xs mt-1">{errors.currency_id}</p>}
            </div>
          </div>

          {/* Tax Settings */}
          {formData.invoice_type !== 'dummy' && (
            <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 rounded-xl border ${colors.border} ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.has_vat}
                  onChange={(e) => setFormData(prev => ({ ...prev, has_vat: e.target.checked }))}
                  className="w-5 h-5 rounded border-gray-300"
                />
                <div>
                  <label className={`block text-sm font-medium ${colors.text}`}>ضريبة القيمة المضافة</label>
                  <p className={`text-xs ${colors.textMuted}`}>14% على البنود غير المعفاة</p>
                </div>
              </div>

              {formData.has_vat && (
                <div>
                  <label className={`block text-sm font-medium mb-1 ${colors.text}`}>نسبة الضريبة</label>
                  <input
                    type="number"
                    value={formData.vat_rate}
                    onChange={(e) => setFormData(prev => ({ ...prev, vat_rate: parseFloat(e.target.value) }))}
                    className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
                  />
                </div>
              )}

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.has_discount_tax}
                  onChange={(e) => setFormData(prev => ({ ...prev, has_discount_tax: e.target.checked }))}
                  className="w-5 h-5 rounded border-gray-300"
                />
                <div>
                  <label className={`block text-sm font-medium ${colors.text}`}>خصم ضريبي</label>
                  <p className={`text-xs ${colors.textMuted}`}>خصم من المورد</p>
                </div>
              </div>
            </div>
          )}

          {/* Dummy Settings */}
          {formData.invoice_type === 'dummy' && (
            <div className={`p-4 rounded-xl border ${colors.border} mb-6 ${isDark ? 'bg-orange-900/10' : 'bg-orange-50'}`}>
              <div className="flex items-center gap-2 mb-3">
                <FaGhost className="w-5 h-5 text-orange-500" />
                <h3 className="font-bold">إعدادات الفاتورة الوهمية</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${colors.text}`}>نوع الوهمية</label>
                  <select
                    value={formData.dummy_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, dummy_type: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
                  >
                    <option value="">اختر النوع</option>
                    <option value="tax_service">خدمة ضريبية</option>
                    <option value="for_others">للغير</option>
                  </select>
                </div>
                <div className="flex items-center">
                  <p className={`text-sm ${colors.textMuted}`}>
                    الفاتورة الوهمية تسمع في المخزون الضريبي فقط ولا تؤثر على المخزن الفعلي
                  </p>
                </div>
              </div>
            </div>
          )}

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

          {/* Items */}
          <div className={`rounded-xl border ${colors.border} overflow-hidden mb-6`}>
            <div className={`p-4 border-b ${colors.border} flex justify-between items-center`}>
              <h3 className="font-bold text-lg flex items-center gap-2">
                <FaCalculator className="w-5 h-5 text-green-500" />
                بنود الفاتورة
              </h3>
              <button
                type="button"
                onClick={addItem}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${colors.buttonSuccess}`}
              >
                <FaPlus className="w-3 h-3" />
                إضافة بند
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={colors.tableHeader}>
                  <tr>
                    <th className="px-4 py-3 text-right text-sm font-semibold">#</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">الصنف</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">الكمية</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">السعر</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">الإجمالي</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">إعفاء ضريبي</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">ملاحظات</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item, index) => {
                    const selectedItem = getSelectedItem(item.item_id);
                    const itemTotal = calculateItemTotal(item);

                    return (
                      <tr key={index} className={`border-t ${colors.tableRow}`}>
                        <td className="px-4 py-3 text-sm">{index + 1}</td>
                        <td className="px-4 py-3">
                          <select
                            value={item.item_id}
                            onChange={(e) => updateItem(index, 'item_id', e.target.value)}
                            className={`w-full px-2 py-1.5 rounded border text-sm outline-none focus:ring-2 focus:ring-blue-500 ${colors.input} ${errors[`item_${index}`] ? 'border-red-500' : ''}`}
                          >
                            <option value="">اختر الصنف</option>
                            {items.map(i => (
                              <option key={i.id} value={i.id}>{i.code} - {i.name}</option>
                            ))}
                          </select>
                          {selectedItem?.is_vat_exempt && (
                            <div className="flex items-center gap-1 mt-1">
                              <FaExclamationTriangle className="w-3 h-3 text-orange-500" />
                              <span className="text-xs text-orange-500">الصنف معفى افتراضياً</span>
                            </div>
                          )}
                          {errors[`item_${index}`] && <p className="text-red-500 text-xs">{errors[`item_${index}`]}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                            className={`w-20 px-2 py-1.5 rounded border text-sm outline-none focus:ring-2 focus:ring-blue-500 ${colors.input} ${errors[`qty_${index}`] ? 'border-red-500' : ''}`}
                          />
                          {errors[`qty_${index}`] && <p className="text-red-500 text-xs">{errors[`qty_${index}`]}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unit_price}
                            onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                            className={`w-28 px-2 py-1.5 rounded border text-sm outline-none focus:ring-2 focus:ring-blue-500 ${colors.input} ${errors[`price_${index}`] ? 'border-red-500' : ''}`}
                          />
                          {errors[`price_${index}`] && <p className="text-red-500 text-xs">{errors[`price_${index}`]}</p>}
                        </td>
                        <td className="px-4 py-3 font-mono font-medium">
                          {itemTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={item.is_vat_exempt}
                              onChange={(e) => updateItem(index, 'is_vat_exempt', e.target.checked)}
                              className="w-4 h-4 rounded"
                            />
                            <span className="text-xs">معفى</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={item.notes}
                            onChange={(e) => updateItem(index, 'notes', e.target.value)}
                            className={`w-full px-2 py-1.5 rounded border text-sm outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
                            placeholder="ملاحظات..."
                          />
                        </td>
                        <td className="px-4 py-3">
                          {formData.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
                            >
                              <FaTrash className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className={`grid grid-cols-2 md:grid-cols-5 gap-4 mb-6`}>
            <div className={`p-4 rounded-xl border ${colors.border} ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <p className={`text-sm ${colors.textMuted}`}>عدد البنود</p>
              <p className="text-xl font-bold">{formData.items.length}</p>
            </div>
            <div className={`p-4 rounded-xl border ${colors.border} ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <p className={`text-sm ${colors.textMuted}`}>الإجمالي</p>
              <p className="text-xl font-bold">{calculateSubtotal().toLocaleString('ar-EG', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className={`p-4 rounded-xl border ${colors.border} ${isDark ? 'bg-yellow-900/20' : 'bg-yellow-50'}`}>
              <p className={`text-sm ${colors.textMuted}`}>الضريبة ({formData.vat_rate}%)</p>
              <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{calculateVAT().toLocaleString('ar-EG', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className={`p-4 rounded-xl border ${colors.border} ${isDark ? 'bg-red-900/20' : 'bg-red-50'}`}>
              <p className={`text-sm ${colors.textMuted}`}>الخصم الضريبي</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">-{calculateDiscountTax().toLocaleString('ar-EG', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className={`p-4 rounded-xl border ${colors.border} ${isDark ? 'bg-green-900/20' : 'bg-green-50'}`}>
              <p className={`text-sm ${colors.textMuted}`}>الصافي</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {calculateTotal().toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                <span className="text-sm font-normal mr-1">{currencies.find(c => c.id === parseInt(formData.currency_id))?.symbol || 'ج.م'}</span>
              </p>
            </div>
          </div>

          {/* Local Currency Total */}
          <div className={`p-4 rounded-xl border ${colors.border} mb-6 ${isDark ? 'bg-blue-900/10' : 'bg-blue-50'}`}>
            <div className="flex justify-between items-center">
              <div>
                <p className={`text-sm ${colors.textMuted}`}>الإجمالي بالجنيه المصري</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {calculateTotalLocal().toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                </p>
              </div>
              <FaCoins className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className={`px-6 py-2.5 rounded-lg border transition-colors ${colors.buttonSecondary}`}
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-2.5 rounded-lg transition-colors ${colors.buttonPrimary} disabled:opacity-50`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  جاري الحفظ...
                </span>
              ) : (
                isEdit ? 'حفظ التعديلات' : 'حفظ الفاتورة'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PurchaseInvoiceModal;
