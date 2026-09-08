import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [qr, setQr] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { qr_code } = await register(form);
      setQr(qr_code);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  if (qr) {
    return (
      <div className="max-w-sm mx-auto mt-16 card text-center">
        <h1 className="text-xl font-bold mb-2">🎉 Account created!</h1>
        <p className="text-sm text-gray-500 mb-4">This is your Student ID QR. Save or print it — the librarian scans it to issue books.</p>
        <img src={qr} alt="Student QR ID" className="mx-auto w-48 h-48 border rounded-lg" />
        <button className="btn-primary w-full mt-5" onClick={() => navigate('/dashboard')}>
          Go to my dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto mt-16 card">
      <h1 className="text-xl font-bold mb-1">Create your account</h1>
      <p className="text-sm text-gray-500 mb-5">Register as a student to borrow books</p>
      {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg p-2 mb-3">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <input className="input" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="input" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="input" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input className="input" type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? 'Creating...' : 'Register'}
        </button>
      </form>
      <p className="text-sm text-gray-500 mt-4">
        Already registered? <Link to="/login" className="text-brand-600 font-medium">Login</Link>
      </p>
    </div>
  );
}
