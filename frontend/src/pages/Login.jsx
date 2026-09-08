import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      navigate(user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16 card">
      <h1 className="text-xl font-bold mb-1">Welcome back</h1>
      <p className="text-sm text-gray-500 mb-5">Login to your library account</p>
      {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg p-2 mb-3">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          className="input"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? 'Signing in...' : 'Login'}
        </button>
      </form>
      <p className="text-sm text-gray-500 mt-4">
        New here? <Link to="/register" className="text-brand-600 font-medium">Create a student account</Link>
      </p>
      <p className="text-xs text-gray-400 mt-3">Admin demo login: see backend/.env.example (ADMIN_EMAIL / ADMIN_PASSWORD)</p>
    </div>
  );
}
