import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  FaTimes, FaShip, FaFileInvoice, FaMoneyBill, FaCalculator,
  FaReceipt, FaPercentage, FaCoins, FaUserTie
} from 'react-icons/fa';

const ShipmentDetails = ({ shipmentId, onClose, isDark, colors }) => {
  const API_URL = import.meta.env.VITE_API_URL;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/api/shipments/${shipmentId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setData(res.data);
      } catch (error) {
        toast.error(error.response?.data?.message || 'فشل في جلب تفاصيل الشحنة');
        onClose();
      } finally {
        setLoading(false);
      }
    };
    if (shipmentId) fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId]);

  const fmt = (n) => (n || n === 0) ? parseFloat(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 }) : '-';

  const Section = ({ icon: Icon, title, children }) => (
    <div className={`rounded-lg border ${colors.border} p-4 mb-4`}>
      <div className={`flex items-center gap-2 mb-3 font-semibold ${colors.text}`}>
        <Icon className="w-4 h-4" />
        {title}
      </div>
      {children}
    </div>
  );

  const Row = ({ label, value, highlight }) => (
    <div className="flex justify-between items-center py-1.5 text-sm">
      <span className={colors.textMuted}>{label}</span>
      <span className={`font-mono ${highlight ? 'font-bold text-green-500' : colors.text}`}>{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className={`absolute inset-0 ${isDark ? 'bg-black/70' : 'bg-black/50'}`} onClick={onClose} />

      <div className={`relative w-full max-w-4xl max-h-[90vh] overflow-auto rounded-xl shadow-2xl ${colors.modal}`}>
        <div className={`sticky top-0 flex justify-between items-center px-6 py-4 border-b ${colors.border} ${colors.modal}`}>
          <h2 className={`text-lg font-bold flex items-center gap-2 ${colors.text}`}>
            <FaShip className="w-5 h-5" />
            تفاصيل الشحنة {data ? `- ${data.shipment_number}` : ''}
          </h2>
          <button onClick={onClose} className={`p-2 rounded-lg ${colors.buttonSecondary}`}>
            <FaTimes className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
          ) : !data ? (
            <p className={colors.textMuted}>تعذر تحميل بيانات الشحنة.</p>
          ) : (
            <>
              <Section icon={FaFileInvoice} title="بيانات الشحنة">
                <Row label="رقم الشحنة" value={data.shipment_number} />
                <Row label="رقم الفاتورة" value={data.purchase_number || '-'} />
                <Row label="المورد" value={data.supplier_name || '-'} />
                <Row label="تاريخ الشحن" value={data.shipment_date ? new Date(data.shipment_date).toLocaleDateString('ar-EG') : '-'} />
                <Row label="تاريخ الوصول" value={data.arrival_date ? new Date(data.arrival_date).toLocaleDateString('ar-EG') : '-'} />
                <Row label="الحالة" value={data.status} />
              </Section>

              {data.items?.length > 0 && (
                <Section icon={FaFileInvoice} title="بنود الفاتورة">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className={colors.tableHeader}>
                          <th className="px-2 py-2 text-right">الصنف</th>
                          <th className="px-2 py-2 text-right">الكمية</th>
                          <th className="px-2 py-2 text-right">سعر الوحدة $</th>
                          <th className="px-2 py-2 text-right">تكلفة الوحدة النهائية</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.items.map((item) => {
                          const unitCost = data.cost_calculation?.actual_exchange_rate
                            ? (parseFloat(item.unit_price) * data.cost_calculation.actual_exchange_rate)
                            : null;
                          return (
                            <tr key={item.id} className={`border-t ${colors.border}`}>
                              <td className="px-2 py-2">{item.item_name || item.item_code}</td>
                              <td className="px-2 py-2 font-mono">{item.quantity}</td>
                              <td className="px-2 py-2 font-mono">{fmt(item.unit_price)}</td>
                              <td className="px-2 py-2 font-mono text-green-500">{unitCost !== null ? `${fmt(unitCost)} ج.م` : '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )}

              {data.cost_calculation && (
                <Section icon={FaCalculator} title="التكلفة النهائية (Landed Cost)">
                  <Row label="قيمة الفاتورة بالدولار" value={`${fmt(data.cost_calculation.invoice_value_usd)} $`} />
                  <Row label="معامل التحويل البنكي" value={fmt(data.cost_calculation.bank_exchange_rate)} />
                  <Row label="قيمة الفاتورة بالجنيه (بنكي)" value={`${fmt(data.cost_calculation.invoice_value_egp)} ج.م`} />
                  <div className={`my-2 border-t ${colors.border}`} />
                  <Row label="إجمالي المصاريف" value={`${fmt(data.cost_calculation.expenses?.total_expenses)} ج.م`} />
                  <Row label="إجمالي ضرائب الإفراج" value={`${fmt(data.cost_calculation.taxes?.total_clearance_taxes)} ج.م`} />
                  <div className={`my-2 border-t ${colors.border}`} />
                  <Row label="إجمالي التكلفة" value={`${fmt(data.cost_calculation.total_cost_egp)} ج.م`} highlight />
                  <Row label="المعامل الفعلي" value={fmt(data.cost_calculation.actual_exchange_rate)} highlight />
                </Section>
              )}

              {data.cost_calculation?.expenses && (
                <Section icon={FaMoneyBill} title="تفصيل المصاريف">
                  <Row label="مصاريف الشركة" value={`${fmt(data.cost_calculation.expenses.company_expenses)} ج.م`} />
                  <Row label="مصاريف العهدة (المخلص)" value={`${fmt(data.cost_calculation.expenses.custodian_expenses)} ج.م`} />
                  <Row label="سداد للبنك" value={`${fmt(data.cost_calculation.expenses.bank_payments)} ج.م`} />
                  <Row label="مصاريف تخليص" value={`${fmt(data.cost_calculation.expenses.clearance_expenses)} ج.م`} />
                  <Row label="مصاريف شحن" value={`${fmt(data.cost_calculation.expenses.shipping_expenses)} ج.م`} />
                  <Row label="عمولة البنك" value={`${fmt(data.cost_calculation.expenses.bank_commission)} ج.م`} />
                  <Row label="مصاريف أخرى" value={`${fmt(data.cost_calculation.expenses.other_expenses)} ج.م`} />
                </Section>
              )}

              {data.cost_calculation?.taxes && (
                <Section icon={FaPercentage} title="ضرائب الإفراج الجمركي">
                  <Row label="ضريبة الوارد (جمارك)" value={`${fmt(data.cost_calculation.taxes.customs_duty)} ج.م`} />
                  <Row label="ضريبة القيمة المضافة 14%" value={`${fmt(data.cost_calculation.taxes.vat_14)} ج.م`} />
                  <Row label="ضريبة الأرباح 1%" value={`${fmt(data.cost_calculation.taxes.profit_tax_1)} ج.م`} />
                </Section>
              )}

              {data.expenses?.length > 0 && (
                <Section icon={FaReceipt} title="سجل المصاريف المربوطة بالشحنة">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className={colors.tableHeader}>
                          <th className="px-2 py-2 text-right">النوع</th>
                          <th className="px-2 py-2 text-right">الجهة الدافعة</th>
                          <th className="px-2 py-2 text-right">المصدر</th>
                          <th className="px-2 py-2 text-right">المبلغ (ج.م)</th>
                          <th className="px-2 py-2 text-right">التاريخ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.expenses.map((exp) => (
                          <tr key={exp.id} className={`border-t ${colors.border}`}>
                            <td className="px-2 py-2">{exp.expense_type}</td>
                            <td className="px-2 py-2">{exp.paid_by === 'custodian' ? 'المخلص (عهدة)' : 'الشركة'}</td>
                            <td className="px-2 py-2">
                              {exp.treasury_number || exp.custody_number || exp.bank_account_name || '-'}
                            </td>
                            <td className="px-2 py-2 font-mono">{fmt(exp.total_egp)}</td>
                            <td className="px-2 py-2">{exp.expense_date ? new Date(exp.expense_date).toLocaleDateString('ar-EG') : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )}

              {data.notes && (
                <Section icon={FaUserTie} title="ملاحظات">
                  <p className={`text-sm ${colors.text}`}>{data.notes}</p>
                </Section>
              )}
            </>
          )}
        </div>

        <div className={`sticky bottom-0 flex justify-end px-6 py-4 border-t ${colors.border} ${colors.modal}`}>
          <button onClick={onClose} className={`px-6 py-2.5 rounded-lg ${colors.buttonSecondary}`}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShipmentDetails;
