import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { 
  FaPlus, FaEdit, FaTrash, FaEye, FaCheck, FaTimes, 
  FaSearch, FaFilter, FaSync, FaFilePdf, FaFileExcel,
  FaArrowLeft, FaArrowRight, FaExclamationTriangle
} from 'react-icons/fa';
import PurchaseRequestModal from '../components/PurchaseRequestModal';
import PurchaseRequestDetails from '../components/PurchaseRequestDetails';

const PurchaseRequests = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [items, setItems] = useState([]);
  const [currencies, setCurrencies] = useState([]);

  const API_URL = import.meta.env.VITE_API_URL;

  // Theme-based colors
  const colors = {
    bg: isDark ? 'bg-gray-900' : 'bg-gray-50',
    card: isDark ? 'bg-gray-800' : 'bg-white',
    cardHover: isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50',
    text: isDark ? 'text-gray-100' : 'text-gray-900',
    textMuted: isDark ? 'text-gray-400' : 'text-gray-500',
    border: isDark ? 'border-gray-700' : 'border-gray-200',
    input: isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900',
    tableHeader: isDark ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-700',
    tableRow: isDark ? 'border-gray-700 hover:bg-gray-700/50' : 'border-gray-200 hover:bg-gray-50',
    modal: isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900',
    buttonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white',
    buttonSuccess: 'bg-green-600 hover:bg-green-700 text-white',
    buttonDanger: 'bg-red-600 hover:bg-red-700 text-white',
    buttonSecondary: isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-100' : 'bg-gray-200 hover:bg-gray-300 text-gray-700',
    status: {
      pending: isDark ? 'bg-yellow-900/50 text-yellow-300 border-yellow-700' : 'bg-yellow-100 text-yellow-800 border-yellow-300',
      approved: isDark ? 'bg-green-900/50 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-300',
      rejected: isDark ? 'bg-red-900/50 text-red-300 border-red-700' : 'bg-red-100 text-red-800 border-red-300',
      completed: isDark ? 'bg-blue-900/50 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-300',
    }
  };

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/purchase-requests`, {
        params: { status: filterStatus !== 'all' ? filterStatus : '', search: searchTerm, page: currentPage },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setRequests(response.data.data || []);
      setTotalPages(response.data.totalPages || 1);
    } catch (error) {
      toast.error('فشل في جلب طلبات الشراء');
    } finally {
      setLoading(false);
    }
  }, [API_URL, filterStatus, searchTerm, currentPage]);

  const fetchItems = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/items`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setItems(response.data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  }, [API_URL]);

  const fetchCurrencies = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/currencies`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setCurrencies(response.data || []);
    } catch (error) {
      console.error('Error fetching currencies:', error);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchRequests();
    fetchItems();
    fetchCurrencies();
  }, [fetchRequests, fetchItems, fetchCurrencies]);

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف طلب الشراء؟')) return;
    try {
      await axios.delete(`${API_URL}/api/purchase-requests/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('تم الحذف بنجاح');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل في الحذف');
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('هل أنت متأكد من اعتماد طلب الشراء؟')) return;
    try {
      await axios.post(`${API_URL}/api/purchase-requests/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('تم الاعتماد بنجاح');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل في الاعتماد');
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('سبب الرفض:');
    if (!reason) return;
    try {
      await axios.post(`${API_URL}/api/purchase-requests/${id}/reject`, { reason }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('تم الرفض بنجاح');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل في الرفض');
    }
  };

  const handleView = (request) => {
    setSelectedRequest(request);
    setShowDetails(true);
  };

  const handleEdit = (request) => {
    setSelectedRequest(request);
    setShowModal(true);
  };

  const handleAdd = () => {
    setSelectedRequest(null);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedRequest(null);
    fetchRequests();
  };

  const getStatusBadge = (status) => {
    const labels = { pending: 'معلق', approved: 'معتمد', rejected: 'مرفوض', completed: 'مكتمل' };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${colors.status[status] || colors.status.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading && requests.length === 0) {
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
          <h1 className="text-2xl font-bold">طلبات الشراء</h1>
          <p className={`text-sm mt-1 ${colors.textMuted}`}>إدارة طلبات الشراء من الإدارات المختلفة</p>
        </div>
        <button
          onClick={handleAdd}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${colors.buttonPrimary}`}
        >
          <FaPlus className="w-4 h-4" />
          طلب شراء جديد
        </button>
      </div>

      {/* Filters & Search */}
      <div className={`${colors.card} rounded-lg shadow-sm p-4 mb-6 border ${colors.border}`}>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FaSearch className={`absolute right-3 top-3 w-4 h-4 ${colors.textMuted}`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث برقم الطلب أو الملاحظات..."
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
              <option value="pending">معلق</option>
              <option value="approved">معتمد</option>
              <option value="rejected">مرفوض</option>
              <option value="completed">مكتمل</option>
            </select>
            <button
              onClick={fetchRequests}
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
                <th className="px-4 py-3 text-right text-sm font-semibold">رقم الطلب</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">التاريخ</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">القسم</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">العملة</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الإجمالي</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">بالجنيه</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الحالة</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center">
                    <div className={`flex flex-col items-center gap-2 ${colors.textMuted}`}>
                      <FaExclamationTriangle className="w-8 h-8" />
                      <p>لا توجد طلبات شراء</p>
                    </div>
                  </td>
                </tr>
              ) : (
                requests.map((request, index) => (
                  <tr key={request.id} className={`border-t ${colors.tableRow} transition-colors`}>
                    <td className="px-4 py-3 text-sm">{(currentPage - 1) * 20 + index + 1}</td>
                    <td className="px-4 py-3 font-mono text-sm font-medium">{request.request_number}</td>
                    <td className="px-4 py-3 text-sm">
                      {request.request_date ? new Date(request.request_date).toLocaleDateString('ar-EG') : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">{request.department_name || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center gap-1">
                        <span className="font-bold">{request.currency_symbol || 'ج.م'}</span>
                        {request.currency_name && (
                          <span className={`text-xs ${colors.textMuted}`}>({request.currency_name})</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono font-medium">
                      {parseFloat(request.total_amount || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-green-500 font-medium">
                      {parseFloat(request.total_amount_local || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(request.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleView(request)}
                          className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
                          title="عرض"
                        >
                          <FaEye className="w-4 h-4" />
                        </button>
                        {request.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleEdit(request)}
                              className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 transition-colors"
                              title="تعديل"
                            >
                              <FaEdit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleApprove(request.id)}
                              className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 transition-colors"
                              title="اعتماد"
                            >
                              <FaCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleReject(request.id)}
                              className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                              title="رفض"
                            >
                              <FaTimes className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(request.id)}
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

      {/* Modal */}
      {showModal && (
        <PurchaseRequestModal
          request={selectedRequest}
          items={items}
          currencies={currencies}
          onClose={handleModalClose}
          isDark={isDark}
          colors={colors}
        />
      )}

      {/* Details Modal */}
      {showDetails && selectedRequest && (
        <PurchaseRequestDetails
          request={selectedRequest}
          onClose={() => setShowDetails(false)}
          isDark={isDark}
          colors={colors}
        />
      )}
    </div>
  );
};

export default PurchaseRequests;
