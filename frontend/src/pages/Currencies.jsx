import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  DollarSign, Plus, Edit2, Trash2, History, TrendingUp, 
  CheckCircle, XCircle, RefreshCw, Calculator 
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const API_URL = import.meta.env.VITE_API_URL;

const Currencies = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';

  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState(null);
  const [historyData, setHistoryData] = useState([]);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    symbol: '',
    exchange_rate: '',
    is_default: false
  });

  const [convertData, setConvertData] = useState({
    amount: '',
    from_currency: 'USD',
    to_currency: 'EGP'
  });
  const [convertResult, setConvertResult] = useState(null);

  // جلب العملات
  const fetchCurrencies = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/currencies`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setCurrencies(response.data);
    } catch (error) {
      toast.error('فشل في جلب العملات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrencies();
  }, []);

  // إضافة / تعديل عملة
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = selectedCurrency 
        ? `${API_URL}/api/currencies/${selectedCurrency.id}`
        : `${API_URL}/api/currencies`;
      const method = selectedCurrency ? 'put' : 'post';

      await axios[method](url, formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      toast.success(selectedCurrency ? 'تم تعديل العملة بنجاح' : 'تم إضافة العملة بنجاح');
      setShowModal(false);
      setSelectedCurrency(null);
      setFormData({ code: '', name: '', symbol: '', exchange_rate: '', is_default: false });
      fetchCurrencies();
    } catch (error) {
      toast.error(error.response?.data?.error || 'حدث خطأ');
    }
  };

  // حذف عملة
  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف العملة؟')) return;
    try {
      await axios.delete(`${API_URL}/api/currencies/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('تم حذف العملة بنجاح');
      fetchCurrencies();
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل في الحذف');
    }
  };

  // جلب تاريخ المعاملات
  const fetchHistory = async (currencyId) => {
    try {
      const response = await axios.get(`${API_URL}/api/currencies/${currencyId}/history`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setHistoryData(response.data);
      setShowHistory(true);
    } catch (error) {
      toast.error('فشل في جلب التاريخ');
    }
  };

  // تحويل عملة
  const handleConvert = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/api/currencies/convert`, convertData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setConvertResult(response.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل في التحويل');
    }
  };

  // فتح نموذج التعديل
  const openEdit = (currency) => {
    setSelectedCurrency(currency);
    setFormData({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      exchange_rate: currency.exchange_rate,
      is_default: currency.is_default
    });
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className={`p-6 ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold">شاشة العملات</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowConvert(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
          >
            <Calculator className="w-4 h-4" />
            آلة التحويل
          </button>
          <button
            onClick={() => { setSelectedCurrency(null); setFormData({ code: '', name: '', symbol: '', exchange_rate: '', is_default: false }); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            <Plus className="w-4 h-4" />
            إضافة عملة
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <p className="text-sm opacity-70">عدد العملات</p>
          <p className="text-2xl font-bold">{currencies.length}</p>
        </div>
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <p className="text-sm opacity-70">العملة الافتراضية</p>
          <p className="text-2xl font-bold">
            {currencies.find(c => c.is_default)?.code || 'EGP'}
          </p>
        </div>
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <p className="text-sm opacity-70">سعر الدولار</p>
          <p className="text-2xl font-bold">
            {currencies.find(c => c.code === 'USD')?.exchange_rate?.toFixed(2) || '-'} ج.م
          </p>
        </div>
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <p className="text-sm opacity-70">سعر اليورو</p>
          <p className="text-2xl font-bold">
            {currencies.find(c => c.code === 'EUR')?.exchange_rate?.toFixed(2) || '-'} ج.م
          </p>
        </div>
      </div>

      {/* Table */}
      <div className={`rounded-lg shadow overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <table className="w-full">
          <thead className={isDark ? 'bg-gray-700' : 'bg-gray-100'}>
            <tr>
              <th className="px-4 py-3 text-right">الكود</th>
              <th className="px-4 py-3 text-right">الاسم</th>
              <th className="px-4 py-3 text-right">الرمز</th>
              <th className="px-4 py-3 text-right">معامل التحويل</th>
              <th className="px-4 py-3 text-right">الافتراضية</th>
              <th className="px-4 py-3 text-right">الحالة</th>
              <th className="px-4 py-3 text-right">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {currencies.map((currency) => (
              <tr key={currency.id} className={`border-t ${isDark ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                <td className="px-4 py-3 font-mono font-bold">{currency.code}</td>
                <td className="px-4 py-3">{currency.name}</td>
                <td className="px-4 py-3 text-lg">{currency.symbol}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    {parseFloat(currency.exchange_rate).toFixed(6)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {currency.is_default ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-gray-400" />
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    currency.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {currency.is_active ? 'نشط' : 'معطل'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchHistory(currency.id)}
                      className="p-1 text-purple-500 hover:bg-purple-100 rounded"
                      title="تاريخ المعاملات"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEdit(currency)}
                      className="p-1 text-blue-500 hover:bg-blue-100 rounded"
                      title="تعديل"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {!currency.is_default && (
                      <button
                        onClick={() => handleDelete(currency.id)}
                        className="p-1 text-red-500 hover:bg-red-100 rounded"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: Add/Edit Currency */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`w-full max-w-md p-6 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className="text-xl font-bold mb-4">
              {selectedCurrency ? 'تعديل عملة' : 'إضافة عملة جديدة'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-1">كود العملة</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                    className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                    placeholder="مثال: USD"
                    required
                    disabled={!!selectedCurrency}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">اسم العملة</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                    placeholder="مثال: دولار أمريكي"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">الرمز</label>
                  <input
                    type="text"
                    value={formData.symbol}
                    onChange={(e) => setFormData({...formData, symbol: e.target.value})}
                    className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                    placeholder="مثال: $"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">معامل التحويل (مقابل الجنيه)</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={formData.exchange_rate}
                    onChange={(e) => setFormData({...formData, exchange_rate: e.target.value})}
                    className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                    placeholder="مثال: 50.000000"
                    required
                  />
                  <p className="text-xs opacity-70 mt-1">كم جنيه مصري = 1 وحدة من العملة</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({...formData, is_default: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <label className="text-sm">العملة الافتراضية</label>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded border hover:bg-gray-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  {selectedCurrency ? 'حفظ التعديلات' : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Exchange Rate History */}
      {showHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`w-full max-w-2xl p-6 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">تاريخ معاملات التحويل</h2>
              <button onClick={() => setShowHistory(false)} className="text-gray-500 hover:text-gray-700">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <table className="w-full">
              <thead className={isDark ? 'bg-gray-700' : 'bg-gray-100'}>
                <tr>
                  <th className="px-4 py-2 text-right">التاريخ</th>
                  <th className="px-4 py-2 text-right">المعامل</th>
                  <th className="px-4 py-2 text-right">ملاحظات</th>
                  <th className="px-4 py-2 text-right">بواسطة</th>
                </tr>
              </thead>
              <tbody>
                {historyData.map((h) => (
                  <tr key={h.id} className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <td className="px-4 py-2">{new Date(h.effective_date).toLocaleDateString('ar-EG')}</td>
                    <td className="px-4 py-2 font-mono">{parseFloat(h.exchange_rate).toFixed(6)}</td>
                    <td className="px-4 py-2">{h.notes}</td>
                    <td className="px-4 py-2">{h.created_by_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Currency Converter */}
      {showConvert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`w-full max-w-md p-6 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">آلة تحويل العملات</h2>
              <button onClick={() => setShowConvert(false)} className="text-gray-500 hover:text-gray-700">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleConvert}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-1">المبلغ</label>
                  <input
                    type="number"
                    value={convertData.amount}
                    onChange={(e) => setConvertData({...convertData, amount: e.target.value})}
                    className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1">من</label>
                    <select
                      value={convertData.from_currency}
                      onChange={(e) => setConvertData({...convertData, from_currency: e.target.value})}
                      className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                    >
                      {currencies.map(c => (
                        <option key={c.id} value={c.code}>{c.code} - {c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">إلى</label>
                    <select
                      value={convertData.to_currency}
                      onChange={(e) => setConvertData({...convertData, to_currency: e.target.value})}
                      className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                    >
                      {currencies.map(c => (
                        <option key={c.id} value={c.code}>{c.code} - {c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                >
                  تحويل
                </button>
                {convertResult && (
                  <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <p className="text-center text-lg">
                      <span className="font-bold">{convertResult.amount}</span> {convertResult.from_currency}
                      <span className="mx-2">=</span>
                      <span className="font-bold text-green-500">{convertResult.converted_amount.toLocaleString()}</span> {convertResult.to_currency}
                    </p>
                    <p className="text-center text-sm opacity-70 mt-2">
                      المعامل: {convertResult.exchange_rate.toFixed(6)}
                    </p>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Currencies;
