import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { 
  FaPlus, FaEdit, FaTrash, FaEye, FaSearch, FaSync, 
  FaArrowLeft, FaArrowRight, FaExclamationTriangle,
  FaPhone, FaEnvelope, FaMapMarkerAlt, FaIdCard,
  FaFileInvoiceDollar, FaBalanceScale
} from 'react-icons/fa';

const Suppliers = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const API_URL = import.meta.env.VITE_API_URL;

  // Theme-based colors
  const colors = {
    bg: isDark ? 'bg-gray-900' : 'bg-gray-50',
    card: isDark ? 'bg-gray-800' : 'bg-white',
    text: isDark ? 'text-gray-100' : 'text-gray-900',
    textMuted: isDark ? 'text-gray-400' : 'text-gray-500',
    border: isDark ? 'border-gray-700' : 'border-gray-200',
    input: isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400',
    tableHeader: isDark ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-700',
    tableRow: isDark ? 'border-gray-700 hover:bg-gray-700/50' : 'border-gray-200 hover:bg-gray-50',
    buttonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white',
    buttonSuccess: 'bg-green-600 hover:bg-green-700 text-white',
    buttonDanger: 'bg-red-600 hover:bg-red-700 text-white',
    buttonSecondary: isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-100' : 'bg-gray-200 hover:bg-gray-300 text-gray-700',
    status: {
      active: isDark ? 'bg-green-900/50 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-300',
      inactive: isDark ? 'bg-red-900/50 text-red-300 border-red-700' : 'bg-red-100 text-red-800 border-red-300',
    }
  };

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/suppliers`, {
        params: { search: searchTerm, page: currentPage },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setSuppliers(response.data.data || []);
      setTotalPages(response.data.totalPages || 1);
    } catch (error) {
      toast.error('فشل في جلب الموردين');
    } finally {
      setLoading(false);
    }
  }, [API_URL, searchTerm, currentPage]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف المورد؟')) return;
    try {
      await axios.delete(`${API_URL}/api/suppliers/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('تم الحذف بنجاح');
      fetchSuppliers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل في الحذف');
    }
  };

  const handleView = (supplier) => {
    setSelectedSupplier(supplier);
    setShowDetails(true);
  };

  const handleEdit = (supplier) => {
    setSelectedSupplier(supplier);
    setShowModal(true);
  };

  const handleAdd = () => {
    setSelectedSupplier(null);
    setShowModal(true);
  };

  const getStatusBadge = (status) => {
    const labels = { active: 'نشط', inactive: 'معطل' };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${colors.status[status] || colors.status.active}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading && suppliers.length === 0) {
    return (
      <div className={`flex items-center justify-center h-64 ${colors.bg}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-6 ${colors.bg} ${colors.text}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">الموردين</h1>
          <p className={`text-sm mt-1 ${colors.textMuted}`}>إدارة بيانات الموردين والتعاملات</p>
        </div>
        <button
          onClick={handleAdd}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${colors.buttonPrimary}`}
        >
          <FaPlus className="w-4 h-4" />
          مورد جديد
        </button>
      </div>

      {/* Filters */}
      <div className={`${colors.card} rounded-lg shadow-sm p-4 mb-6 border ${colors.border}`}>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FaSearch className={`absolute right-3 top-3 w-4 h-4 ${colors.textMuted}`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث باسم المورد أو الكود..."
              className={`w-full pr-10 px-4 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
            />
          </div>
          <button
            onClick={fetchSuppliers}
            className={`p-2 rounded-lg border transition-colors ${colors.buttonSecondary}`}
            title="تحديث"
          >
            <FaSync className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={`${colors.card} rounded-lg shadow-sm overflow-hidden border ${colors.border}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={colors.tableHeader}>
                <th className="px-4 py-3 text-right text-sm font-semibold">#</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الكود</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الاسم</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">النوع</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الهاتف</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الرصيد</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الحالة</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center">
                    <div className={`flex flex-col items-center gap-2 ${colors.textMuted}`}>
                      <FaExclamationTriangle className="w-8 h-8" />
                      <p>لا يوجد موردين</p>
                    </div>
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier, index) => (
                  <tr key={supplier.id} className={`border-t ${colors.tableRow} transition-colors`}>
                    <td className="px-4 py-3 text-sm">{(currentPage - 1) * 20 + index + 1}</td>
                    <td className="px-4 py-3 font-mono text-sm font-medium">{supplier.code}</td>
                    <td className="px-4 py-3 text-sm font-medium">{supplier.name}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        supplier.type === 'local' 
                          ? (isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700')
                          : (isDark ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-50 text-purple-700')
                      }`}>
                        {supplier.type === 'local' ? 'محلي' : 'أجنبي'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{supplier.phone || '-'}</td>
                    <td className="px-4 py-3 text-sm font-mono">
                      <span className={parseFloat(supplier.balance || 0) > 0 ? 'text-red-500' : 'text-green-500'}>
                        {parseFloat(supplier.balance || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                      </span>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(supplier.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleView(supplier)}
                          className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
                          title="عرض"
                        >
                          <FaEye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(supplier)}
                          className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 transition-colors"
                          title="تعديل"
                        >
                          <FaEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(supplier.id)}
                          className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                          title="حذف"
                        >
                          <FaTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={`flex justify-center items-center gap-2 p-4 border-t ${colors.border}`}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`p-2 rounded-lg disabled:opacity-50 ${colors.buttonSecondary}`}
            >
              <FaArrowRight className="w-4 h-4" />
            </button>
            <span className={`text-sm ${colors.textMuted}`}>
              صفحة {currentPage} من {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`p-2 rounded-lg disabled:opacity-50 ${colors.buttonSecondary}`}
            >
              <FaArrowLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Suppliers;
