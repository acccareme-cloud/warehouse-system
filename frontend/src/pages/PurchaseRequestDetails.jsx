import React from 'react';
import { FaTimes, FaCalendar, FaUser, FaBuilding, FaDollarSign, FaCoins, FaExclamationTriangle } from 'react-icons/fa';

const PurchaseRequestDetails = ({ request, onClose, isDark, colors }) => {
  if (!request) return null;

  const getStatusBadge = (status) => {
    const styles = {
      pending: isDark ? 'bg-yellow-900/50 text-yellow-300 border-yellow-700' : 'bg-yellow-100 text-yellow-800 border-yellow-300',
      approved: isDark ? 'bg-green-900/50 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-300',
      rejected: isDark ? 'bg-red-900/50 text-red-300 border-red-700' : 'bg-red-100 text-red-800 border-red-300',
      completed: isDark ? 'bg-blue-900/50 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-300',
    };
    const labels = { pending: 'معلق', approved: 'معتمد', rejected: 'مرفوض', completed: 'مكتمل' };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className={`absolute inset-0 ${isDark ? 'bg-black/70' : 'bg-black/50'}`}
        onClick={onClose}
      />

      <div className={`relative w-full max-w-4xl max-h-[90vh] overflow-auto rounded-xl shadow-2xl ${colors.modal}`}>
        {/* Header */}
        <div className={`flex justify-between items-center p-6 border-b ${colors.border}`}>
          <div>
            <h2 className="text-xl font-bold">تفاصيل طلب الشراء</h2>
            <p className={`text-sm mt-1 ${colors.textMuted}`}>#{request.request_number}</p>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(request.status)}
            <button
              onClick={onClose}
              className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
            >
              <FaTimes className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className={`p-4 rounded-xl border ${colors.border} ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                <FaCalendar className={`w-4 h-4 ${colors.textMuted}`} />
                <span className={`text-sm ${colors.textMuted}`}>التاريخ</span>
              </div>
              <p className="font-medium">
                {request.request_date ? new Date(request.request_date).toLocaleDateString('ar-EG') : '-'}
              </p>
            </div>

            <div className={`p-4 rounded-xl border ${colors.border} ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                <FaBuilding className={`w-4 h-4 ${colors.textMuted}`} />
                <span className={`text-sm ${colors.textMuted}`}>القسم</span>
              </div>
              <p className="font-medium">{request.department_name || '-'}</p>
            </div>

            <div className={`p-4 rounded-xl border ${colors.border} ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                <FaUser className={`w-4 h-4 ${colors.textMuted}`} />
                <span className={`text-sm ${colors.textMuted}`}>بواسطة</span>
              </div>
              <p className="font-medium">{request.created_by_name || '-'}</p>
            </div>

            <div className={`p-4 rounded-xl border ${colors.border} ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                <FaCoins className={`w-4 h-4 ${colors.textMuted}`} />
                <span className={`text-sm ${colors.textMuted}`}>العملة</span>
              </div>
              <p className="font-medium">{request.currency_name || 'جنيه مصري'}</p>
            </div>
          </div>

          {/* Exchange Rate */}
          {request.currency_id && (
            <div className={`p-4 rounded-xl border ${colors.border} mb-6 ${isDark ? 'bg-blue-900/10' : 'bg-blue-50'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${colors.textMuted}`}>معامل التحويل</p>
                  <p className="text-lg font-mono font-medium">1 {request.currency_symbol} = {parseFloat(request.exchange_rate).toFixed(6)} ج.م</p>
                </div>
                <FaDollarSign className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className={`rounded-xl border ${colors.border} overflow-hidden mb-6`}>
            <div className={`p-4 border-b ${colors.border}`}>
              <h3 className="font-bold">البنود</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={colors.tableHeader}>
                  <tr>
                    <th className="px-4 py-3 text-right text-sm font-semibold">#</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">الصنف</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">الكمية</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">السعر</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">الإجمالي</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">الضريبة</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {request.items?.map((item, index) => (
                    <tr key={index} className={`border-t ${colors.tableRow}`}>
                      <td className="px-4 py-3 text-sm">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{item.item_name}</p>
                          <p className={`text-xs ${colors.textMuted}`}>{item.item_code}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm font-mono">
                        {parseFloat(item.unit_price).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono font-medium">
                        {parseFloat(item.total_price).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        {item.is_vat_exempt ? (
                          <span className="flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded text-xs">
                            <FaExclamationTriangle className="w-3 h-3" />
                            معفى
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs">
                            14% VAT
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{item.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-4 rounded-xl border ${colors.border} ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <p className={`text-sm ${colors.textMuted}`}>عدد البنود</p>
              <p className="text-2xl font-bold">{request.items?.length || 0}</p>
            </div>
            <div className={`p-4 rounded-xl border ${colors.border} ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <p className={`text-sm ${colors.textMuted}`}>الإجمالي</p>
              <p className="text-2xl font-bold">
                {parseFloat(request.total_amount || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                <span className="text-sm font-normal mr-1">{request.currency_symbol || 'ج.م'}</span>
              </p>
            </div>
            <div className={`p-4 rounded-xl border ${colors.border} ${isDark ? 'bg-green-900/20' : 'bg-green-50'}`}>
              <p className={`text-sm ${colors.textMuted}`}>بالجنيه المصري</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {parseFloat(request.total_amount_local || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
              </p>
            </div>
          </div>

          {/* Notes */}
          {request.notes && (
            <div className={`mt-6 p-4 rounded-xl border ${colors.border} ${isDark ? 'bg-yellow-900/10' : 'bg-yellow-50'}`}>
              <p className={`text-sm font-medium mb-1 ${colors.textMuted}`}>ملاحظات</p>
              <p>{request.notes}</p>
            </div>
          )}

          {/* Approval Info */}
          {request.status === 'approved' && (
            <div className={`mt-6 p-4 rounded-xl border ${colors.border} ${isDark ? 'bg-green-900/10' : 'bg-green-50'}`}>
              <p className={`text-sm font-medium mb-2 ${colors.textMuted}`}>معلومات الاعتماد</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={`text-xs ${colors.textMuted}`}>معتمد بواسطة</p>
                  <p className="font-medium">{request.approved_by_name || '-'}</p>
                </div>
                <div>
                  <p className={`text-xs ${colors.textMuted}`}>تاريخ الاعتماد</p>
                  <p className="font-medium">
                    {request.approved_at ? new Date(request.approved_at).toLocaleDateString('ar-EG') : '-'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t ${colors.border} flex justify-end`}>
          <button
            onClick={onClose}
            className={`px-6 py-2 rounded-lg border transition-colors ${colors.buttonSecondary}`}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurchaseRequestDetails;
