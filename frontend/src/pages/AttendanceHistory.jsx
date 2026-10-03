import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { attendanceAPI, userAPI } from '../services/api';
import Card from '../components/Card';
import Table from '../components/Table';
import LoadingSpinner from '../components/LoadingSpinner';

const AttendanceHistory = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterUser, setFilterUser] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const isAdmin = user.role === 'ADMIN';

  const fetchData = async () => {
    try {
      const filters = {};
      if (filterDate) filters.date = filterDate;

      if (isAdmin) {
        if (filterUser) filters.userId = filterUser;
      } else {
        filters.userId = user.userId;
      }

      const response = await attendanceAPI.getHistory(filters);
      setRecords(response.data);
    } catch (error) {
      console.error('Failed to load attendance records:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const filters = isAdmin ? {} : { userId: user.userId };
        const [recordsRes, usersRes] = await Promise.all([
          attendanceAPI.getHistory(filters),
          isAdmin ? userAPI.list() : Promise.resolve({ data: [] })
        ]);
        
        setRecords(recordsRes.data);
        if (isAdmin) {
          setUsers(usersRes.data.filter(u => u.role !== 'ADMIN'));
        }
      } catch (error) {
        console.error('Failed to load initial history data:', error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [user, isAdmin]);

  // Refetch logs when filters change
  useEffect(() => {
    if (!loading) {
      fetchData();
    }
  }, [filterUser, filterDate]);

  if (loading) {
    return <LoadingSpinner message="Querying biometric checkpoints..." />;
  }

  const tableHeaders = isAdmin 
    ? ['Date', 'Time', 'User Name', 'Role', 'Subject', 'Classroom', 'Status']
    : ['Date', 'Time', 'Subject', 'Classroom', 'Department', 'Status'];

  return (
    <div>
      <p className="page-subtitle">
        {isAdmin 
          ? 'Browse and filter biometric checkout logs across subjects and classes.' 
          : 'Review your complete record of classroom check-ins.'}
      </p>

      <Card 
        title="Check-In Registry" 
        actions={
          isAdmin && (
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <select 
                className="form-input" 
                value={filterUser} 
                onChange={(e) => setFilterUser(e.target.value)}
                style={{ width: '180px', padding: '0.4rem 0.8rem' }}
              >
                <option value="">All Students/Staff</option>
                {users.map(u => (
                  <option key={u.userId} value={u.userId}>{u.name}</option>
                ))}
              </select>

              <input 
                className="form-input" 
                type="date" 
                value={filterDate} 
                onChange={(e) => setFilterDate(e.target.value)}
                style={{ width: '150px', padding: '0.4rem 0.8rem' }}
              />
            </div>
          )
        }
      >
        <Table headers={tableHeaders} isEmpty={records.length === 0} emptyMessage="No attendance logs found matching filters">
          {records.map((record) => (
            <tr key={record.attendanceId}>
              <td>{record.date}</td>
              <td>{record.time}</td>
              {isAdmin && (
                <>
                  <td style={{ fontWeight: 600, color: 'white' }}>{record.userName}</td>
                  <td>
                    <span className={`badge ${record.userType === 'STUDENT' ? 'badge-success' : 'badge-warning'}`}>
                      {record.userType}
                    </span>
                  </td>
                </>
              )}
              <td style={{ fontWeight: 500 }}>{record.subject}</td>
              <td>{record.classroom}</td>
              {!isAdmin && <td>{record.department}</td>}
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
  );
};

export default AttendanceHistory;
