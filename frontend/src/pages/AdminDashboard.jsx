import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { reportsAPI, attendanceAPI, adminAPI, userAPI } from '../services/api';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [metadata, setMetadata] = useState({ departments: [], classrooms: [], subjects: [] });
  const [loading, setLoading] = useState(true);

  // Teachers state
  const [teachers, setTeachers] = useState([]);
  const [assignedTeacher, setAssignedTeacher] = useState('');

  // Chart view selection state ('daily', 'weekly', 'monthly', 'department')
  const [activeChartTab, setActiveChartTab] = useState('daily');

  // New session form state
  const [subject, setSubject] = useState('');
  const [classroom, setClassroom] = useState('');
  const [department, setDepartment] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const fetchData = async () => {
    try {
      const [statsRes, sessionsRes, metaRes, usersRes] = await Promise.all([
        reportsAPI.getStats(),
        attendanceAPI.getSessions(),
        adminAPI.getMetadata(),
        userAPI.list({ role: 'EMPLOYEE' })
      ]);

      setStats(statsRes.data);
      const sorted = (sessionsRes.data || []).sort((a, b) => b.createdAt - a.createdAt);
      setActiveSessions(sorted);
      setMetadata(metaRes.data);
      
      const usersData = Array.isArray(usersRes.data)
        ? usersRes.data
        : (usersRes.data && Array.isArray(usersRes.data.users) ? usersRes.data.users : []);
      const teacherList = usersData.filter(u => u.role === 'EMPLOYEE');
      setTeachers(teacherList);
      if (teacherList.length > 0) {
        setAssignedTeacher(teacherList[0].employeeId || teacherList[0].userId);
      }

      // Auto select first option in form if available
      if (metaRes.data.subjects.length > 0) setSubject(metaRes.data.subjects[0].name);
      if (metaRes.data.classrooms.length > 0) setClassroom(metaRes.data.classrooms[0].name);
      if (metaRes.data.departments.length > 0) setDepartment(metaRes.data.departments[0].name);

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStartSession = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!subject || !classroom || !department || !assignedTeacher) {
      setFormError('Please select subject, classroom, department, and assigned teacher.');
      return;
    }

    try {
      await attendanceAPI.startSession({ subject, classroom, department, assignedTeacherId: assignedTeacher });
      setFormSuccess('Attendance session created and sent to the assigned teacher.');
      
      // Refresh sessions and stats
      const sessionsRes = await attendanceAPI.getSessions();
      const sorted = (sessionsRes.data || []).sort((a, b) => b.createdAt - a.createdAt);
      setActiveSessions(sorted);
      
      const statsRes = await reportsAPI.getStats();
      setStats(statsRes.data);
    } catch (error) {
      setFormError(error.response?.data?.error || 'Failed to start session.');
    }
  };

  // Rendering helpers for custom CSS charts
  const renderDailyChart = () => {
    if (!stats?.dailyTrend || stats.dailyTrend.length === 0) {
      return <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No trend records found.</p>;
    }
    const maxVal = Math.max(...stats.dailyTrend.map(d => d.present + d.late + d.absent), 1);
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '180px', padding: '1rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {stats.dailyTrend.map((d, index) => {
            const presentPct = (d.present / maxVal) * 100;
            const latePct = (d.late / maxVal) * 100;
            const absentPct = (d.absent / maxVal) * 100;
            return (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{
                  position: 'relative',
                  width: '24px',
                  height: '140px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '4px',
                  display: 'flex',
                  flexDirection: 'column-reverse',
                  overflow: 'hidden'
                }}>
                  <div style={{ height: `${presentPct}%`, background: 'var(--accent-success)' }} title={`Present: ${d.present}`} />
                  <div style={{ height: `${latePct}%`, background: 'var(--accent-warning)' }} title={`Late: ${d.late}`} />
                  <div style={{ height: `${absentPct}%`, background: 'var(--accent-error)' }} title={`Absent: ${d.absent}`} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
          {stats.dailyTrend.map((d, index) => (
            <div key={index} style={{ flex: 1, fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              {d.label}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem', fontSize: '0.75rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '10px', height: '10px', background: 'var(--accent-success)', borderRadius: '20%' }}></span> Present
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '10px', height: '10px', background: 'var(--accent-warning)', borderRadius: '20%' }}></span> Late
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '10px', height: '10px', background: 'var(--accent-error)', borderRadius: '20%' }}></span> Absent
          </span>
        </div>
      </div>
    );
  };

  const renderWeeklyChart = () => {
    if (!stats?.weeklyTrend || stats.weeklyTrend.length === 0) {
      return <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No trend records found.</p>;
    }
    const maxVal = Math.max(...stats.weeklyTrend.map(w => w.present + w.late), 1);
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '180px', padding: '1rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {stats.weeklyTrend.map((w, index) => {
            const presentPct = (w.present / maxVal) * 100;
            const latePct = (w.late / maxVal) * 100;
            return (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: '140px' }}>
                  <div style={{ height: `${presentPct}%`, width: '14px', background: 'var(--accent-success)', borderRadius: '2px 2px 0 0' }} title={`Present: ${w.present}`} />
                  <div style={{ height: `${latePct}%`, width: '14px', background: 'var(--accent-warning)', borderRadius: '2px 2px 0 0' }} title={`Late: ${w.late}`} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '0.5rem' }}>
          {stats.weeklyTrend.map((w, index) => (
            <div key={index} style={{ flex: 1, fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              {w.label}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMonthlyChart = () => {
    if (!stats?.monthlyTrend || stats.monthlyTrend.length === 0) {
      return <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No trend records found.</p>;
    }
    const maxVal = Math.max(...stats.monthlyTrend.map(m => m.present + m.late), 1);
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '180px', padding: '1rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {stats.monthlyTrend.map((m, index) => {
            const presentPct = (m.present / maxVal) * 100;
            const latePct = (m.late / maxVal) * 100;
            return (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: '140px' }}>
                  <div style={{ height: `${presentPct}%`, width: '14px', background: 'var(--accent-success)', borderRadius: '2px 2px 0 0' }} title={`Present: ${m.present}`} />
                  <div style={{ height: `${latePct}%`, width: '14px', background: 'var(--accent-warning)', borderRadius: '2px 2px 0 0' }} title={`Late: ${m.late}`} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '0.5rem' }}>
          {stats.monthlyTrend.map((m, index) => (
            <div key={index} style={{ flex: 1, fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              {m.label}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDepartmentChart = () => {
    if (!stats?.departmentStats || stats.departmentStats.length === 0) {
      return <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No department statistics recorded today.</p>;
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
        {stats.departmentStats.map((dept, index) => {
          const total = dept.present + dept.late + dept.absent;
          const rate = total > 0 ? Math.round(((dept.present + dept.late) / total) * 100) : 0;
          return (
            <div key={index}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                <span style={{ color: 'white', fontWeight: 500 }}>{dept.department}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{dept.present + dept.late}/{total} ({rate}%)</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${rate}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                  borderRadius: '4px',
                  boxShadow: 'var(--shadow-neon)'
                }}></div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return <LoadingSpinner message="Fetching dashboard analytics..." />;
  }

  return (
    <div>
      <p className="page-subtitle">Overview of campus activity and active biometric check-in channels.</p>

      {/* Stats Cards Row */}
      <div className="stats-grid animate-fade-in" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div className="glass-card stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2rem', background: 'rgba(99, 102, 241, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>👥</div>
          <div className="stat-info">
            <span className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 700, display: 'block', color: 'white' }}>
              {stats?.totalStudents || 0}
            </span>
            <span className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Students</span>
          </div>
        </div>

        <div className="glass-card stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2rem', background: 'rgba(168, 85, 247, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>💼</div>
          <div className="stat-info">
            <span className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 700, display: 'block', color: 'white' }}>
              {stats?.totalEmployees || 0}
            </span>
            <span className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Employees</span>
          </div>
        </div>

        <div className="glass-card stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2rem', background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>✅</div>
          <div className="stat-info">
            <span className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 700, display: 'block', color: 'var(--accent-success)' }}>
              {stats?.todayPresent || 0}
            </span>
            <span className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Today's Present</span>
          </div>
        </div>

        <div className="glass-card stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>❌</div>
          <div className="stat-info">
            <span className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 700, display: 'block', color: 'var(--accent-error)' }}>
              {stats?.todayAbsent || 0}
            </span>
            <span className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Today's Absent</span>
          </div>
        </div>

        <div className="glass-card stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2rem', background: 'rgba(245, 158, 11, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>⏰</div>
          <div className="stat-info">
            <span className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 700, display: 'block', color: 'var(--accent-warning)' }}>
              {stats?.todayLate || 0}
            </span>
            <span className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Late Arrivals</span>
          </div>
        </div>

        <div className="glass-card stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2rem', background: 'rgba(59, 130, 246, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>📡</div>
          <div className="stat-info">
            <span className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 700, display: 'block', color: 'white' }}>
              {stats?.activeSessionsCount || 0}
            </span>
            <span className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Active Sessions</span>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }} className="animate-fade-in">
        
        {/* Quick Actions Card */}
        <Card title="Quick Biometric Actions" subtitle="Fast shortcut navigation controls">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1rem',
            padding: '0.5rem 0'
          }}>
            <Link to="/admin/users" className="glass-card" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.25rem',
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              transition: 'transform 0.2s, border-color 0.2s'
            }}>
              <span style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>👥</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>Register User</span>
            </Link>

            <Link to="/admin/face-enrollment" className="glass-card" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.25rem',
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              transition: 'transform 0.2s, border-color 0.2s'
            }}>
              <span style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>📸</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>Enroll Face</span>
            </Link>

            <Link to="/admin/attendance" className="glass-card" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.25rem',
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              transition: 'transform 0.2s, border-color 0.2s'
            }}>
              <span style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>📈</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>View Reports</span>
            </Link>
          </div>
        </Card>

        {/* Create New Session Column */}
        <Card title="Create New Session" subtitle="Request a new attendance session">
          {formError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '1rem' }}>
              ⚠️ {formError}
            </div>
          )}
          {formSuccess && (
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#34d399', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '1rem' }}>
              ✅ {formSuccess}
            </div>
          )}

          <form onSubmit={handleStartSession}>
            <div className="form-group">
              <label className="form-label">Subject / Course</label>
              {metadata.subjects.length === 0 ? (
                <input className="form-input" placeholder="e.g. Operating Systems" value={subject} onChange={(e) => setSubject(e.target.value)} required />
              ) : (
                <select className="form-input" value={subject} onChange={(e) => setSubject(e.target.value)} required>
                  {metadata.subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Classroom / Location</label>
              {metadata.classrooms.length === 0 ? (
                <input className="form-input" placeholder="e.g. Room 101" value={classroom} onChange={(e) => setClassroom(e.target.value)} required />
              ) : (
                <select className="form-input" value={classroom} onChange={(e) => setClassroom(e.target.value)} required>
                  {metadata.classrooms.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Target Department</label>
              {metadata.departments.length === 0 ? (
                <input className="form-input" placeholder="e.g. Computer Science" value={department} onChange={(e) => setDepartment(e.target.value)} required />
              ) : (
                <select className="form-input" value={department} onChange={(e) => setDepartment(e.target.value)} required>
                  {metadata.departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Assigned Teacher</label>
              {teachers.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--accent-warning)' }}>⚠️ No teachers registered. Create an Employee user first.</p>
              ) : (
                <select className="form-input" value={assignedTeacher} onChange={(e) => setAssignedTeacher(e.target.value)} required>
                  {teachers.map(t => <option key={t.userId} value={t.employeeId || t.userId}>{t.name} ({t.employeeId || 'No ID'})</option>)}
                </select>
              )}
            </div>

            <button className="btn btn-primary" type="submit" style={{ width: '100%', marginTop: '0.5rem' }} disabled={teachers.length === 0}>
              ⚡ Create Attendance Session
            </button>
          </form>
        </Card>

        <Card title="Attendance Sessions" subtitle="Current status of classroom check-in gateways">
          {activeSessions.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📴</div>
              <p>No attendance sessions</p>
              <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Create a session using the form to request teacher approval.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {activeSessions.map((session) => (
                <div 
                  key={session.sessionId} 
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    opacity: session.status === 'COMPLETED' ? 0.75 : 1
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ color: 'white', fontWeight: 600 }}>{session.subject}</h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        📍 Classroom: {session.classroom} | 🏢 Dept: {session.department}
                      </p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                        👤 Teacher: {session.teacherName || 'Assigned Teacher'}
                      </p>
                    </div>
                    <div>
                      {session.status === 'PENDING' && (
                        <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.65rem' }}>
                          ⏳ PENDING TEACHER
                        </span>
                      )}
                      {session.status === 'APPROVED' && (
                        <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.65rem', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                          👍 APPROVED
                        </span>
                      )}
                      {session.status === 'ACTIVE' && (
                        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.65rem' }}>
                          <span className="status-dot status-dot-active" style={{ background: '#10b981', width: '6px', height: '6px', borderRadius: '50%' }}></span> Live – Managed by Teacher
                        </span>
                      )}
                      {session.status === 'COMPLETED' && (
                        <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.65rem', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)' }}>
                          COMPLETED
                        </span>
                      )}
                      {(session.status === 'DECLINED' || session.status === 'REJECTED') && (
                        <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.65rem' }}>
                          REJECTED
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Analytics Charts Panel */}
      <div style={{ marginTop: '1.5rem' }} className="animate-fade-in">
        <Card 
          title="Biometric Attendance Charts" 
          subtitle="Visual check-in logs over multiple timescales"
          actions={
            <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.03)', padding: '0.2rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <button 
                onClick={() => setActiveChartTab('daily')} 
                style={{
                  background: activeChartTab === 'daily' ? 'var(--accent-primary)' : 'transparent',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                Daily (7d)
              </button>
              <button 
                onClick={() => setActiveChartTab('weekly')} 
                style={{
                  background: activeChartTab === 'weekly' ? 'var(--accent-primary)' : 'transparent',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                Weekly (4w)
              </button>
              <button 
                onClick={() => setActiveChartTab('monthly')} 
                style={{
                  background: activeChartTab === 'monthly' ? 'var(--accent-primary)' : 'transparent',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                Monthly (6m)
              </button>
              <button 
                onClick={() => setActiveChartTab('department')} 
                style={{
                  background: activeChartTab === 'department' ? 'var(--accent-primary)' : 'transparent',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                Departments
              </button>
            </div>
          }
        >
          <div style={{ minHeight: '220px' }}>
            {activeChartTab === 'daily' && renderDailyChart()}
            {activeChartTab === 'weekly' && renderWeeklyChart()}
            {activeChartTab === 'monthly' && renderMonthlyChart()}
            {activeChartTab === 'department' && renderDepartmentChart()}
          </div>
        </Card>
      </div>

      {/* Recent Activity Table */}
      <div style={{ marginTop: '1.5rem' }} className="animate-fade-in">
        <Card title="Recent Biometric Check-Ins" subtitle="Real-time live registry stream logs">
          {(!stats?.recentLogs || stats.recentLogs.length === 0) ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No recent logs found.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse', color: 'var(--text-secondary)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Time</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Role</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Subject</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Classroom</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentLogs.map((log) => (
                    <tr key={log.attendanceId} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '0.75rem' }}>{log.date}</td>
                      <td style={{ padding: '0.75rem' }}>{log.time}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 600, color: 'white' }}>{log.userName}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className={`badge ${log.userType === 'STUDENT' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                          {log.userType}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>{log.subject}</td>
                      <td style={{ padding: '0.75rem' }}>{log.classroom}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <span className={`badge ${log.status === 'PRESENT' ? 'badge-success' : log.status === 'LATE' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '0.65rem' }}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
