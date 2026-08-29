import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { 
  FaPlus, FaTrash, FaTimes, FaCalculator, FaExclamationTriangle,
  FaDollarSign, FaCoins, FaSearch, FaCheck, FaArrowRight
} from 'react-icons/fa';

const PurchaseOrderModal = ({ order, items, suppliers, currencies, approvedRequests, onClose, isDark, colors }) => {
  const API_URL = import.meta.env.VITE_API_URL;
  const isEdit = !!order;

  const [formData, setFormData] = useState({
    order_number: '',
    order_date: new Date().toISOString().split('T')[0],
    supplier_id: '',
    purchase_request_id: '',
    purchase_type: 'local',
    currency_id: '',
    exchange_rate: 1,
    notes: '',
    items: [{ item_id: '', quantity: 1, unit_price: 0, notes: '' }]
  });

  const [showRequestSelector, setShowRequestSelector] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Load order data if editing
  useEffect(() => {
    if (order) {
      setFormData({
        order_number: order.order_number || '',
        order_date: order.order_date ? order.order_date.split('T')[0] : new Date().toISOString().split('T')[0],
        supplier_id: order.supplier_id || '',
        purchase_request_id: order.purchase_request_id || '',
        purchase_type: order.purchase_type || 'local',
        currency_id: order.currency_id || '',
        exchange_rate: order.exchange_rate || 1,
        notes: order.notes || '',
        items: order.items?.map(i => ({
          item_id: i.item_id?.toString() || '',
          quantity: i.quantity || 1,
          unit_price: i.unit_price || 0,
          notes: i.notes || ''
        })) || [{ item_id: '', quantity: 1, unit_price: 0, notes: '' }]
      });
    }
  }, [order]);

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

  const handleRequestSelect = async (request) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/purchase-requests/${request.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      const prData = response.data;

      setFormData(prev => ({
        ...prev,
        purchase_request_id: request.id,
        currency_id: prData.currency_id || '',
        exchange_rate: prData.exchange_rate || 1,
        purchase_type: prData.currency_id ? 'import' : 'local',
        items: prData.items?.map(i => ({
          item_id: i.item_id?.toString() || '',
          quantity: i.quantity || 1,
          unit_price: i.unit_price || 0,
          notes: i.notes || ''
        })) || [{ item_id: '', quantity: 1, unit_price: 0, notes: '' }]
      }));

      setShowRequestSelector(false);
      toast.success('تم استدعاء البنود من طلب الشراء');
    } catch (error) {
      toast.error('فشل في استدعاء البنود');
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { item_id: '', quantity: 1, unit_price: 0, notes: '' }]
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

  const calculateItemTotal = (item) => {
    return (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  const calculateTotalLocal = () => {
    return calculateTotal() * (parseFloat(formData.exchange_rate) || 1);
  };

  const getSelectedItem = (itemId) => {
    return items.find(i => i.id === parseInt(itemId));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.order_number.trim()) newErrors.order_number = 'رقم الأمر مطلوب';
    if (!formData.order_date) newErrors.order_date = 'التاريخ مطلوب';
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
        ? `${API_URL}/api/purchase-orders/${order.id}`
        : `${API_URL}/api/purchase-orders`;
      const method = isEdit ? 'put' : 'post';

      const payload = {
        ...formData,
        items: formData.items.map(item => ({
          ...item,
          item_id: parseInt(item.item_id),
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price)
        }))
      };

      await axios[method](url, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      toast.success(isEdit ? 'تم التعديل بنجاح' : 'تم الإضافة بنجاح');
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className={`absolute inset-0 ${isDark ? 'bg-black/70' : 'bg-black/50'}`}
        onClick={onClose}
      />

      <div className={`relative w-full max-w-5xl max-h-[90vh] overflow-auto rounded-xl shadow-2xl ${colors.modal}`}>
        {/* Header */}
        <div className={`flex justify-between items-center p-6 border-b ${colors.border}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isDark ? 'bg-purple-900/30' : 'bg-purple-100'}`}>
              <FaCalculator className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {isEdit ? 'تعديل أمر شراء' : 'أمر شراء جديد'}
              </h2>
              <p className={`text-sm mt-1 ${colors.textMuted}`}>
                {isEdit ? order?.order_number : 'إنشاء أمر شراء جديد'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Request Selector (for new orders) */}
          {!isEdit && (
            <div className={`p-4 rounded-xl border ${colors.border} mb-6 ${isDark ? 'bg-blue-900/10' : 'bg-blue-50'}`}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">استدعاء من طلب شراء معتمد</p>
                  <p className={`text-sm ${colors.textMuted}`}>يمكنك استدعاء البنود من طلب شراء معتمد</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRequestSelector(!showRequestSelector)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${colors.buttonPrimary}`}
                >
                  <FaSearch className="w-4 h-4" />
                  {showRequestSelector ? 'إخفاء' : 'اختيار طلب'}
                </button>
              </div>

              {showRequestSelector && (
                <div className={`mt-4 rounded-lg border ${colors.border} overflow-hidden`}>
                  {approvedRequests.length === 0 ? (
                    <p className="p-4 text-center">لا توجد طلبات شراء معتمدة متاحة</p>
                  ) : (
                    <table className="w-full">
                      <thead className={colors.tableHeader}>
                        <tr>
                          <th className="px-4 py-2 text-right text-sm">رقم الطلب</th>
                          <th className="px-4 py-2 text-right text-sm">التاريخ</th>
                          <th className="px-4 py-2 text-right text-sm">العملة</th>
                          <th className="px-4 py-2 text-right text-sm">الإجمالي</th>
                          <th className="px-4 py-2 text-right text-sm"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {approvedRequests.map(req => (
                          <tr key={req.id} className={`border-t ${colors.tableRow}`}>
                            <td className="px-4 py-2 text-sm font-mono">{req.request_number}</td>
                            <td className="px-4 py-2 text-sm">
                              {req.request_date ? new Date(req.request_date).toLocaleDateString('ar-EG') : '-'}
                            </td>
                            <td className="px-4 py-2 text-sm">{req.currency_symbol || 'ج.م'}</td>
                            <td className="px-4 py-2 text-sm font-mono">
                              {parseFloat(req.total_amount || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-2">
                              <button
                                type="button"
                                onClick={() => handleRequestSelect(req)}
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
                رقم الأمر <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.order_number}
                onChange={(e) => setFormData(prev => ({ ...prev, order_number: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input} ${errors.order_number ? 'border-red-500' : ''}`}
                placeholder="PO-2026-001"
              />
              {errors.order_number && <p className="text-red-500 text-xs mt-1">{errors.order_number}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${colors.text}`}>
                التاريخ <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.order_date}
                onChange={(e) => setFormData(prev => ({ ...prev, order_date: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input} ${errors.order_date ? 'border-red-500' : ''}`}
              />
              {errors.order_date && <p className="text-red-500 text-xs mt-1">{errors.order_date}</p>}
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
                النوع
              </label>
              <select
                value={formData.purchase_type}
                onChange={(e) => setFormData(prev => ({ ...prev, purchase_type: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
              >
                <option value="local">محلي</option>
                <option value="import">استيراد</option>
              </select>
            </div>
          </div>

          {/* Currency */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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

            {formData.currency_id && (
              <div>
                <label className={`block text-sm font-medium mb-1 ${colors.text}`}>
                  معامل التحويل
                </label>
                <div className="relative">
                  <FaCoins className={`absolute right-3 top-3 w-4 h-4 ${colors.textMuted}`} />
                  <input
                    type="number"
                    step="0.000001"
                    value={formData.exchange_rate}
                    className={`w-full pr-10 px-3 py-2 rounded-lg border outline-none ${colors.input}`}
                    readOnly
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className={`block text-sm font-medium mb-1 ${colors.text}`}>
              ملاحظات
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
              rows="2"
              placeholder="أي ملاحظات إضافية..."
            />
          </div>

          {/* Items Section */}
          <div className={`rounded-xl border ${colors.border} overflow-hidden mb-6`}>
            <div className={`p-4 border-b ${colors.border} flex justify-between items-center`}>
              <h3 className="font-bold text-lg flex items-center gap-2">
                <FaCalculator className="w-5 h-5 text-purple-500" />
                بنود الأمر
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
                    <th className="px-4 py-3 text-right text-sm font-semibold">الضريبة</th>
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
                              <span className="text-xs text-orange-500">معفى من VAT</span>
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
                          {selectedItem?.is_vat_exempt ? (
                            <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded text-xs">
                              معفى
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs">
                              14% VAT
                            </span>
                          )}
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
          <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 mb-6`}>
            <div className={`p-4 rounded-xl border ${colors.border} ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <p className={`text-sm ${colors.textMuted}`}>عدد البنود</p>
              <p className="text-2xl font-bold">{formData.items.length}</p>
            </div>
            <div className={`p-4 rounded-xl border ${colors.border} ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <p className={`text-sm ${colors.textMuted}`}>الإجمالي</p>
              <p className="text-2xl font-bold flex items-center gap-2">
                <FaDollarSign className="w-5 h-5 text-green-500" />
                {calculateTotal().toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                <span className="text-sm font-normal">
                  {currencies.find(c => c.id === parseInt(formData.currency_id))?.symbol || 'ج.م'}
                </span>
              </p>
            </div>
            <div className={`p-4 rounded-xl border ${colors.border} ${isDark ? 'bg-green-900/20' : 'bg-green-50'}`}>
              <p className={`text-sm ${colors.textMuted}`}>بالجنيه المصري</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {calculateTotalLocal().toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
              </p>
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
                isEdit ? 'حفظ التعديلات' : 'حفظ الأمر'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PurchaseOrderModal;
