import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaFilter, FaMoneyBillWave, FaUniversity, FaCalendarAlt } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function SupplierPayments() {
  const { isDark } = useTheme();
  const [payments, setPayments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterMethod, setFilterMethod] = useState('');

  const [formData, setFormData] = useState({
    supplier_id: '',
    shipment_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank',
    amount_egp: '',
    amount_usd: '',
    amount_eur: '',
    exchange_rate_usd: '',
    exchange_rate_eur: '',
    bank_account_id: '',
    check_number: '',
    check_date: '',
    notes: '',
    reference_number: ''
  });

  useEffect(() => {
    fetchPayments();
    fetchSuppliers();
    fetchShipments();
    fetchBankAccounts();
  }, []);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/supplier-payments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPayments(res.data);
    } catch (err) {
      toast.error('فشل في تحميل المدفوعات');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/suppliers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuppliers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchShipments = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/shipments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShipments(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/bank-accounts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBankAccounts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const data = {
        ...formData,
        amount_egp: parseFloat(formData.amount_egp) || 0,
        amount_usd: parseFloat(formData.amount_usd) || 0,
        amount_eur: parseFloat(formData.amount_eur) || 0,
        exchange_rate_usd: parseFloat(formData.exchange_rate_usd) || 0,
        exchange_rate_eur: parseFloat(formData.exchange_rate_eur) || 0
      };

      if (editingPayment) {
        await axios.put(`${API_URL}/supplier-payments/${editingPayment.id}`, data, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('تم تحديث السداد بنجاح');
      } else {
        await axios.post(`${API_URL}/supplier-payments`, data, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('تم تسجيل السداد بنجاح');
      }
      setShowModal(false);
      setEditingPayment(null);
      resetForm();
      fetchPayments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل في حفظ السداد');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا السداد؟')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/supplier-payments/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('تم حذف السداد بنجاح');
      fetchPayments();
    } catch (err) {
      toast.error('فشل في حذف السداد');
      console.error(err);
    }
  };

  const handleEdit = (payment) => {
    setEditingPayment(payment);
    setFormData({
      supplier_id: payment.supplier_id || '',
      shipment_id: payment.shipment_id || '',
      payment_date: payment.payment_date?.split('T')[0] || new Date().toISOString().split('T')[0],
      payment_method: payment.payment_method || 'bank',
      amount_egp: payment.amount_egp || '',
      amount_usd: payment.amount_usd || '',
      amount_eur: payment.amount_eur || '',
      exchange_rate_usd: payment.exchange_rate_usd || '',
      exchange_rate_eur: payment.exchange_rate_eur || '',
      bank_account_id: payment.bank_account_id || '',
      check_number: payment.check_number || '',
      check_date: payment.check_date?.split('T')[0] || '',
      notes: payment.notes || '',
      reference_number: payment.reference_number || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      supplier_id: '',
      shipment_id: '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'bank',
      amount_egp: '',
      amount_usd: '',
      amount_eur: '',
      exchange_rate_usd: '',
      exchange_rate_eur: '',
      bank_account_id: '',
      check_number: '',
      check_date: '',
      notes: '',
      reference_number: ''
    });
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = 
      payment.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSupplier = !filterSupplier || payment.supplier_id === parseInt(filterSupplier);
    const matchesMethod = !filterMethod || payment.payment_method === filterMethod;
    return matchesSearch && matchesSupplier && matchesMethod;
  });

  const getTotalPayments = () => {
    return filteredPayments.reduce((sum, p) => sum + (parseFloat(p.total_egp) || 0), 0);
  };

  return (
    <div className={`min-h-screen p-4 ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FaMoneyBillWave className="text-green-500" />
            سداد الموردين
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            إدارة مدفوعات الموردين المحليين والأجانب
          </p>
        </div>
        <button
          onClick={() => { setEditingPayment(null); resetForm(); setShowModal(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <FaPlus /> سداد جديد
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>إجمالي السدادات</p>
          <p className="text-2xl font-bold text-green-600">{getTotalPayments().toLocaleString()} ج.م</p>
        </div>
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>عدد السدادات</p>
          <p className="text-2xl font-bold">{filteredPayments.length}</p>
        </div>
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>الموردين</p>
          <p className="text-2xl font-bold">{new Set(filteredPayments.map(p => p.supplier_id)).size}</p>
        </div>
      </div>

      {/* Filters */}
      <div className={`p-4 rounded-lg mb-6 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <FaSearch className="absolute right-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="بحث..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pr-10 p-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:ring-2 focus:ring-blue-500`}
            />
          </div>
          <select
            value={filterSupplier}
            onChange={(e) => setFilterSupplier(e.target.value)}
            className={`p-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
          >
            <option value="">كل الموردين</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
            className={`p-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
          >
            <option value="">كل طرق الدفع</option>
            <option value="cash">نقدي</option>
            <option value="bank">بنكي</option>
            <option value="check">شيك</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className={`rounded-lg shadow overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <th className="p-3 text-right">#</th>
                <th className="p-3 text-right">المورد</th>
                <th className="p-3 text-right">التاريخ</th>
                <th className="p-3 text-right">طريقة الدفع</th>
                <th className="p-3 text-right">المبلغ (ج.م)</th>
                <th className="p-3 text-right">المبلغ ($)</th>
                <th className="p-3 text-right">الإجمالي</th>
                <th className="p-3 text-right">ملاحظات</th>
                <th className="p-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-gray-500">
                    لا توجد سدادات
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment, index) => (
                  <tr key={payment.id} className={`border-t ${isDark ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'} transition-colors`}>
                    <td className="p-3">{index + 1}</td>
                    <td className="p-3 font-medium">{payment.supplier_name}</td>
                    <td className="p-3">{new Date(payment.payment_date).toLocaleDateString('ar-EG')}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        payment.payment_method === 'cash' ? 'bg-green-100 text-green-800' :
                        payment.payment_method === 'bank' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {payment.payment_method === 'cash' ? 'نقدي' : payment.payment_method === 'bank' ? 'بنكي' : 'شيك'}
                      </span>
                    </td>
                    <td className="p-3">{(parseFloat(payment.amount_egp) || 0).toLocaleString()}</td>
                    <td className="p-3">{(parseFloat(payment.amount_usd) || 0).toLocaleString()}</td>
                    <td className="p-3 font-bold text-green-600">{(parseFloat(payment.total_egp) || 0).toLocaleString()} ج.م</td>
                    <td className="p-3 text-sm">{payment.notes}</td>
                    <td className="p-3">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleEdit(payment)} className="text-blue-500 hover:text-blue-700">
                          <FaEdit />
                        </button>
                        <button onClick={() => handleDelete(payment.id)} className="text-red-500 hover:text-red-700">
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <FaMoneyBillWave className="text-green-500" />
                {editingPayment ? 'تعديل سداد' : 'سداد جديد'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">المورد *</label>
                    <select
                      value={formData.supplier_id}
                      onChange={(e) => setFormData({...formData, supplier_id: e.target.value})}
                      className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                      required
                    >
                      <option value="">اختر المورد</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">الشحنة (اختياري)</label>
                    <select
                      value={formData.shipment_id}
                      onChange={(e) => setFormData({...formData, shipment_id: e.target.value})}
                      className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                    >
                      <option value="">اختر الشحنة</option>
                      {shipments.map(s => (
                        <option key={s.id} value={s.id}>شحنة #{s.shipment_number} - {s.supplier_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">تاريخ السداد *</label>
                    <input
                      type="date"
                      value={formData.payment_date}
                      onChange={(e) => setFormData({...formData, payment_date: e.target.value})}
                      className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">طريقة الدفع *</label>
                    <select
                      value={formData.payment_method}
                      onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
                      className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                    >
                      <option value="bank">بنكي</option>
                      <option value="cash">نقدي</option>
                      <option value="check">شيك</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">المبلغ (ج.م)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.amount_egp}
                      onChange={(e) => setFormData({...formData, amount_egp: e.target.value})}
                      className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">المبلغ ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.amount_usd}
                      onChange={(e) => setFormData({...formData, amount_usd: e.target.value})}
                      className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">معامل التحويل ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.exchange_rate_usd}
                      onChange={(e) => setFormData({...formData, exchange_rate_usd: e.target.value})}
                      className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                      placeholder="50.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">الحساب البنكي</label>
                    <select
                      value={formData.bank_account_id}
                      onChange={(e) => setFormData({...formData, bank_account_id: e.target.value})}
                      className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                    >
                      <option value="">اختر الحساب</option>
                      {bankAccounts.map(ba => (
                        <option key={ba.id} value={ba.id}>{ba.account_name} - {ba.account_number}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">رقم الشيك</label>
                    <input
                      type="text"
                      value={formData.check_number}
                      onChange={(e) => setFormData({...formData, check_number: e.target.value})}
                      className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">تاريخ الشيك</label>
                    <input
                      type="date"
                      value={formData.check_date}
                      onChange={(e) => setFormData({...formData, check_date: e.target.value})}
                      className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">رقم المرجع</label>
                    <input
                      type="text"
                      value={formData.reference_number}
                      onChange={(e) => setFormData({...formData, reference_number: e.target.value})}
                      className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                      placeholder="رقم الإيصال أو التحويل"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">ملاحظات</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                      rows="2"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className={`px-4 py-2 rounded-lg border ${isDark ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-100'}`}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg flex items-center gap-2"
                  >
                    {loading ? 'جاري الحفظ...' : <><FaMoneyBillWave /> حفظ</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
