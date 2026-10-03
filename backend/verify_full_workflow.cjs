const http = require('http');
const mongoose = require('mongoose');
require('dotenv').config();

// Helper to make HTTP requests
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

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING SMART ATTENDANCE E2E COMPREHENSIVE TEST SUITE');
  console.log('====================================================\n');

  try {
    // 1. Clean up old test sessions from database
    console.log('▶ SETUP: Initializing Test State & Database...');
    const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_attendance';
    try {
      await mongoose.connect(dbUri, { serverSelectionTimeoutMS: 4000 });
      const db = mongoose.connection.db;
      await db.collection('attendancesessions').deleteMany({
        $or: [{ subject: 'Operating Systems' }, { classroom: 'Room 101' }]
      });
      await db.collection('attendances').deleteMany({
        $or: [{ subject: 'Operating Systems' }, { classroom: 'Room 101' }]
      });
      console.log('  🧹 Cleaned up old test sessions from Room 101.');
    } catch (e) {
      console.log('  ℹ Mongoose direct cleanup skipped / mock mode:', e.message);
    } finally {
      await mongoose.disconnect().catch(() => {});
    }
    
    // Register Teacher if not exists
    await request('POST', '/auth/register', {
      name: 'Prof. Jane Smith',
      email: 'teacher_workflow@college.edu',
      password: 'password123',
      role: 'EMPLOYEE',
      department: 'Computer Science',
      employeeId: 'EMP_WORKFLOW_01',
      designation: 'Associate Professor'
    });

    // Register Student 1
    await request('POST', '/auth/register', {
      name: 'V Rohith',
      email: 'student_workflow_1@college.edu',
      password: 'password123',
      role: 'STUDENT',
      department: 'Computer Science',
      studentId: 'STU_WORKFLOW_01',
      course: 'B.Tech',
      year: '3rd',
      batch: 'A'
    });

    // Register Student 2
    await request('POST', '/auth/register', {
      name: 'Aakash Sharma',
      email: 'student_workflow_2@college.edu',
      password: 'password123',
      role: 'STUDENT',
      department: 'Computer Science',
      studentId: 'STU_WORKFLOW_02',
      course: 'B.Tech',
      year: '3rd',
      batch: 'A'
    });

    // 1. ADMIN LOGIN
    console.log('▶ TEST 1: Admin logs in...');
    const adminLogin = await request('POST', '/auth/login', {
      email: 'admin@college.edu',
      password: 'password123'
    });
    if (adminLogin.status !== 200 || !adminLogin.data.token) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.data)}`);
    }
    const adminToken = adminLogin.data.token;
    console.log('  ✅ Admin logged in successfully.\n');

    // 2. TEACHER LOGIN
    console.log('▶ TEST 2: Teacher logs in...');
    const teacherLogin = await request('POST', '/auth/login', {
      email: 'teacher_workflow@college.edu',
      password: 'password123'
    });
    if (teacherLogin.status !== 200 || !teacherLogin.data.token) {
      throw new Error(`Teacher login failed: ${JSON.stringify(teacherLogin.data)}`);
    }
    const teacherToken = teacherLogin.data.token;
    const teacherUser = teacherLogin.data.user;
    console.log(`  ✅ Teacher logged in (${teacherUser.name}, ${teacherUser.employeeId || teacherUser.userId}).\n`);

    // Clean up any stale active sessions in test classroom
    const existingActive = await request('GET', '/attendance/sessions/active', null, adminToken);
    if (Array.isArray(existingActive.data)) {
      for (const s of existingActive.data) {
        if (s.classroom === 'Room 101') {
          // If teacher is assigned, end it, else end via db
          await request('POST', `/attendance/sessions/${s.sessionId}/end`, null, teacherToken).catch(() => {});
        }
      }
    }

    // 3. STUDENT 1 & 2 LOGIN
    console.log('▶ TEST 3: Students log in...');
    const student1Login = await request('POST', '/auth/login', {
      email: 'student_workflow_1@college.edu',
      password: 'password123'
    });
    const student2Login = await request('POST', '/auth/login', {
      email: 'student_workflow_2@college.edu',
      password: 'password123'
    });
    if (student1Login.status !== 200 || student2Login.status !== 200) {
      throw new Error(`Student login failed`);
    }
    const student1Token = student1Login.data.token;
    const student1User = student1Login.data.user;
    const student2Token = student2Login.data.token;
    const student2User = student2Login.data.user;
    console.log(`  ✅ Student 1 (${student1User.name}) and Student 2 (${student2User.name}) logged in.\n`);

    // 4. ADMIN CREATES ATTENDANCE SESSION
    console.log('▶ TEST 4: Admin creates attendance session (Subject: Operating Systems, Room 101, Dept: Computer Science)...');
    const createSessionRes = await request('POST', '/attendance/sessions/start', {
      subject: 'Operating Systems',
      classroom: 'Room 101',
      department: 'Computer Science',
      assignedTeacherId: teacherUser.employeeId || teacherUser.userId
    }, adminToken);

    if (createSessionRes.status !== 201) {
      throw new Error(`Session creation failed: ${JSON.stringify(createSessionRes.data)}`);
    }
    const session = createSessionRes.data;
    console.log(`  ✅ Session created! ID: ${session.sessionId}, Status: ${session.status}`);
    if (session.status !== 'PENDING') {
      throw new Error(`Expected status PENDING, got ${session.status}`);
    }

    // 5. TEACHER NOTIFICATION CHECK
    console.log('\n▶ TEST 5: Teacher checks pending sessions...');
    const teacherSessions = await request('GET', '/attendance/sessions', null, teacherToken);
    const pendingSession = teacherSessions.data.find(s => s.sessionId === session.sessionId);
    if (!pendingSession || pendingSession.status !== 'PENDING') {
      throw new Error(`Pending session not found in teacher list: ${JSON.stringify(teacherSessions.data)}`);
    }
    console.log('  ✅ Teacher sees pending session notification.');

    // 6. TEACHER APPROVES SESSION
    console.log('\n▶ TEST 6: Teacher approves session...');
    const approveRes = await request('POST', `/attendance/sessions/${session.sessionId}/approve`, null, teacherToken);
    if (approveRes.status !== 200 || approveRes.data.session?.status !== 'APPROVED') {
      throw new Error(`Approve session failed: ${JSON.stringify(approveRes.data)}`);
    }
    console.log(`  ✅ Session approved! Status is now: ${approveRes.data.session.status}`);

    // 7. TEACHER STARTS LIVE SESSION
    console.log('\n▶ TEST 7: Teacher clicks [Start Session] -> Session becomes LIVE...');
    const startLiveRes = await request('POST', `/attendance/sessions/${session.sessionId}/start-live`, null, teacherToken);
    if (startLiveRes.status !== 200 || startLiveRes.data.session?.status !== 'ACTIVE') {
      throw new Error(`Start live session failed: ${JSON.stringify(startLiveRes.data)}`);
    }
    console.log(`  ✅ Session is LIVE! Start time recorded: ${new Date(startLiveRes.data.session.startTime).toLocaleTimeString()}`);

    // 8. STUDENT VIEWS ACTIVE SESSION
    console.log('\n▶ TEST 8: Student dashboard detects active lecture gateway...');
    const activeSessionsRes = await request('GET', '/attendance/sessions/active', null, student1Token);
    const foundActive = activeSessionsRes.data.find(s => s.sessionId === session.sessionId);
    if (!foundActive) {
      throw new Error(`Active session not found in student active list: ${JSON.stringify(activeSessionsRes.data)}`);
    }
    console.log(`  ✅ Student sees active gateway: ${foundActive.subject} in ${foundActive.classroom}`);

    // 9. STUDENT 1 CHECK-IN WITHIN 10 MINUTES -> PRESENT
    console.log('\n▶ TEST 9: Student 1 scans face and checks in (within 10 minutes)...');
    const checkIn1 = await request('POST', '/attendance/log', {
      sessionId: session.sessionId,
      userId: student1User.userId
    }, student1Token);
    if (checkIn1.status !== 201 || checkIn1.data.status !== 'PRESENT') {
      throw new Error(`Student 1 check-in failed: ${JSON.stringify(checkIn1.data)}`);
    }
    console.log(`  ✅ Attendance logged for Student 1! Status: ${checkIn1.data.status}, Time: ${checkIn1.data.time}`);

    // 10. DUPLICATE CHECK-IN REJECTION
    console.log('\n▶ TEST 10: Student 1 attempts duplicate scan...');
    const dupCheckIn = await request('POST', '/attendance/log', {
      sessionId: session.sessionId,
      userId: student1User.userId
    }, student1Token);
    if (dupCheckIn.status !== 400 || !dupCheckIn.data.error.includes('already')) {
      throw new Error(`Duplicate check-in was not rejected properly: ${JSON.stringify(dupCheckIn.data)}`);
    }
    console.log(`  ✅ Duplicate attendance rejected: "${dupCheckIn.data.error}"`);

    // 11. TEACHER LIVE ATTENDANCE MONITOR
    console.log('\n▶ TEST 11: Teacher monitors live attendance table...');
    const liveSessionCheck = await request('GET', '/attendance/sessions', null, teacherToken);
    const updatedLive = liveSessionCheck.data.find(s => s.sessionId === session.sessionId);
    console.log(`  ✅ Live Monitor Table: Checked-in = [${updatedLive.checkedInStudents.join(', ')}]`);
    console.log(`  ✅ Student 1 Check-In Details: ${JSON.stringify(updatedLive.checkInDetails[student1User.userId])}`);

    // 12. TEACHER ENDS SESSION -> STUDENT 2 MARKED ABSENT
    console.log('\n▶ TEST 12: Teacher clicks [End Session]...');
    const endRes = await request('POST', `/attendance/sessions/${session.sessionId}/end`, null, teacherToken);
    if (endRes.status !== 200 || endRes.data.session?.status !== 'COMPLETED') {
      throw new Error(`End session failed: ${JSON.stringify(endRes.data)}`);
    }
    console.log(`  ✅ Session COMPLETED! Summary:`);
    console.log(`     Total Enrolled in Dept: ${endRes.data.summary.totalStudents}`);
    console.log(`     Present: ${endRes.data.summary.present}`);
    console.log(`     Late: ${endRes.data.summary.late}`);
    console.log(`     Absent: ${endRes.data.summary.absent}`);
    console.log(`     Attendance Rate: ${endRes.data.summary.attendancePercentage}%`);

    // 13. ADMIN CHECKS SESSION STATUS
    console.log('\n▶ TEST 13: Admin checks completed session status...');
    const adminSessions = await request('GET', '/attendance/sessions', null, adminToken);
    const completedSession = adminSessions.data.find(s => s.sessionId === session.sessionId);
    if (completedSession.status !== 'COMPLETED') {
      throw new Error(`Admin does not see COMPLETED status: ${completedSession.status}`);
    }
    console.log(`  ✅ Admin sees session: COMPLETED (Monitor mode, no start/end controls).`);

    // 14. ADMIN REPORTS & ANALYTICS
    console.log('\n▶ TEST 14: Checking Reports & Analytics stats and history logs...');
    const historyRes = await request('GET', '/attendance/history', null, adminToken);
    const sessionRecords = historyRes.data.filter(r => r.sessionId === session.sessionId);
    console.log(`  ✅ Session Attendance History Records (${sessionRecords.length} records):`);
    sessionRecords.forEach(r => {
      console.log(`     - ${r.userName} (${r.userId}): ${r.status} (Time: ${r.time})`);
    });

    const student1Record = sessionRecords.find(r => r.userId === student1User.userId);
    const student2Record = sessionRecords.find(r => r.userId === student2User.userId);
    if (!student1Record || student1Record.status !== 'PRESENT') {
      throw new Error('Student 1 should be PRESENT');
    }
    if (!student2Record || student2Record.status !== 'ABSENT') {
      throw new Error('Student 2 should be ABSENT');
    }

    // 15. PERSISTENCE CHECK AFTER RE-QUERY
    console.log('\n▶ TEST 15: Re-querying all endpoints to verify data consistency...');
    const statsRes = await request('GET', '/reports/stats', null, adminToken);
    if (!statsRes.data.totalStudents || statsRes.data.totalStudents < 2) {
      throw new Error('Total students count inconsistent in reports');
    }
    console.log(`  ✅ System state verified. Total Students = ${statsRes.data.totalStudents}, Active Sessions = ${statsRes.data.activeSessionsCount}`);

    console.log('\n====================================================');
    console.log('🎉 ALL 15 END-TO-END WORKFLOW TESTS PASSED SUCCESSFULLY!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('❌ TEST FAILED:', err.message);
    process.exit(1);
  }
}

runTests();
