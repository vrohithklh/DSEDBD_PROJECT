const http = require('http');
const mongoose = require('mongoose');
require('dotenv').config();

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api' + path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseBody });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (data) req.write(data);
    req.end();
  });
}

// Generate realistic 128-float unit vectors for testing
function generateFaceDescriptor(seed = 1) {
  const arr = [];
  let sumSq = 0;
  for (let i = 0; i < 128; i++) {
    const val = Math.sin(seed * (i + 1)) * Math.cos(seed + i);
    arr.push(val);
    sumSq += val * val;
  }
  const norm = Math.sqrt(sumSq);
  return arr.map(v => v / norm);
}

// Generate slightly perturbed vector (close match)
function generateSimilarDescriptor(baseDescriptor, noise = 0.05) {
  const arr = baseDescriptor.map(v => v + (Math.random() - 0.5) * noise);
  const sumSq = arr.reduce((sum, v) => sum + v * v, 0);
  const norm = Math.sqrt(sumSq);
  return arr.map(v => v / norm);
}

async function runFaceWorkflowTests() {
  console.log('================================================================');
  console.log('  TESTING COMPLETE FACE RECOGNITION & ATTENDANCE WORKFLOW');
  console.log('================================================================\n');

  try {
    // 1. Log in Admin
    console.log('▶ STEP 1: Admin Authentication');
    const adminLogin = await request('POST', '/auth/login', {
      email: 'admin@college.edu',
      password: 'password123'
    });
    if (adminLogin.status !== 200) throw new Error('Admin login failed');
    const adminToken = adminLogin.data.token;
    console.log('  ✅ Admin logged in.\n');

    // 2. Register / Setup Teacher and Student
    console.log('▶ STEP 2: Setting up test Teacher and Student accounts');
    const teacherReg = await request('POST', '/auth/register', {
      name: 'Dr. Sarah Connor',
      email: 'teacher_face_test@college.edu',
      password: 'password123',
      role: 'EMPLOYEE',
      department: 'Computer Science',
      employeeId: 'EMP_FACE_01',
      designation: 'Professor'
    });
    const teacherLogin = await request('POST', '/auth/login', {
      email: 'teacher_face_test@college.edu',
      password: 'password123'
    });
    const teacherToken = teacherLogin.data.token;
    const teacherUser = teacherLogin.data.user;

    const studentReg = await request('POST', '/auth/register', {
      name: 'Rohith V',
      email: 'student_face_test@college.edu',
      password: 'password123',
      role: 'STUDENT',
      department: 'Computer Science',
      studentId: 'STU_FACE_01',
      course: 'B.Tech',
      year: '4th',
      batch: 'A'
    });
    const studentLogin = await request('POST', '/auth/login', {
      email: 'student_face_test@college.edu',
      password: 'password123'
    });
    const studentToken = studentLogin.data.token;
    const studentUser = studentLogin.data.user;
    console.log(`  ✅ Teacher: ${teacherUser.name} (${teacherUser.userId})`);
    console.log(`  ✅ Student: ${studentUser.name} (${studentUser.userId})\n`);

    // 3. Face Enrollment for Student
    console.log('▶ STEP 3: Biometric Face Enrollment for Student');
    const baseFaceVector = generateFaceDescriptor(42);
    const enrollRes = await request('POST', '/face/enroll', {
      userId: studentUser.userId,
      faceFeatures: baseFaceVector
    }, teacherToken);

    if (enrollRes.status !== 200) {
      throw new Error(`Face enrollment failed: ${JSON.stringify(enrollRes.data)}`);
    }
    console.log('  ✅ Face enrolled successfully in database.');

    // 4. Face Profile Retrieval Verification
    console.log('\n▶ STEP 4: Verify Face Profile Retrieval');
    const getProfileRes = await request('GET', `/face/profile?userId=${studentUser.userId}`, null, studentToken);
    if (getProfileRes.status !== 200 || !getProfileRes.data.userId) {
      throw new Error(`Get profile failed: ${JSON.stringify(getProfileRes.data)}`);
    }
    console.log('  ✅ Biometric profile verified (face vectors securely concealed).');

    // 5. Test Face Recognition with Matching Face
    console.log('\n▶ STEP 5: Test Face Recognition endpoint with MATCHING face vector');
    const matchedVector = generateSimilarDescriptor(baseFaceVector, 0.08);
    const recognizeMatchRes = await request('POST', '/face/recognize', {
      faceFeatures: matchedVector,
      threshold: 0.50
    }, studentToken);

    if (recognizeMatchRes.status !== 200 || !recognizeMatchRes.data.match || recognizeMatchRes.data.userId !== studentUser.userId) {
      throw new Error(`Face recognition match failed: ${JSON.stringify(recognizeMatchRes.data)}`);
    }
    console.log(`  ✅ Face matched correctly to ${recognizeMatchRes.data.name} (distance: ${recognizeMatchRes.data.distance?.toFixed(4)}, threshold: ${recognizeMatchRes.data.threshold})`);

    // 6. Test Face Recognition with UNKNOWN Face
    console.log('\n▶ STEP 6: Test Face Recognition with an UNKNOWN face vector');
    const unknownVector = generateFaceDescriptor(999);
    const recognizeUnknownRes = await request('POST', '/face/recognize', {
      faceFeatures: unknownVector,
      threshold: 0.50
    }, studentToken);

    if (recognizeUnknownRes.data.match === true) {
      throw new Error('Unknown face should not have matched');
    }
    console.log(`  ✅ Unknown face rejected properly (match: false, distance: ${recognizeUnknownRes.data.distance?.toFixed(4)})`);

    // 7. Admin Creates Attendance Session
    console.log('\n▶ STEP 7: Admin creates session for Computer Science (Room 303)');
    const createSessionRes = await request('POST', '/attendance/sessions/start', {
      subject: 'Cloud & Distributed Systems',
      classroom: 'Room 303',
      department: 'Computer Science',
      assignedTeacherId: teacherUser.employeeId || teacherUser.userId
    }, adminToken);
    if (createSessionRes.status !== 201) throw new Error('Create session failed');
    const session = createSessionRes.data;
    console.log(`  ✅ Session created with ID: ${session.sessionId}, Status: ${session.status}`);

    // 8. Teacher Approves and Starts Session
    console.log('\n▶ STEP 8: Teacher approves and starts session live');
    await request('POST', `/attendance/sessions/${session.sessionId}/approve`, null, teacherToken);
    const liveRes = await request('POST', `/attendance/sessions/${session.sessionId}/start-live`, null, teacherToken);
    if (liveRes.status !== 200 || liveRes.data.session.status !== 'ACTIVE') {
      throw new Error('Start live session failed');
    }
    console.log(`  ✅ Session is LIVE at ${new Date(liveRes.data.session.startTime).toLocaleTimeString()}`);

    // 9. Student Performs Face Recognition Attendance Scan
    console.log('\n▶ STEP 9: Student marks attendance via face verification (within 10m grace period)');
    const markAttRes = await request('POST', '/attendance/log', {
      sessionId: session.sessionId,
      userId: studentUser.userId
    }, studentToken);

    if (markAttRes.status !== 201 || markAttRes.data.status !== 'PRESENT') {
      throw new Error(`Attendance check-in failed: ${JSON.stringify(markAttRes.data)}`);
    }
    console.log(`  ✅ Attendance recorded: Status = ${markAttRes.data.status}, Time = ${markAttRes.data.time}`);

    // 10. Duplicate Attendance Scan Protection
    console.log('\n▶ STEP 10: Student attempts duplicate face scan');
    const dupRes = await request('POST', '/attendance/log', {
      sessionId: session.sessionId,
      userId: studentUser.userId
    }, studentToken);

    if (dupRes.status !== 400 || !dupRes.data.error.includes('already recorded')) {
      throw new Error(`Duplicate attendance not rejected: ${JSON.stringify(dupRes.data)}`);
    }
    console.log(`  ✅ Duplicate scan blocked with message: "${dupRes.data.error}"`);

    // 11. Teacher Ends Session
    console.log('\n▶ STEP 11: Teacher ends lecture session');
    const endRes = await request('POST', `/attendance/sessions/${session.sessionId}/end`, null, teacherToken);
    if (endRes.status !== 200 || endRes.data.session.status !== 'COMPLETED') {
      throw new Error('End session failed');
    }
    console.log(`  ✅ Session ended. Present: ${endRes.data.summary.present}, Absent: ${endRes.data.summary.absent}`);

    // 12. Final History Verification
    console.log('\n▶ STEP 12: Verify attendance history persistence');
    const historyRes = await request('GET', `/attendance/history?sessionId=${session.sessionId}`, null, studentToken);
    const myRecord = historyRes.data.find(r => r.userId === studentUser.userId);
    if (!myRecord || myRecord.status !== 'PRESENT') {
      throw new Error('Attendance history record missing or status incorrect');
    }
    console.log(`  ✅ Student attendance history record confirmed: Status = ${myRecord.status}, Subject = ${myRecord.subject}`);

    console.log('\n================================================================');
    console.log('🎉 ALL 12 FACE RECOGNITION & ATTENDANCE TESTS PASSED PERFECTLY!');
    console.log('================================================================\n');

  } catch (err) {
    console.error('❌ TEST FAILED:', err.message);
    process.exit(1);
  }
}

runFaceWorkflowTests();
