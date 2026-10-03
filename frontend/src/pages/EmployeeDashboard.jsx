import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { attendanceAPI, userAPI } from '../services/api';
import Card from '../components/Card';
import Table from '../components/Table';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [assignedSessions, setAssignedSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [classAttendance, setClassAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  // Success / Error notification states
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // End Session Summary State
  const [sessionSummary, setSessionSummary] = useState(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  // Selected session ID for class report
  const [selectedReportSessionId, setSelectedReportSessionId] = useState('');

  // Filtering for reports
  const [reportFilterStatus, setReportFilterStatus] = useState('');
  const [reportFilterDate, setReportFilterDate] = useState('');

  const fetchData = async (silent = false) => {
    try {
      const [historyRes, sessionsRes, studentsRes, classLogsRes] = await Promise.all([
        attendanceAPI.getHistory({ userId: user.userId }),
        attendanceAPI.getSessions(),
        userAPI.list({ role: 'STUDENT' }),
        attendanceAPI.getHistory()
      ]);

      setHistory(historyRes.data || []);
      const teacherSessions = sessionsRes.data || [];
      const sortedSessions = teacherSessions.sort((a, b) => b.createdAt - a.createdAt);
      setAssignedSessions(sortedSessions);

      const studentsData = Array.isArray(studentsRes.data)
        ? studentsRes.data
        : (studentsRes.data && Array.isArray(studentsRes.data.users) ? studentsRes.data.users : []);
      setStudents(studentsData);

      const teacherSessionIds = new Set(teacherSessions.map(s => s.sessionId));
      const filteredLogs = (classLogsRes.data || []).filter(log => teacherSessionIds.has(log.sessionId));
      setClassAttendance(filteredLogs);

      if (sortedSessions.length > 0 && !selectedReportSessionId) {
        setSelectedReportSessionId(sortedSessions[0].sessionId);
      }
    } catch (error) {
      if (!silent) {
        console.error('Failed to load teacher dashboard:', error);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  // Polling interval while active session is running
  useEffect(() => {
    const hasActive = assignedSessions.some(s => s.status === 'ACTIVE');
    if (!hasActive) return;

    const interval = setInterval(() => {
      fetchData(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [assignedSessions]);

  // Handle Approve Session
  const handleApprove = async (sessionId) => {
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await attendanceAPI.approveSession(sessionId);
      setSuccessMsg('Attendance session approved. You can now start the live session.');
      await fetchData();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to approve session.');
    }
  };

  // Handle Reject / Decline Session
  const handleReject = async (sessionId) => {
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await attendanceAPI.rejectSession(sessionId);
      setSuccessMsg('Attendance session rejected.');
      await fetchData();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to reject session.');
    }
  };

  // Handle Start Live Session
  const handleStartLive = async (sessionId) => {
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await attendanceAPI.startLiveSession(sessionId);
      setSuccessMsg('Attendance session is now LIVE. Students can now check in.');
      await fetchData();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to start live session.');
    }
  };

  // Handle End Session
  const handleEndSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to end this attendance session? All students who did not check in will be marked ABSENT.')) {
      return;
    }

    setSuccessMsg('');
    setErrorMsg('');
    try {
      const res = await attendanceAPI.endSession(sessionId);
      setSuccessMsg('Attendance session ended successfully. Absent records have been generated.');
      
      if (res.data?.summary) {
        setSessionSummary({
          ...res.data.summary,
          subject: res.data.session?.subject || 'Class',
          classroom: res.data.session?.classroom || 'Room'
        });
        setIsSummaryModalOpen(true);
      }
      
      await fetchData();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to end session.');
    }
  };

  if (loading) {
    return <LoadingSpinner message="Assembling teacher dashboard..." />;
  }

  // Filter sessions by status
  const pendingSessions = assignedSessions.filter(s => s.status === 'PENDING');
  const approvedSessions = assignedSessions.filter(s => s.status === 'APPROVED');
  const activeSession = assignedSessions.find(s => s.status === 'ACTIVE');

  // Selected session for class report rendering
  const selectedSession = assignedSessions.find(s => s.sessionId === selectedReportSessionId);

  // Compute live active session data
  let activeDeptStudents = [];
  let livePresentCount = 0;
  let liveLateCount = 0;
  let liveNotCheckedInCount = 0;

  if (activeSession) {
    activeDeptStudents = students.filter(s => s.department === activeSession.department && s.status === 'ACTIVE');
    const checkInDetails = activeSession.checkInDetails || {};
    
    activeDeptStudents.forEach(student => {
      const detail = checkInDetails[student.userId];
      if (detail) {
        if (detail.status === 'PRESENT') livePresentCount++;
        else if (detail.status === 'LATE') liveLateCount++;
      } else {
        liveNotCheckedInCount++;
      }
    });
  }

  // Compute report rows dynamically (combining live scanned students with DB logs)
  let reportRows = [];
  if (selectedSession) {
    const deptStudents = students.filter(s => s.department === selectedSession.department);
    reportRows = deptStudents.map(student => {
      if (selectedSession.status === 'ACTIVE') {
        const isCheckedIn = selectedSession.checkedInStudents && selectedSession.checkedInStudents.includes(student.userId);
        const detail = selectedSession.checkInDetails && selectedSession.checkInDetails[student.userId];
        return {
          name: student.name,
          studentId: student.studentId || 'N/A',
          time: isCheckedIn && detail ? detail.time : '--',
          status: isCheckedIn && detail ? detail.status : 'NOT CHECKED IN',
          date: selectedSession.date,
          subject: selectedSession.subject,
          classroom: selectedSession.classroom
        };
      } else if (selectedSession.status === 'COMPLETED') {
        const log = classAttendance.find(c => c.sessionId === selectedReportSessionId && c.userId === student.userId);
        return {
          name: student.name,
          studentId: student.studentId || 'N/A',
          time: log ? log.time : '--',
          status: log ? log.status : 'ABSENT',
          date: selectedSession.date,
          subject: selectedSession.subject,
          classroom: selectedSession.classroom
        };
      } else {
        return {
          name: student.name,
          studentId: student.studentId || 'N/A',
          time: '--',
          status: selectedSession.status,
          date: selectedSession.date,
          subject: selectedSession.subject,
          classroom: selectedSession.classroom
        };
      }
    });

    if (reportFilterStatus) {
      reportRows = reportRows.filter(r => r.status === reportFilterStatus);
    }
  }

  return (
    <div>
      <p className="page-subtitle">Approve pending attendance requests, start live sessions, monitor check-ins in real-time, and view reports.</p>

      {/* Success / Error notification block */}
      {successMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#34d399', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', fontWeight: 600 }} className="animate-fade-in">
          ✅ {successMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', fontWeight: 600 }} className="animate-fade-in">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* 1. Pending Session Notifications */}
      {pendingSessions.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }} className="animate-fade-in">
          <Card title="New Attendance Session Requests" subtitle="Sessions created by Admin waiting for your approval">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {pendingSessions.map(session => (
                <div 
                  key={session.sessionId} 
                  style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}
                >
                  <div>
                    <span className="badge badge-warning" style={{ fontSize: '0.65rem', marginBottom: '0.5rem' }}>
                      🔔 PENDING APPROVAL
                    </span>
                    <h3 style={{ color: 'white', fontWeight: 600, fontSize: '1.2rem' }}>{session.subject}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      📍 Classroom: <strong style={{ color: 'white' }}>{session.classroom}</strong> | 🏢 Department: <strong style={{ color: 'white' }}>{session.department}</strong>
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                      Created by: Admin | Date: {session.date}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn btn-primary" onClick={() => handleApprove(session.sessionId)} style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}>
                      ✓ Approve
                    </button>
                    <button className="btn btn-secondary" onClick={() => handleReject(session.sessionId)} style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171' }}>
                      ✗ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* 2. Approved Sessions Ready to Start */}
      {approvedSessions.length > 0 && !activeSession && (
        <div style={{ marginBottom: '1.5rem' }} className="animate-fade-in">
          <Card title="Approved Attendance Sessions" subtitle="Ready to start live student check-ins">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {approvedSessions.map(session => (
                <div 
                  key={session.sessionId} 
                  style={{
                    background: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}
                >
                  <div>
                    <span className="badge" style={{ fontSize: '0.65rem', marginBottom: '0.5rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>
                      👍 APPROVED & READY
                    </span>
                    <h3 style={{ color: 'white', fontWeight: 600, fontSize: '1.2rem' }}>{session.subject}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      📍 Classroom: {session.classroom} | 🏢 Department: {session.department}
                    </p>
                  </div>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => handleStartLive(session.sessionId)} 
                    style={{ padding: '0.6rem 1.5rem', fontSize: '0.9rem', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', boxShadow: '0 0 15px rgba(16, 185, 129, 0.3)' }}
                  >
                    ▶ Start Session
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* 3. Live Active Session Monitor */}
      {activeSession && (
        <div style={{ marginBottom: '1.5rem' }} className="animate-fade-in">
          <Card 
            title="🔴 Live Attendance Monitor" 
            subtitle="Real-time check-in stream. Updates automatically as students scan."
            actions={
              <button 
                className="btn btn-danger" 
                onClick={() => handleEndSession(activeSession.sessionId)} 
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
              >
                ⏹ End Session
              </button>
            }
          >
            {/* Live Session Overview */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              padding: '1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div>
                <span className="badge badge-success" style={{ fontSize: '0.7rem', marginBottom: '0.4rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                  <span className="status-dot status-dot-active" style={{ background: '#10b981', width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block', marginRight: '0.3rem' }}></span>
                  LIVE / ACTIVE
                </span>
                <h3 style={{ color: 'white', fontWeight: 700, fontSize: '1.4rem' }}>{activeSession.subject}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                  📍 Classroom: <strong style={{ color: 'white' }}>{activeSession.classroom}</strong> | 🏢 Department: <strong style={{ color: 'white' }}>{activeSession.department}</strong>
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                  Started at: <strong style={{ color: 'white' }}>{new Date(activeSession.startTime).toLocaleTimeString()}</strong>
                </p>
              </div>

              {/* Stat Counters */}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '0.75rem 1.25rem', borderRadius: '10px', textAlign: 'center', minWidth: '90px' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-success)', display: 'block' }}>{livePresentCount}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Present</span>
                </div>
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', padding: '0.75rem 1.25rem', borderRadius: '10px', textAlign: 'center', minWidth: '90px' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-warning)', display: 'block' }}>{liveLateCount}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Late</span>
                </div>
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '0.75rem 1.25rem', borderRadius: '10px', textAlign: 'center', minWidth: '90px' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-error)', display: 'block' }}>{liveNotCheckedInCount}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Not Checked In</span>
                </div>
              </div>
            </div>

            {/* Live Student Table */}
            <Table 
              headers={['Student Name', 'Student ID', 'Check-in Time', 'Status']}
              isEmpty={activeDeptStudents.length === 0}
              emptyMessage="No active students found in this department."
            >
              {activeDeptStudents.map(student => {
                const detail = activeSession.checkInDetails && activeSession.checkInDetails[student.userId];
                const isCheckedIn = detail !== undefined;
                const status = isCheckedIn ? detail.status : 'NOT CHECKED IN';
                const time = isCheckedIn ? detail.time : '--';

                return (
                  <tr key={student.userId}>
                    <td style={{ fontWeight: 600, color: 'white' }}>{student.name}</td>
                    <td>{student.studentId || student.userId}</td>
                    <td>{time}</td>
                    <td>
                      <span className={`badge ${
                        status === 'PRESENT' ? 'badge-success' : 
                        status === 'LATE' ? 'badge-warning' : 
                        'badge-danger'
                      }`} style={{ fontSize: '0.7rem' }}>
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </Table>
          </Card>
        </div>
      )}

      {/* Profile and Quick Info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }} className="animate-fade-in">
        <Card title="Teacher Profile Summary" subtitle="Your institutional registration details">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '0.5rem 0' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              fontWeight: 'bold',
              color: 'white',
              boxShadow: 'var(--shadow-neon)'
            }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 style={{ color: 'white', fontWeight: 600, fontSize: '1.25rem' }}>{user.name}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                💼 {user.designation || 'Faculty Member'} | ID: {user.employeeId || user.userId}
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                🏢 Department: {user.department}
              </p>
            </div>
          </div>
        </Card>

        <Card title="Attendance Channel Status" subtitle="Session gateway status">
          {!activeSession ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📴</div>
              <p style={{ fontWeight: 500 }}>No active session streaming</p>
              <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {approvedSessions.length > 0 
                  ? 'Click "Start Session" on an approved request above to begin.' 
                  : 'Approve a pending request above when requested by Admin.'}
              </p>
            </div>
          ) : (
            <div style={{ padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📡</div>
              <p style={{ fontWeight: 600, color: 'var(--accent-success)', fontSize: '1.1rem' }}>Active Stream Open</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                {activeSession.subject} - {activeSession.classroom}
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Class Attendance Report Section */}
      <div className="animate-fade-in">
        <Card 
          title="Class Attendance Reports & History" 
          subtitle="Registry records for your assigned sessions"
          actions={
            assignedSessions.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <select 
                  className="form-input" 
                  value={selectedReportSessionId} 
                  onChange={(e) => setSelectedReportSessionId(e.target.value)}
                  style={{ padding: '0.3rem 0.8rem', width: 'auto', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  {assignedSessions.map(s => (
                    <option key={s.sessionId} value={s.sessionId}>
                      {s.subject} ({s.date} - {s.status})
                    </option>
                  ))}
                </select>

                <select
                  className="form-input"
                  value={reportFilterStatus}
                  onChange={(e) => setReportFilterStatus(e.target.value)}
                  style={{ padding: '0.3rem 0.8rem', width: 'auto', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  <option value="">All Statuses</option>
                  <option value="PRESENT">PRESENT</option>
                  <option value="LATE">LATE</option>
                  <option value="ABSENT">ABSENT</option>
                </select>
              </div>
            )
          }
        >
          {assignedSessions.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
              No assigned sessions recorded.
            </p>
          ) : !selectedSession ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
              Please select a session from the list.
            </p>
          ) : (
            <Table 
              headers={['Student Name', 'Registration ID', 'Date', 'Subject', 'Classroom', 'Check-In Time', 'Status']} 
              isEmpty={reportRows.length === 0}
              emptyMessage="No student records match the selected filter."
            >
              {reportRows.map((row, index) => (
                <tr key={index}>
                  <td style={{ fontWeight: 600, color: 'white' }}>{row.name}</td>
                  <td>{row.studentId}</td>
                  <td>{row.date}</td>
                  <td>{row.subject}</td>
                  <td>{row.classroom}</td>
                  <td>{row.time}</td>
                  <td>
                    <span className={`badge ${
                      row.status === 'PRESENT' ? 'badge-success' : 
                      row.status === 'LATE' ? 'badge-warning' : 
                      row.status === 'ABSENT' ? 'badge-danger' : 
                      row.status === 'NOT CHECKED IN' ? 'badge-danger' : ''
                    }`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      {/* Session Completed Summary Modal */}
      {sessionSummary && (
        <Modal
          isOpen={isSummaryModalOpen}
          onClose={() => setIsSummaryModalOpen(false)}
          title="Session Completed Summary"
          size="md"
        >
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📋</div>
            <h3 style={{ color: 'white', fontWeight: 700, fontSize: '1.3rem' }}>{sessionSummary.subject}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Classroom: {sessionSummary.classroom}</p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'white', display: 'block' }}>{sessionSummary.totalStudents}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Students</span>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-success)', display: 'block' }}>{sessionSummary.present}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Present</span>
              </div>
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-warning)', display: 'block' }}>{sessionSummary.late}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Late</span>
              </div>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-error)', display: 'block' }}>{sessionSummary.absent}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Absent</span>
              </div>
            </div>

            <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', padding: '1rem', borderRadius: '10px', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Attendance Rate: </span>
              <strong style={{ fontSize: '1.2rem', color: 'white' }}>{sessionSummary.attendancePercentage}%</strong>
            </div>

            <button className="btn btn-primary" onClick={() => setIsSummaryModalOpen(false)} style={{ width: '100%' }}>
              Close Summary
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default EmployeeDashboard;
