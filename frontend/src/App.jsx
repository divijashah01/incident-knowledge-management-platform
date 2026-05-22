import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import Sidebar from './components/common/Sidebar';
import Login          from './pages/auth/Login';
import Register       from './pages/auth/Register';
import SubmitTicket   from './pages/reporter/SubmitTicket';
import MyTickets      from './pages/reporter/MyTickets';
import Search         from './pages/shared/Search';
import Chat           from './pages/shared/Chat';
import Queue          from './pages/engineer/Queue';
import Knowledge      from './pages/engineer/Knowledge';
import Dashboard      from './pages/admin/Dashboard';
import Tickets        from './pages/admin/Tickets';
import Clusters       from './pages/admin/Clusters';
import KnowledgeAdmin from './pages/admin/KnowledgeAdmin';
import ModelAdmin     from './pages/admin/ModelAdmin';
import Users          from './pages/admin/Users';

function defaultRoute(user) {
  if (!user)                    return '/login';
  if (user.role === 'admin')    return '/dashboard';
  if (user.role === 'engineer') return '/queue';
  return '/submit';
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div
      className="flex items-center justify-center h-screen"
      style={{ background: 'linear-gradient(135deg, #3D52A0 0%, #7091E6 100%)' }}
    >
      <div className="text-center">
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'monospace', letterSpacing: '0.02em' }}>IK</span>
        </div>
        <div style={{
          width: 22, height: 22,
          border: '2px solid rgba(255,255,255,0.2)',
          borderTopColor: 'rgba(255,255,255,0.8)',
          borderRadius: '50%',
          margin: '0 auto',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ color: 'rgba(237,232,245,0.7)', fontSize: 13, marginTop: 12 }}>Loading…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/login"    element={!user ? <Login />    : <Navigate to={defaultRoute(user)} replace />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to={defaultRoute(user)} replace />} />

        {/* Protected — with sidebar layout */}
        <Route path="/*" element={
          <ProtectedRoute>
            <div className="flex min-h-screen" style={{ background: 'var(--bg-page)' }}>
              <Sidebar />
              {/* ml-60 matches sidebar w-60 */}
              <main className="flex-1 ml-60 min-h-screen">
                <div className="p-8 max-w-screen-xl">
                  <Routes>
                    <Route path="/submit"          element={<ProtectedRoute requiredRole="reporter"><SubmitTicket /></ProtectedRoute>} />
                    <Route path="/my-tickets"      element={<ProtectedRoute requiredRole="reporter"><MyTickets /></ProtectedRoute>} />
                    <Route path="/search"          element={<ProtectedRoute requiredRole="reporter"><Search /></ProtectedRoute>} />
                    <Route path="/chat"            element={<ProtectedRoute requiredRole="reporter"><Chat /></ProtectedRoute>} />
                    <Route path="/queue"           element={<ProtectedRoute requiredRole="engineer"><Queue /></ProtectedRoute>} />
                    <Route path="/knowledge"       element={<ProtectedRoute requiredRole="engineer"><Knowledge /></ProtectedRoute>} />
                    <Route path="/dashboard"       element={<ProtectedRoute requiredRole="admin"><Dashboard /></ProtectedRoute>} />
                    <Route path="/tickets"         element={<ProtectedRoute requiredRole="admin"><Tickets /></ProtectedRoute>} />
                    <Route path="/clusters"        element={<ProtectedRoute requiredRole="admin"><Clusters /></ProtectedRoute>} />
                    <Route path="/knowledge-admin" element={<ProtectedRoute requiredRole="admin"><KnowledgeAdmin /></ProtectedRoute>} />
                    <Route path="/model-admin"     element={<ProtectedRoute requiredRole="admin"><ModelAdmin /></ProtectedRoute>} />
                    <Route path="/users"           element={<ProtectedRoute requiredRole="admin"><Users /></ProtectedRoute>} />
                    <Route path="/"  element={<Navigate to={defaultRoute(user)} replace />} />
                    <Route path="*"  element={<Navigate to={defaultRoute(user)} replace />} />
                  </Routes>
                </div>
              </main>
            </div>
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}

export default function App() {
  return <AuthProvider><AppRoutes /></AuthProvider>;
}