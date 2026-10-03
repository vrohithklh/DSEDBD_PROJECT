import React, { useState, useEffect } from 'react';
import { reportsAPI, userAPI, adminAPI } from '../services/api';
import Card from '../components/Card';
import Table from '../components/Table';
import LoadingSpinner from '../components/LoadingSpinner';

const Reports = () => {
  const [records, setRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [metadata, setMetadata] = useState({ departments: [], classrooms: [], subjects: [] });
  const [loading, setLoading] = useState(true);

  // Filter states
  const [reportType, setReportType] = useState('daily');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterUser, setFilterUser] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterSub, setFilterSub] = useState('');
  const [filterClassroom, setFilterClassroom] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [exportMessage, setExportMessage] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        const [detailedRes, usersRes, metaRes] = await Promise.all([
          reportsAPI.getDetailed(),
          userAPI.list(),
          adminAPI.getMetadata()
        ]);
        setRecords(detailedRes.data.records || []);
        setUsers(usersRes.data || []);
        setMetadata(metaRes.data);
      } catch (error) {
        console.error('Failed to load reports data:', error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Filter computations
  const getFilteredRecords = () => {
    let result = [...records];

    // 1. General Filters
    if (filterDept) {
      result = result.filter(r => r.department === filterDept);
    }
    if (filterSub) {
      result = result.filter(r => r.subject === filterSub);
    }
    if (filterClassroom) {
      result = result.filter(r => r.classroom === filterClassroom);
    }
    if (filterStatus) {
      result = result.filter(r => r.status === filterStatus);
    }

    // 2. Report Type Filters
    if (reportType === 'daily') {
      if (filterDate) {
        result = result.filter(r => r.date === filterDate);
      }
    } else if (reportType === 'weekly') {
      if (filterDate) {
        const targetDate = new Date(filterDate);
        const startOfWeek = new Date(targetDate);
        startOfWeek.setDate(targetDate.getDate() - targetDate.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        result = result.filter(r => {
          const rDate = new Date(r.date);
          return rDate >= startOfWeek && rDate <= endOfWeek;
        });
      }
    } else if (reportType === 'monthly') {
      if (filterDate) {
        const targetDate = new Date(filterDate);
        const month = targetDate.getMonth();
        const year = targetDate.getFullYear();
        result = result.filter(r => {
          const rDate = new Date(r.date);
          return rDate.getMonth() === month && rDate.getFullYear() === year;
        });
      }
    } else if (reportType === 'individual') {
      if (filterUser) {
        result = result.filter(r => r.userId === filterUser);
      }
    } else if (reportType === 'department-wise') {
      if (filterDept) {
        result = result.filter(r => r.department === filterDept);
      }
    }

    return result;
  };

  const filteredRecords = getFilteredRecords();
  const totalClasses = filteredRecords.length;
  const present = filteredRecords.filter(r => r.status === 'PRESENT').length;
  const late = filteredRecords.filter(r => r.status === 'LATE').length;
  const absent = filteredRecords.filter(r => r.status === 'ABSENT').length;
  const presentClasses = present + late;
  const percentage = totalClasses > 0 ? ((presentClasses / totalClasses) * 100).toFixed(1) : '100.0';

  // Real CSV exporter
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      setExportMessage('⚠️ No matching records found to export.');
      return;
    }

    const headers = ['Name', 'ID', 'Date', 'Time', 'Subject', 'Classroom', 'Status'];
    const csvRows = [
      headers.join(','),
      ...filteredRecords.map(r => [
        `"${r.userName.replace(/"/g, '""')}"`,
        `"${r.userId}"`,
        `"${r.date}"`,
        `"${r.time}"`,
        `"${r.subject.replace(/"/g, '""')}"`,
        `"${r.classroom.replace(/"/g, '""')}"`,
        `"${r.status}"`
      ].join(','))
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Attendance_Report_${reportType}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportMessage('✅ CSV Report downloaded successfully!');
    setTimeout(() => setExportMessage(''), 4000);
  };

  // Real PDF exporter using browser print window
  const handlePrintPDF = () => {
    window.print();
  };

  if (loading) {
    return <LoadingSpinner message="Generating reports compiler..." />;
  }

  // Circular progress math
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (parseFloat(percentage) / 100) * circumference;

  return (
    <div>
      {/* Dynamic CSS styles for clean print layouts */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
            background: white !important;
            color: black !important;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 2rem;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <p className="page-subtitle no-print">Generate attendance summaries, review statistics, and export academic logs.</p>

      {exportMessage && (
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#34d399', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1.5rem' }} className="no-print">
          {exportMessage}
        </div>
      )}

      {/* Interactive Filters Panel */}
      <div className="no-print" style={{ marginBottom: '1.5rem' }}>
        <Card title="Attendance Report Filters" subtitle="Configure scope boundaries for report compilation">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
            <div className="form-group">
              <label className="form-label">Report Category</label>
              <select className="form-input" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                <option value="daily">Daily Attendance</option>
                <option value="weekly">Weekly Attendance</option>
                <option value="monthly">Monthly Attendance</option>
                <option value="individual">Individual Profile Report</option>
                <option value="department-wise">Department-wise Summary</option>
              </select>
            </div>

            {(reportType === 'daily' || reportType === 'weekly' || reportType === 'monthly') && (
              <div className="form-group">
                <label className="form-label">Target Date</label>
                <input className="form-input" type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
              </div>
            )}

            {reportType === 'individual' && (
              <div className="form-group">
                <label className="form-label">Select Student/Employee</label>
                <select className="form-input" value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
                  <option value="">-- Choose User --</option>
                  {users.map(u => (
                    <option key={u.userId} value={u.userId}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Department</label>
              <select className="form-input" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
                <option value="">All Departments</option>
                {metadata.departments.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Subject</label>
              <select className="form-input" value={filterSub} onChange={(e) => setFilterSub(e.target.value)}>
                <option value="">All Subjects</option>
                {metadata.subjects.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Classroom</label>
              <select className="form-input" value={filterClassroom} onChange={(e) => setFilterClassroom(e.target.value)}>
                <option value="">All Classrooms</option>
                {metadata.classrooms.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Check-In Status</label>
              <select className="form-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="PRESENT">PRESENT</option>
                <option value="LATE">LATE</option>
                <option value="ABSENT">ABSENT</option>
              </select>
            </div>
          </div>
        </Card>
      </div>

      {/* Print-Ready Report Wrapper */}
      <div id="print-area">
        {/* Print Only Header */}
        <div style={{ display: 'none' }} className="visible-print">
          <div style={{ borderBottom: '2px solid black', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>UNIVERSITY BIOMETRIC ATTENDANCE SYSTEM</h1>
              <p style={{ fontSize: '0.85rem', color: '#555', marginTop: '0.25rem' }}>Automated Biometric Verification Logging Portal</p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
              <p>Generated At: {new Date().toLocaleString()}</p>
              <p>Category: {reportType.toUpperCase()}</p>
            </div>
          </div>
        </div>

        {/* Visual Analytics block */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Key Metrics cards */}
          <Card title="Attendance Rate Gauge" subtitle="Evaluation rate from current subset">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '1rem 0' }}>
              <div style={{ position: 'relative', width: '90px', height: '90px' }}>
                <svg width="90" height="90" viewBox="0 0 90 90">
                  <circle cx="45" cy="45" r={radius} fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                  <circle 
                    cx="45" 
                    cy="45" 
                    r={radius} 
                    fill="transparent" 
                    stroke="var(--accent-primary)" 
                    strokeWidth="8" 
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                  />
                </svg>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>
                  {percentage}%
                </div>
              </div>

              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Classes Counted: <strong style={{ color: 'white' }}>{totalClasses}</strong></p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Present Total: <strong style={{ color: 'var(--accent-success)' }}>{presentClasses}</strong></p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Absent Total: <strong style={{ color: 'var(--accent-error)' }}>{absent}</strong></p>
              </div>
            </div>
          </Card>

          {/* Metrics breakdown chart */}
          <Card title="Check-In Status Breakdown" subtitle="Mathematical registry counts">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                  <span>PRESENT ({present})</span>
                  <span>{totalClasses > 0 ? Math.round((present / totalClasses) * 100) : 0}%</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${totalClasses > 0 ? (present / totalClasses) * 100 : 0}%`, height: '100%', background: 'var(--accent-success)' }}></div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                  <span>LATE ({late})</span>
                  <span>{totalClasses > 0 ? Math.round((late / totalClasses) * 100) : 0}%</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${totalClasses > 0 ? (late / totalClasses) * 100 : 0}%`, height: '100%', background: 'var(--accent-warning)' }}></div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                  <span>ABSENT ({absent})</span>
                  <span>{totalClasses > 0 ? Math.round((absent / totalClasses) * 100) : 0}%</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${totalClasses > 0 ? (absent / totalClasses) * 100 : 0}%`, height: '100%', background: 'var(--accent-error)' }}></div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Attendance Records Table */}
        <Card 
          title="Attendance Logs Directory" 
          subtitle={`Compiled database registry (${filteredRecords.length} records)`}
          actions={
            <div style={{ display: 'flex', gap: '0.75rem' }} className="no-print">
              <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }} onClick={handleExportCSV}>
                📥 Export CSV
              </button>
              <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }} onClick={handlePrintPDF}>
                🖨️ Save as PDF (Print)
              </button>
            </div>
          }
        >
          <Table 
            headers={['Name', 'ID', 'Date', 'Time', 'Subject', 'Classroom', 'Status']}
            isEmpty={filteredRecords.length === 0}
            emptyMessage="No attendance logs match the selected filter configuration."
          >
            {filteredRecords.map((record) => (
              <tr key={record.attendanceId}>
                <td style={{ fontWeight: 600, color: 'white' }}>{record.userName}</td>
                <td>{record.userId}</td>
                <td>{record.date}</td>
                <td>{record.time}</td>
                <td style={{ fontWeight: 500 }}>{record.subject}</td>
                <td>{record.classroom}</td>
                <td>
                  <span className={`badge ${record.status === 'PRESENT' ? 'badge-success' : record.status === 'LATE' ? 'badge-warning' : 'badge-danger'}`}>
                    {record.status}
                  </span>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </div>
  );
};

export default Reports;
