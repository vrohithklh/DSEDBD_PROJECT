import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { userAPI, adminAPI } from '../services/api';
import Card from '../components/Card';
import Table from '../components/Table';
import LoadingSpinner from '../components/LoadingSpinner';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [metadata, setMetadata] = useState({ departments: [] });
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchVal, setSearchVal] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState(''); // 'success', 'error'

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users', {
        params: {
          page,
          limit: 8,
          role: roleFilter || undefined,
          department: deptFilter || undefined,
          search: searchVal || undefined
        }
      });
      
      setUsers(response.data.users || []);
      setTotalPages(response.data.totalPages || 1);
      setTotalUsers(response.data.total || 0);
    } catch (error) {
      console.error('Failed to query users directory:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const [usersRes, metaRes] = await Promise.all([
          api.get('/users', { params: { page: 1, limit: 8 } }),
          adminAPI.getMetadata()
        ]);
        
        setUsers(usersRes.data.users || []);
        setTotalPages(usersRes.data.totalPages || 1);
        setTotalUsers(usersRes.data.total || 0);
        setMetadata(metaRes.data);
      } catch (error) {
        console.error('Failed to load initial directory parameters:', error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Refetch when page or filters update
  useEffect(() => {
    if (!loading) {
      fetchUsers();
    }
  }, [page, roleFilter, deptFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleDelete = async (userId, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${name}'s profile?`)) {
      return;
    }
    
    setFeedback('');
    try {
      await userAPI.delete(userId);
      setFeedbackType('success');
      setFeedback(`User ${name} was deleted successfully.`);
      
      // If current page is empty after delete, go to previous page
      const newPage = (users.length === 1 && page > 1) ? page - 1 : page;
      setPage(newPage);
      fetchUsers();
    } catch (err) {
      setFeedbackType('error');
      setFeedback(err.response?.data?.error || 'Failed to delete user.');
    }
  };

  if (loading) {
    return <LoadingSpinner message="Querying student and employee registers..." />;
  }

  const tableHeaders = ['Name', 'Role', 'Email', 'Department', 'ID Reference', 'Status', 'Actions'];

  return (
    <div>
      <p className="page-subtitle">Add new members, verify credentials, and manage classroom accounts.</p>

      {feedback && (
        <div style={{
          background: feedbackType === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${feedbackType === 'success' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
          color: feedbackType === 'success' ? '#34d399' : '#f87171',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          fontSize: '0.85rem',
          marginBottom: '1.5rem',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {feedback}
        </div>
      )}

      {/* Directory Controls */}
      <Card 
        title="Institutional Directory" 
        subtitle={`Total registered accounts: ${totalUsers}`}
        actions={
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link to="/admin/users/add-student" className="btn btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}>
              🎓 Add Student
            </Link>
            <Link to="/admin/users/add-employee" className="btn btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}>
              💼 Add Staff
            </Link>
          </div>
        }
      >
        {/* Search and Filters Header */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '250px' }}>
            <input 
              className="form-input" 
              placeholder="Search by name, email, or ID..."
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              style={{ padding: '0.5rem 1rem' }}
            />
            <button className="btn btn-secondary" type="submit" style={{ padding: '0.5rem 1rem' }}>🔍</button>
          </form>

          <select 
            className="form-input" 
            value={roleFilter} 
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            style={{ width: '130px', padding: '0.5rem' }}
          >
            <option value="">All Roles</option>
            <option value="ADMIN">Admins</option>
            <option value="STUDENT">Students</option>
            <option value="EMPLOYEE">Staff</option>
          </select>

          <select 
            className="form-input" 
            value={deptFilter} 
            onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
            style={{ width: '180px', padding: '0.5rem' }}
          >
            <option value="">All Departments</option>
            {metadata.departments.map(d => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Directory Table */}
        <Table headers={tableHeaders} isEmpty={users.length === 0} emptyMessage="No registered accounts match these filters.">
          {users.map((item) => (
            <tr key={item.userId}>
              <td style={{ fontWeight: 600, color: 'white' }}>{item.name}</td>
              <td>
                <span className={`badge ${item.role === 'ADMIN' ? 'badge-info' : item.role === 'STUDENT' ? 'badge-success' : 'badge-warning'}`}>
                  {item.role}
                </span>
              </td>
              <td>{item.email}</td>
              <td>{item.department}</td>
              <td>{item.studentId || item.employeeId || 'N/A'}</td>
              <td>
                <span className={`status-dot ${item.status === 'ACTIVE' ? 'status-dot-active' : 'status-dot-inactive'}`} />
                <span style={{ fontSize: '0.85rem' }}>{item.status}</span>
              </td>
              <td>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Link to={`/admin/users/${item.userId}`} className="btn btn-secondary" title="View Details" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}>
                    👁️
                  </Link>
                  <Link to={`/admin/users/edit/${item.userId}`} className="btn btn-secondary" title="Edit Profile" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}>
                    ✏️
                  </Link>
                  {item.role !== 'ADMIN' && (
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => handleDelete(item.userId, item.name)} 
                      title="Delete User"
                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', color: '#f87171' }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>

        {/* Pagination Buttons Layout */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Page <strong>{page}</strong> of <strong>{totalPages}</strong> (showing {users.length} results)
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setPage(p => Math.max(p - 1, 1))} 
                disabled={page === 1}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              >
                ◀️ Previous
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => setPage(p => Math.min(p + 1, totalPages))} 
                disabled={page === totalPages}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              >
                Next ▶️
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Users;
