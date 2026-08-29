import React, { useState, useEffect } from 'react';
import axios from 'axios';
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function TaxInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customer_id: '', invoice_date: new Date().toISOString().split('T')[0], items: [], is_service: true, service_period_from: '', service_period_to: '' });
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);

  useEffect(() => { fetchInvoices(); fetchCustomers(); fetchItems(); }, []);

  const fetchInvoices = async () => {
    try { const token = localStorage.getItem('token'); const res = await axios.get(`${API}/tax-invoices?type=service`, { headers: { Authorization: `Bearer ${token}` } }); setInvoices(res.data); }
    catch (e) { console.error(e); }
  };
  const fetchCustomers = async () => {
    try { const token = localStorage.getItem('token'); const res = await axios.get(`${API}/customers`, { headers: { Authorization: `Bearer ${token}` } }); setCustomers(res.data); }
    catch (e) { console.error(e); }
  };
  const fetchItems = async () => {
    try { const token = localStorage.getItem('token'); const res = await axios.get(`${API}/items?type=service`, { headers: { Authorization: `Bearer ${token}` } }); setItems(res.data); }
    catch (e) { console.error(e); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try { const token = localStorage.getItem('token'); await axios.post(`${API}/tax-invoices`, form, { headers: { Authorization: `Bearer ${token}` } }); setShowForm(false); fetchInvoices(); }
    catch (e) { alert(e.response?.data?.message || 'خطأ'); }
  };

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen" dir="rtl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">فواتير خدمة ضريبية / بيانات سعر</h1>
      <button onClick={()=>setShowForm(!showForm)} className="mb-4 px-4 py-2 bg-green-600 text-white rounded-lg">+ فاتورة جديدة</button>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select required value={form.customer_id} onChange={e=>setForm({...form,customer_id:e.target.value})} className="border dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">اختر العميل</option>
              {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="date" required value={form.invoice_date} onChange={e=>setForm({...form,invoice_date:e.target.value})} className="border dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="date" placeholder="فترة الخدمة من" value={form.service_period_from} onChange={e=>setForm({...form,service_period_from:e.target.value})} className="border dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            <input type="date" placeholder="فترة الخدمة إلى" value={form.service_period_to} onChange={e=>setForm({...form,service_period_to:e.target.value})} className="border dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">⚠️ الفاتورة دي للخدمات فقط - مش هتأثر على المخزن</p>
          <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg">حفظ الفاتورة</button>
        </form>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700"><tr>
            <th className="px-4 py-3 text-right text-gray-900 dark:text-white">رقم الفاتورة</th>
            <th className="px-4 py-3 text-right text-gray-900 dark:text-white">العميل</th>
            <th className="px-4 py-3 text-right text-gray-900 dark:text-white">التاريخ</th>
            <th className="px-4 py-3 text-right text-gray-900 dark:text-white">النوع</th>
            <th className="px-4 py-3 text-right text-gray-900 dark:text-white">القيمة</th>
            <th className="px-4 py-3 text-right text-gray-900 dark:text-white">الحالة</th>
          </tr></thead>
          <tbody className="divide-y dark:divide-gray-700">
            {invoices.map(inv=> (
              <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 text-gray-900 dark:text-white">{inv.invoice_number}</td>
                <td className="px-4 py-3 text-gray-900 dark:text-white">{inv.customer_name}</td>
                <td className="px-4 py-3 text-gray-900 dark:text-white">{new Date(inv.invoice_date).toLocaleDateString('ar-EG')}</td>
                <td className="px-4 py-3"><span className="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">خدمة</span></td>
                <td className="px-4 py-3 text-gray-900 dark:text-white">ج.م {Number(inv.total_amount).toLocaleString()}</td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs ${inv.status==='approved'?'bg-green-100 text-green-800':'bg-yellow-100 text-yellow-800'}`}>{inv.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
