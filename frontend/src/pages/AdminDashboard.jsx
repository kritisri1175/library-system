import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, ResponsiveContainer } from 'recharts';
import api from '../api';
import StatCard from '../components/StatCard';

export default function AdminDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/admin/stats').then((r) => setData(r.data));
  }, []);

  if (!data) return <div className="max-w-6xl mx-auto px-4 py-6">Loading dashboard...</div>;
  const { totals, most_borrowed, most_active_borrowers, category_stats, issued_per_day, recent_transactions } = data;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Books" value={totals.total_books} sub={`${totals.total_titles} titles`} />
        <StatCard label="Available" value={totals.available_books} accent="green" />
        <StatCard label="Currently Issued" value={totals.issued_books} accent="brand" />
        <StatCard label="Overdue" value={totals.overdue_books} accent="red" />
        <StatCard label="Total Members" value={totals.total_members} accent="gray" />
        <StatCard label="Fine Collected" value={`₹${totals.fine_collected}`} accent="green" />
        <StatCard label="Fine Pending" value={`₹${totals.fine_pending}`} accent="amber" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <p className="font-semibold mb-3">Books Issued (last 30 days)</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={issued_per_day}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#3b5bdb" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <p className="font-semibold mb-3">Category-wise Copies</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={category_stats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="copies" fill="#3b5bdb" />
              <Bar dataKey="available" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <p className="font-semibold mb-3">Most Borrowed Books</p>
          <ol className="space-y-2 text-sm">
            {most_borrowed.map((b, i) => (
              <li key={b.id} className="flex justify-between">
                <span>{i + 1}. {b.title} <span className="text-gray-400">— {b.author}</span></span>
                <span className="font-semibold">{b.times_borrowed}×</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="card">
          <p className="font-semibold mb-3">Most Active Borrowers</p>
          <ol className="space-y-2 text-sm">
            {most_active_borrowers.map((u, i) => (
              <li key={u.id} className="flex justify-between">
                <span>{i + 1}. {u.name} <span className="text-gray-400">({u.student_code})</span></span>
                <span className="font-semibold">{u.total_borrows}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="card">
        <p className="font-semibold mb-3">Recent Transactions</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-1.5 pr-3">Book</th>
                <th className="py-1.5 pr-3">Student</th>
                <th className="py-1.5 pr-3">Issued</th>
                <th className="py-1.5 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent_transactions.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="py-1.5 pr-3">{t.title}</td>
                  <td className="py-1.5 pr-3">{t.student_name}</td>
                  <td className="py-1.5 pr-3">{new Date(t.issued_at).toLocaleDateString()}</td>
                  <td className="py-1.5 pr-3">
                    <span className={`badge ${t.status === 'Overdue' ? 'bg-red-50 text-red-600' : t.status === 'Returned' ? 'bg-gray-100 text-gray-600' : 'bg-brand-50 text-brand-600'}`}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
