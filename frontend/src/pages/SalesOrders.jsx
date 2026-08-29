import React, { useState, useEffect } from 'react';
import axios from 'axios';
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function SalesOrders() {
  const [orders, setOrders] = useState([]);
  const [banks, setBanks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('orders');
  const [form, setForm] = useState({ customer_id: '', order_date: new Date().toISOString().split('T')[0], notes: '', bank_id: '', items: [] });
  const [dqForm, setDqForm] = useState({ items: [], bank_id: '', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchOrders(); fetchBanks(); }, []);

  const fetchOrders = async () => {
    try { const token = localStorage.getItem('token'); const res = await axios.get(`${API}/sales-orders`, { headers: { Authorization: `Bearer ${token}` } }); setOrders(res.data); }
    catch (e) { console.error(e); }
  };
  const fetchBanks = async () => {
    try { const token = localStorage.getItem('token'); const res = await axios.get(`${API}/bank-accounts`, { headers: { Authorization: `Bearer ${token}` } }); setBanks(res.data); }
    catch (e) { console.error(e); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try { const token = localStorage.getItem('token'); await axios.post(`${API}/sales-orders`, form, { headers: { Authorization: `Bearer ${token}` } }); setShowForm(false); fetchOrders(); }
    catch (e) { alert(e.response?.data?.message || 'خطأ'); }
    finally { setLoading(false); }
  };

  const createDeliveryQuote = async (orderId) => {
    if (!dqForm.bank_id) { alert('اختر البنك'); return; }
    try { const token = localStorage.getItem('token'); await axios.post(`${API}/sales-orders/${orderId}/delivery-quote`, dqForm, { headers: { Authorization: `Bearer ${token}` } }); alert('تم إنشاء بيان التسليم'); fetchOrders(); }
    catch (e) { alert(e.response?.data?.message || 'خطأ'); }
  };

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen" dir="rtl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">أوامر البيع</h1>

      <div className="flex gap-4 mb-6">
        <button onClick={() => setActiveTab('orders')} className={`px-4 py-2 rounded-lg ${activeTab==='orders'?'bg-blue-600 text-white':'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>أوامر البيع</button>
        <button onClick={() => setActiveTab('dq')} className={`px-4 py-2 rounded-lg ${activeTab==='dq'?'bg-blue-600 text-white':'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>بيانات التسليم</button>
      </div>

      <button onClick={() => setShowForm(!showForm)} className="mb-4 px-4 py-2 bg-green-600 text-white rounded-lg">+ أمر بيع جديد</button>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select required value={form.customer_id} onChange={e=>setForm({...form,customer_id:e.target.value})} className="border dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">اختر العميل</option>
            </select>
            <input type="date" required value={form.order_date} onChange={e=>setForm({...form,order_date:e.target.value})} className="border dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            <select value={form.bank_id} onChange={e=>setForm({...form,bank_id:e.target.value})} className="border dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">اختر البنك (اختياري)</option>
              {banks.map(b=><option key={b.id} value={b.id}>{b.bank_name} - {b.account_number}</option>)}
            </select>
          </div>
          <textarea placeholder="ملاحظات" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="w-full border dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg">{loading?'جاري الحفظ...':'حفظ'}</button>
        </form>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-right text-gray-900 dark:text-white">رقم الأمر</th>
              <th className="px-4 py-3 text-right text-gray-900 dark:text-white">العميل</th>
              <th className="px-4 py-3 text-right text-gray-900 dark:text-white">التاريخ</th>
              <th className="px-4 py-3 text-right text-gray-900 dark:text-white">البنك</th>
              <th className="px-4 py-3 text-right text-gray-900 dark:text-white">الحالة</th>
              <th className="px-4 py-3 text-right text-gray-900 dark:text-white">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-700">
            {orders.map(o=> (
              <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 text-gray-900 dark:text-white">{o.order_number}</td>
                <td className="px-4 py-3 text-gray-900 dark:text-white">{o.customer_name}</td>
                <td className="px-4 py-3 text-gray-900 dark:text-white">{new Date(o.order_date).toLocaleDateString('ar-EG')}</td>
                <td className="px-4 py-3 text-gray-900 dark:text-white">{o.bank_name || '-'}</td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs ${o.status==='approved'?'bg-green-100 text-green-800':'bg-yellow-100 text-yellow-800'}`}>{o.status}</span></td>
                <td className="px-4 py-3">
                  <button onClick={()=>setSelectedOrder(o)} className="text-blue-600 hover:underline">عرض</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">تفاصيل أمر البيع #{selectedOrder.order_number}</h2>
            <p className="text-gray-600 dark:text-gray-300">العميل: {selectedOrder.customer_name}</p>
            {selectedOrder.bank_name && (
              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <p className="text-blue-800 dark:text-blue-200 font-medium">🏦 البنك: {selectedOrder.bank_name}</p>
                <p className="text-blue-600 dark:text-blue-300 text-sm">رقم الحساب: {selectedOrder.account_number}</p>
                <p className="text-blue-600 dark:text-blue-300 text-sm">IBAN: {selectedOrder.iban}</p>
              </div>
            )}

            <div className="mt-4 border-t dark:border-gray-700 pt-4">
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">إنشاء بيان تسليم مسعر</h3>
              <div className="flex gap-2 mb-2">
                <select value={dqForm.bank_id} onChange={e=>setDqForm({...dqForm,bank_id:e.target.value})} className="border dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value="">اختر البنك</option>
                  {banks.map(b=><option key={b.id} value={b.id}>{b.bank_name}</option>)}
                </select>
                <input type="number" placeholder="الشهر" value={dqForm.month} onChange={e=>setDqForm({...dqForm,month:e.target.value})} className="border dark:border-gray-600 rounded-lg p-2 w-20 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                <input type="number" placeholder="السنة" value={dqForm.year} onChange={e=>setDqForm({...dqForm,year:e.target.value})} className="border dark:border-gray-600 rounded-lg p-2 w-24 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <button onClick={()=>createDeliveryQuote(selectedOrder.id)} className="px-4 py-2 bg-blue-600 text-white rounded-lg">إنشاء بيان تسليم</button>
            </div>

            <button onClick={()=>setSelectedOrder(null)} className="mt-4 w-full py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg">إغلاق</button>
          </div>
        </div>
      )}
    </div>
  );
}
