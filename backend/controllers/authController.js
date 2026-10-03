import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { dbService } from '../services/dbService.js';
import User from '../models/User.js';

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // 1. Fetch user by email
    const user = await dbService.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 2. Validate password hashes
    let isPasswordMatch = false;
    if (global.isMongoMock) {
      // In sandbox mode, compare cleartext password directly for easy logins, or try bcrypt
      isPasswordMatch = (password === user.password) || await bcrypt.compare(password, user.password);
    } else {
      isPasswordMatch = await bcrypt.compare(password, user.password);
    }

    if (!isPasswordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 3. Check account status
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Your account has been deactivated by an administrator.' });
    }

    // 4. Generate local JSON Web Token (JWT)
    const jwtSecret = process.env.JWT_SECRET || 'yoursupersecurejwtsecretkeygoeshere';
    const token = jwt.sign(
      { userId: user.userId, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: '7d' } // Session valid for 7 days
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        department: user.department,
        studentId: user.studentId,
        employeeId: user.employeeId,
        designation: user.designation,
        course: user.course,
        year: user.year,
        batch: user.batch
      }
    });

  } catch (error) {
    console.error('Login controller error:', error);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email address is required' });
  }

  try {
    const user = await dbService.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'Email address is not registered in our records.' });
    }

    // Generate a temporary reset link
    const resetToken = Math.random().toString(36).substring(2, 15);
    const resetLink = `http://localhost:5173/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
    
    console.log(`\n==========================================`);
    console.log(`📨 SIMULATED PASSWORD RESET EMAIL DISPATCH`);
    console.log(`To: ${email}`);
    console.log(`Link: ${resetLink}`);
    console.log(`==========================================\n`);

    res.json({ message: 'A password reset link has been dispatched to your email (simulated in server console).' });

  } catch (error) {
    console.error('Forgot password controller error:', error);
    res.status(500).json({ error: 'Failed to request password reset.' });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = await dbService.getUserById(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: 'User profile not found in directory.' });
    }
    const { password, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve profile credentials' });
  }
};

export const register = async (req, res) => {
  const {
    name,
    email,
    password,
    role,
    phone,
    department,
    studentId,
    employeeId,
    course,
    designation,
    year
  } = req.body;

  // 1. Validate request data
  if (!name || !email || !password || !role || !department) {
    return res.status(400).json({ error: 'Please provide all required fields: name, email, password, role, department.' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  // Validate password length
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  // Validate role
  if (role !== 'STUDENT' && role !== 'EMPLOYEE') {
    return res.status(400).json({ error: 'Invalid role selection. Must be STUDENT or EMPLOYEE.' });
  }

  // Role-specific validation
  if (role === 'STUDENT' && !studentId) {
    return res.status(400).json({ error: 'Student ID is required for student registration.' });
  }
  if (role === 'EMPLOYEE' && !employeeId) {
    return res.status(400).json({ error: 'Employee ID is required for employee registration.' });
  }

  try {
    // 2. Check whether email already exists
    const existingEmail = await dbService.getUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ error: 'A user with this email address is already registered.' });
    }

    // 3. Check whether Student ID / Employee ID already exists
    if (role === 'STUDENT') {
      const checkId = studentId.trim();
      let duplicate = false;
      if (global.isMongoMock) {
        const users = await dbService.getAllUsers();
        duplicate = users.some(u => u.studentId === checkId);
      } else {
        const doc = await User.findOne({ studentId: checkId });
        duplicate = !!doc;
      }
      if (duplicate) {
        return res.status(400).json({ error: `Student ID "${checkId}" is already assigned to another student.` });
      }
    } else if (role === 'EMPLOYEE') {
      const checkId = employeeId.trim();
      let duplicate = false;
      if (global.isMongoMock) {
        const users = await dbService.getAllUsers();
        duplicate = users.some(u => u.employeeId === checkId);
      } else {
        const doc = await User.findOne({ employeeId: checkId });
        duplicate = !!doc;
      }
      if (duplicate) {
        return res.status(400).json({ error: `Employee ID "${checkId}" is already assigned to another staff member.` });
      }
    }

    // 4. Hash the password using bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Create the user payload
    const userId = `user-${Date.now()}`;
    const userPayload = {
      userId,
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone: phone || '',
      role,
      department,
      status: 'ACTIVE',
      createdAt: Date.now()
    };

    if (role === 'STUDENT') {
      userPayload.studentId = studentId.trim();
      userPayload.course = course || '';
      userPayload.year = year || '';
    } else {
      userPayload.employeeId = employeeId.trim();
      userPayload.designation = designation || '';
    }

    // 6. Store user in database (MongoDB Atlas or Mock)
    const createdUser = await dbService.createUser(userPayload);

    // 8. Return safe response without password
    const safeUser = {
      userId: createdUser.userId,
      name: createdUser.name,
      email: createdUser.email,
      phone: createdUser.phone,
      role: createdUser.role,
      department: createdUser.department,
      studentId: createdUser.studentId || null,
      employeeId: createdUser.employeeId || null,
      course: createdUser.course || null,
      designation: createdUser.designation || null,
      year: createdUser.year || null,
      createdAt: createdUser.createdAt
    };

    return res.status(201).json({
      message: 'Registration successful',
      user: safeUser
    });

  } catch (error) {
    console.error('Registration controller error:', error);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
};
