const http = require('http');
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const post = (url, body, token) => {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(raw) });
        } catch(e) {
          resolve({ statusCode: res.statusCode, data: raw });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

const get = (url, token) => {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'GET',
      headers
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(raw) });
        } catch(e) {
          resolve({ statusCode: res.statusCode, data: raw });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
};

// Database clean-up and seeding
async function setupDb() {
  const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_attendance';
  console.log('🌱 Connecting to database for setup...');
  try {
    await mongoose.connect(dbUri, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;

    // Delete users with test emails
    await db.collection('users').deleteMany({
      email: { $in: ['student_a@college.edu', 'student_b@college.edu', 'student_c@college.edu'] }
    });
    await db.collection('users').deleteMany({
      studentId: { $in: ['STU_A', 'STU_B', 'STU_C'] }
    });

    // Seed test students
    const hashedPwd = await bcrypt.hash('password123', 10);
    
    // Student A (CS)
    const studentA = {
      userId: 'student-a-uuid',
      name: 'Student A',
      email: 'student_a@college.edu',
      password: hashedPwd,
      role: 'STUDENT',
      studentId: 'STU_A',
      department: 'Computer Science',
      status: 'ACTIVE',
      createdAt: Date.now()
    };
    // Student B (CS)
    const studentB = {
      userId: 'student-b-uuid',
      name: 'Student B',
      email: 'student_b@college.edu',
      password: hashedPwd,
      role: 'STUDENT',
      studentId: 'STU_B',
      department: 'Computer Science',
      status: 'ACTIVE',
      createdAt: Date.now()
    };
    // Student C (Electronics - different department)
    const studentC = {
      userId: 'student-c-uuid',
      name: 'Student C',
      email: 'student_c@college.edu',
      password: hashedPwd,
      role: 'STUDENT',
      studentId: 'STU_C',
      department: 'Electronics',
      status: 'ACTIVE',
      createdAt: Date.now()
    };

    await db.collection('users').insertMany([studentA, studentB, studentC]);
    console.log('👥 Inserted clean test users (Student A, Student B, Student C).');

    // Clean up face profiles for our test students
    await db.collection('faceprofiles').deleteMany({
      userId: { $in: ['student-a-uuid', 'student-b-uuid', 'student-c-uuid'] }
    });
    console.log('🧹 Cleaned up old face profiles.');

    // Clean up old attendance sessions and records
    await db.collection('attendancesessions').deleteMany({
      $or: [
        { subject: { $in: ['Data Structures Integration Test', 'Operating Systems Integration Test'] } },
        { classroom: { $in: ['Room 101', 'Room 102'] } }
      ]
    });
    await db.collection('attendances').deleteMany({
      subject: { $in: ['Data Structures Integration Test', 'Operating Systems Integration Test'] }
    });
    console.log('🧹 Cleaned up old attendance records.');

  } catch (err) {
    console.error('❌ Database setup failed:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

async function run() {
  await setupDb();

  console.log('\n🚀 Starting ERP Smart Attendance Verification Tests...');

  try {
    // 1. Login as admin
    const login = await post('http://localhost:5000/api/auth/login', {
      email: 'admin@college.edu',
      password: 'password123'
    });
    if (login.statusCode !== 200) {
      throw new Error('Admin Authentication failed: ' + JSON.stringify(login.data));
    }
    const token = login.data.token;
    console.log('🔐 Admin login: SUCCESS');

    // Helper face feature arrays
    const faceFeaturesA = new Array(128).fill(0.1);
    const faceFeaturesDuplicate = new Array(128).fill(0.1); // distance = 0
    const faceFeaturesSimilar = new Array(128).fill(0.1); 
    faceFeaturesSimilar[0] = 0.105; // distance < 0.40
    const faceFeaturesDifferent = new Array(128).fill(0.8); // distance > 0.40

    // 2. Enroll Student A face
    console.log('\n--- Test Case: Enroll Student A ---');
    const enrollA = await post('http://localhost:5000/api/face/enroll', {
      userId: 'student-a-uuid',
      faceFeatures: faceFeaturesA
    }, token);
    console.log('✅ Enroll Student A:', enrollA.statusCode === 200 ? 'SUCCESS' : 'FAIL');
    console.log('   Response message:', enrollA.data.message);
    console.log('   Response contains faceFeatures (should be undefined):', enrollA.data.profile?.faceFeatures);
    if (enrollA.data.profile?.faceFeatures !== undefined) {
      throw new Error('Security breach: faceFeatures exposed in enrollFace response!');
    }

    // Check getProfile security as well
    const profileA = await get('http://localhost:5000/api/face/profile?userId=student-a-uuid', token);
    console.log('✅ getProfile field stripping check:', profileA.statusCode === 200 ? 'SUCCESS' : 'FAIL');
    console.log('   Profile response faceFeatures (should be undefined):', profileA.data.faceFeatures);
    if (profileA.data.faceFeatures !== undefined) {
      throw new Error('Security breach: faceFeatures exposed in getProfile response!');
    }

    // 3. Try to enroll exact duplicate face for Student B
    console.log('\n--- Test Case: Prevent Exact Duplicate Enrollment (Student B) ---');
    const enrollB1 = await post('http://localhost:5000/api/face/enroll', {
      userId: 'student-b-uuid',
      faceFeatures: faceFeaturesDuplicate
    }, token);
    console.log('✅ Block exact duplicate:', enrollB1.statusCode === 400 ? 'SUCCESS' : 'FAIL');
    console.log('   Error returned:', enrollB1.data.error);
    if (!enrollB1.data.error || !enrollB1.data.error.includes('already registered')) {
      throw new Error('Failed to block duplicate enrollment!');
    }

    // 4. Try to enroll similar face for Student B
    console.log('\n--- Test Case: Prevent Similar Face Enrollment (Student B) ---');
    const enrollB2 = await post('http://localhost:5000/api/face/enroll', {
      userId: 'student-b-uuid',
      faceFeatures: faceFeaturesSimilar
    }, token);
    console.log('✅ Block similar face:', enrollB2.statusCode === 400 ? 'SUCCESS' : 'FAIL');
    console.log('   Error returned:', enrollB2.data.error);

    // 5. Enroll different face for Student B (should succeed)
    console.log('\n--- Test Case: Enroll Different Face for Student B ---');
    const enrollB3 = await post('http://localhost:5000/api/face/enroll', {
      userId: 'student-b-uuid',
      faceFeatures: faceFeaturesDifferent
    }, token);
    console.log('✅ Enroll Student B with different face:', enrollB3.statusCode === 200 ? 'SUCCESS' : 'FAIL');

    // 6. Re-enroll Student A (same user, should succeed)
    console.log('\n--- Test Case: Re-enroll / Update Face for Student A ---');
    const reenrollA = await post('http://localhost:5000/api/face/enroll', {
      userId: 'student-a-uuid',
      faceFeatures: faceFeaturesSimilar // slightly updated vector
    }, token);
    console.log('✅ Student A re-enrollment:', reenrollA.statusCode === 200 ? 'SUCCESS' : 'FAIL');

    // 7. Start Attendance Session (Computer Science)
    console.log('\n--- Test Case: Start Attendance Session ---');
    const startSess = await post('http://localhost:5000/api/attendance/sessions/start', {
      subject: 'Data Structures Integration Test',
      classroom: 'Room 102',
      department: 'Computer Science'
    }, token);
    console.log('✅ Start Session:', startSess.statusCode === 201 ? 'SUCCESS' : 'FAIL');
    const sessionId = startSess.data.sessionId;
    console.log('   Session ID:', sessionId);
    console.log('   Session Status:', startSess.data.status);

    // Verify sessions endpoint returns ACTIVE session
    const activeSessionsList = await get('http://localhost:5000/api/attendance/sessions', token);
    console.log('✅ getSessions list retrieve:', activeSessionsList.statusCode === 200 ? 'SUCCESS' : 'FAIL');
    const matchingSession = activeSessionsList.data.find(s => s.sessionId === sessionId);
    console.log('   Found session status (expected: ACTIVE):', matchingSession ? matchingSession.status : 'NOT FOUND');
    if (!matchingSession || matchingSession.status !== 'ACTIVE') {
      throw new Error('/api/attendance/sessions failed to return ACTIVE session!');
    }

    // TEST CASE A: Start a new session -> no ABSENT/PRESENT records created.
    console.log('\n--- Test Case A: No Attendance Records Created on Session Start ---');
    const historyCheck = await get(`http://localhost:5000/api/attendance/history?sessionId=${sessionId}`, token);
    console.log('✅ History is empty for active session:', historyCheck.data.length === 0 ? 'SUCCESS' : 'FAIL');
    if (historyCheck.data.length > 0) {
      throw new Error('Attendance records were prematurely created for active session!');
    }

    // Test: Starting another active session in Room 102 (different subject) -> rejected
    console.log('\n--- Test Case: Block Classroom Conflict (Room 102 occupied) ---');
    const startSessOccupied = await post('http://localhost:5000/api/attendance/sessions/start', {
      subject: 'Operating Systems Integration Test',
      classroom: 'Room 102',
      department: 'Computer Science'
    }, token);
    console.log('✅ Block duplicate active classroom session:', startSessOccupied.statusCode === 400 ? 'SUCCESS' : 'FAIL');
    console.log('   Error message:', startSessOccupied.data.error);
    if (!startSessOccupied.data.error || !startSessOccupied.data.error.includes('classroom already has an active')) {
      throw new Error('Failed to block classroom conflict!');
    }

    // Test: Starting different classroom (Room 101) -> allowed while Room 102 is active
    console.log('\n--- Test Case: Start Independent Session in Room 101 (Allowed) ---');
    const startSessDiff = await post('http://localhost:5000/api/attendance/sessions/start', {
      subject: 'Operating Systems Integration Test',
      classroom: 'Room 101',
      department: 'Computer Science'
    }, token);
    console.log('✅ Start independent session in Room 101:', startSessDiff.statusCode === 201 ? 'SUCCESS' : 'FAIL');
    if (startSessDiff.statusCode === 201) {
      // Clean it up immediately by ending it so we don't pollute future runs
      await post(`http://localhost:5000/api/attendance/sessions/${startSessDiff.data.sessionId}/end`, {}, token);
    }

    // 8. Log check-in for Student A (CS - matches department)
    console.log('\n--- Test Case: Check-in Student A (CS) ---');
    const checkinA1 = await post('http://localhost:5000/api/attendance/log', {
      sessionId,
      userId: 'student-a-uuid'
    }, token);
    console.log('✅ Student A Check-in:', checkinA1.statusCode === 201 ? 'SUCCESS' : 'FAIL');
    console.log('   Response message:', checkinA1.data.message);
    if (checkinA1.data.message !== 'Detected / Checked in') {
      throw new Error('Unexpected checkin status message: ' + checkinA1.data.message);
    }

    // TEST CASE C: Student scans -> remains pending, no PRESENT/ABSENT finalized records created yet.
    console.log('\n--- Test Case C: No finalized records created on scan ---');
    const historyCheck2 = await get(`http://localhost:5000/api/attendance/history?sessionId=${sessionId}`, token);
    console.log('✅ History remains empty after scan:', historyCheck2.data.length === 0 ? 'SUCCESS' : 'FAIL');
    if (historyCheck2.data.length > 0) {
      throw new Error('Finalized attendance records were prematurely created on student scan!');
    }

    // 9. Log duplicate check-in for Student A
    console.log('\n--- Test Case: Prevent Duplicate Check-in ---');
    const checkinA2 = await post('http://localhost:5000/api/attendance/log', {
      sessionId,
      userId: 'student-a-uuid'
    }, token);
    console.log('✅ Block duplicate check-in:', checkinA2.statusCode === 400 ? 'SUCCESS' : 'FAIL');
    console.log('   Error returned:', checkinA2.data.error);

    // 10. Log check-in for Student C (Electronics - mismatch department)
    console.log('\n--- Test Case: Verify Department Mismatch Verification ---');
    const checkinC = await post('http://localhost:5000/api/attendance/log', {
      sessionId,
      userId: 'student-c-uuid'
    }, token);
    console.log('✅ Block department mismatch check-in:', checkinC.statusCode === 400 ? 'SUCCESS' : 'FAIL');
    console.log('   Error returned:', checkinC.data.error);

    // 11. End Session
    console.log('\n--- Test Case: End Session and Finalize Attendance ---');
    const endSess = await post(`http://localhost:5000/api/attendance/sessions/${sessionId}/end`, {}, token);
    console.log('✅ End Session:', endSess.statusCode === 200 ? 'SUCCESS' : 'FAIL');
    console.log('   Session status now:', endSess.data.session?.status);

    // Verify sessions endpoint returns COMPLETED session
    const completedSessionsList = await get('http://localhost:5000/api/attendance/sessions', token);
    const matchingSessionCompleted = completedSessionsList.data.find(s => s.sessionId === sessionId);
    console.log('   Found session status after end (expected: COMPLETED):', matchingSessionCompleted ? matchingSessionCompleted.status : 'NOT FOUND');
    if (!matchingSessionCompleted || matchingSessionCompleted.status !== 'COMPLETED') {
      throw new Error('/api/attendance/sessions failed to return COMPLETED session!');
    }

    // Test: Starting same class again after completion -> allowed
    console.log('\n--- Test Case: Start same session after completion ---');
    const startSessAgain = await post('http://localhost:5000/api/attendance/sessions/start', {
      subject: 'Data Structures Integration Test',
      classroom: 'Room 102',
      department: 'Computer Science'
    }, token);
    console.log('✅ Re-open completed session slot:', startSessAgain.statusCode === 201 ? 'SUCCESS' : 'FAIL');
    
    // TEST CASE G: Start another session later -> previous session's attendance does not affect the new session
    if (startSessAgain.statusCode === 201) {
      const newSessionId = startSessAgain.data.sessionId;
      console.log('\n--- Test Case G: Log check-in in a new session after previous one completed ---');
      const checkinA3 = await post('http://localhost:5000/api/attendance/log', {
        sessionId: newSessionId,
        userId: 'student-a-uuid'
      }, token);
      console.log('✅ Student A Check-in in new session is allowed:', checkinA3.statusCode === 201 ? 'SUCCESS' : 'FAIL');
      if (checkinA3.statusCode !== 201) {
        throw new Error('Failed to log check-in in a new session after previous one was completed!');
      }
      
      // End it so it's not active anymore
      await post(`http://localhost:5000/api/attendance/sessions/${newSessionId}/end`, {}, token);
    }

    // 12. Verify finalized attendance logs
    console.log('\n--- Test Case: Verify Finalized Attendance Records ---');
    const logs = await get(`http://localhost:5000/api/attendance/history?sessionId=${sessionId}`, token);
    console.log('✅ History retrieved:', logs.statusCode === 200 ? 'SUCCESS' : 'FAIL');
    console.log(`   Total records created: ${logs.data.length}`);
    
    const recordA = logs.data.find(r => r.userId === 'student-a-uuid');
    const recordB = logs.data.find(r => r.userId === 'student-b-uuid');
    const recordC = logs.data.find(r => r.userId === 'student-c-uuid');

    console.log('   Student A record status (expected: PRESENT):', recordA ? recordA.status : 'NOT FOUND');
    console.log('   Student B record status (expected: ABSENT):', recordB ? recordB.status : 'NOT FOUND');
    console.log('   Student C record status (expected: NOT FOUND):', recordC ? 'FOUND' : 'NOT FOUND');

    if (!recordA || recordA.status !== 'PRESENT') {
      throw new Error('Student A attendance was not correctly recorded as PRESENT!');
    }
    if (!recordB || recordB.status !== 'ABSENT') {
      throw new Error('Student B expected in department was not marked as ABSENT!');
    }
    if (recordC) {
      throw new Error('Student C from another department was incorrectly included in session attendance!');
    }

    // 13. Idempotency Check (clicking end session twice)
    console.log('\n--- Test Case: End Session Idempotency check ---');
    const endSess2 = await post(`http://localhost:5000/api/attendance/sessions/${sessionId}/end`, {}, token);
    console.log('✅ Call endSession again:', endSess2.statusCode === 200 ? 'SUCCESS' : 'FAIL');
    
    const logsAfter = await get(`http://localhost:5000/api/attendance/history?sessionId=${sessionId}`, token);
    console.log(`   Total records created after second end call: ${logsAfter.data.length} (originally ${logs.data.length})`);
    if (logsAfter.data.length !== logs.data.length) {
      throw new Error('Idempotency check failed: records duplicated!');
    }

    // 14. Scan check-in after session is ended
    console.log('\n--- Test Case: Scan check-in after session is completed ---');
    const checkinAfter = await post('http://localhost:5000/api/attendance/log', {
      sessionId,
      userId: 'student-a-uuid'
    }, token);
    console.log('✅ Block check-in on completed session:', checkinAfter.statusCode === 400 ? 'SUCCESS' : 'FAIL');
    console.log('   Error returned:', checkinAfter.data.error);
    if (!checkinAfter.data.error || !checkinAfter.data.error.includes('ended')) {
      throw new Error('Failed to return correct error when checking in to a completed session!');
    }

    console.log('\n🎉 ALL SMART ATTENDANCE TESTS PASSED SUCCESSFULLY! 🎉');

  } catch(e) {
    console.error('\n❌ Verification test failed:', e.message);
    process.exit(1);
  }
}

run();
