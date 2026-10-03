import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import StudentDashboard from './pages/StudentDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import Users from './pages/Users';
import AddStudent from './pages/AddStudent';
import AddEmployee from './pages/AddEmployee';
import EditUser from './pages/EditUser';
import UserDetails from './pages/UserDetails';
import FaceEnrollment from './pages/FaceEnrollment';
import LiveAttendance from './pages/LiveAttendance';
import AttendanceHistory from './pages/AttendanceHistory';
import Reports from './pages/Reports';
import Profile from './pages/Profile';
import Settings from './pages/Settings';

// Helper component to redirect root / to role based dashboard or login
const RootRedirect = () => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="spinner-container" style={{ minHeight: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'ADMIN') {
    return <Navigate to="/admin/dashboard" replace />;
  } else if (user.role === 'STUDENT') {
    return <Navigate to="/student/dashboard" replace />;
  } else if (user.role === 'EMPLOYEE') {
    return <Navigate to="/employee/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
};

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="spinner-container" style={{ minHeight: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const redirectPath = user.role === 'ADMIN'
      ? '/admin/dashboard'
      : user.role === 'STUDENT'
      ? '/student/dashboard'
      : '/employee/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Root redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* Protected Routes Layout */}
          <Route element={<DashboardLayout />}>
            {/* Admin specific pages */}
            <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['ADMIN']}><Users /></ProtectedRoute>} />
            <Route path="/admin/users/add-student" element={<ProtectedRoute allowedRoles={['ADMIN']}><AddStudent /></ProtectedRoute>} />
            <Route path="/admin/users/add-employee" element={<ProtectedRoute allowedRoles={['ADMIN']}><AddEmployee /></ProtectedRoute>} />
            <Route path="/admin/users/edit/:id" element={<ProtectedRoute allowedRoles={['ADMIN']}><EditUser /></ProtectedRoute>} />
            <Route path="/admin/users/:id" element={<ProtectedRoute allowedRoles={['ADMIN']}><UserDetails /></ProtectedRoute>} />
            <Route path="/admin/face-enrollment" element={<ProtectedRoute allowedRoles={['ADMIN']}><FaceEnrollment /></ProtectedRoute>} />
            <Route path="/employee/face-enrollment" element={<ProtectedRoute allowedRoles={['EMPLOYEE']}><FaceEnrollment /></ProtectedRoute>} />
            <Route path="/admin/live-attendance" element={<ProtectedRoute allowedRoles={['ADMIN']}><LiveAttendance /></ProtectedRoute>} />
            <Route path="/admin/attendance" element={<ProtectedRoute allowedRoles={['ADMIN']}><AttendanceHistory /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute allowedRoles={['ADMIN']}><Reports /></ProtectedRoute>} />

            {/* Student & Employee common/specific pages */}
            <Route path="/student/dashboard" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentDashboard /></ProtectedRoute>} />
            <Route path="/employee/dashboard" element={<ProtectedRoute allowedRoles={['EMPLOYEE']}><EmployeeDashboard /></ProtectedRoute>} />
            <Route path="/attendance-history" element={<ProtectedRoute allowedRoles={['STUDENT', 'EMPLOYEE']}><AttendanceHistory /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute allowedRoles={['ADMIN', 'STUDENT', 'EMPLOYEE']}><Profile /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute allowedRoles={['ADMIN', 'STUDENT', 'EMPLOYEE']}><Settings /></ProtectedRoute>} />
          </Route>

          {/* Fallback redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
