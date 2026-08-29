import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { 
  FaPlus, FaEdit, FaTrash, FaEye, FaCheck, FaTimes, 
  FaSearch, FaSync, FaArrowLeft, FaArrowRight, FaExclamationTriangle,
  FaFileInvoice, FaTruck
} from 'react-icons/fa';

const PurchaseOrders = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [approvedRequests, setApprovedRequests] = useState([]);

  const API_URL = import.meta.env.VITE_API_URL;

  // Theme-based colors
  const colors = {
    bg: isDark ? 'bg-gray-900' : 'bg-gray-50',
    card: isDark ? 'bg-gray-800' : 'bg-white',
    cardHover: isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50',
    text: isDark ? 'text-gray-100' : 'text-gray-900',
    textMuted: isDark ? 'text-gray-400' : 'text-gray-500',
    border: isDark ? 'border-gray-700' : 'border-gray-200',
    input: isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400',
    tableHeader: isDark ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-700',
    tableRow: isDark ? 'border-gray-700 hover:bg-gray-700/50' : 'border-gray-200 hover:bg-gray-50',
    modal: isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900',
    modalOverlay: isDark ? 'bg-black/70' : 'bg-black/50',
    buttonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white',
    buttonSuccess: 'bg-green-600 hover:bg-green-700 text-white',
    buttonDanger: 'bg-red-600 hover:bg-red-700 text-white',
    buttonSecondary: isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-100' : 'bg-gray-200 hover:bg-gray-300 text-gray-700',
    buttonWarning: 'bg-yellow-600 hover:bg-yellow-700 text-white',
    status: {
      draft: isDark ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-gray-100 text-gray-800 border-gray-300',
      pending: isDark ? 'bg-yellow-900/50 text-yellow-300 border-yellow-700' : 'bg-yellow-100 text-yellow-800 border-yellow-300',
      approved: isDark ? 'bg-green-900/50 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-300',
      rejected: isDark ? 'bg-red-900/50 text-red-300 border-red-700' : 'bg-red-100 text-red-800 border-red-300',
      completed: isDark ? 'bg-blue-900/50 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-300',
    },
    type: {
      local: isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700',
      import: isDark ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-50 text-purple-700',
    }
  };

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/purchase-orders`, {
        params: { status: filterStatus !== 'all' ? filterStatus : '', search: searchTerm, page: currentPage },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setOrders(response.data.data || []);
      setTotalPages(response.data.totalPages || 1);
    } catch (error) {
      toast.error('فشل في جلب أوامر الشراء');
    } finally {
      setLoading(false);
    }
  }, [API_URL, filterStatus, searchTerm, currentPage]);

  const fetchData = useCallback(async () => {
    try {
      const [itemsRes, suppliersRes, currenciesRes, requestsRes] = await Promise.all([
        axios.get(`${API_URL}/api/items`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
        axios.get(`${API_URL}/api/suppliers`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
        axios.get(`${API_URL}/api/currencies`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
        axios.get(`${API_URL}/api/purchase-requests/approved/list`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      ]);
      setItems(itemsRes.data || []);
      setSuppliers(suppliersRes.data || []);
      setCurrencies(currenciesRes.data || []);
      setApprovedRequests(requestsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchOrders();
    fetchData();
  }, [fetchOrders, fetchData]);

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف أمر الشراء؟')) return;
    try {
      await axios.delete(`${API_URL}/api/purchase-orders/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('تم الحذف بنجاح');
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل في الحذف');
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('هل أنت متأكد من اعتماد أمر الشراء؟')) return;
    try {
      await axios.post(`${API_URL}/api/purchase-orders/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('تم الاعتماد بنجاح');
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل في الاعتماد');
    }
  };

  const handleView = (order) => {
    setSelectedOrder(order);
    setShowDetails(true);
  };

  const handleEdit = (order) => {
    setSelectedOrder(order);
    setShowModal(true);
  };

  const handleAdd = () => {
    setSelectedOrder(null);
    setShowModal(true);
  };

  const getStatusBadge = (status) => {
    const labels = { draft: 'مسودة', pending: 'معلق', approved: 'معتمد', rejected: 'مرفوض', completed: 'مكتمل' };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${colors.status[status] || colors.status.draft}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getTypeBadge = (type) => {
    const labels = { local: 'محلي', import: 'استيراد' };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors.type[type] || colors.type.local}`}>
        {labels[type] || type}
      </span>
    );
  };

  if (loading && orders.length === 0) {
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
          <h1 className="text-2xl font-bold">أوامر الشراء</h1>
          <p className={`text-sm mt-1 ${colors.textMuted}`}>إدارة أوامر الشراء المحلية والمستوردة</p>
        </div>
        <button
          onClick={handleAdd}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${colors.buttonPrimary}`}
        >
          <FaPlus className="w-4 h-4" />
          أمر شراء جديد
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
              placeholder="بحث برقم الأمر أو المورد..."
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
              <option value="approved">معتمد</option>
              <option value="rejected">مرفوض</option>
            </select>
            <button
              onClick={fetchOrders}
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
                <th className="px-4 py-3 text-right text-sm font-semibold">رقم الأمر</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">التاريخ</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">المورد</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">النوع</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">العملة</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الإجمالي</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">بالجنيه</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الحالة</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-4 py-8 text-center">
                    <div className={`flex flex-col items-center gap-2 ${colors.textMuted}`}>
                      <FaExclamationTriangle className="w-8 h-8" />
                      <p>لا توجد أوامر شراء</p>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((order, index) => (
                  <tr key={order.id} className={`border-t ${colors.tableRow} transition-colors`}>
                    <td className="px-4 py-3 text-sm">{(currentPage - 1) * 20 + index + 1}</td>
                    <td className="px-4 py-3 font-mono text-sm font-medium">{order.order_number}</td>
                    <td className="px-4 py-3 text-sm">
                      {order.order_date ? new Date(order.order_date).toLocaleDateString('ar-EG') : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">{order.supplier_name || '-'}</td>
                    <td className="px-4 py-3">{getTypeBadge(order.purchase_type)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="font-bold">{order.currency_symbol || 'ج.م'}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono font-medium">
                      {parseFloat(order.total_amount || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-green-500 font-medium">
                      {parseFloat(order.total_amount_local || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(order.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleView(order)}
                          className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
                          title="عرض"
                        >
                          <FaEye className="w-4 h-4" />
                        </button>
                        {order.status === 'draft' && (
                          <>
                            <button
                              onClick={() => handleEdit(order)}
                              className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 transition-colors"
                              title="تعديل"
                            >
                              <FaEdit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleApprove(order.id)}
                              className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 transition-colors"
                              title="اعتماد"
                            >
                              <FaCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(order.id)}
                              className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                              title="حذف"
                            >
                              <FaTrash className="w-4 h-4" />
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

export default PurchaseOrders;
