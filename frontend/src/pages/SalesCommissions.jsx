import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function SalesCommissions() {
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({});
  const [filters, setFilters] = useState({ from_date: '', to_date: '', employee_id: '' });
  const [employees, setEmployees] = useState([]);

  useEffect(() => { fetchData(); fetchEmployees(); }, [filters]);

  const fetchData = async () => {
    try { const token = localStorage.getItem('token'); const res = await axios.get(`${API}/reports/commissions-detailed`, { headers: { Authorization: `Bearer ${token}` }, params: filters }); setData(res.data.data || []); setSummary(res.data.summary || {}); }
    catch (e) { console.error(e); }
  };
  const fetchEmployees = async () => {
    try { const token = localStorage.getItem('token'); const res = await axios.get(`${API}/employees`, { headers: { Authorization: `Bearer ${token}` } }); setEmployees(res.data || []); }
    catch (e) { console.error(e); }
  };

  const empChart = Object.values(summary.by_employee || {}).map(e => ({
    name: e.employee_name,
    عمولة: e.total_commission,
    مسدد: e.total_paid,
    متبقي: e.total_remaining
  }));

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen" dir="rtl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">تقرير العمولات</h1>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm flex flex-wrap gap-4 mb-6">
        <input type="date" value={filters.from_date} onChange={e=>setFilters({...filters,from_date:e.target.value})} className="border dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        <input type="date" value={filters.to_date} onChange={e=>setFilters({...filters,to_date:e.target.value})} className="border dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        <select value={filters.employee_id} onChange={e=>setFilters({...filters,employee_id:e.target.value})} className="border dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          <option value="">كل البائعين</option>
          {employees.map(e=><option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm"><p className="text-gray-500 dark:text-gray-400">إجمالي العمولات</p><p className="text-xl font-bold text-gray-900 dark:text-white">ج.م {(summary.total_commissions||0).toLocaleString()}</p></div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm"><p className="text-gray-500 dark:text-gray-400">المسدد</p><p className="text-xl font-bold text-green-600">ج.م {(summary.total_paid||0).toLocaleString()}</p></div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm"><p className="text-gray-500 dark:text-gray-400">المتبقي</p><p className="text-xl font-bold text-orange-600">ج.م {(summary.total_remaining||0).toLocaleString()}</p></div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm"><p className="text-gray-500 dark:text-gray-400">عدد العمليات</p><p className="text-xl font-bold text-gray-900 dark:text-white">{data.length}</p></div>
      </div>

      {empChart.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">العمولات حسب البائع</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={empChart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip formatter={(v)=>`ج.م ${Number(v).toLocaleString()}`} /><Legend /><Bar dataKey="عمولة" fill="#3B82F6" /><Bar dataKey="مسدد" fill="#10B981" /><Bar dataKey="متبقي" fill="#EF4444" /></BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700"><tr>
            <th className="px-4 py-3 text-right text-gray-900 dark:text-white">البائع</th>
            <th className="px-4 py-3 text-right text-gray-900 dark:text-white">الفاتورة</th>
            <th className="px-4 py-3 text-right text-gray-900 dark:text-white">العميل</th>
            <th className="px-4 py-3 text-right text-gray-900 dark:text-white">النسبة %</th>
            <th className="px-4 py-3 text-right text-gray-900 dark:text-white">العمولة</th>
            <th className="px-4 py-3 text-right text-gray-900 dark:text-white">المسدد</th>
            <th className="px-4 py-3 text-right text-gray-900 dark:text-white">المتبقي</th>
            <th className="px-4 py-3 text-right text-gray-900 dark:text-white">الحالة</th>
          </tr></thead>
          <tbody className="divide-y dark:divide-gray-700">
            {data.map((row,idx)=> (
              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 text-gray-900 dark:text-white">{row.employee_name}</td>
                <td className="px-4 py-3 text-gray-900 dark:text-white">{row.invoice_number}</td>
                <td className="px-4 py-3 text-gray-900 dark:text-white">{row.customer_name}</td>
                <td className="px-4 py-3 text-gray-900 dark:text-white">{row.commission_rate}%</td>
                <td className="px-4 py-3 text-gray-900 dark:text-white">ج.م {Number(row.commission_amount).toLocaleString()}</td>
                <td className="px-4 py-3 text-green-600">ج.م {Number(row.paid_amount).toLocaleString()}</td>
                <td className="px-4 py-3 text-orange-600">ج.م {Number(row.remaining_amount).toLocaleString()}</td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs ${row.status==='paid'?'bg-green-100 text-green-800':'bg-yellow-100 text-yellow-800'}`}>{row.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
