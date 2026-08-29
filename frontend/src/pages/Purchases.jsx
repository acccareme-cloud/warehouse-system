import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { 
  FaPlus, FaEdit, FaTrash, FaEye, FaCheck, FaTimes, 
  FaSearch, FaSync, FaArrowLeft, FaArrowRight, FaExclamationTriangle,
  FaFileInvoice, FaWarehouse, FaStamp, FaUndo
} from 'react-icons/fa';

const Purchases = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';

  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
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
    buttonWarning: 'bg-yellow-600 hover:bg-yellow-700 text-white',
    status: {
      draft: isDark ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-gray-100 text-gray-800 border-gray-300',
      approved: isDark ? 'bg-green-900/50 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-300',
      posted: isDark ? 'bg-blue-900/50 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-300',
      cancelled: isDark ? 'bg-red-900/50 text-red-300 border-red-700' : 'bg-red-100 text-red-800 border-red-300',
    },
    invoiceType: {
      local_tax: isDark ? 'bg-green-900/30 text-green-300' : 'bg-green-50 text-green-700',
      local_no_tax: isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700',
      import: isDark ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-50 text-purple-700',
      dummy: isDark ? 'bg-orange-900/30 text-orange-300' : 'bg-orange-50 text-orange-700',
    }
  };

  const fetchPurchases = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/purchases`, {
        params: { 
          status: filterStatus !== 'all' ? filterStatus : '', 
          type: filterType !== 'all' ? filterType : '',
          search: searchTerm, 
          page: currentPage 
        },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setPurchases(response.data.data || []);
      setTotalPages(response.data.totalPages || 1);
    } catch (error) {
      toast.error('فشل في جلب فواتير المشتريات');
    } finally {
      setLoading(false);
    }
  }, [API_URL, filterStatus, filterType, searchTerm, currentPage]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف الفاتورة؟')) return;
    try {
      await axios.delete(`${API_URL}/api/purchases/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('تم الحذف بنجاح');
      fetchPurchases();
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل في الحذف');
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('هل أنت متأكد من اعتماد الفاتورة؟')) return;
    try {
      await axios.post(`${API_URL}/api/purchases/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('تم الاعتماد بنجاح');
      fetchPurchases();
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل في الاعتماد');
    }
  };

  const handlePost = async (id) => {
    if (!window.confirm('هل أنت متأكد من ترحيل الفاتورة للمخزن؟')) return;
    try {
      await axios.post(`${API_URL}/api/purchases/${id}/post`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('تم الترحيل بنجاح');
      fetchPurchases();
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل في الترحيل');
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('هل أنت متأكد من إلغاء الفاتورة؟')) return;
    try {
      await axios.post(`${API_URL}/api/purchases/${id}/cancel`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('تم الإلغاء بنجاح');
      fetchPurchases();
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل في الإلغاء');
    }
  };

  const handleView = (purchase) => {
    setSelectedPurchase(purchase);
    setShowDetails(true);
  };

  const handleEdit = (purchase) => {
    setSelectedPurchase(purchase);
    setShowModal(true);
  };

  const handleAdd = () => {
    setSelectedPurchase(null);
    setShowModal(true);
  };

  const getStatusBadge = (status) => {
    const labels = { draft: 'مسودة', approved: 'معتمدة', posted: 'مرحلة', cancelled: 'ملغاة' };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${colors.status[status] || colors.status.draft}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getTypeBadge = (type) => {
    const labels = { 
      local_tax: 'محلي ضريبي', 
      local_no_tax: 'محلي غير ضريبي', 
      import: 'استيراد',
      dummy: 'وهمية'
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors.invoiceType[type] || colors.invoiceType.local_tax}`}>
        {labels[type] || type}
      </span>
    );
  };

  if (loading && purchases.length === 0) {
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
          <h1 className="text-2xl font-bold">فواتير المشتريات</h1>
          <p className={`text-sm mt-1 ${colors.textMuted}`}>إدارة فواتير الشراء المحلية والمستوردة</p>
        </div>
        <button
          onClick={handleAdd}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${colors.buttonPrimary}`}
        >
          <FaPlus className="w-4 h-4" />
          فاتورة جديدة
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
              placeholder="بحث برقم الفاتورة أو المورد..."
              className={`w-full pr-10 px-4 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={`px-4 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
            >
              <option value="all">كل الحالات</option>
              <option value="draft">مسودة</option>
              <option value="approved">معتمدة</option>
              <option value="posted">مرحلة</option>
              <option value="cancelled">ملغاة</option>
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={`px-4 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
            >
              <option value="all">كل الأنواع</option>
              <option value="local_tax">محلي ضريبي</option>
              <option value="local_no_tax">محلي غير ضريبي</option>
              <option value="import">استيراد</option>
              <option value="dummy">وهمية</option>
            </select>
            <button
              onClick={fetchPurchases}
              className={`p-2 rounded-lg border transition-colors ${colors.buttonSecondary}`}
              title="تحديث"
            >
              <FaSync className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={`${colors.card} rounded-lg shadow-sm overflow-hidden border ${colors.border}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={colors.tableHeader}>
                <th className="px-4 py-3 text-right text-sm font-semibold">#</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">رقم الفاتورة</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">التاريخ</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">المورد</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">النوع</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">العملة</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الإجمالي</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الضريبة</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الصافي</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الحالة</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan="11" className="px-4 py-8 text-center">
                    <div className={`flex flex-col items-center gap-2 ${colors.textMuted}`}>
                      <FaExclamationTriangle className="w-8 h-8" />
                      <p>لا توجد فواتير مشتريات</p>
                    </div>
                  </td>
                </tr>
              ) : (
                purchases.map((purchase, index) => (
                  <tr key={purchase.id} className={`border-t ${colors.tableRow} transition-colors`}>
                    <td className="px-4 py-3 text-sm">{(currentPage - 1) * 20 + index + 1}</td>
                    <td className="px-4 py-3 font-mono text-sm font-medium">{purchase.invoice_number}</td>
                    <td className="px-4 py-3 text-sm">
                      {purchase.invoice_date ? new Date(purchase.invoice_date).toLocaleDateString('ar-EG') : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">{purchase.supplier_name || '-'}</td>
                    <td className="px-4 py-3">{getTypeBadge(purchase.invoice_type)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="font-bold">{purchase.currency_symbol || 'ج.م'}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono font-medium">
                      {parseFloat(purchase.total_amount || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-yellow-500">
                      {parseFloat(purchase.tax_amount || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-green-500 font-medium">
                      {parseFloat(purchase.net_amount || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(purchase.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleView(purchase)}
                          className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
                          title="عرض"
                        >
                          <FaEye className="w-4 h-4" />
                        </button>
                        {purchase.status === 'draft' && (
                          <>
                            <button
                              onClick={() => handleEdit(purchase)}
                              className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 transition-colors"
                              title="تعديل"
                            >
                              <FaEdit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleApprove(purchase.id)}
                              className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 transition-colors"
                              title="اعتماد"
                            >
                              <FaCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(purchase.id)}
                              className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                              title="حذف"
                            >
                              <FaTrash className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {purchase.status === 'approved' && (
                          <>
                            <button
                              onClick={() => handlePost(purchase.id)}
                              className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
                              title="ترحيل للمخزن"
                            >
                              <FaWarehouse className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleCancel(purchase.id)}
                              className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                              title="إلغاء"
                            >
                              <FaUndo className="w-4 h-4" />
                            </button>
                          </>
                        )}
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

export default Purchases;
