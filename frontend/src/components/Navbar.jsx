import React from 'react';
import { useLocation } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();

  const getPageTitle = (pathname) => {
    switch (pathname) {
      case '/admin/dashboard': return 'Admin Dashboard';
      case '/admin/users': return 'User Management';
      case '/employee/face-enrollment': return 'Face Enrollment (Biometrics)';
      case '/admin/live-attendance': return 'Live Attendance Terminal';
      case '/admin/attendance': return 'Attendance Records';
      case '/admin/reports': return 'Reports & Analytics';
      case '/student/dashboard': return 'Student Dashboard';
      case '/employee/dashboard': return 'Staff Dashboard';
      case '/attendance-history': return 'My Attendance History';
      case '/profile': return 'User Profile';
      case '/settings': return 'System Settings';
      default: return 'Smart Attendance';
    }
  };

  const getFormattedDate = () => {
    const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  };

  return (
    <header className="navbar">
      <div className="navbar-title-container">
        <h1 className="navbar-title">{getPageTitle(location.pathname)}</h1>
        <span className="navbar-subtitle">System Status: Active</span>
      </div>

      <div className="navbar-actions">
        <div className="navbar-date">
          📅 {getFormattedDate()}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
