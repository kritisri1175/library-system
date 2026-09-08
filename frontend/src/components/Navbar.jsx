import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-bold text-brand-600 text-lg">📚 LibraryOS</Link>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/catalog" className="hover:text-brand-600">Catalog</Link>
          {user?.role === 'student' && (
            <>
              <Link to="/dashboard" className="hover:text-brand-600">My Dashboard</Link>
            </>
          )}
          {user?.role === 'admin' && (
            <>
              <Link to="/admin" className="hover:text-brand-600">Admin</Link>
              <Link to="/admin/scan" className="hover:text-brand-600">Scan Station</Link>
              <Link to="/admin/books" className="hover:text-brand-600">Manage Books</Link>
              <Link to="/admin/transactions" className="hover:text-brand-600">Transactions</Link>
              <Link to="/admin/reports" className="hover:text-brand-600">Reports</Link>
            </>
          )}
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-gray-500">Hi, {user.name.split(' ')[0]}</span>
              <button
                className="btn-secondary !px-3 !py-1"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn-secondary !px-3 !py-1">Login</Link>
              <Link to="/register" className="btn-primary !px-3 !py-1">Register</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
