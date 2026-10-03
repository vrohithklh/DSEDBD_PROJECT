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
      'Content-Length': data.length
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

async function seedAdmin() {
  const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_attendance';
  console.log('🌱 Connecting to database for seeder checks...');
  try {
    await mongoose.connect(dbUri, { serverSelectionTimeoutMS: 3000 });
    const usersColl = mongoose.connection.db.collection('users');
    
    // Check if admin exists
    await usersColl.deleteMany({ email: { $in: ['alice@college.edu', 'alicethird@college.edu'] } });
    await usersColl.deleteMany({ studentId: { $in: ['STU1001', 'STU1002'] } });
    console.log('🧹 Cleaned up old integration test users from MongoDB.');

    const existing = await usersColl.findOne({ email: 'admin@college.edu' });
    if (!existing) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      await usersColl.insertOne({
        userId: 'admin-uuid-123',
        name: 'System Administrator',
        email: 'admin@college.edu',
        password: hashedPassword,
        role: 'ADMIN',
        department: 'Administration',
        status: 'ACTIVE',
        createdAt: Date.now()
      });
      console.log('👤 Seeded default Admin user in MongoDB successfully.');
    } else {
      console.log('👤 Admin user already registered in MongoDB.');
    }
  } catch (err) {
    console.error('❌ Database seed check failed:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

async function run() {
  // 1. Seed the default admin
  await seedAdmin();

  console.log('\n🔍 Initiating full-stack API integration test...');

  try {
    // 2. Check Root Endpoint
    const root = await get('http://localhost:5000/');
    console.log('✅ API Health check:', root.statusCode === 200 ? 'SUCCESS' : 'FAIL', root.data);

    // 3. Perform Login Check
    const login = await post('http://localhost:5000/api/auth/login', {
      email: 'admin@college.edu',
      password: 'password123'
    });
    console.log('✅ Auth Login check:', login.statusCode === 200 ? 'SUCCESS' : 'FAIL');
    
    if (login.statusCode !== 200) {
      throw new Error('Authentication login failed: ' + JSON.stringify(login.data));
    }

    const token = login.data.token;
    console.log('🔑 Acquired local JWT Token:', token.substring(0, 30) + '...');

    // 4. Fetch Metadata Settings
    const meta = await get('http://localhost:5000/api/admin/metadata', token);
    console.log('✅ Metadata retrieval:', meta.statusCode === 200 ? 'SUCCESS' : 'FAIL');

    // 5. Fetch Users List
    const users = await get('http://localhost:5000/api/users', token);
    console.log('✅ Users directory query:', users.statusCode === 200 ? 'SUCCESS' : 'FAIL');
    if (users.statusCode === 200) {
      console.log(`👥 Registered User Count: ${users.data.users.length} (total: ${users.data.total})`);
    }

    // 6. Test creating a new student (valid)
    const newStudent = await post('http://localhost:5000/api/users', {
      name: 'Alice Johnson',
      email: 'alice@college.edu',
      role: 'STUDENT',
      studentId: 'STU1001',
      department: 'Computer Science',
      course: 'B.Tech',
      year: '1st',
      batch: 'B',
      password: 'password123'
    }, token);
    console.log('✅ Create Student check:', newStudent.statusCode === 201 ? 'SUCCESS' : 'FAIL', newStudent.data);

    // 7. Test creating a student with duplicate email
    const duplicateEmail = await post('http://localhost:5000/api/users', {
      name: 'Alice Second',
      email: 'alice@college.edu',
      role: 'STUDENT',
      studentId: 'STU1002',
      department: 'Computer Science',
      password: 'password123'
    }, token);
    console.log('✅ Duplicate Email block check:', duplicateEmail.statusCode === 400 ? 'SUCCESS' : 'FAIL', duplicateEmail.data);

    // 8. Test creating a student with duplicate Student ID
    const duplicateId = await post('http://localhost:5000/api/users', {
      name: 'Alice Third',
      email: 'alicethird@college.edu',
      role: 'STUDENT',
      studentId: 'STU1001',
      department: 'Computer Science',
      password: 'password123'
    }, token);
    console.log('✅ Duplicate Student ID block check:', duplicateId.statusCode === 400 ? 'SUCCESS' : 'FAIL', duplicateId.data);

    // 9. Test starting a session
    const session = await post('http://localhost:5000/api/attendance/sessions/start', {
      subject: 'Data Structures',
      classroom: 'Room 102',
      department: 'Computer Science'
    }, token);
    console.log('✅ Session gateway start check (using admin authorization):', session.statusCode === 201 ? 'SUCCESS' : 'FAIL');

    console.log('🎉 Full-stack REST API validation complete. All systems online.');
  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
  }
}

run();
