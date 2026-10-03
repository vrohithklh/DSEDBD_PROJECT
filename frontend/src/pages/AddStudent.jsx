import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { userAPI, adminAPI } from '../services/api';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';

const AddStudent = () => {
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [course, setCourse] = useState('B.Tech');
  const [year, setYear] = useState('3rd');
  const [batch, setBatch] = useState('A');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Metadata dropdown options
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const response = await adminAPI.getMetadata();
        setDepartments(response.data.departments);
        if (response.data.departments.length > 0) {
          setDepartment(response.data.departments[0].name);
        }
      } catch (err) {
        console.error('Failed to load academic metadata:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMeta();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim() || !studentId.trim() || !email.trim() || !department || !password || !confirmPassword) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const payload = {
      name,
      studentId: studentId.trim(),
      email: email.trim(),
      phone: phone.trim(),
      role: 'STUDENT',
      department,
      course,
      year,
      batch,
      profilePhoto: profilePhoto.trim(),
      status,
      password
    };

    setSubmitting(true);
    try {
      await userAPI.create(payload);
      setSuccess('Student registered successfully!');
      setTimeout(() => {
        navigate('/admin/users');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Fetching campus metadata options..." />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 className="page-title">Register Student Account</h2>
        <Link to="/admin/users" className="btn btn-secondary">⬅️ Directory</Link>
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
              <label className="form-label">Student ID *</label>
              <input className="form-input" placeholder="e.g. STU1234" value={studentId} onChange={(e) => setStudentId(e.target.value)} required disabled={submitting} />
            </div>
            <div className="form-group">
              <label className="form-label">Department *</label>
              {departments.length === 0 ? (
                <input className="form-input" placeholder="Computer Science" value={department} onChange={(e) => setDepartment(e.target.value)} required disabled={submitting} />
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
              <input className="form-input" type="email" placeholder="e.g. john@college.edu" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={submitting} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input className="form-input" placeholder="e.g. 9876543210" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={submitting} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Password *</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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
              <label className="form-label">Confirm Password *</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Verify password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Course / Degree</label>
              <input className="form-input" placeholder="e.g. B.Tech" value={course} onChange={(e) => setCourse(e.target.value)} disabled={submitting} />
            </div>
            <div className="form-group">
              <label className="form-label">Academic Year</label>
              <select className="form-input" value={year} onChange={(e) => setYear(e.target.value)} disabled={submitting}>
                <option value="1st">1st Year</option>
                <option value="2nd">2nd Year</option>
                <option value="3rd">3rd Year</option>
                <option value="4th">4th Year</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Batch</label>
              <input className="form-input" placeholder="e.g. A" value={batch} onChange={(e) => setBatch(e.target.value)} disabled={submitting} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Profile Image URL</label>
              <input className="form-input" placeholder="e.g. http://images.com/pic.png" value={profilePhoto} onChange={(e) => setProfilePhoto(e.target.value)} disabled={submitting} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)} disabled={submitting}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
            <Link to="/admin/users" className="btn btn-secondary" disabled={submitting}>Cancel</Link>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Registering Student...' : 'Register Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddStudent;
