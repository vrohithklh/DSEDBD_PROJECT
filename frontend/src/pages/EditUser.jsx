import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { userAPI, adminAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const EditUser = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState([]);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // General fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('STUDENT');
  const [department, setDepartment] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [status, setStatus] = useState('ACTIVE');

  // Student specific fields
  const [studentId, setStudentId] = useState('');
  const [course, setCourse] = useState('');
  const [year, setYear] = useState('');
  const [batch, setBatch] = useState('');

  // Employee specific fields
  const [employeeId, setEmployeeId] = useState('');
  const [designation, setDesignation] = useState('');

  // Password reset fields
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, metaRes] = await Promise.all([
          userAPI.get(id),
          adminAPI.getMetadata()
        ]);
        
        const u = userRes.data;
        setName(u.name);
        setEmail(u.email);
        setPhone(u.phone || '');
        setRole(u.role);
        setDepartment(u.department);
        setProfilePhoto(u.profilePhoto || '');
        setStatus(u.status);

        if (u.role === 'STUDENT') {
          setStudentId(u.studentId || '');
          setCourse(u.course || '');
          setYear(u.year || '');
          setBatch(u.batch || '');
        } else if (u.role === 'EMPLOYEE') {
          setEmployeeId(u.employeeId || '');
          setDesignation(u.designation || '');
        }

        setDepartments(metaRes.data.departments);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch edit data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim() || !email.trim() || !department) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password) {
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    const payload = {
      name,
      email: email.trim(),
      phone: phone.trim(),
      department,
      profilePhoto: profilePhoto.trim(),
      status,
      ...(role === 'STUDENT' ? { studentId: studentId.trim(), course, year, batch } : {}),
      ...(role === 'EMPLOYEE' ? { employeeId: employeeId.trim(), designation } : {}),
      ...(password ? { password } : {})
    };

    setSubmitting(true);
    try {
      await userAPI.update(id, payload);
      setSuccess('Profile updated successfully!');
      setTimeout(() => {
        navigate(`/admin/users/${id}`);
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Fetching user details from directory..." />;
  }

  const isStudent = role === 'STUDENT';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 className="page-title">Modify Account Profile</h2>
        <Link to={`/admin/users/${id}`} className="btn btn-secondary">Cancel</Link>
      </div>

      <div className="glass-card animate-fade-in" style={{ maxWidth: '650px', margin: '0 auto', padding: '2rem' }}>
        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#34d399', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            ✅ {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input className="form-input" placeholder="e.g. John Doe" value={name} onChange={(e) => setName(e.target.value)} required disabled={submitting} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">
                {isStudent ? 'Student ID *' : 'Employee ID *'}
              </label>
              <input 
                className="form-input" 
                value={isStudent ? studentId : employeeId} 
                onChange={(e) => isStudent ? setStudentId(e.target.value) : setEmployeeId(e.target.value)} 
                required 
                disabled={submitting} 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Department *</label>
              {departments.length === 0 ? (
                <input className="form-input" value={department} onChange={(e) => setDepartment(e.target.value)} required disabled={submitting} />
              ) : (
                <select className="form-input" value={department} onChange={(e) => setDepartment(e.target.value)} required disabled={submitting}>
                  {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input className="form-input" type="email" placeholder="e.g. user@college.edu" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={submitting} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input className="form-input" placeholder="e.g. 9876543210" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={submitting} />
            </div>
          </div>

          {/* Student Fields */}
          {isStudent && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Course</label>
                <input className="form-input" value={course} onChange={(e) => setCourse(e.target.value)} disabled={submitting} />
              </div>
              <div className="form-group">
                <label className="form-label">Year</label>
                <select className="form-input" value={year} onChange={(e) => setYear(e.target.value)} disabled={submitting}>
                  <option value="1st">1st Year</option>
                  <option value="2nd">2nd Year</option>
                  <option value="3rd">3rd Year</option>
                  <option value="4th">4th Year</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Batch</label>
                <input className="form-input" value={batch} onChange={(e) => setBatch(e.target.value)} disabled={submitting} />
              </div>
            </div>
          )}

          {/* Employee Fields */}
          {!isStudent && (
            <div className="form-group">
              <label className="form-label">Designation</label>
              <input className="form-input" value={designation} onChange={(e) => setDesignation(e.target.value)} disabled={submitting} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Profile Image URL</label>
              <input className="form-input" value={profilePhoto} onChange={(e) => setProfilePhoto(e.target.value)} disabled={submitting} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)} disabled={submitting}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>

          {/* Set / Reset Password Section */}
          <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '1.5rem' }}>
            <h4 style={{ color: 'white', marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>Set / Reset Password</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Leave blank to keep current"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '1.1rem'
                    }}
                  >
                    {showPassword ? '👁️' : '🙈'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-input"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Verify new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={submitting}
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '1.1rem'
                    }}
                  >
                    {showConfirmPassword ? '👁️' : '🙈'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
            <Link to={`/admin/users/${id}`} className="btn btn-secondary" disabled={submitting}>Cancel</Link>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Saving modifications...' : 'Save Modifications'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUser;
