import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { attendanceAPI, faceAPI } from '../services/api';
import Card from '../components/Card';
import Table from '../components/Table';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';

const StudentDashboard = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Scanner modal and camera states
  const [selectedSession, setSelectedSession] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [scanStatus, setScanStatus] = useState('Looking for face...');
  const [scanStatusType, setScanStatusType] = useState('info'); // 'info', 'detecting', 'success', 'warning', 'error'
  const [scanSuccess, setScanSuccess] = useState(false);
  const [successDetails, setSuccessDetails] = useState(null); // { name, status, time }
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [profileError, setProfileError] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const requestRef = useRef(null);
  const timeoutRef = useRef(null);
  const isRecognizingRef = useRef(false);
  const lastRecognizeTimeRef = useRef(0);
  const scanSuccessRef = useRef(false);
  const isTimedOutRef = useRef(false);
  const detectLoopRef = useRef(null);

  const fetchData = async () => {
    try {
      const [historyRes, activeRes] = await Promise.all([
        attendanceAPI.getHistory({ userId: user.userId }),
        attendanceAPI.getActiveSessions()
      ]);
      setHistory(historyRes.data || []);
      
      // Filter active sessions matching student department
      const matchingSessions = (activeRes.data || []).filter(s => s.department === user.department);
      setActiveSessions(matchingSessions);
    } catch (error) {
      console.error('Failed to load student dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkProfile = async () => {
    try {
      await faceAPI.getProfile(user.userId);
      setProfileError('');
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setProfileError('Your face is not registered in the system. Please contact your teacher or administrator to enroll your face.');
      } else {
        setProfileError('Failed to verify biometric registration status.');
      }
    }
  };

  useEffect(() => {
    const init = async () => {
      if (user) {
        setLoading(true);
        await Promise.all([
          fetchData(),
          checkProfile()
        ]);
      }
    };
    init();
  }, [user]);

  // Load Face-API neural network weights
  const loadModels = async () => {
    if (window.faceapi && window.faceapi.nets.tinyFaceDetector.params) {
      setModelsLoaded(true);
      setLoadingModels(false);
      return true;
    }
    setLoadingModels(true);
    try {
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
      await Promise.all([
        window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        window.faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL).catch(() => {})
      ]);
      setModelsLoaded(true);
      return true;
    } catch (err) {
      console.error('Failed to load face-api models:', err);
      setCameraError('Failed to load face recognition neural networks. Please check your network connection.');
      return false;
    } finally {
      setLoadingModels(false);
    }
  };

  // Stop camera tracks and clean up all loops and timers
  const stopCamera = useCallback(() => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          // ignore
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      if (stream.getTracks) {
        stream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (e) {
            // ignore
          }
        });
      }
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
    isRecognizingRef.current = false;
  }, []);

  // Start Camera Stream
  const startCamera = async () => {
    setCameraError('');
    setScanStatus('Looking for face...');
    setScanStatusType('info');
    setScanSuccess(false);
    setSuccessDetails(null);
    setIsTimedOut(false);
    scanSuccessRef.current = false;
    isTimedOutRef.current = false;
    isRecognizingRef.current = false;
    lastRecognizeTimeRef.current = 0;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Browser error: getUserMedia is not supported. Please use a modern browser under HTTPS or localhost.');
      setScanStatusType('error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });
      streamRef.current = stream;
      setCameraActive(true);

      // Start a 25-second recognition timeout
      timeoutRef.current = setTimeout(() => {
        if (!scanSuccessRef.current) {
          isTimedOutRef.current = true;
          setIsTimedOut(true);
          setScanStatus('Face recognition timed out. Please face the camera directly in good lighting and try again.');
          setScanStatusType('warning');
        }
      }, 25000);

    } catch (err) {
      console.error('Camera connection error:', err);
      let msg = 'Failed to access webcam.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission denied. Please allow camera access in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera found on this device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Camera is already in use by another application.';
      }
      setCameraError(msg);
      setScanStatusType('error');
      setCameraActive(false);
    }
  };

  // Handle opening scanner modal
  const handleOpenScanner = (session) => {
    if (session.department !== user.department) {
      alert('You cannot mark attendance for a class belonging to another department.');
      return;
    }
    
    setCameraError('');
    setScanStatus('Initializing camera...');
    setScanStatusType('info');
    setScanSuccess(false);
    setSuccessDetails(null);
    setIsTimedOut(false);
    setSelectedSession(session);
    setIsModalOpen(true);

    // Ensure faceapi is present and models loaded
    if (window.faceapi) {
      loadModels();
    } else {
      const checkInterval = setInterval(() => {
        if (window.faceapi) {
          clearInterval(checkInterval);
          loadModels();
        }
      }, 150);
      setTimeout(() => clearInterval(checkInterval), 10000);
    }
  };

  // Safe video stream binding when cameraActive is true
  useEffect(() => {
    let active = true;
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play()
        .then(() => {
          if (active) {
            console.log('StudentDashboard: Webcam stream playing.');
          }
        })
        .catch(err => {
          if (active) {
            console.error('StudentDashboard: Video play failed:', err);
            setCameraError(`Video playback error: ${err.message}`);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [cameraActive]);

  // Autostart camera when modal opens and models are loaded
  useEffect(() => {
    if (isModalOpen && modelsLoaded && !cameraActive && !cameraError) {
      startCamera();
    }
    return () => {
      if (!isModalOpen) {
        stopCamera();
      }
    };
  }, [isModalOpen, modelsLoaded]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Server recognition call with biometric descriptor
  const triggerServerRecognition = async (descriptor, sessionId) => {
    if (isRecognizingRef.current || scanSuccessRef.current || isTimedOutRef.current) {
      return;
    }

    isRecognizingRef.current = true;
    setScanStatus('Recognizing face...');
    setScanStatusType('detecting');

    try {
      const res = await faceAPI.recognize(Array.from(descriptor), 0.50);
      
      if (res.data && res.data.match) {
        // Enforce that the recognized face belongs to the logged-in student
        if (res.data.userId === user.userId) {
          try {
            const attRes = await attendanceAPI.logAttendance({
              sessionId,
              userId: user.userId
            });

            scanSuccessRef.current = true;
            setScanSuccess(true);
            const statusLabel = attRes.data?.status === 'LATE' ? 'LATE' : 'PRESENT';
            const recordTime = attRes.data?.time || new Date().toLocaleTimeString();
            
            setSuccessDetails({
              name: user.name,
              status: statusLabel,
              time: recordTime
            });

            setScanStatus(`✓ Face recognized successfully! Marked [${statusLabel}]`);
            setScanStatusType('success');

            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }

            // Stop camera after 1.2s and close modal after 2.5s
            setTimeout(() => {
              stopCamera();
            }, 1200);

            setTimeout(() => {
              fetchData();
              setIsModalOpen(false);
            }, 2600);

          } catch (err) {
            const errDetail = err.response?.data?.error || '';
            if (errDetail.toLowerCase().includes('already marked') || errDetail.toLowerCase().includes('already recorded')) {
              scanSuccessRef.current = true;
              setScanSuccess(true);
              setScanStatus('Attendance already recorded for this session.');
              setScanStatusType('info');
              setSuccessDetails({
                name: user.name,
                status: 'RECORDED',
                time: 'Earlier'
              });
              setTimeout(() => {
                stopCamera();
              }, 1200);
              setTimeout(() => {
                fetchData();
                setIsModalOpen(false);
              }, 2600);
            } else {
              setScanStatus(`⚠ ${errDetail || 'Failed to record attendance.'}`);
              setScanStatusType('error');
            }
          }
        } else {
          setScanStatus(`⚠ Recognized as ${res.data.name || 'another person'}, not matching your student ID.`);
          setScanStatusType('warning');
        }
      } else {
        setScanStatus('Looking for registered face...');
        setScanStatusType('info');
      }
    } catch (error) {
      console.error('Biometric verification error:', error);
      setScanStatus('Biometric verification server error. Retrying...');
      setScanStatusType('warning');
    } finally {
      isRecognizingRef.current = false;
    }
  };

  // Real-time detection & HUD overlay loop
  const detectLoop = async () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended) {
      return;
    }
    if (videoRef.current.readyState < 2) {
      return;
    }

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const faceapi = window.faceapi;
      if (!faceapi) return;

      const displaySize = { width: video.clientWidth || 640, height: video.clientHeight || 480 };
      
      if (displaySize.width > 0 && displaySize.height > 0) {
        faceapi.matchDimensions(canvas, displaySize);

        // Run fast tiny face detector
        let detections = [];
        try {
          detections = await faceapi.detectAllFaces(
            video,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 })
          ).withFaceLandmarks().withFaceDescriptors();
        } catch (e) {
          // fallback
        }

        const resizedDetections = faceapi.resizeResults(detections || [], displaySize);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw futuristic HUD guide elements
        const count = detections ? detections.length : 0;

        if (count === 0) {
          if (!isRecognizingRef.current && !scanSuccessRef.current && !isTimedOutRef.current) {
            setScanStatus('Looking for face...');
            setScanStatusType('info');
          }
        } else if (count > 1) {
          setScanStatus('Multiple faces detected. Please keep only one face in frame.');
          setScanStatusType('warning');
        }

        resizedDetections.forEach((det) => {
          const box = det.detection.box;
          let boxColor = '#f59e0b'; // Amber scanning
          let label = 'Scanning...';

          if (count > 1) {
            boxColor = '#ef4444'; // Red error
            label = 'Multiple Faces';
          } else if (scanSuccessRef.current) {
            boxColor = '#10b981'; // Green success
            label = user.name;
          } else if (isRecognizingRef.current) {
            boxColor = '#6366f1'; // Indigo recognizing
            label = 'Recognizing...';
          }

          const drawBox = new faceapi.draw.DrawBox(box, { label, boxColor, lineWidth: 2 });
          drawBox.draw(canvas);
          faceapi.draw.drawFaceLandmarks(canvas, det);
        });

        // Trigger throttled recognition for single face
        if (
          count === 1 && 
          !isRecognizingRef.current && 
          !scanSuccessRef.current && 
          !isTimedOutRef.current && 
          detections[0] && 
          detections[0].descriptor
        ) {
          const now = Date.now();
          if (now - lastRecognizeTimeRef.current > 900) {
            lastRecognizeTimeRef.current = now;
            setScanStatus('Face detected. Recognizing...');
            setScanStatusType('detecting');
            triggerServerRecognition(detections[0].descriptor, selectedSession?.sessionId);
          }
        }
      }
    } catch (err) {
      console.error('Error running detection frame:', err);
    }
  };

  useEffect(() => {
    detectLoopRef.current = detectLoop;
  });

  // RAF loop runner
  useEffect(() => {
    let active = true;
    const loop = async () => {
      if (!active) return;
      if (detectLoopRef.current) {
        await detectLoopRef.current();
      }
      if (active && cameraActive && !scanSuccess) {
        requestRef.current = requestAnimationFrame(loop);
      }
    };

    if (cameraActive && !scanSuccess) {
      requestRef.current = requestAnimationFrame(loop);
    }

    return () => {
      active = false;
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [cameraActive, scanSuccess, selectedSession]);

  // Retry Handler
  const handleRetry = () => {
    setIsTimedOut(false);
    isTimedOutRef.current = false;
    setScanSuccess(false);
    scanSuccessRef.current = false;
    setSuccessDetails(null);
    setScanStatus('Looking for face...');
    setScanStatusType('info');
    startCamera();
  };

  if (loading) {
    return <LoadingSpinner message="Assembling student academic details..." />;
  }

  // Calculate dynamic attendance percentage
  const presentCount = history.filter(h => h.status === 'PRESENT' || h.status === 'LATE').length;
  const totalCount = history.length;
  const attendanceRate = totalCount > 0 ? ((presentCount / totalCount) * 100).toFixed(1) : '100.0';

  // Find today's check-in status
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecord = history.find(h => h.date === todayStr);

  const activeSessionForDept = activeSessions.find(s => s.department === user.department);
  const isDetectedInActiveSession = activeSessionForDept && 
    activeSessionForDept.checkedInStudents && 
    activeSessionForDept.checkedInStudents.includes(user.userId);

  let todayStatusText = 'ABSENT';
  let todayStatusLabel = "Today's Attendance Status";
  let todayIcon = '❌';
  let todayBg = 'rgba(239, 68, 68, 0.1)';
  let todayColor = 'var(--accent-error)';

  if (activeSessionForDept) {
    todayStatusText = 'Session Active';
    todayIcon = '📡';
    todayBg = 'rgba(99, 102, 241, 0.1)';
    todayColor = 'var(--accent-primary)';
    if (isDetectedInActiveSession) {
      todayStatusLabel = 'Attendance Detected — Pending Finalization';
    } else {
      todayStatusLabel = 'Lecture live - Scan required';
    }
  } else if (todayRecord) {
    todayStatusText = todayRecord.status;
    todayIcon = todayRecord.status === 'PRESENT' || todayRecord.status === 'LATE' ? '✅' : '❌';
    todayBg = todayRecord.status === 'PRESENT' || todayRecord.status === 'LATE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
    todayColor = todayRecord.status === 'PRESENT' || todayRecord.status === 'LATE' ? 'var(--accent-success)' : 'var(--accent-error)';
    todayStatusLabel = todayRecord.status === 'PRESENT' || todayRecord.status === 'LATE' ? `Checked in at ${todayRecord.time}` : 'Finalized ABSENT';
  }

  return (
    <div>
      <p className="page-subtitle">Track your daily attendance percentage, check recent logs, and check into active classroom lectures.</p>

      {/* Top Student Profile Card */}
      <div className="animate-fade-in" style={{ marginBottom: '1.5rem' }}>
        <Card title="Student Profile Summary" subtitle="Your institutional registration details">
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
                🎓 {user.course || 'B.Tech'} | Year: {user.year || '3rd'} | Batch: {user.batch || 'A'}
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                🏢 Department: {user.department}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Stats Row */}
      <div className="stats-grid animate-fade-in" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div className="glass-card stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2rem', background: 'rgba(99, 102, 241, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>🎓</div>
          <div className="stat-info">
            <span className="stat-value" style={{ fontSize: '1.3rem', fontWeight: 700, display: 'block', color: 'white' }}>
              {user?.studentId || 'N/A'}
            </span>
            <span className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Student Registration ID</span>
          </div>
        </div>

        <div className="glass-card stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2rem', background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>📈</div>
          <div className="stat-info">
            <span className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 700, display: 'block', color: 'var(--accent-success)' }}>
              {attendanceRate}%
            </span>
            <span className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Attendance Rate ({presentCount}/{totalCount})</span>
          </div>
        </div>

        <div className="glass-card stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            fontSize: '2.2rem',
            background: todayBg,
            padding: '0.4rem',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {todayIcon}
          </div>
          <div className="stat-info">
            <span className="stat-value" style={{
              fontSize: '1.15rem',
              fontWeight: 700,
              display: 'block',
              color: todayColor
            }}>
              {todayStatusText}
            </span>
            <span className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {todayStatusLabel}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', marginTop: '1rem' }} className="animate-fade-in">
        
        {/* Active Class Gateways */}
        <Card title="Active Class Gateways" subtitle="Current lectures open for biometric scan">
          {profileError && (
            <div style={{ 
              background: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid rgba(239, 68, 68, 0.25)', 
              color: '#f87171', 
              padding: '0.75rem', 
              borderRadius: '8px', 
              fontSize: '0.8rem', 
              marginBottom: '1rem' 
            }}>
              ⚠️ {profileError}
            </div>
          )}

          {activeSessions.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📴</div>
              <p style={{ fontWeight: 500 }}>No active lectures for {user.department}</p>
              <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Your professor will open a gateway when class starts.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {activeSessions.map((session) => {
                const isCheckedIn = session.checkedInStudents && session.checkedInStudents.includes(user.userId);
                
                return (
                  <div 
                    key={session.sessionId}
                    style={{
                      background: 'rgba(99, 102, 241, 0.05)',
                      border: '1px solid rgba(99, 102, 241, 0.15)',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem'
                    }}
                  >
                    <div>
                      <span className="badge badge-success" style={{ fontSize: '0.65rem', marginBottom: '0.5rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                        🟢 Attendance Open
                      </span>
                      <h4 style={{ color: 'white', fontSize: '1.1rem', fontWeight: 600 }}>{session.subject}</h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                        📍 Classroom: {session.classroom} | 🏢 Department: {session.department} | 👤 Teacher: {session.teacherName || 'Assigned Teacher'}
                      </p>
                    </div>

                    {isCheckedIn ? (
                      <div style={{ 
                        background: 'rgba(16, 185, 129, 0.1)', 
                        border: '1px solid rgba(16, 185, 129, 0.25)', 
                        padding: '0.75rem', 
                        borderRadius: '8px', 
                        fontSize: '0.85rem', 
                        color: '#34d399', 
                        fontWeight: 600,
                        textAlign: 'center'
                      }}>
                        ✓ Attendance Detected — Pending Finalization
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Click below to start scanning. Ensure your face is clearly visible in the camera frame.
                        </div>
                        <button 
                          className="btn btn-primary"
                          onClick={() => handleOpenScanner(session)}
                          disabled={!!profileError}
                          style={{ alignSelf: 'flex-start', padding: '0.5rem 1.25rem' }}
                        >
                          Scan Face / Mark Attendance
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Recent Attendance Logs */}
        <Card title="Recent Check-Ins" subtitle="Last verified logs">
          <Table 
            headers={['Date', 'Time', 'Subject', 'Classroom', 'Status']} 
            isEmpty={history.length === 0}
            emptyMessage="No attendance logged yet"
          >
            {history.slice(0, 8).map((record) => (
              <tr key={record.attendanceId}>
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

      {/* Face Scanner Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          stopCamera();
          setIsModalOpen(false);
        }} 
        title={`Face Scanner - ${selectedSession?.subject || 'Machine Learning'}`}
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Top Session Context Bar */}
          <div style={{ 
            background: 'rgba(99, 102, 241, 0.08)', 
            border: '1px solid rgba(99, 102, 241, 0.2)', 
            padding: '0.6rem 1rem', 
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.8rem'
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              Subject: <strong style={{ color: 'white' }}>{selectedSession?.subject}</strong>
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              Room: <strong style={{ color: 'white' }}>{selectedSession?.classroom}</strong>
            </span>
          </div>

          {cameraError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem' }}>
              ⚠️ {cameraError}
            </div>
          )}

          {/* Camera & Canvas Viewport */}
          <div style={{
            width: '100%',
            height: '320px',
            background: 'black',
            borderRadius: '12px',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--card-border)',
            boxShadow: scanSuccess ? '0 0 20px rgba(16, 185, 129, 0.3)' : 'inset 0 0 20px rgba(0,0,0,0.8)'
          }}>
            {loadingModels ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                <div className="spinner" style={{ marginBottom: '1rem', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', width: '32px', height: '32px', animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto' }}></div>
                <p style={{ fontSize: '0.85rem' }}>Loading face recognition neural networks...</p>
              </div>
            ) : cameraActive ? (
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                />
                <canvas 
                  ref={canvasRef} 
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎥</div>
                <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>Camera offline. Ready to start biometric scan.</p>
                <button className="btn btn-primary" onClick={startCamera}>
                  Activate Camera
                </button>
              </div>
            )}
          </div>

          {/* Real-Time Status Display HUD */}
          <div style={{
            padding: '1rem',
            borderRadius: '10px',
            background: scanSuccess 
              ? 'rgba(16, 185, 129, 0.12)' 
              : scanStatusType === 'warning' 
              ? 'rgba(245, 158, 11, 0.10)' 
              : scanStatusType === 'error'
              ? 'rgba(239, 68, 68, 0.10)'
              : 'rgba(255, 255, 255, 0.03)',
            border: scanSuccess 
              ? '1px solid rgba(16, 185, 129, 0.3)' 
              : scanStatusType === 'warning'
              ? '1px solid rgba(245, 158, 11, 0.25)'
              : scanStatusType === 'error'
              ? '1px solid rgba(239, 68, 68, 0.25)'
              : '1px solid rgba(255, 255, 255, 0.08)',
            textAlign: 'center'
          }}>
            {scanSuccess && successDetails ? (
              <div>
                <div style={{ color: '#34d399', fontWeight: 800, fontSize: '1.2rem', marginBottom: '0.4rem' }}>
                  ✓ Face recognized
                </div>
                <div style={{ color: 'white', fontSize: '0.95rem', fontWeight: 600 }}>
                  Name: {successDetails.name}
                </div>
                <div style={{ color: successDetails.status === 'PRESENT' ? 'var(--accent-success)' : 'var(--accent-warning)', fontSize: '0.9rem', fontWeight: 700, marginTop: '0.2rem' }}>
                  Status: {successDetails.status}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                  Time: {successDetails.time}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '0.5rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: scanStatusType === 'warning' ? '#fbbf24' : scanStatusType === 'error' ? '#f87171' : scanStatusType === 'detecting' ? 'var(--accent-primary)' : 'var(--text-primary)'
                }}>
                  {scanStatusType === 'detecting' && (
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-primary)', animation: 'pulse 1s infinite' }}></div>
                  )}
                  <span>{scanStatus}</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
            {isTimedOut ? (
              <>
                <button className="btn btn-primary" onClick={handleRetry} style={{ flex: 1 }}>
                  🔄 Retry Recognition
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => {
                    stopCamera();
                    setIsModalOpen(false);
                  }} 
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  stopCamera();
                  setIsModalOpen(false);
                }} 
                style={{ width: '100%' }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StudentDashboard;
