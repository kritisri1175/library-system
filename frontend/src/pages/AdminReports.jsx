import { useState } from 'react';

const reportTypes = [
  { key: 'transactions', label: 'All Transactions' },
  { key: 'overdue', label: 'Overdue Books' },
  { key: 'issued', label: 'Currently Issued Books' },
  { key: 'fines', label: 'Fine / Penalty Report' },
];

export default function AdminReports() {
  const [filters, setFilters] = useState({ status: '', student_id: '', book_id: '', category: '', from: '', to: '' });

  function download(reportKey, format) {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
    const url = `/api/reports/${reportKey}.${format}?${params.toString()}`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${reportKey}.${format}`;
        link.click();
      });
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      <div className="card">
        <p className="font-semibold mb-3">Filters (applied to all reports below)</p>
        <div className="grid md:grid-cols-3 gap-3">
          <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Any status</option>
            <option>Issued</option>
            <option>Returned</option>
            <option>Overdue</option>
          </select>
          <input className="input" placeholder="Category" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} />
          <input className="input" placeholder="Student ID (numeric)" value={filters.student_id} onChange={(e) => setFilters({ ...filters, student_id: e.target.value })} />
          <input className="input" placeholder="Book ID (numeric)" value={filters.book_id} onChange={(e) => setFilters({ ...filters, book_id: e.target.value })} />
          <input className="input" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          <input className="input" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {reportTypes.map((r) => (
          <div key={r.key} className="card flex items-center justify-between">
            <span className="font-medium">{r.label}</span>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => download(r.key, 'csv')}>CSV</button>
              <button className="btn-primary" onClick={() => download(r.key, 'pdf')}>PDF</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
