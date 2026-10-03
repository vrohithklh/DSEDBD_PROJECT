import React from 'react';
import { useAuth } from '../context/AuthContext';
import Card from '../components/Card';

const Profile = () => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div>
      <p className="page-subtitle">Manage your personal university credentials and biometric settings.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'flex-start' }} className="animate-fade-in">
        
        {/* User Card */}
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem 0' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.5rem',
              fontWeight: 'bold',
              color: 'white',
              boxShadow: 'var(--shadow-neon)',
              marginBottom: '1rem'
            }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <h3 style={{ color: 'white', fontWeight: 600 }}>{user.name}</h3>
            <span className="badge badge-info" style={{ marginTop: '0.5rem', fontSize: '0.7rem' }}>
              {user.role}
            </span>
          </div>
        </Card>

        {/* User Details */}
        <Card title="Account Information" subtitle="Detailed institutional credentials">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', padding: '0.5rem 0' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Email Address</label>
              <p style={{ color: 'white', fontWeight: 500, marginTop: '0.25rem' }}>{user.email}</p>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Phone Number</label>
              <p style={{ color: 'white', fontWeight: 500, marginTop: '0.25rem' }}>{user.phone || 'N/A'}</p>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Academic Department</label>
              <p style={{ color: 'white', fontWeight: 500, marginTop: '0.25rem' }}>{user.department}</p>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                {user.role === 'STUDENT' ? 'Student Registration ID' : 'Employee Kiosk ID'}
              </label>
              <p style={{ color: 'white', fontWeight: 500, marginTop: '0.25rem' }}>
                {user.studentId || user.employeeId || 'N/A'}
              </p>
            </div>

            {user.role === 'STUDENT' && (
              <>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Course / Year</label>
                  <p style={{ color: 'white', fontWeight: 500, marginTop: '0.25rem' }}>{user.course || 'B.Tech'} - {user.year || '3rd Year'}</p>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Classroom Batch</label>
                  <p style={{ color: 'white', fontWeight: 500, marginTop: '0.25rem' }}>Batch {user.batch || 'A'}</p>
                </div>
              </>
            )}

            {user.role === 'EMPLOYEE' && (
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Staff Designation</label>
                <p style={{ color: 'white', fontWeight: 500, marginTop: '0.25rem' }}>{user.designation || 'Staff'}</p>
              </div>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
};

export default Profile;
