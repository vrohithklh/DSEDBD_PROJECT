import React, { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userAPI, faceAPI } from '../services/api';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';

const FaceEnrollment = () => {
  const { user } = useAuth();

  // Access validation: Teachers and Admins can enroll faces
  if (!user || (user.role !== 'EMPLOYEE' && user.role !== 'ADMIN')) {
    return <Navigate to="/" replace />;
  }

  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [debugError, setDebugError] = useState('');
  const [loopError, setLoopError] = useState('');
  
  // Model loading states
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingModelsError, setLoadingModelsError] = useState('');

  // Camera states
  const [cameraActive, setCameraActive] = useState(false);
  const [streamLoaded, setStreamLoaded] = useState(false);
  const [enrollSuccess, setEnrollSuccess] = useState('');
  const [enrollError, setEnrollError] = useState('');
  
  // Biometric status of selected user
  const [enrolledProfile, setEnrolledProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Capturing / scanning states
  const [capturing, setCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [captureStatus, setCaptureStatus] = useState('Position your face inside the frame');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const requestRef = useRef(null);
  const lastSampleTimeRef = useRef(0);
  const samplesRef = useRef([]);
  const capturingRef = useRef(false);
  const detectLoopRef = useRef();
  const lastLogTimeRef = useRef(0);

  // Synchronize capturing state to ref for animation loop
  useEffect(() => {
    capturingRef.current = capturing;
    if (!capturing) {
      setCaptureProgress(0);
      samplesRef.current = [];
    }
  }, [capturing]);

  // 1. Load users list on mount
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await userAPI.list();
        
        const dataArray = Array.isArray(response.data) 
          ? response.data 
          : (response.data && Array.isArray(response.data.users) ? response.data.users : []);
          
        // Admins can enroll students & employees; Teachers can enroll students
        const enrollableUsers = user.role === 'ADMIN'
          ? dataArray.filter(u => u.role !== 'ADMIN')
          : dataArray.filter(u => u.role === 'STUDENT');
        
        setUsers(enrollableUsers);
        if (enrollableUsers.length > 0) {
          setSelectedUserId(enrollableUsers[0].userId);
        }
      } catch (error) {
        console.error('Failed to load users list:', error);
        setDebugError(error.message || 'Error loading users list');
      } finally {
        setLoading(false);
      }
    };
    loadUsers();

    return () => {
      stopCamera();
    };
  }, [user]);

  // 2. Load face-api models from CDN
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        // Load ssdMobilenetv1, tinyFaceDetector, faceLandmark68Net, and faceRecognitionNet
        await Promise.all([
          window.faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error('Failed to load face-api models:', err);
        setLoadingModelsError('Failed to load face recognition neural networks. Please reload the page.');
      } finally {
        setLoadingModels(false);
      }
    };

    // Wait for the CDN script to load and inject window.faceapi
    const checkAndLoad = setInterval(() => {
      if (window.faceapi) {
        clearInterval(checkAndLoad);
        loadModels();
      }
    }, 100);

    return () => clearInterval(checkAndLoad);
  }, []);

  // 3. Fetch face profile status when selected user changes
  const fetchUserProfileStatus = async (userId) => {
    if (!userId) return;
    setLoadingProfile(true);
    setEnrolledProfile(null);
    try {
      const res = await faceAPI.getProfile(userId);
      setEnrolledProfile(res.data);
    } catch (err) {
      if (err.response && err.response.status === 404) {
        // Expected if user is not enrolled yet
        setEnrolledProfile(null);
      } else {
        console.error('Failed to retrieve face profile status:', err);
      }
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    setEnrollSuccess('');
    setEnrollError('');
    setLoopError('');
    setCaptureProgress(0);
    setCaptureStatus('Position your face inside the frame');
    setEnrolledProfile(null);
    if (selectedUserId) {
      fetchUserProfileStatus(selectedUserId);
    }
  }, [selectedUserId]);

  // Safely assign stream to video element when camera active state changes and video element mounts
  useEffect(() => {
    let active = true;
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play()
        .then(() => {
          if (active) {
            setStreamLoaded(true);
            setCaptureStatus('Ready to capture');
          }
        })
        .catch(err => {
          if (active) {
            console.error('Error playing video stream:', err);
            setEnrollError(`Failed to start video playback (${err.name}): ${err.message}`);
            setCaptureStatus('Video playback failed');
          }
        });
    } else {
      setStreamLoaded(false);
    }
    return () => {
      active = false;
    };
  }, [cameraActive, videoRef.current]);

  // 4. Start Camera Stream
  const startCamera = async () => {
    setEnrollSuccess('');
    setEnrollError('');
    setCaptureProgress(0);
    setCaptureStatus('Initializing camera...');
    setStreamLoaded(false);
    samplesRef.current = [];
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setEnrollError('Browser API error: navigator.mediaDevices.getUserMedia is not supported/available in this browser. Ensure you are using HTTPS or localhost.');
      setCaptureStatus('Camera initialization failed');
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      console.error('Failed to access camera:', err);
      setEnrollError(`Unable to access camera (${err.name}): ${err.message}`);
      setCameraActive(false);
      setCaptureStatus('Camera access failed');
    }
  };

  // 5. Stop Camera Stream
  const stopCamera = () => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    
    // Stop all tracks from the ref stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.label);
      });
      streamRef.current = null;
    }

    // Fallback: Stop tracks from video element directly and clear srcObject
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      if (stream.getTracks) {
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('Stopped video element track:', track.label);
        });
      }
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
    setCapturing(false);
    setStreamLoaded(false);
    setCaptureProgress(0);
  };

  // 6. Handle Sample Capture logic
  const handleSampleCapture = (descriptor) => {
    const now = Date.now();
    // 600ms spacing between captures to record variations
    if (now - lastSampleTimeRef.current < 600) {
      return;
    }

    if (samplesRef.current.length >= 5) {
      return;
    }

    lastSampleTimeRef.current = now;
    const newSamples = [...samplesRef.current, Array.from(descriptor)];
    samplesRef.current = newSamples;
    
    const progress = Math.min((newSamples.length / 5) * 100, 100);
    setCaptureProgress(progress);

    if (newSamples.length === 5) {
      // Completed, push enrollment
      triggerEnrollment(newSamples);
    }
  };

  // 7. Process Average Vector and Send to DB/Firestore
  const triggerEnrollment = async (capturedSamples) => {
    setCapturing(false);
    stopCamera();

    try {
      // Average the 128-float arrays for stability
      const avgDescriptor = new Float32Array(128);
      for (let i = 0; i < 128; i++) {
        let sum = 0;
        for (let s = 0; s < capturedSamples.length; s++) {
          sum += capturedSamples[s][i];
        }
        avgDescriptor[i] = sum / capturedSamples.length;
      }

      await faceAPI.enroll(selectedUserId, Array.from(avgDescriptor));
      setEnrollSuccess('Enrolled Successfully');
      fetchUserProfileStatus(selectedUserId);
    } catch (err) {
      setEnrollError(err.response?.data?.error || 'Biometric enrollment failed.');
    }
  };

  // 8. Delete / Reset Enrollment template
  const handleResetEnrollment = async () => {
    if (!selectedUserId) return;
    if (!window.confirm("Are you sure you want to delete this user's biometric face template? This action cannot be undone.")) {
      return;
    }

    setEnrollSuccess('');
    setEnrollError('');
    try {
      await faceAPI.deleteProfile(selectedUserId);
      setEnrollSuccess('Enrollment reset successfully! You can now register a new profile.');
      setEnrolledProfile(null);
    } catch (err) {
      setEnrollError(err.response?.data?.error || 'Failed to delete face profile.');
    }
  };

  // 9. Real-Time Detection and HUD Loop
  const detectLoop = async () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended) {
      return;
    }

    // Ensure the video metadata is fully loaded and playing
    if (videoRef.current.readyState < 2) {
      return;
    }

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const faceapi = window.faceapi;
      if (!faceapi) return;

      const displaySize = { width: video.clientWidth, height: video.clientHeight };
      
      if (displaySize.width > 0 && displaySize.height > 0) {
        faceapi.matchDimensions(canvas, displaySize);

        // Try SSD Mobilenet V1 first (high-precision default)
        let detections = [];
        try {
          detections = await faceapi.detectAllFaces(
            video,
            new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 })
          ).withFaceLandmarks().withFaceDescriptors();
        } catch (e) {
          console.warn('SSD Mobilenet detection failed, falling back to TinyFace:', e.message);
        }

        // Fallback to Tiny Face Detector with loose options if SSD returns nothing
        if (!detections || detections.length === 0) {
          detections = await faceapi.detectAllFaces(
            video,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 })
          ).withFaceLandmarks().withFaceDescriptors();
        }

        // Periodic logging to verify frame processing works
        const now = Date.now();
        if (now - lastLogTimeRef.current > 2000) {
          lastLogTimeRef.current = now;
          console.log(`[Biometric Capture Loop] Active. Canvas size: ${displaySize.width}x${displaySize.height}. Detections found: ${detections ? detections.length : 0}`);
        }

        const resizedDetections = faceapi.resizeResults(detections || [], displaySize);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Render glass overlay with circular lens cutout
        ctx.fillStyle = 'rgba(11, 15, 25, 0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const ringRadius = Math.min(canvas.width, canvas.height) * 0.32;
        const ringX = canvas.width / 2;
        const ringY = canvas.height / 2;

        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(ringX, ringY, ringRadius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        let status = 'Position your face inside the frame';
        let isValid = false;
        let ringColor = 'rgba(99, 102, 241, 0.7)'; // Indigo default

        if (!detections || detections.length === 0) {
          status = 'Position your face inside the frame';
          ringColor = 'rgba(245, 158, 11, 0.7)'; // Warning Amber
        } else if (detections.length > 1) {
          status = 'Only one face should be visible';
          ringColor = 'rgba(239, 68, 68, 0.7)'; // Error Red
        } else {
          const det = resizedDetections[0];
          const box = det.detection.box;

          // Draw futuristic facial landmarks
          faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

          // Calculate center positions
          const faceCenterX = box.x + box.width / 2;
          const faceCenterY = box.y + box.height / 2;

          const deltaX = Math.abs(faceCenterX - ringX);
          const deltaY = Math.abs(faceCenterY - ringY);

          // Loosen constraints to facilitate easy enrollment
          if (deltaX > ringRadius * 0.45 || deltaY > ringRadius * 0.45) {
            status = 'Center your face';
            ringColor = 'rgba(245, 158, 11, 0.7)';
          } else if (box.width < ringRadius * 0.75) {
            status = 'Move closer';
            ringColor = 'rgba(245, 158, 11, 0.7)';
          } else {
            status = 'Face detected';
            isValid = true;
            ringColor = 'rgba(16, 185, 129, 0.9)'; // Success Emerald
          }
        }

        // Draw HUD alignment ring
        ctx.beginPath();
        ctx.arc(ringX, ringY, ringRadius, 0, 2 * Math.PI);
        ctx.lineWidth = 3;
        ctx.strokeStyle = ringColor;
        ctx.stroke();

        // Draw target crosshairs inside alignment ring
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.moveTo(ringX - 15, ringY); ctx.lineTo(ringX + 15, ringY);
        ctx.moveTo(ringX, ringY - 15); ctx.lineTo(ringX, ringY + 15);
        ctx.stroke();

        // Draw feedback bubble overlay
        ctx.font = "bold 14px 'Outfit', sans-serif";
        ctx.textAlign = 'center';
        const displayStatusText = capturingRef.current && isValid 
          ? `Capturing sample ${samplesRef.current.length + 1} of 5...`
          : status;
        const textWidth = ctx.measureText(displayStatusText).width;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(ringX - textWidth / 2 - 14, ringY + ringRadius + 20, textWidth + 28, 32);
        
        ctx.fillStyle = isValid ? '#10b981' : status.includes('visible') ? '#ef4444' : '#ffffff';
        ctx.fillText(displayStatusText, ringX, ringY + ringRadius + 40);

        setCaptureStatus(status);

        if (capturingRef.current && isValid && detections[0] && detections[0].descriptor) {
          handleSampleCapture(detections[0].descriptor);
        }
      }
    } catch (err) {
      console.error('Error running detection frame:', err);
      setLoopError(`Detection Error: ${err.message || err}`);
    }
  };

  useEffect(() => {
    detectLoopRef.current = detectLoop;
  });

  // Start/cancel animation frame loop when camera active state changes
  useEffect(() => {
    let active = true;
    const loop = async () => {
      if (!active) return;
      if (detectLoopRef.current) {
        await detectLoopRef.current();
      }
      if (active && cameraActive) {
        requestRef.current = requestAnimationFrame(loop);
      }
    };

    if (cameraActive) {
      requestRef.current = requestAnimationFrame(loop);
    }

    return () => {
      active = false;
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [cameraActive]);

  // Loading Screens
  if (loading) {
    return <LoadingSpinner message="Accessing student records..." />;
  }

  if (loadingModels) {
    return <LoadingSpinner message="Loading high-precision face recognition models..." />;
  }

  if (loadingModelsError) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <h3 style={{ color: 'var(--accent-error)', marginBottom: '1rem' }}>⚠️ Model Loading Error</h3>
        <p style={{ color: 'var(--text-secondary)' }}>{loadingModelsError}</p>
      </div>
    );
  }

  const selectedUser = users.find(u => u.userId === selectedUserId);

  return (
    <div>
      <p className="page-subtitle">Configure high-precision face recognition templates using the browser camera.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }} className="animate-fade-in">
        
        {/* User Selection Card */}
        <Card title="Select Enrollment Profile" subtitle="Link face template to campus account">
          {debugError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '1rem' }}>
              ⚠️ Debug Load Error: {debugError}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Select User Account</label>
            {users.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No accounts available for enrollment.</p>
            ) : (
              <select 
                className="form-input" 
                value={selectedUserId} 
                onChange={(e) => {
                  setSelectedUserId(e.target.value);
                }}
                disabled={cameraActive}
              >
                {users.map(u => (
                  <option key={u.userId} value={u.userId}>
                    {u.name} ({u.role} - {u.studentId || u.employeeId || 'No ID'})
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedUser && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              padding: '1.25rem',
              borderRadius: '12px',
              marginTop: '1.5rem'
            }}>
              <h4 style={{ color: 'white', fontWeight: 600, marginBottom: '0.75rem' }}>Profile Summary</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                📧 Email: {selectedUser.email}<br />
                🏢 Department: {selectedUser.department}<br />
                {selectedUser.role === 'STUDENT' ? (
                  <>
                    🎓 Course: {selectedUser.course} | Year: {selectedUser.year}<br />
                    📦 Batch: {selectedUser.batch}
                  </>
                ) : (
                  <>💼 Designation: {selectedUser.designation || 'Staff Member'}</>
                )}
              </p>
              
              <div style={{
                marginTop: '1.25rem',
                paddingTop: '1rem',
                borderTop: '1px solid rgba(255,255,255,0.05)'
              }}>
                <h5 style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Enrollment Status
                </h5>
                {loadingProfile ? (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Checking registration database...</span>
                ) : enrolledProfile ? (
                  <div>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      fontSize: '0.75rem',
                      background: 'rgba(16, 185, 129, 0.1)',
                      color: 'var(--accent-success)',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontWeight: 600,
                      marginBottom: '0.5rem'
                    }}>
                      🛡️ Biometric Registered
                    </span>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Enrolled: {new Date(enrolledProfile.createdAt).toLocaleDateString()}<br />
                      Last Updated: {new Date(enrolledProfile.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    fontSize: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-secondary)',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontWeight: 600
                  }}>
                    📷 Registration Required
                  </span>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Biometrics Camera Card */}
        <Card title="Face Template Registration" subtitle="Browser camera biometric capture gateway">
          {enrollError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '1rem' }}>
              ⚠️ {enrollError}
            </div>
          )}
          {loopError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '1rem' }}>
              ⚠️ {loopError}
            </div>
          )}
          {enrollSuccess && (
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#34d399', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '1rem' }}>
              ✅ {enrollSuccess}
            </div>
          )}

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
            border: '1px solid var(--card-border)'
          }}>
            {cameraActive ? (
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
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                {enrolledProfile ? (
                  <>
                    <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🛡️</div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                      High-precision facial template is already active.
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button className="btn btn-secondary" onClick={startCamera}>
                        Re-enroll
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        onClick={handleResetEnrollment}
                        style={{ border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171' }}
                      >
                        Reset Template
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📷</div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                      Webcam access is required to capture biometrics.
                    </p>
                    <button className="btn btn-primary" onClick={startCamera}>
                      Start Camera
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Progress / Capture Guidance HUD */}
          {cameraActive && (
            <div style={{ marginTop: '1.5rem' }}>
              {capturing ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    <span>Biometric Collection: Keep Center</span>
                    <span>{captureProgress}%</span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '6px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${captureProgress}%`,
                      height: '100%',
                      background: 'var(--accent-success)',
                      boxShadow: 'var(--shadow-success-neon)',
                      transition: 'width 0.2s ease-out'
                    }}></div>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '0.8rem',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  textAlign: 'center'
                }}>
                  📋 {captureStatus}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            {cameraActive && (
              <>
                <button className="btn btn-secondary" onClick={stopCamera}>
                  Stop Camera
                </button>
                {!capturing && (
                  <button 
                    className="btn btn-primary" 
                    onClick={() => setCapturing(true)} 
                    style={{ flex: 1 }}
                    disabled={!selectedUserId || !streamLoaded}
                  >
                    Start Capture
                  </button>
                )}
              </>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
};

export default FaceEnrollment;
