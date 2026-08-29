import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FaBox, FaBalanceScale, FaChartBar, FaExchangeAlt, FaBarcode, FaSearch, FaFilter } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function InventoryReports() {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('summary');
  const [loading, setLoading] = useState(false);

  // Summary data
  const [summary, setSummary] = useState({});

  // Items data
  const [items, setItems] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [itemCategory, setItemCategory] = useState('');

  // Tax inventory data
  const [taxInventory, setTaxInventory] = useState([]);

  // Comparison data
  const [comparison, setComparison] = useState([]);

  // Movements data
  const [movements, setMovements] = useState([]);
  const [movementItemId, setMovementItemId] = useState('');
  const [movementFromDate, setMovementFromDate] = useState('');
  const [movementToDate, setMovementToDate] = useState('');

  // Serial numbers data
  const [serialNumbers, setSerialNumbers] = useState([]);
  const [serialStatus, setSerialStatus] = useState('');

  // Shipments cost data
  const [shipmentsCost, setShipmentsCost] = useState([]);

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    if (activeTab === 'items') fetchItems();
    if (activeTab === 'tax-inventory') fetchTaxInventory();
    if (activeTab === 'comparison') fetchComparison();
    if (activeTab === 'movements') fetchMovements();
    if (activeTab === 'serial-numbers') fetchSerialNumbers();
    if (activeTab === 'shipments-cost') fetchShipmentsCost();
  }, [activeTab]);

  const fetchSummary = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/inventory-reports/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSummary(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = {};
      if (itemCategory) params.category_id = itemCategory;
      const res = await axios.get(`${API_URL}/inventory-reports/items`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setItems(res.data);
    } catch (err) {
      toast.error('فشل في تحميل الأصناف');
    } finally {
      setLoading(false);
    }
  };

  const fetchTaxInventory = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/inventory-reports/tax-inventory`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTaxInventory(res.data);
    } catch (err) {
      toast.error('فشل في تحميل المخزون الضريبي');
    } finally {
      setLoading(false);
    }
  };

  const fetchComparison = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/inventory-reports/comparison`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComparison(res.data);
    } catch (err) {
      toast.error('فشل في تحميل المقارنة');
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = {};
      if (movementItemId) params.item_id = movementItemId;
      if (movementFromDate) params.from_date = movementFromDate;
      if (movementToDate) params.to_date = movementToDate;
      const res = await axios.get(`${API_URL}/inventory-reports/movements`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setMovements(res.data);
    } catch (err) {
      toast.error('فشل في تحميل الحركات');
    } finally {
      setLoading(false);
    }
  };

  const fetchSerialNumbers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = {};
      if (serialStatus) params.status = serialStatus;
      const res = await axios.get(`${API_URL}/inventory-reports/serial-numbers`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setSerialNumbers(res.data);
    } catch (err) {
      toast.error('فشل في تحميل السريالات');
    } finally {
      setLoading(false);
    }
  };

  const fetchShipmentsCost = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/inventory-reports/shipments-cost`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShipmentsCost(res.data);
    } catch (err) {
      toast.error('فشل في تحميل تكلفة الشحنات');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item =>
    item.name?.toLowerCase().includes(itemSearch.toLowerCase()) ||
    item.code?.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const tabs = [
    { id: 'summary', label: 'ملخص المخزون', icon: <FaChartBar /> },
    { id: 'items', label: 'الأصناف', icon: <FaBox /> },
    { id: 'tax-inventory', label: 'المخزون الضريبي', icon: <FaBalanceScale /> },
    { id: 'comparison', label: 'مقارنة المخزون', icon: <FaExchangeAlt /> },
    { id: 'movements', label: 'الحركات', icon: <FaExchangeAlt /> },
    { id: 'serial-numbers', label: 'السريالات', icon: <FaBarcode /> },
    { id: 'shipments-cost', label: 'تكلفة الشحنات', icon: <FaChartBar /> },
  ];

  return (
    <div className={`min-h-screen p-4 ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FaBox className="text-blue-500" />
          تقارير المخزون
        </h1>
        <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          تقارير شاملة للمخزون الفعلي والضريبي
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-100'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>إجمالي الأصناف</p>
            <p className="text-3xl font-bold text-blue-600">{parseInt(summary.total_items || 0).toLocaleString()}</p>
          </div>
          <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>إجمالي الكمية</p>
            <p className="text-3xl font-bold text-green-600">{parseFloat(summary.total_quantity || 0).toLocaleString()}</p>
          </div>
          <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>القيمة الإجمالية</p>
            <p className="text-3xl font-bold text-purple-600">{parseFloat(summary.total_value || 0).toLocaleString()} ج.م</p>
          </div>
          <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>المخزون الضريبي</p>
            <p className="text-3xl font-bold text-orange-600">{parseFloat(summary.total_tax_quantity || 0).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Items Tab */}
      {activeTab === 'items' && (
        <div>
          <div className={`p-4 rounded-lg mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <FaSearch className="absolute right-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="بحث باسم أو كود الصنف..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className={`w-full pr-10 p-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                />
              </div>
            </div>
          </div>
          <div className={`rounded-lg shadow overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <th className="p-3 text-right">الكود</th>
                    <th className="p-3 text-right">الاسم</th>
                    <th className="p-3 text-right">الفئة</th>
                    <th className="p-3 text-right">الكمية</th>
                    <th className="p-3 text-right">التكلفة</th>
                    <th className="p-3 text-right">القيمة</th>
                    <th className="p-3 text-right">المخزون الضريبي</th>
                    <th className="p-3 text-right">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="8" className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div></td></tr>
                  ) : filteredItems.length === 0 ? (
                    <tr><td colSpan="8" className="p-8 text-center text-gray-500">لا توجد أصناف</td></tr>
                  ) : (
                    filteredItems.map(item => (
                      <tr key={item.id} className={`border-t ${isDark ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <td className="p-3 font-mono">{item.code}</td>
                        <td className="p-3 font-medium">{item.name}</td>
                        <td className="p-3">{item.category_name}</td>
                        <td className="p-3">{parseFloat(item.quantity || 0).toLocaleString()}</td>
                        <td className="p-3">{parseFloat(item.unit_cost || 0).toLocaleString()} ج.م</td>
                        <td className="p-3 font-bold">{parseFloat(item.total_value || 0).toLocaleString()} ج.م</td>
                        <td className="p-3">{parseFloat(item.tax_inventory_quantity || 0).toLocaleString()}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            item.status === 'active' ? 'bg-green-100 text-green-800' :
                            item.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {item.status === 'active' ? 'نشط' : item.status === 'inactive' ? 'غير نشط' : 'منتهي'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tax Inventory Tab */}
      {activeTab === 'tax-inventory' && (
        <div className={`rounded-lg shadow overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <th className="p-3 text-right">الكود</th>
                  <th className="p-3 text-right">الاسم</th>
                  <th className="p-3 text-right">المخزون الفعلي</th>
                  <th className="p-3 text-right">المخزون الضريبي</th>
                  <th className="p-3 text-right">الفرق</th>
                  <th className="p-3 text-right">القيمة الضريبية</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div></td></tr>
                ) : taxInventory.length === 0 ? (
                  <tr><td colSpan="6" className="p-8 text-center text-gray-500">لا يوجد مخزون ضريبي</td></tr>
                ) : (
                  taxInventory.map(item => (
                    <tr key={item.id} className={`border-t ${isDark ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <td className="p-3 font-mono">{item.code}</td>
                      <td className="p-3 font-medium">{item.name}</td>
                      <td className="p-3">{parseFloat(item.actual_quantity || 0).toLocaleString()}</td>
                      <td className="p-3 text-orange-600 font-bold">{parseFloat(item.tax_inventory_quantity || 0).toLocaleString()}</td>
                      <td className="p-3">{parseFloat(item.difference || 0).toLocaleString()}</td>
                      <td className="p-3">{parseFloat(item.tax_value || 0).toLocaleString()} ج.م</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Comparison Tab */}
      {activeTab === 'comparison' && (
        <div className={`rounded-lg shadow overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <th className="p-3 text-right">الكود</th>
                  <th className="p-3 text-right">الاسم</th>
                  <th className="p-3 text-right">المخزون الفعلي</th>
                  <th className="p-3 text-right">المخزون الضريبي</th>
                  <th className="p-3 text-right">الفرق</th>
                  <th className="p-3 text-right">الحالة</th>
                  <th className="p-3 text-right">القيمة</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div></td></tr>
                ) : comparison.length === 0 ? (
                  <tr><td colSpan="7" className="p-8 text-center text-gray-500">لا توجد بيانات</td></tr>
                ) : (
                  comparison.map(item => (
                    <tr key={item.id} className={`border-t ${isDark ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <td className="p-3 font-mono">{item.code}</td>
                      <td className="p-3 font-medium">{item.name}</td>
                      <td className="p-3">{parseFloat(item.actual_quantity || 0).toLocaleString()}</td>
                      <td className="p-3">{parseFloat(item.tax_inventory_quantity || 0).toLocaleString()}</td>
                      <td className="p-3 font-bold">{parseFloat(item.difference || 0).toLocaleString()}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          item.status === 'فائض' ? 'bg-green-100 text-green-800' :
                          item.status === 'عجز' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="p-3">{parseFloat(item.value_difference || 0).toLocaleString()} ج.م</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Movements Tab */}
      {activeTab === 'movements' && (
        <div>
          <div className={`p-4 rounded-lg mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                type="text"
                placeholder="رقم الصنف"
                value={movementItemId}
                onChange={(e) => setMovementItemId(e.target.value)}
                className={`p-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              />
              <input
                type="date"
                placeholder="من"
                value={movementFromDate}
                onChange={(e) => setMovementFromDate(e.target.value)}
                className={`p-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              />
              <input
                type="date"
                placeholder="إلى"
                value={movementToDate}
                onChange={(e) => setMovementToDate(e.target.value)}
                className={`p-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              />
              <button
                onClick={fetchMovements}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                بحث
              </button>
            </div>
          </div>
          <div className={`rounded-lg shadow overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <th className="p-3 text-right">التاريخ</th>
                    <th className="p-3 text-right">الصنف</th>
                    <th className="p-3 text-right">النوع</th>
                    <th className="p-3 text-right">الكمية</th>
                    <th className="p-3 text-right">التكلفة</th>
                    <th className="p-3 text-right">المرجع</th>
                    <th className="p-3 text-right">ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="7" className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div></td></tr>
                  ) : movements.length === 0 ? (
                    <tr><td colSpan="7" className="p-8 text-center text-gray-500">لا توجد حركات</td></tr>
                  ) : (
                    movements.map(m => (
                      <tr key={m.id} className={`border-t ${isDark ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <td className="p-3">{new Date(m.movement_date).toLocaleDateString('ar-EG')}</td>
                        <td className="p-3">{m.item_name}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            m.movement_type === 'in' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {m.movement_type === 'in' ? 'إضافة' : 'صرف'}
                          </span>
                        </td>
                        <td className="p-3">{parseFloat(m.quantity || 0).toLocaleString()}</td>
                        <td className="p-3">{parseFloat(m.unit_cost || 0).toLocaleString()} ج.م</td>
                        <td className="p-3">{m.reference_type} #{m.reference_id}</td>
                        <td className="p-3 text-sm">{m.notes}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Serial Numbers Tab */}
      {activeTab === 'serial-numbers' && (
        <div>
          <div className={`p-4 rounded-lg mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
            <select
              value={serialStatus}
              onChange={(e) => setSerialStatus(e.target.value)}
              className={`p-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value="">كل الحالات</option>
              <option value="pending">معلق</option>
              <option value="in_stock">في المخزن</option>
              <option value="sold">مباع</option>
              <option value="damaged">تالف</option>
            </select>
          </div>
          <div className={`rounded-lg shadow overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <th className="p-3 text-right">السريال</th>
                    <th className="p-3 text-right">الصنف</th>
                    <th className="p-3 text-right">الحالة</th>
                    <th className="p-3 text-right">إذن الاستلام</th>
                    <th className="p-3 text-right">أمر البيع</th>
                    <th className="p-3 text-right">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="6" className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div></td></tr>
                  ) : serialNumbers.length === 0 ? (
                    <tr><td colSpan="6" className="p-8 text-center text-gray-500">لا توجد سريالات</td></tr>
                  ) : (
                    serialNumbers.map(sn => (
                      <tr key={sn.id} className={`border-t ${isDark ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <td className="p-3 font-mono">{sn.serial_number}</td>
                        <td className="p-3">{sn.item_name}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            sn.status === 'in_stock' ? 'bg-green-100 text-green-800' :
                            sn.status === 'sold' ? 'bg-blue-100 text-blue-800' :
                            sn.status === 'damaged' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {sn.status === 'in_stock' ? 'في المخزن' : sn.status === 'sold' ? 'مباع' : sn.status === 'damaged' ? 'تالف' : 'معلق'}
                          </span>
                        </td>
                        <td className="p-3">{sn.receipt_voucher_number}</td>
                        <td className="p-3">{sn.sales_order_number}</td>
                        <td className="p-3">{new Date(sn.created_at).toLocaleDateString('ar-EG')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Shipments Cost Tab */}
      {activeTab === 'shipments-cost' && (
        <div className={`rounded-lg shadow overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <th className="p-3 text-right">رقم الشحنة</th>
                  <th className="p-3 text-right">المورد</th>
                  <th className="p-3 text-right">قيمة الفاتورة ($)</th>
                  <th className="p-3 text-right">معامل البنك</th>
                  <th className="p-3 text-right">سداد البنك</th>
                  <th className="p-3 text-right">مصاريف أخرى</th>
                  <th className="p-3 text-right">إجمالي التكلفة</th>
                  <th className="p-3 text-right">المعامل الفعلي</th>
                  <th className="p-3 text-right">ضرائب</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="9" className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div></td></tr>
                ) : shipmentsCost.length === 0 ? (
                  <tr><td colSpan="9" className="p-8 text-center text-gray-500">لا توجد شحنات</td></tr>
                ) : (
                  shipmentsCost.map(sh => (
                    <tr key={sh.id} className={`border-t ${isDark ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <td className="p-3 font-bold">#{sh.shipment_number}/{sh.shipment_year}</td>
                      <td className="p-3">{sh.supplier_name}</td>
                      <td className="p-3">{(parseFloat(sh.invoice_value_usd) || 0).toLocaleString()} $</td>
                      <td className="p-3">{parseFloat(sh.bank_exchange_rate || 0).toFixed(2)}</td>
                      <td className="p-3">{(parseFloat(sh.bank_payments) || 0).toLocaleString()} ج.م</td>
                      <td className="p-3">{(parseFloat(sh.other_expenses) || 0).toLocaleString()} ج.م</td>
                      <td className="p-3 font-bold text-green-600">{(parseFloat(sh.total_cost_egp) || 0).toLocaleString()} ج.م</td>
                      <td className="p-3 font-bold text-blue-600">{parseFloat(sh.actual_exchange_rate || 0).toFixed(2)}</td>
                      <td className="p-3">
                        <div className="text-xs">
                          <div>وارد: {(parseFloat(sh.total_customs_duty) || 0).toLocaleString()}</div>
                          <div>14%: {(parseFloat(sh.total_vat) || 0).toLocaleString()}</div>
                          <div>1%: {(parseFloat(sh.total_profit_tax) || 0).toLocaleString()}</div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
