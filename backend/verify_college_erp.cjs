const http = require('http');
require('dotenv').config({ path: 'c:/Users/V.Rohith/OneDrive/Desktop/smart_att/backend/.env' });
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

const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_attendance';

// Database clean-up and seeding
async function setupDb() {
  console.log('🌱 Connecting to database for setup...');
  try {
    await mongoose.connect(dbUri, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;

    // Delete users with test emails
    await db.collection('users').deleteMany({
      email: { $in: ['student_a@college.edu', 'student_b@college.edu', 'student_c@college.edu', 'employee_teacher@college.edu'] }
    });

    const hashedPwd = await bcrypt.hash('password123', 10);
    
    // Seed CS Teacher (EMPLOYEE)
    const teacher = {
      userId: 'teacher-uuid-999',
      name: 'Dr. John Watson',
      email: 'employee_teacher@college.edu',
      password: hashedPwd,
      role: 'EMPLOYEE',
      employeeId: 'EMP_WATSON',
      department: 'Computer Science',
      status: 'ACTIVE',
      createdAt: Date.now()
    };

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

    // Student C (Electronics)
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

    await db.collection('users').insertMany([teacher, studentA, studentB, studentC]);
    console.log('👥 Seeded clean test users (Teacher, Student A, Student B, Student C).');

    // Clean up old attendance sessions and records
    await db.collection('attendancesessions').deleteMany({
      $or: [
        { subject: { $in: ['ERP Structures Integration Test', 'ERP Database Integration Test'] } },
        { classroom: { $in: ['Room 102', 'Room 105'] } }
      ]
    });
    await db.collection('attendances').deleteMany({
      subject: { $in: ['ERP Structures Integration Test', 'ERP Database Integration Test'] }
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
    // 1. Login as Admin
    const adminLogin = await post('http://localhost:5000/api/auth/login', {
      email: 'admin@college.edu',
      password: 'password123'
    });
    if (adminLogin.statusCode !== 200) {
      throw new Error('Admin Authentication failed: ' + JSON.stringify(adminLogin.data));
    }
    const adminToken = adminLogin.data.token;
    console.log('🔐 Admin login: SUCCESS');

    // 2. Login as Teacher
    const teacherLogin = await post('http://localhost:5000/api/auth/login', {
      email: 'employee_teacher@college.edu',
      password: 'password123'
    });
    if (teacherLogin.statusCode !== 200) {
      throw new Error('Teacher Authentication failed: ' + JSON.stringify(teacherLogin.data));
    }
    const teacherToken = teacherLogin.data.token;
    console.log('🔐 Teacher login: SUCCESS');

    // 3. Admin creates an attendance session (assigned to Watson)
    console.log('\n--- Test Case: Admin Creates Session (PENDING) ---');
    const createSess = await post('http://localhost:5000/api/attendance/sessions/start', {
      subject: 'ERP Structures Integration Test',
      classroom: 'Room 102',
      department: 'Computer Science',
      assignedTeacher: 'teacher-uuid-999'
    }, adminToken);
    
    console.log('✅ Create Session:', createSess.statusCode === 201 ? 'SUCCESS' : 'FAIL');
    const sessionId = createSess.data.sessionId;
    console.log('   Session ID:', sessionId);
    console.log('   Session Status:', createSess.data.status);
    console.log('   Teacher Assigned Name:', createSess.data.teacherName);
    if (createSess.data.status !== 'PENDING') {
      throw new Error('Expected initial status PENDING, got ' + createSess.data.status);
    }

    // 4. CS Teacher declines a test pending session
    console.log('\n--- Test Case: Admin Creates Another Session and Teacher Declines ---');
    const createSessDecline = await post('http://localhost:5000/api/attendance/sessions/start', {
      subject: 'ERP Database Integration Test',
      classroom: 'Room 105',
      department: 'Computer Science',
      assignedTeacher: 'teacher-uuid-999'
    }, adminToken);
    
    const declineSess = await post(`http://localhost:5000/api/attendance/sessions/${createSessDecline.data.sessionId}/decline`, {}, teacherToken);
    console.log('✅ Decline Session:', declineSess.statusCode === 200 ? 'SUCCESS' : 'FAIL');
    console.log('   Declined Status:', declineSess.data.session.status);
    if (declineSess.data.session.status !== 'DECLINED') {
      throw new Error('Expected status to be DECLINED');
    }

    // 5. CS Teacher approves & starts the first session
    console.log('\n--- Test Case: Teacher Approves and Starts Session ---');
    const approveSess = await post(`http://localhost:5000/api/attendance/sessions/${sessionId}/approve`, {}, teacherToken);
    console.log('✅ Approve Session:', approveSess.statusCode === 200 ? 'SUCCESS' : 'FAIL');
    console.log('   Approve Status:', approveSess.data.session.status);
    console.log('   StartTime Recorded:', approveSess.data.session.startTime ? 'YES' : 'NO');
    if (approveSess.data.session.status !== 'ACTIVE' || !approveSess.data.session.startTime) {
      throw new Error('Expected status to be ACTIVE with startTime recorded');
    }

    // 6. Test Classroom Conflict
    console.log('\n--- Test Case: Prevent Classroom conflict on active sessions ---');
    const createSessConflict = await post('http://localhost:5000/api/attendance/sessions/start', {
      subject: 'ERP Database Integration Test',
      classroom: 'Room 102', // same classroom
      department: 'Computer Science',
      assignedTeacher: 'teacher-uuid-999'
    }, adminToken);

    const approveConflict = await post(`http://localhost:5000/api/attendance/sessions/${createSessConflict.data.sessionId}/approve`, {}, teacherToken);
    console.log('✅ Block duplicate active room:', approveConflict.statusCode === 400 ? 'SUCCESS' : 'FAIL');
    console.log('   Conflict message:', approveConflict.data.error);
    if (approveConflict.statusCode !== 400 || !approveConflict.data.error.includes('classroom already has an active')) {
      throw new Error('Failed to block duplicate active classroom.');
    }

    // 7. Student A checks in (within 10m grace period)
    console.log('\n--- Test Case: Student A Checks In (On Time) ---');
    const checkinA = await post('http://localhost:5000/api/attendance/log', {
      sessionId,
      userId: 'student-a-uuid'
    }, teacherToken);
    console.log('✅ Student A Check-In:', checkinA.statusCode === 201 ? 'SUCCESS' : 'FAIL');
    console.log('   Check-In Status (expected PRESENT):', checkinA.data.status);
    if (checkinA.data.status !== 'PRESENT') {
      throw new Error('Expected status to be PRESENT');
    }

    // 8. Simulate LATE: Update session startTime to 11 minutes ago in DB
    console.log('\n--- Test Case: Simulating delay to check LATE status logic ---');
    await mongoose.connect(dbUri);
    await mongoose.connection.db.collection('attendancesessions').updateOne(
      { sessionId },
      { $set: { startTime: Date.now() - 11 * 60 * 1000 } }
    );
    await mongoose.disconnect();
    console.log('   Session startTime shifted 11 minutes into the past.');

    // 9. Student B checks in (Late)
    console.log('\n--- Test Case: Student B Checks In (Late) ---');
    const checkinB = await post('http://localhost:5000/api/attendance/log', {
      sessionId,
      userId: 'student-b-uuid'
    }, teacherToken);
    console.log('✅ Student B Check-In:', checkinB.statusCode === 201 ? 'SUCCESS' : 'FAIL');
    console.log('   Check-In Status (expected LATE):', checkinB.data.status);
    if (checkinB.data.status !== 'LATE') {
      throw new Error('Expected status to be LATE');
    }

    // 10. Student C checks in (Electronics student - should be blocked)
    console.log('\n--- Test Case: Block Department Mismatch Student C ---');
    const checkinC = await post('http://localhost:5000/api/attendance/log', {
      sessionId,
      userId: 'student-c-uuid'
    }, teacherToken);
    console.log('✅ Block Department Mismatch:', checkinC.statusCode === 400 ? 'SUCCESS' : 'FAIL');
    console.log('   Error Message:', checkinC.data.error);

    // 11. End Session by Teacher
    console.log('\n--- Test Case: Teacher Ends Session (Marking Absents) ---');
    const endSess = await post(`http://localhost:5000/api/attendance/sessions/${sessionId}/end`, {}, teacherToken);
    console.log('✅ End Session:', endSess.statusCode === 200 ? 'SUCCESS' : 'FAIL');
    console.log('   Finalized status:', endSess.data.session.status);

    // 12. Verify Finalized DB Records
    console.log('\n--- Test Case: Verify Finalized Attendance Logs ---');
    const logs = await get(`http://localhost:5000/api/attendance/history?sessionId=${sessionId}`, teacherToken);
    console.log('✅ History retrieved:', logs.statusCode === 200 ? 'SUCCESS' : 'FAIL');
    console.log(`   Total records created: ${logs.data.length}`);

    const recordA = logs.data.find(r => r.userId === 'student-a-uuid');
    const recordB = logs.data.find(r => r.userId === 'student-b-uuid');
    const recordC = logs.data.find(r => r.userId === 'student-c-uuid');

    console.log('   Student A record (expected PRESENT):', recordA ? recordA.status : 'NOT FOUND', '| Time:', recordA?.time);
    console.log('   Student B record (expected LATE):', recordB ? recordB.status : 'NOT FOUND', '| Time:', recordB?.time);
    console.log('   Student C record (expected NOT FOUND):', recordC ? 'FOUND' : 'NOT FOUND');

    if (!recordA || recordA.status !== 'PRESENT') {
      throw new Error('Student A is not PRESENT!');
    }
    if (!recordB || recordB.status !== 'LATE') {
      throw new Error('Student B is not LATE!');
    }
    if (recordC) {
      throw new Error('Student C was incorrectly marked!');
    }

    console.log('\n🎉 ALL COLLEGE ERP ATTENDANCE WORKFLOW TESTS PASSED! 🎉');

  } catch (e) {
    console.error('\n❌ Verification test failed:', e.message);
    process.exit(1);
  }
}

run();
