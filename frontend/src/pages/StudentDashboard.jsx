import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [current, setCurrent] = useState([]);
  const [history, setHistory] = useState([]);
  const [fines, setFines] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [qr, setQr] = useState(null);
  const [tab, setTab] = useState('current');

  useEffect(() => {
    api.get('/transactions/my/current').then((r) => setCurrent(r.data.transactions));
    api.get('/transactions/my/history').then((r) => setHistory(r.data.transactions));
    api.get('/transactions/my/fines').then((r) => setFines(r.data));
    api.get('/transactions/my/notifications').then((r) => setNotifications(r.data.notifications));
    api.get('/auth/my-qr').then((r) => setQr(r.data.qr_code)).catch(() => {});
  }, []);

  function downloadHistory() {
    const token = localStorage.getItem('token');
    fetch('/api/transactions/my/history.csv', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'my-borrowing-history.csv';
        a.click();
      });
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Hi, {user?.name} 👋</h1>
          <p className="text-gray-500 text-sm">Student code: {user?.student_code}</p>
        </div>

        <div className="flex gap-2">
          {['current', 'history', 'notifications'].map((t) => (
            <button
              key={t}
              className={`btn-secondary !px-3 !py-1.5 ${tab === t ? '!bg-brand-500 !text-white' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'current' ? 'Currently Borrowed' : t === 'history' ? 'History' : 'Notifications'}
            </button>
          ))}
        </div>

        {tab === 'current' && (
          <div className="space-y-3">
            {current.length === 0 && <p className="text-gray-500 text-sm">No books currently borrowed.</p>}
            {current.map((tx) => {
              const days = daysUntil(tx.due_at);
              const overdue = days < 0;
              return (
                <div key={tx.id} className="card flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{tx.title}</p>
                    <p className="text-xs text-gray-500">{tx.author} · Copy {tx.copy_code}</p>
                  </div>
                  <div className="text-right">
                    <span className={`badge ${overdue ? 'bg-red-50 text-red-600' : days <= 2 ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                      {overdue ? `Overdue by ${Math.abs(days)}d` : `Due in ${days}d`}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">Due {new Date(tx.due_at).toDateString()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-3">
            <button className="btn-secondary" onClick={downloadHistory}>⬇ Download history (CSV)</button>
            {history.map((tx) => (
              <div key={tx.id} className="card flex justify-between items-center">
                <div>
                  <p className="font-semibold">{tx.title}</p>
                  <p className="text-xs text-gray-500">
                    Issued {new Date(tx.issued_at).toDateString()}
                    {tx.returned_at ? ` · Returned ${new Date(tx.returned_at).toDateString()}` : ''}
                  </p>
                </div>
                <span className={`badge ${tx.status === 'Returned' ? 'bg-gray-100 text-gray-600' : tx.status === 'Overdue' ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-600'}`}>
                  {tx.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {tab === 'notifications' && (
          <div className="space-y-2">
            {notifications.length === 0 && <p className="text-gray-500 text-sm">No notifications yet.</p>}
            {notifications.map((n) => (
              <div key={n.id} className="card text-sm flex justify-between items-center">
                <span>{n.message}</span>
                <span className="text-xs text-gray-400">{new Date(n.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="card text-center">
          <p className="text-sm font-medium mb-2">My ID QR</p>
          {qr ? <img src={qr} className="w-32 h-32 mx-auto" alt="Student QR" /> : <p className="text-xs text-gray-400">No QR on file</p>}
        </div>

        {fines && (
          <div className="card">
            <p className="text-sm font-medium mb-2">Fines</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Pending</span>
              <span className="font-semibold text-red-600">₹{fines.pending}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-500">Paid</span>
              <span className="font-semibold text-green-600">₹{fines.paid}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
