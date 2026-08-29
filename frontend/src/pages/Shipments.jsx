import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'react-toastify';
import { 
  FaPlus, FaEdit, FaTrash, FaEye, FaCheck, FaTimes, 
  FaSearch, FaSync, FaArrowLeft, FaArrowRight, FaExclamationTriangle,
  FaShip, FaDollarSign, FaCalculator, FaFileInvoice, FaWarehouse,
  FaMoneyBill, FaUserTie, FaReceipt
} from 'react-icons/fa';
import ShipmentModal from '../components/ShipmentModal';
import ShipmentDetails from '../components/ShipmentDetails';

const Shipments = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [shipments, setShipments] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const API_URL = import.meta.env.VITE_API_URL;

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
    modal: isDark ? 'bg-gray-800' : 'bg-white',
    status: {
      open: isDark ? 'bg-blue-900/50 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-300',
      in_progress: isDark ? 'bg-yellow-900/50 text-yellow-300 border-yellow-700' : 'bg-yellow-100 text-yellow-800 border-yellow-300',
      cleared: isDark ? 'bg-purple-900/50 text-purple-300 border-purple-700' : 'bg-purple-100 text-purple-800 border-purple-300',
      completed: isDark ? 'bg-green-900/50 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-300',
      cancelled: isDark ? 'bg-red-900/50 text-red-300 border-red-700' : 'bg-red-100 text-red-800 border-red-300',
    }
  };

  const fetchShipments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/shipments`, {
        params: { status: filterStatus !== 'all' ? filterStatus : '', search: searchTerm, page: currentPage },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setShipments(response.data.data || []);
      setTotalPages(response.data.totalPages || 1);
    } catch (error) {
      toast.error('فشل في جلب الشحنات');
    } finally {
      setLoading(false);
    }
  }, [API_URL, filterStatus, searchTerm, currentPage]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
        const [purchasesRes, suppliersRes] = await Promise.all([
          axios.get(`${API_URL}/api/purchases`, { params: { purchase_type: 'import' }, headers }),
          axios.get(`${API_URL}/api/suppliers`, { headers })
        ]);
        setPurchases(purchasesRes.data || []);
        setSuppliers(suppliersRes.data || []);
      } catch (error) {
        toast.error('فشل في جلب بيانات الفواتير أو الموردين');
      }
    };
    fetchLookups();
  }, [API_URL]);

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف الشحنة؟')) return;
    try {
      await axios.delete(`${API_URL}/api/shipments/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('تم الحذف بنجاح');
      fetchShipments();
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل في الحذف');
    }
  };

  const handleView = (shipment) => {
    setSelectedShipment(shipment);
    setShowDetails(true);
  };

  const handleEdit = (shipment) => {
    setSelectedShipment(shipment);
    setShowModal(true);
  };

  const handleAdd = () => {
    setSelectedShipment(null);
    setShowModal(true);
  };

  const getStatusBadge = (status) => {
    const labels = { 
      open: 'مفتوحة', 
      in_progress: 'قيد التنفيذ', 
      cleared: 'تم الإفراج',
      completed: 'مكتملة', 
      cancelled: 'ملغاة' 
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${colors.status[status] || colors.status.open}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading && shipments.length === 0) {
    return (
      <div className={`flex items-center justify-center h-64 ${colors.bg}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-6 ${colors.bg} ${colors.text}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">الشحنات</h1>
          <p className={`text-sm mt-1 ${colors.textMuted}`}>إدارة شحنات الاستيراد والتكلفة النهائية</p>
        </div>
        <button onClick={handleAdd} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${colors.buttonPrimary}`}>
          <FaPlus className="w-4 h-4" />
          شحنة جديدة
        </button>
      </div>

      <div className={`${colors.card} rounded-lg shadow-sm p-4 mb-6 border ${colors.border}`}>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FaSearch className={`absolute right-3 top-3 w-4 h-4 ${colors.textMuted}`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث برقم الشحنة..."
              className={`w-full pr-10 px-4 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={`px-4 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${colors.input}`}
          >
            <option value="all">كل الحالات</option>
            <option value="open">مفتوحة</option>
            <option value="in_progress">قيد التنفيذ</option>
            <option value="cleared">تم الإفراج</option>
            <option value="completed">مكتملة</option>
          </select>
          <button onClick={fetchShipments} className={`p-2 rounded-lg border transition-colors ${colors.buttonSecondary}`}>
            <FaSync className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className={`${colors.card} rounded-lg shadow-sm overflow-hidden border ${colors.border}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={colors.tableHeader}>
                <th className="px-4 py-3 text-right text-sm font-semibold">#</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">رقم الشحنة</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الفاتورة</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">المورد</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">قيمة الفاتورة $</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">التكلفة النهائية</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">المعامل الفعلي</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الحالة</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {shipments.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center">
                    <div className={`flex flex-col items-center gap-2 ${colors.textMuted}`}>
                      <FaExclamationTriangle className="w-8 h-8" />
                      <p>لا توجد شحنات</p>
                    </div>
                  </td>
                </tr>
              ) : (
                shipments.map((shipment, index) => (
                  <tr key={shipment.id} className={`border-t ${colors.tableRow} transition-colors`}>
                    <td className="px-4 py-3 text-sm">{(currentPage - 1) * 20 + index + 1}</td>
                    <td className="px-4 py-3 font-mono text-sm font-medium">{shipment.shipment_number}</td>
                    <td className="px-4 py-3 text-sm">{shipment.invoice_number || '-'}</td>
                    <td className="px-4 py-3 text-sm">{shipment.supplier_name || '-'}</td>
                    <td className="px-4 py-3 text-sm font-mono">
                      {shipment.invoice_amount_usd ? parseFloat(shipment.invoice_amount_usd).toLocaleString('ar-EG') : '-'} $
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-green-500 font-medium">
                      {shipment.total_landed_cost ? parseFloat(shipment.total_landed_cost).toLocaleString('ar-EG') : '-'} ج.م
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-blue-500">
                      {shipment.actual_exchange_rate ? parseFloat(shipment.actual_exchange_rate).toFixed(2) : '-'}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(shipment.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleView(shipment)} className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors">
                          <FaEye className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleEdit(shipment)} className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 transition-colors">
                          <FaEdit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(shipment.id)} className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors">
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

        {totalPages > 1 && (
          <div className={`flex justify-center items-center gap-2 p-4 border-t ${colors.border}`}>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className={`p-2 rounded-lg disabled:opacity-50 ${colors.buttonSecondary}`}>
              <FaArrowRight className="w-4 h-4" />
            </button>
            <span className={`text-sm ${colors.textMuted}`}>صفحة {currentPage} من {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className={`p-2 rounded-lg disabled:opacity-50 ${colors.buttonSecondary}`}>
              <FaArrowLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <ShipmentModal
          shipment={selectedShipment}
          purchases={purchases}
          suppliers={suppliers}
          isDark={isDark}
          colors={colors}
          onClose={() => {
            setShowModal(false);
            fetchShipments();
          }}
        />
      )}

      {showDetails && selectedShipment && (
        <ShipmentDetails
          shipmentId={selectedShipment.id}
          isDark={isDark}
          colors={colors}
          onClose={() => setShowDetails(false)}
        />
      )}
    </div>
  );
};

export default Shipments;
