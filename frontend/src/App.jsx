import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import { useAuth } from './context/AuthContext';

import Login from './pages/Login';
import Register from './pages/Register';
import Catalog from './pages/Catalog';
import StudentDashboard from './pages/StudentDashboard';
import ScanIssueReturn from './pages/ScanIssueReturn';
import AdminDashboard from './pages/AdminDashboard';
import AdminBooks from './pages/AdminBooks';
import AdminTransactions from './pages/AdminTransactions';
import AdminReports from './pages/AdminReports';

function Protected({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/" />;
  return children;
}

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Catalog />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/dashboard" element={<Protected role="student"><StudentDashboard /></Protected>} />

        <Route path="/admin" element={<Protected role="admin"><AdminDashboard /></Protected>} />
        <Route path="/admin/scan" element={<Protected role="admin"><ScanIssueReturn /></Protected>} />
        <Route path="/admin/books" element={<Protected role="admin"><AdminBooks /></Protected>} />
        <Route path="/admin/transactions" element={<Protected role="admin"><AdminTransactions /></Protected>} />
        <Route path="/admin/reports" element={<Protected role="admin"><AdminReports /></Protected>} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}
