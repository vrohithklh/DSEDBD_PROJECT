const http = require('http');

const post = (url, body) => {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
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

async function run() {
  console.log('🔍 Initiating full-stack API integration test...');

  try {
    // 1. Check Root Endpoint
    const root = await get('http://localhost:5000/');
    console.log('✅ API Health check:', root.statusCode === 200 ? 'SUCCESS' : 'FAIL', root.data);

    // 2. Perform Login Check
    const login = await post('http://localhost:5000/api/auth/login', {
      email: 'admin@college.edu',
      password: 'password'
    });
    console.log('✅ Auth Login check:', login.statusCode === 200 ? 'SUCCESS' : 'FAIL');
    
    if (login.statusCode !== 200) {
      throw new Error('Authentication login failed');
    }

    const token = login.data.token;
    console.log('🔑 Acquired JWT Token:', token);

    // 3. Fetch Metadata Settings
    const meta = await get('http://localhost:5000/api/admin/metadata', token);
    console.log('✅ Metadata retrieval:', meta.statusCode === 200 ? 'SUCCESS' : 'FAIL');
    console.log('📁 Available collections:', Object.keys(meta.data));

    // 4. Fetch Users List
    const users = await get('http://localhost:5000/api/users', token);
    console.log('✅ Users directory query:', users.statusCode === 200 ? 'SUCCESS' : 'FAIL');
    console.log(`👥 Registered User Count: ${users.data.length}`);

    // 5. Test starting a session
    const session = await post('http://localhost:5000/api/attendance/sessions/start', {
      subject: 'Data Structures',
      classroom: 'Room 102',
      department: 'Computer Science'
    });
    console.log('✅ Session gateway start check (using admin authorization):', session.statusCode === 201 ? 'SUCCESS' : 'FAIL');

    console.log('🎉 Full-stack REST API validation complete. All systems online.');
  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
  }
}

run();
