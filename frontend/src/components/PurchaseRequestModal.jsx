import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { 
  FaPlus, FaTrash, FaTimes, FaCalculator, FaExclamationTriangle,
  FaDollarSign, FaCoins
} from 'react-icons/fa';

const PurchaseRequestModal = ({ request, items, currencies, onClose, isDark, colors }) => {
  const API_URL = import.meta.env.VITE_API_URL;
  const isEdit = !!request;

  const [formData, setFormData] = useState({
    request_number: '',
    request_date: new Date().toISOString().split('T')[0],
    department_id: '',
    currency_id: '',
    exchange_rate: 1,
    notes: '',
    items: [{ item_id: '', quantity: 1, unit_price: 0, notes: '' }]
  });

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Load departments
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/departments`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setDepartments(response.data || []);
      } catch (error) {
        console.error('Error fetching departments:', error);
      }
    };
    fetchDepartments();
  }, [API_URL]);

  // Load request data if editing
  useEffect(() => {
    if (request) {
      setFormData({
        request_number: request.request_number || '',
        request_date: request.request_date ? request.request_date.split('T')[0] : new Date().toISOString().split('T')[0],
        department_id: request.department_id || '',
        currency_id: request.currency_id || '',
        exchange_rate: request.exchange_rate || 1,
        notes: request.notes || '',
        items: request.items?.map(i => ({
          item_id: i.item_id?.toString() || '',
          quantity: i.quantity || 1,
          unit_price: i.unit_price || 0,
          notes: i.notes || ''
        })) || [{ item_id: '', quantity: 1, unit_price: 0, notes: '' }]
      });
    }
  }, [request]);

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
    if (!formData.request_number.trim()) newErrors.request_number = 'رقم الطلب مطلوب';
    if (!formData.request_date) newErrors.request_date = 'التاريخ مطلوب';
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
        ? `${API_URL}/api/purchase-requests/${request.id}`
        : `${API_URL}/api/purchase-requests`;
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
      {/* Overlay */}
      <div 
        className={`absolute inset-0 ${isDark ? 'bg-black/70' : 'bg-black/50'}`}
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`relative w-full max-w-5xl max-h-[90vh] overflow-auto rounded-xl shadow-2xl ${colors.modal}`}>
        {/* Header */}
        <div className={`flex justify-between items-center p-6 border-b ${colors.border}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
              <FaCalculator className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {isEdit ? 'تعديل طلب شراء' : 'طلب شراء جديد'}
              </h2>
              <p className={`text-sm ${colors.textMuted}`}>
                {isEdit ? request?.request_number : 'إنشاء طلب شراء جديد'}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <label className={`block text-sm font-medium mb-1 ${colors.text}`}>
                رقم الطلب <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.request_number}
                onChange={(e) => setFormData(prev => ({ ...prev, request_number: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input} ${errors.request_number ? 'border-red-500' : ''}`}
                placeholder="PR-2026-001"
              />
              {errors.request_number && <p className="text-red-500 text-xs mt-1">{errors.request_number}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${colors.text}`}>
                التاريخ <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.request_date}
                onChange={(e) => setFormData(prev => ({ ...prev, request_date: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input} ${errors.request_date ? 'border-red-500' : ''}`}
              />
              {errors.request_date && <p className="text-red-500 text-xs mt-1">{errors.request_date}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${colors.text}`}>
                القسم
              </label>
              <select
                value={formData.department_id}
                onChange={(e) => setFormData(prev => ({ ...prev, department_id: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
              >
                <option value="">اختر القسم</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
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

          {/* Exchange Rate */}
          {formData.currency_id && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                    onChange={(e) => setFormData(prev => ({ ...prev, exchange_rate: e.target.value }))}
                    className={`w-full pr-10 px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
                    readOnly={!!formData.currency_id}
                  />
                </div>
                <p className={`text-xs mt-1 ${colors.textMuted}`}>
                  كم جنيه مصري = 1 وحدة من العملة المختارة
                </p>
              </div>
            </div>
          )}

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
                <FaCalculator className="w-5 h-5 text-blue-500" />
                بنود الطلب
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
                isEdit ? 'حفظ التعديلات' : 'حفظ الطلب'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PurchaseRequestModal;
