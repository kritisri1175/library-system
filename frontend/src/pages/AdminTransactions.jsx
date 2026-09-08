import { useEffect, useState } from 'react';
import api from '../api';

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [filters, setFilters] = useState({ status: '', category: '', from: '', to: '' });

  function load() {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    api.get('/transactions', { params }).then((r) => setTransactions(r.data.transactions));
  }

  useEffect(load, [filters]);

  async function payFine(id) {
    await api.post(`/transactions/${id}/pay-fine`);
    load();
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold">All Transactions</h1>

      <div className="card flex flex-wrap gap-3">
        <select className="input max-w-[160px]" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All statuses</option>
          <option>Issued</option>
          <option>Returned</option>
          <option>Overdue</option>
        </select>
        <input className="input max-w-[160px]" placeholder="Category" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} />
        <input className="input max-w-[160px]" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        <input className="input max-w-[160px]" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 pr-3">Book</th>
              <th className="py-2 pr-3">Student</th>
              <th className="py-2 pr-3">Issued</th>
              <th className="py-2 pr-3">Due</th>
              <th className="py-2 pr-3">Returned</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Fine</th>
              <th className="py-2 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <td className="py-2 pr-3">{t.title}</td>
                <td className="py-2 pr-3">{t.student_name}</td>
                <td className="py-2 pr-3">{new Date(t.issued_at).toLocaleDateString()}</td>
                <td className="py-2 pr-3">{new Date(t.due_at).toLocaleDateString()}</td>
                <td className="py-2 pr-3">{t.returned_at ? new Date(t.returned_at).toLocaleDateString() : '-'}</td>
                <td className="py-2 pr-3">
                  <span className={`badge ${t.status === 'Overdue' ? 'bg-red-50 text-red-600' : t.status === 'Returned' ? 'bg-gray-100 text-gray-600' : 'bg-brand-50 text-brand-600'}`}>
                    {t.status}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  {t.fine_amount > 0 ? `₹${t.fine_amount} ${t.fine_paid ? '(paid)' : '(due)'}` : '-'}
                </td>
                <td className="py-2 pr-3">
                  {t.fine_amount > 0 && !t.fine_paid && (
                    <button className="btn-secondary !px-2 !py-1" onClick={() => payFine(t.id)}>Mark paid</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {transactions.length === 0 && <p className="text-gray-500 text-sm py-4">No transactions match these filters.</p>}
      </div>
    </div>
  );
}
