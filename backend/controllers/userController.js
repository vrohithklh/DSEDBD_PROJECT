import bcrypt from 'bcryptjs';
import { dbService } from '../services/dbService.js';
import User from '../models/User.js';

export const getUsers = async (req, res) => {
  const isAll = req.query.all === 'true';
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    if (global.isMongoMock) {
      // 1. Mock Sandbox Filtering
      let list = await dbService.getAllUsers();
      
      if (req.query.role) {
        list = list.filter(u => u.role === req.query.role);
      }
      if (req.query.department) {
        list = list.filter(u => u.department === req.query.department);
      }
      if (req.query.search) {
        const searchVal = req.query.search.toLowerCase();
        list = list.filter(u => 
          u.name.toLowerCase().includes(searchVal) || 
          u.email.toLowerCase().includes(searchVal) ||
          (u.studentId && u.studentId.toLowerCase().includes(searchVal)) ||
          (u.employeeId && u.employeeId.toLowerCase().includes(searchVal))
        );
      }

      if (isAll) {
        return res.json(list.map(u => { const { password, ...rest } = u; return rest; }));
      }

      const total = list.length;
      const paginated = list.slice(skip, skip + limit);

      return res.json({
        users: paginated.map(u => { const { password, ...rest } = u; return rest; }),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    }

    // 2. Real Mongoose Database Queries
    const query = {};
    
    if (req.query.role) {
      query.role = req.query.role;
    }
    if (req.query.department) {
      query.department = req.query.department;
    }
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { studentId: searchRegex },
        { employeeId: searchRegex }
      ];
    }

    if (isAll) {
      const users = await User.find(query, '-password').lean();
      return res.json(users);
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query, '-password').skip(skip).limit(limit).lean();

    res.json({
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error('getUsers error:', error);
    res.status(500).json({ error: 'Failed to retrieve users directory' });
  }
};

export const getUser = async (req, res) => {
  const { id } = req.params;

  // Non-admins can only retrieve their own credentials
  if (req.user.role !== 'ADMIN' && req.user.uid !== id) {
    return res.status(403).json({ error: 'Access denied: Cannot query other users credentials' });
  }

  try {
    const user = await dbService.getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    const { password, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve user' });
  }
};

export const createUser = async (req, res) => {
  const userData = req.body;

  try {
    // 1. Verify email uniqueness
    const existingEmail = await dbService.getUserByEmail(userData.email);
    if (existingEmail) {
      return res.status(400).json({ error: 'A user with this email address is already registered.' });
    }

    // 2. Prevent duplicate Student IDs or Employee IDs
    if (userData.role === 'STUDENT') {
      const checkId = userData.studentId.trim();
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
    } else if (userData.role === 'EMPLOYEE') {
      const checkId = userData.employeeId.trim();
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

    // Hash user passwords (skip if in mock connection)
    const rawPassword = userData.password;
    if (!rawPassword) {
      return res.status(400).json({ error: 'Password is required.' });
    }
    const passwordToSave = global.isMongoMock ? rawPassword : await bcrypt.hash(rawPassword, 10);

    const created = await dbService.createUser({
      ...userData,
      userId: userData.userId || `user-${Date.now()}`,
      password: passwordToSave,
      status: userData.status || 'ACTIVE'
    });

    const { password, ...safeCreated } = created;
    res.status(201).json(safeCreated);
  } catch (error) {
    console.error('createUser error:', error);
    res.status(500).json({ error: 'Failed to create user record.' });
  }
};

export const updateUser = async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  // Non-admins can only modify their own profile
  if (req.user.role !== 'ADMIN' && req.user.uid !== id) {
    return res.status(403).json({ error: 'Access denied: Cannot update other user records' });
  }

  // Prevent role elevation by non-admins
  if (req.user.role !== 'ADMIN' && data.role) {
    delete data.role;
  }

  try {
    // 1. Verify email uniqueness if changed
    if (data.email) {
      const existing = await dbService.getUserByEmail(data.email);
      if (existing && existing.userId !== id) {
        return res.status(400).json({ error: 'A user with this email address is already registered.' });
      }
    }

    // 2. Prevent duplicate Student IDs / Employee IDs
    if (data.studentId) {
      const checkId = data.studentId.trim();
      let duplicate = false;
      
      if (global.isMongoMock) {
        const users = await dbService.getAllUsers();
        duplicate = users.some(u => u.studentId === checkId && u.userId !== id);
      } else {
        const doc = await User.findOne({ studentId: checkId, userId: { $ne: id } });
        duplicate = !!doc;
      }
      
      if (duplicate) {
        return res.status(400).json({ error: `Student ID "${checkId}" is already assigned to another student.` });
      }
    }

    if (data.employeeId) {
      const checkId = data.employeeId.trim();
      let duplicate = false;

      if (global.isMongoMock) {
        const users = await dbService.getAllUsers();
        duplicate = users.some(u => u.employeeId === checkId && u.userId !== id);
      } else {
        const doc = await User.findOne({ employeeId: checkId, userId: { $ne: id } });
        duplicate = !!doc;
      }

      if (duplicate) {
        return res.status(400).json({ error: `Employee ID "${checkId}" is already assigned to another staff member.` });
      }
    }

    // Hash password if modified
    if (data.password) {
      if (data.password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }
      if (!global.isMongoMock) {
        data.password = await bcrypt.hash(data.password, 10);
      }
    }

    const updated = await dbService.updateUser(id, data);
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { password, ...safeUpdated } = updated;
    res.json(safeUpdated);
  } catch (error) {
    console.error('updateUser error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

export const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const success = await dbService.deleteUser(id);
    if (!success) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('deleteUser error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};
