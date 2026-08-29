import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { 
  FaCheck, FaTimes, FaEye, FaSearch, FaSync, 
  FaArrowLeft, FaArrowRight, FaExclamationTriangle,
  FaFileSignature, FaStamp, FaClipboardCheck
} from 'react-icons/fa';

const PurchaseApprovals = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';

  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);
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
    status: {
      pending: isDark ? 'bg-yellow-900/50 text-yellow-300 border-yellow-700' : 'bg-yellow-100 text-yellow-800 border-yellow-300',
      approved: isDark ? 'bg-green-900/50 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-300',
      rejected: isDark ? 'bg-red-900/50 text-red-300 border-red-700' : 'bg-red-100 text-red-800 border-red-300',
    },
    type: {
      purchase_request: isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700',
      purchase_order: isDark ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-50 text-purple-700',
      purchase_invoice: isDark ? 'bg-green-900/30 text-green-300' : 'bg-green-50 text-green-700',
    }
  };

  const fetchApprovals = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/purchase-approvals`, {
        params: { 
          type: filterType !== 'all' ? filterType : '', 
          search: searchTerm, 
          page: currentPage 
        },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setApprovals(response.data.data || []);
      setTotalPages(response.data.totalPages || 1);
    } catch (error) {
      toast.error('فشل في جلب طلبات الاعتماد');
    } finally {
      setLoading(false);
    }
  }, [API_URL, filterType, searchTerm, currentPage]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleApprove = async (id, type) => {
    if (!window.confirm('هل أنت متأكد من الاعتماد؟')) return;
    try {
      await axios.post(`${API_URL}/api/purchase-approvals/${id}/approve`, { type }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('تم الاعتماد بنجاح');
      fetchApprovals();
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل في الاعتماد');
    }
  };

  const handleReject = async (id, type) => {
    const reason = prompt('سبب الرفض:');
    if (!reason) return;
    try {
      await axios.post(`${API_URL}/api/purchase-approvals/${id}/reject`, { type, reason }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('تم الرفض بنجاح');
      fetchApprovals();
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل في الرفض');
    }
  };

  const handleView = (approval) => {
    setSelectedApproval(approval);
    setShowDetails(true);
  };

  const getStatusBadge = (status) => {
    const labels = { pending: 'معلق', approved: 'معتمد', rejected: 'مرفوض' };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${colors.status[status] || colors.status.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getTypeBadge = (type) => {
    const labels = { 
      purchase_request: 'طلب شراء', 
      purchase_order: 'أمر شراء', 
      purchase_invoice: 'فاتورة' 
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors.type[type] || colors.type.purchase_request}`}>
        {labels[type] || type}
      </span>
    );
  };

  if (loading && approvals.length === 0) {
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
          <h1 className="text-2xl font-bold">اعتمادات المشتريات</h1>
          <p className={`text-sm mt-1 ${colors.textMuted}`}>مراجعة واعتماد طلبات الشراء وأوامرها وفواتيرها</p>
        </div>
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
              placeholder="بحث برقم الطلب أو الملاحظات..."
              className={`w-full pr-10 px-4 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={`px-4 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
            >
              <option value="all">كل الأنواع</option>
              <option value="purchase_request">طلب شراء</option>
              <option value="purchase_order">أمر شراء</option>
              <option value="purchase_invoice">فاتورة</option>
            </select>
            <button
              onClick={fetchApprovals}
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
                <th className="px-4 py-3 text-right text-sm font-semibold">النوع</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الرقم</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">التاريخ</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">القيمة</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">طلب بواسطة</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الحالة</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {approvals.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center">
                    <div className={`flex flex-col items-center gap-2 ${colors.textMuted}`}>
                      <FaClipboardCheck className="w-8 h-8" />
                      <p>لا توجد طلبات اعتماد معلقة</p>
                    </div>
                  </td>
                </tr>
              ) : (
                approvals.map((approval, index) => (
                  <tr key={approval.id} className={`border-t ${colors.tableRow} transition-colors`}>
                    <td className="px-4 py-3 text-sm">{(currentPage - 1) * 20 + index + 1}</td>
                    <td className="px-4 py-3">{getTypeBadge(approval.approval_type)}</td>
                    <td className="px-4 py-3 font-mono text-sm font-medium">{approval.document_number}</td>
                    <td className="px-4 py-3 text-sm">
                      {approval.document_date ? new Date(approval.document_date).toLocaleDateString('ar-EG') : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono font-medium">
                      {parseFloat(approval.total_amount || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                    </td>
                    <td className="px-4 py-3 text-sm">{approval.created_by_name || '-'}</td>
                    <td className="px-4 py-3">{getStatusBadge(approval.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleView(approval)}
                          className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
                          title="عرض"
                        >
                          <FaEye className="w-4 h-4" />
                        </button>
                        {approval.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(approval.id, approval.approval_type)}
                              className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 transition-colors"
                              title="اعتماد"
                            >
                              <FaCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleReject(approval.id, approval.approval_type)}
                              className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                              title="رفض"
                            >
                              <FaTimes className="w-4 h-4" />
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

export default PurchaseApprovals;
