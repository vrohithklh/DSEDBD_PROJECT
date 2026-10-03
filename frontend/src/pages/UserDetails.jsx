import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { userAPI } from '../services/api';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';

const UserDetails = () => {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await userAPI.get(id);
        setUser(response.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch user details.');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [id]);

  if (loading) {
    return <LoadingSpinner message="Fetching user credentials..." />;
  }

  if (error || !user) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', padding: '1rem', borderRadius: '8px', display: 'inline-block', marginBottom: '1rem' }}>
          ⚠️ {error || 'User not found.'}
        </div>
        <br />
        <Link to="/admin/users" className="btn btn-secondary">Go Back to Directory</Link>
      </div>
    );
  }

  const isStudent = user.role === 'STUDENT';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 className="page-title">User Account Details</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link to={`/admin/users/edit/${user.userId}`} className="btn btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}>
            ✏️ Edit Profile
          </Link>
          <Link to="/admin/users" className="btn btn-secondary">⬅️ Directory</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'flex-start' }} className="animate-fade-in">
        
        {/* User Card */}
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem 0' }}>
            {user.profilePhoto ? (
              <img 
                src={user.profilePhoto} 
                alt={user.name} 
                style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-primary)', boxShadow: 'var(--shadow-neon)', marginBottom: '1rem' }}
                onError={(e) => {
                  e.target.style.display = 'none'; // Fallback if image fails
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div style={{
              width: '90px',
              height: '90px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
              display: user.profilePhoto ? 'none' : 'flex',
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
            
            <h3 style={{ color: 'white', fontWeight: 600, fontSize: '1.25rem', textAlign: 'center' }}>{user.name}</h3>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span className={`badge ${user.role === 'STUDENT' ? 'badge-success' : 'badge-warning'}`}>
                {user.role}
              </span>
              <span className={`badge ${user.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`} style={{ textTransform: 'uppercase' }}>
                <span className={`status-dot ${user.status === 'ACTIVE' ? 'status-dot-active' : 'status-dot-inactive'}`} />
                {user.status}
              </span>
            </div>
          </div>
        </Card>

        {/* Detailed User Table Details */}
        <Card title="Academic Profile Credentials" subtitle="Full verification database keys">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', padding: '0.5rem 0' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Email Address</label>
              <p style={{ color: 'white', fontWeight: 500, marginTop: '0.25rem', fontSize: '0.95rem' }}>{user.email}</p>
            </div>
            
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Phone Number</label>
              <p style={{ color: 'white', fontWeight: 500, marginTop: '0.25rem', fontSize: '0.95rem' }}>{user.phone || 'Not provided'}</p>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Academic Department</label>
              <p style={{ color: 'white', fontWeight: 500, marginTop: '0.25rem', fontSize: '0.95rem' }}>{user.department}</p>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                {isStudent ? 'Student ID Reference' : 'Employee ID Reference'}
              </label>
              <p style={{ color: 'white', fontWeight: 500, marginTop: '0.25rem', fontSize: '0.95rem' }}>
                {user.studentId || user.employeeId || 'N/A'}
              </p>
            </div>

            {isStudent ? (
              <>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Course / Degree</label>
                  <p style={{ color: 'white', fontWeight: 500, marginTop: '0.25rem', fontSize: '0.95rem' }}>{user.course || 'N/A'}</p>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Academic Year & Batch</label>
                  <p style={{ color: 'white', fontWeight: 500, marginTop: '0.25rem', fontSize: '0.95rem' }}>
                    {user.year} Year (Batch {user.batch || 'A'})
                  </p>
                </div>
              </>
            ) : (
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Staff Designation</label>
                <p style={{ color: 'white', fontWeight: 500, marginTop: '0.25rem', fontSize: '0.95rem' }}>{user.designation || 'Staff Member'}</p>
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Registration Timestamp</label>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', fontSize: '0.9rem' }}>
                {new Date(user.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
};

export default UserDetails;
