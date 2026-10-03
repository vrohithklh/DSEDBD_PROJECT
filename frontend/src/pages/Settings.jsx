import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminAPI } from '../services/api';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';

const Settings = () => {
  const { user } = useAuth();
  const [metadata, setMetadata] = useState({ departments: [], classrooms: [], subjects: [] });
  const [loading, setLoading] = useState(true);

  // Form states
  const [newDept, setNewDept] = useState('');
  const [newRoom, setNewRoom] = useState('');
  const [newSubject, setNewSubject] = useState('');

  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackType, setFeedbackType] = useState(''); // 'success', 'error'

  const [emailNotif, setEmailNotif] = useState(() => localStorage.getItem('email-notif') !== 'false');
  const [kioskAlert, setKioskAlert] = useState(() => localStorage.getItem('kiosk-alert') !== 'false');

  const handleEmailNotifChange = (e) => {
    const val = e.target.checked;
    setEmailNotif(val);
    localStorage.setItem('email-notif', val ? 'true' : 'false');
  };

  const handleKioskAlertChange = (e) => {
    const val = e.target.checked;
    setKioskAlert(val);
    localStorage.setItem('kiosk-alert', val ? 'true' : 'false');
  };

  const isAdmin = user?.role === 'ADMIN';

  const loadMetadata = async () => {
    try {
      const response = await adminAPI.getMetadata();
      setMetadata(response.data);
    } catch (error) {
      console.error('Failed to load settings metadata:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadMetadata();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  const handleAddDept = async (e) => {
    e.preventDefault();
    if (!newDept.trim()) return;
    try {
      await adminAPI.addDepartment(newDept);
      setNewDept('');
      setFeedbackType('success');
      setFeedbackMsg(`Department "${newDept}" created successfully!`);
      loadMetadata();
    } catch (error) {
      setFeedbackType('error');
      setFeedbackMsg('Failed to create department.');
    }
  };

  const handleAddRoom = async (e) => {
    e.preventDefault();
    if (!newRoom.trim()) return;
    try {
      await adminAPI.addClassroom(newRoom);
      setNewRoom('');
      setFeedbackType('success');
      setFeedbackMsg(`Classroom "${newRoom}" created successfully!`);
      loadMetadata();
    } catch (error) {
      setFeedbackType('error');
      setFeedbackMsg('Failed to create classroom.');
    }
  };

  const handleAddSubject = async (e) => {
    e.preventDefault();
    if (!newSubject.trim()) return;
    try {
      await adminAPI.addSubject(newSubject);
      setNewSubject('');
      setFeedbackType('success');
      setFeedbackMsg(`Subject "${newSubject}" created successfully!`);
      loadMetadata();
    } catch (error) {
      setFeedbackType('error');
      setFeedbackMsg('Failed to create subject.');
    }
  };

  if (loading) {
    return <LoadingSpinner message="Opening preferences..." />;
  }

  return (
    <div>
      <p className="page-subtitle">Configure application settings and campus infrastructure metadata.</p>

      {feedbackMsg && (
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
          {feedbackMsg}
        </div>
      )}

      {isAdmin ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }} className="animate-fade-in">
          
          {/* Departments manager */}
          <Card title="Academic Departments" subtitle="Manage university departments">
            <form onSubmit={handleAddDept} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input 
                className="form-input" 
                placeholder="e.g. Electrical Engineering" 
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                required
              />
              <button className="btn btn-primary" type="submit">Add</button>
            </form>

            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {metadata.departments.map(d => (
                <div key={d.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.875rem', border: '1px solid rgba(255,255,255,0.04)' }}>
                  🏢 {d.name}
                </div>
              ))}
            </div>
          </Card>

          {/* Classrooms manager */}
          <Card title="Classroom Locations" subtitle="Physical classroom spaces">
            <form onSubmit={handleAddRoom} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input 
                className="form-input" 
                placeholder="e.g. Lab C" 
                value={newRoom}
                onChange={(e) => setNewRoom(e.target.value)}
                required
              />
              <button className="btn btn-primary" type="submit">Add</button>
            </form>

            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {metadata.classrooms.map(c => (
                <div key={c.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.875rem', border: '1px solid rgba(255,255,255,0.04)' }}>
                  📍 {c.name}
                </div>
              ))}
            </div>
          </Card>

          {/* Subjects manager */}
          <Card title="Subjects & Courses" subtitle="Classroom academic courses">
            <form onSubmit={handleAddSubject} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input 
                className="form-input" 
                placeholder="e.g. Computer Networks" 
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                required
              />
              <button className="btn btn-primary" type="submit">Add</button>
            </form>

            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {metadata.subjects.map(s => (
                <div key={s.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.875rem', border: '1px solid rgba(255,255,255,0.04)' }}>
                  📚 {s.name}
                </div>
              ))}
            </div>
          </Card>

        </div>
      ) : (
        <Card title="User Preferences" subtitle="Configure notifications and portal display settings">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input type="checkbox" id="email-notif" checked={emailNotif} onChange={handleEmailNotifChange} style={{ width: '16px', height: '16px' }} />
              <label htmlFor="email-notif" style={{ fontSize: '0.95rem', cursor: 'pointer' }}>Receive email logs on successful biometric check-ins</label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input type="checkbox" id="kiosk-alert" checked={kioskAlert} onChange={handleKioskAlertChange} style={{ width: '16px', height: '16px' }} />
              <label htmlFor="kiosk-alert" style={{ fontSize: '0.95rem', cursor: 'pointer' }}>Show active check-in portal warning alerts on dashboard</label>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Settings;
