import jwt from 'jsonwebtoken';
import { dbService } from '../services/dbService.js';

export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const jwtSecret = process.env.JWT_SECRET || 'yoursupersecurejwtsecretkeygoeshere';
    
    // Verify local JSON Web Token (JWT)
    const decoded = jwt.verify(token, jwtSecret);
    
    // Fetch user profile from MongoDB using the userId from token payload
    const user = await dbService.getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User profile not registered in campus directory' });
    }

    // Check account status
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Forbidden: Your account has been disabled' });
    }

    req.user = {
      uid: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      employeeId: user.employeeId,
      studentId: user.studentId
    };
    next();
  } catch (error) {
    console.error('JWT Authorization Error:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Unauthorized: Session has expired. Please sign in again.' });
    }
    
    res.status(401).json({ error: 'Unauthorized: Invalid authorization token' });
  }
};

export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const hasRole = Array.isArray(roles) 
      ? roles.includes(req.user.role) 
      : req.user.role === roles;
      
    if (!hasRole) {
      return res.status(403).json({ error: 'Forbidden: You do not have permissions to access this API' });
    }
    next();
  };
};
