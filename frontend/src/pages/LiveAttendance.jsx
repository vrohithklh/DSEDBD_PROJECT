import React, { useState, useEffect, useRef } from 'react';
import { faceAPI, attendanceAPI } from '../services/api';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';

const LiveAttendance = () => {
  // Configurable similarity threshold (default is 0.50, range 0.30 - 0.70)
  const [threshold, setThreshold] = useState(0.50);

  // Active terminal sessions (stored to preserve context, though we don't log attendance in Phase 8)
  const [activeSessions, setActiveSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingModelsError, setLoadingModelsError] = useState('');

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');

  // Recognition / match state
  const [detectionsCount, setDetectionsCount] = useState(0);
  const [matchResult, setMatchResult] = useState(null);
  const [recognizing, setRecognizing] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState(null); // null, 'SUCCESS', 'ALREADY_RECORDED', 'FAILED'

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const requestRef = useRef(null);
  const detectLoopRef = useRef();
  const lastLogTimeRef = useRef(0);

  const thresholdRef = useRef(threshold);
  const recognizingRef = useRef(false);
  const lastRecognizeTimeRef = useRef(0);

  // Sync state with refs for safe access inside animation frame loop
  useEffect(() => {
    thresholdRef.current = threshold;
  }, [threshold]);

  useEffect(() => {
    recognizingRef.current = recognizing;
  }, [recognizing]);

  // 1. Fetch active sessions on mount
  useEffect(() => {
    const initData = async () => {
      try {
        const sessionsRes = await attendanceAPI.getActiveSessions();
        setActiveSessions(sessionsRes.data);
        if (sessionsRes.data.length > 0) {
          setSelectedSessionId(sessionsRes.data[0].sessionId);
        }
      } catch (error) {
        console.error('Failed to load active sessions:', error);
      } finally {
        setLoading(false);
      }
    };
    initData();

    return () => {
      stopCamera();
    };
  }, []);

  // Reset matched scan state when active session changes
  useEffect(() => {
    setMatchResult(null);
    setDetectionsCount(0);
    setAttendanceStatus(null);
  }, [selectedSessionId]);

  // Autostart camera stream when models are ready and an active session exists
  useEffect(() => {
    if (modelsLoaded && activeSessions.length > 0 && !cameraActive && !cameraError) {
      console.log('LiveAttendance: Models loaded & active session found. Auto-starting camera...');
      startCamera();
    }
  }, [modelsLoaded, activeSessions]);

  // 2. Load face-api models from CDN
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        await Promise.all([
          window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          window.faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL).catch(() => {})
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error('Failed to load face-api models:', err);
        setLoadingModelsError('Failed to load face recognition neural networks. Please reload the page.');
      } finally {
        setLoadingModels(false);
      }
    };

    // Wait for the global faceapi script to load
    const checkAndLoad = setInterval(() => {
      if (window.faceapi) {
        clearInterval(checkAndLoad);
        loadModels();
      }
    }, 100);

    return () => clearInterval(checkAndLoad);
  }, []);

  // Safely assign stream to video element when camera active state changes and video element mounts
  useEffect(() => {
    let active = true;
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play()
        .then(() => {
          if (active) {
            console.log('LiveAttendance: Camera stream playing successfully.');
          }
        })
        .catch(err => {
          if (active) {
            console.error('LiveAttendance: Error playing video stream:', err);
            setCameraError(`Failed to start video playback (${err.name}): ${err.message}`);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [cameraActive, videoRef.current]);

  // 3. Start Camera Stream
  const startCamera = async () => {
    setCameraError('');
    setMatchResult(null);
    setDetectionsCount(0);
    setAttendanceStatus(null);
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Browser API error: navigator.mediaDevices.getUserMedia is not supported/available in this browser.');
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
      console.error('Camera access failed:', err);
      setCameraError(`Camera connection failed (${err.name}): ${err.message}`);
      setCameraActive(false);
    }
  };

  // 4. Stop Camera Stream
  const stopCamera = () => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    
    // Stop all tracks from the ref stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('LiveAttendance: Stopped track:', track.label);
      });
      streamRef.current = null;
    }

    // Fallback: Stop tracks from video element directly and clear srcObject
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      if (stream.getTracks) {
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('LiveAttendance: Stopped video element track:', track.label);
        });
      }
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
    setMatchResult(null);
    setDetectionsCount(0);
    setAttendanceStatus(null);
  };

  // 5. Trigger Backend Biometric Recognition & Save Attendance
  const triggerServerRecognition = async (descriptor) => {
    setRecognizing(true);
    setAttendanceStatus(null);
    try {
      const res = await faceAPI.recognize(Array.from(descriptor), thresholdRef.current);
      setMatchResult(res.data);

      if (res.data && res.data.match && selectedSessionId) {
        try {
          const attRes = await attendanceAPI.logAttendance({
            sessionId: selectedSessionId,
            userId: res.data.userId
          });
          setAttendanceStatus('SUCCESS');
        } catch (err) {
          if (err.response && err.response.status === 400 && err.response.data?.error?.includes('already recorded')) {
            setAttendanceStatus('ALREADY_RECORDED');
          } else if (err.response && err.response.status === 400 && err.response.data?.error?.includes('ended')) {
            setAttendanceStatus('ENDED');
            stopCamera();
          } else {
            setAttendanceStatus('FAILED');
            console.error('Failed to log attendance:', err.response?.data?.error || err.message);
          }
        }
      }
    } catch (error) {
      console.error('Biometric comparison API failed:', error);
      setMatchResult(null);
    } finally {
      setRecognizing(false);
    }
  };

  // 6. Real-Time Detection HUD and Comparison Loop
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
          console.warn('LiveAttendance: SSD Mobilenet detection failed, falling back to TinyFace:', e.message);
        }

        // Fallback to Tiny Face Detector if SSD returns nothing
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
          console.log(`[Live Attendance Loop] Active. Canvas size: ${displaySize.width}x${displaySize.height}. Detections found: ${detections ? detections.length : 0}`);
        }

        const resizedDetections = faceapi.resizeResults(detections || [], displaySize);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Update counts to render status messages
        setDetectionsCount(detections ? detections.length : 0);

        if (!detections || detections.length === 0) {
          // Reset match result when face leaves frame
          setMatchResult(null);
          setAttendanceStatus(null);
        }

        // Draw HUD alignment elements for each face
        resizedDetections.forEach((det) => {
          const box = det.detection.box;
          
          let boxColor = '#f59e0b'; // orange warning by default
          let label = 'Scanning...';

          if (detections.length > 1) {
            boxColor = '#ef4444'; // red for multiple
            label = 'Multiple Faces';
          } else if (matchResult) {
            boxColor = matchResult.match ? '#10b981' : '#ef4444';
            label = matchResult.match ? matchResult.name : 'Unknown Face';
          }

          // Draw bounding box
          const drawBox = new faceapi.draw.DrawBox(box, { label, boxColor, lineWidth: 2 });
          drawBox.draw(canvas);

          // Draw landmarks
          faceapi.draw.drawFaceLandmarks(canvas, det);
        });

        // Trigger throttled server recognition for single valid face
        if (detections && detections.length === 1 && !recognizingRef.current && detections[0] && detections[0].descriptor) {
          // Rate-limit request to server every 800ms
          if (now - lastRecognizeTimeRef.current > 800) {
            lastRecognizeTimeRef.current = now;
            triggerServerRecognition(detections[0].descriptor);
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
  }, [cameraActive, matchResult]); // Include matchResult to draw state changes

  // Loading Screens
  if (loading) {
    return <LoadingSpinner message="Opening biometric terminals..." />;
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

  return (
    <div>
      <p className="page-subtitle">Real-time classroom recognition kiosk. Stand in front of the camera to match accounts.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }} className="animate-fade-in">
        
        {/* Terminal Configuration Card */}
        <Card title="Terminal Control Setup" subtitle="Configuring gateway matching factors">
          <div className="form-group">
            <label className="form-label">Active Attendance Session</label>
            {activeSessions.length === 0 ? (
              <p style={{ color: 'var(--accent-warning)', fontSize: '0.85rem' }}>
                ⚠️ No active sessions on campus. Go to the Admin Dashboard to start a session first.
              </p>
            ) : (
              <select 
                className="form-input" 
                value={selectedSessionId} 
                onChange={(e) => setSelectedSessionId(e.target.value)}
                disabled={cameraActive}
              >
                {activeSessions.map(s => (
                  <option key={s.sessionId} value={s.sessionId}>
                    {s.subject} ({s.classroom} - {s.department})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Configurable Threshold Slider */}
          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              <span>Similarity Threshold</span>
              <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{threshold.toFixed(2)}</span>
            </div>
            <input 
              type="range" 
              min="0.30" 
              max="0.70" 
              step="0.05" 
              className="form-input" 
              value={threshold} 
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              style={{ padding: '0.25rem', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              <span>Strict (0.30)</span>
              <span>Balanced (0.50)</span>
              <span>Permissive (0.70)</span>
            </div>
          </div>
        </Card>

        {/* Live Video Kiosk Feed */}
        <Card title="Live Scanner Kiosk Feed" subtitle="Real-time camera detection overlays">
          {cameraError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '1rem' }}>
              ⚠️ {cameraError}
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
                <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎥</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  Kiosk camera is offline. Activate stream to begin scanning.
                </p>
                <button className="btn btn-primary" onClick={startCamera}>
                  Activate Camera Stream
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            {cameraActive && (
              <button className="btn btn-secondary" onClick={stopCamera} style={{ width: '100%' }}>
                Disable Camera Feed
              </button>
            )}
          </div>
        </Card>

        {/* Match Verification Display Panel */}
        <Card title="Identification Result" subtitle="Visual matching output details">
          {detectionsCount > 1 ? (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#f87171',
              padding: '1.5rem',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <div style={{ fontWeight: 800, fontSize: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                MULTIPLE FACES DETECTED
              </div>
              <p style={{ fontSize: '0.85rem', color: '#f87171', marginTop: '0.5rem' }}>
                Only one person should be visible in front of the scanner.
              </p>
            </div>
          ) : detectionsCount === 0 ? (
            <div style={{
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px dashed rgba(255, 255, 255, 0.08)',
              color: 'var(--text-muted)',
              padding: '2rem',
              borderRadius: '12px',
              textAlign: 'center',
              fontSize: '0.9rem'
            }}>
              📷 Waiting for face entry...
            </div>
          ) : matchResult ? (
            matchResult.match ? (
              <div style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.20)',
                color: '#34d399',
                padding: '1.5rem',
                borderRadius: '12px'
              }}>
                <div style={{ 
                  fontWeight: 900, 
                  fontSize: '1.5rem', 
                  marginBottom: '1rem', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.08em',
                  borderBottom: '1px solid rgba(16, 185, 129, 0.15)',
                  paddingBottom: '0.5rem'
                }}>
                  MATCHED
                </div>
                <p style={{ fontSize: '1.05rem', color: 'var(--text-primary)', margin: '0.4rem 0' }}>
                  <strong style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.1rem' }}>Name</strong> 
                  {matchResult.name}
                </p>
                <p style={{ fontSize: '1.05rem', color: 'var(--text-primary)', margin: '0.4rem 0' }}>
                  <strong style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.1rem' }}>Role</strong> 
                  {matchResult.role || 'STUDENT'}
                </p>
                <p style={{ fontSize: '1.05rem', color: 'var(--text-primary)', margin: '0.4rem 0' }}>
                  <strong style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.1rem' }}>Student/Employee ID</strong> 
                  {matchResult.studentId || matchResult.employeeId || 'No ID registered'}
                </p>

                {attendanceStatus === 'SUCCESS' && (
                  <div style={{ marginTop: '1rem', padding: '0.5rem', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '6px', color: '#10b981', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>
                    ✓ Detected / Checked in
                  </div>
                )}
                {attendanceStatus === 'ALREADY_RECORDED' && (
                  <div style={{ marginTop: '1rem', padding: '0.5rem', background: 'rgba(245, 158, 11, 0.15)', borderRadius: '6px', color: '#fbbf24', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>
                    ℹ Attendance already marked for this session
                  </div>
                )}
                {attendanceStatus === 'ENDED' && (
                  <div style={{ marginTop: '1rem', padding: '0.5rem', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '6px', color: '#f87171', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>
                    ✗ Attendance session has ended.
                  </div>
                )}
                {attendanceStatus === 'FAILED' && (
                  <div style={{ marginTop: '1rem', padding: '0.5rem', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '6px', color: '#f87171', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>
                    ✗ Failed to log attendance
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1.25rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>Distance: {matchResult.distance?.toFixed(3)}</span>
                  <span>Threshold: {matchResult.threshold?.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <div style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.20)',
                color: '#fbbf24',
                padding: '1.5rem',
                borderRadius: '12px',
                textAlign: 'center'
              }}>
                <div style={{ fontWeight: 900, fontSize: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                  UNKNOWN FACE
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  This face does not match any enrolled biometrics under the current threshold.
                </p>
                {matchResult.distance !== null && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
                    Closest Distance: {matchResult.distance?.toFixed(3)} (Threshold: {matchResult.threshold?.toFixed(2)})
                  </div>
                )}
              </div>
            )
          ) : (
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              color: 'var(--text-secondary)',
              padding: '2rem',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <div style={{
                display: 'inline-block',
                width: '24px',
                height: '24px',
                border: '2px solid rgba(255, 255, 255, 0.1)',
                borderTopColor: 'var(--accent-primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '1rem'
              }}></div>
              <div style={{ fontWeight: 600, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Face detected
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Extracting biometrics...
              </p>
            </div>
          )}
        </Card>

      </div>
    </div>
  );
};

export default LiveAttendance;
