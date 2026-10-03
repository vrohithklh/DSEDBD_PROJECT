import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const isAdmin = user.role === 'ADMIN';

  const adminLinks = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: '📊' },
    { name: 'Users', path: '/admin/users', icon: '👥' },
    { name: 'Attendance History', path: '/admin/attendance', icon: '🗓️' },
    { name: 'Reports & Analytics', path: '/admin/reports', icon: '📈' },
    { name: 'Settings', path: '/settings', icon: '⚙️' }
  ];

  const userLinks = [
    { name: 'Dashboard', path: user.role === 'STUDENT' ? '/student/dashboard' : '/employee/dashboard', icon: '📊' }
  ];
  if (user.role === 'EMPLOYEE') {
    userLinks.push({ name: 'Face Enrollment', path: '/employee/face-enrollment', icon: '📸' });
  }
  userLinks.push(
    { name: 'My Attendance', path: '/attendance-history', icon: '🗓️' },
    { name: 'My Profile', path: '/profile', icon: '👤' },
    { name: 'Settings', path: '/settings', icon: '⚙️' }
  );

  const links = isAdmin ? adminLinks : userLinks;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-icon">⚡</span>
        <h2 className="brand-name">Smart Attendance</h2>
      </div>

      <div className="sidebar-user">
        <div className="avatar-placeholder">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="user-details">
          <p className="user-name">{user.name}</p>
          <span className="user-role-badge">{user.role}</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {links.map((link) => {
          const isActive = location.pathname === link.path;
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{link.icon}</span>
              <span className="nav-text">{link.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button className="btn-logout" onClick={logout}>
          <span className="nav-icon">🚪</span>
          <span className="nav-text">Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
