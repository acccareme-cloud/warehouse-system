import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FaTimes, FaBuilding, FaUser, FaPhone, FaEnvelope, FaMapMarkerAlt, FaIdCard } from 'react-icons/fa';

const SupplierModal = ({ supplier, onClose, isDark, colors }) => {
  const API_URL = import.meta.env.VITE_API_URL;
  const isEdit = !!supplier;

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'local',
    phone: '',
    email: '',
    address: '',
    tax_number: '',
    commercial_registration: '',
    contact_person: '',
    notes: '',
    status: 'active'
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (supplier) {
      setFormData({
        code: supplier.code || '',
        name: supplier.name || '',
        type: supplier.type || 'local',
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
        tax_number: supplier.tax_number || '',
        commercial_registration: supplier.commercial_registration || '',
        contact_person: supplier.contact_person || '',
        notes: supplier.notes || '',
        status: supplier.status || 'active'
      });
    }
  }, [supplier]);

  const validate = () => {
    const newErrors = {};
    if (!formData.code.trim()) newErrors.code = 'كود المورد مطلوب';
    if (!formData.name.trim()) newErrors.name = 'اسم المورد مطلوب';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'البريد الإلكتروني غير صالح';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const url = isEdit 
        ? `${API_URL}/api/suppliers/${supplier.id}`
        : `${API_URL}/api/suppliers`;
      const method = isEdit ? 'put' : 'post';

      await axios[method](url, formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      toast.success(isEdit ? 'تم التعديل بنجاح' : 'تم إضافة المورد بنجاح');
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

      <div className={`relative w-full max-w-2xl max-h-[90vh] overflow-auto rounded-xl shadow-2xl ${colors.modal}`}>
        <div className={`flex justify-between items-center p-6 border-b ${colors.border}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isDark ? 'bg-indigo-900/30' : 'bg-indigo-100'}`}>
              <FaBuilding className="w-6 h-6 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{isEdit ? 'تعديل مورد' : 'مورد جديد'}</h2>
              <p className={`text-sm mt-1 ${colors.textMuted}`}>
                {isEdit ? supplier?.name : 'إضافة مورد جديد'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}>
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className={`block text-sm font-medium mb-1 ${colors.text}`}>
                الكود <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FaIdCard className={`absolute right-3 top-3 w-4 h-4 ${colors.textMuted}`} />
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  className={`w-full pr-10 px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input} ${errors.code ? 'border-red-500' : ''}`}
                  placeholder="SUP-001"
                />
              </div>
              {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${colors.text}`}>
                الاسم <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FaUser className={`absolute right-3 top-3 w-4 h-4 ${colors.textMuted}`} />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={`w-full pr-10 px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input} ${errors.name ? 'border-red-500' : ''}`}
                  placeholder="اسم المورد"
                />
              </div>
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${colors.text}`}>النوع</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
              >
                <option value="local">محلي</option>
                <option value="foreign">أجنبي</option>
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${colors.text}`}>الحالة</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
              >
                <option value="active">نشط</option>
                <option value="inactive">معطل</option>
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${colors.text}`}>الهاتف</label>
              <div className="relative">
                <FaPhone className={`absolute right-3 top-3 w-4 h-4 ${colors.textMuted}`} />
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className={`w-full pr-10 px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
                  placeholder="01xxxxxxxxx"
                />
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${colors.text}`}>البريد الإلكتروني</label>
              <div className="relative">
                <FaEnvelope className={`absolute right-3 top-3 w-4 h-4 ${colors.textMuted}`} />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className={`w-full pr-10 px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input} ${errors.email ? 'border-red-500' : ''}`}
                  placeholder="email@example.com"
                />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${colors.text}`}>الرقم الضريبي</label>
              <input
                type="text"
                value={formData.tax_number}
                onChange={(e) => setFormData(prev => ({ ...prev, tax_number: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
                placeholder="الرقم الضريبي"
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${colors.text}`}>السجل التجاري</label>
              <input
                type="text"
                value={formData.commercial_registration}
                onChange={(e) => setFormData(prev => ({ ...prev, commercial_registration: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
                placeholder="رقم السجل التجاري"
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${colors.text}`}>الشخص المسؤول</label>
              <input
                type="text"
                value={formData.contact_person}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
                placeholder="اسم الشخص المسؤول"
              />
            </div>

            <div className="md:col-span-2">
              <label className={`block text-sm font-medium mb-1 ${colors.text}`}>العنوان</label>
              <div className="relative">
                <FaMapMarkerAlt className={`absolute right-3 top-3 w-4 h-4 ${colors.textMuted}`} />
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className={`w-full pr-10 px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
                  rows="2"
                  placeholder="عنوان المورد"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className={`block text-sm font-medium mb-1 ${colors.text}`}>ملاحظات</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
                rows="2"
                placeholder="أي ملاحظات إضافية..."
              />
            </div>
          </div>

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
                isEdit ? 'حفظ التعديلات' : 'حفظ المورد'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SupplierModal;
