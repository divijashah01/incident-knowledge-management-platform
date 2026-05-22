import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export default function ProtectedRoute({ children, requiredRole = 'reporter' }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner message="Checking session..." />;
  if (!user)   return <Navigate to="/login" replace />;

  const hierarchy = { reporter: 1, engineer: 2, admin: 3 };
  const userLevel = hierarchy[user.role]    || 0;
  const reqLevel  = hierarchy[requiredRole] || 0;

  if (userLevel < reqLevel) return <Navigate to="/" replace />;

  return children;
}