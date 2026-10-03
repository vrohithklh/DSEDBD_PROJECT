import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Department from '../models/Department.js';
import Classroom from '../models/Classroom.js';
import Subject from '../models/Subject.js';

dotenv.config();

// Global mock state flag
global.isMongoMock = false;

const connectDB = async () => {
  const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_attendance';
  try {
    // Attempt Mongoose connection with a 3-second timeout
    const conn = await mongoose.connect(dbUri, {
      serverSelectionTimeoutMS: 3000
    });
    console.log(`📡 MongoDB Connected: ${conn.connection.host}`);

    // Seed default data if database is empty
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('🌱 Mongoose database is empty. Seeding default demo registry...');
      
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      // 1. Seed users
      await User.insertMany([
        {
          userId: 'admin-uuid-123',
          name: 'System Administrator',
          email: 'admin@college.edu',
          password: hashedPassword,
          phone: '9876543210',
          role: 'ADMIN',
          department: 'Administration',
          status: 'ACTIVE',
          createdAt: Date.now()
        },
        {
          userId: 'student-uuid-456',
          name: 'John Doe',
          email: 'student@college.edu',
          password: hashedPassword,
          phone: '9876543211',
          studentId: 'STU001',
          role: 'STUDENT',
          department: 'Computer Science',
          course: 'B.Tech',
          year: '3rd',
          batch: 'A',
          status: 'ACTIVE',
          createdAt: Date.now()
        },
        {
          userId: 'employee-uuid-789',
          name: 'Prof. Jane Smith',
          email: 'employee@college.edu',
          password: hashedPassword,
          phone: '9876543212',
          employeeId: 'EMP101',
          role: 'EMPLOYEE',
          department: 'Computer Science',
          designation: 'Assistant Professor',
          status: 'ACTIVE',
          createdAt: Date.now()
        }
      ]);

      // 2. Seed auxiliary metadata
      await Department.insertMany([
        { id: 'dept-1', name: 'Computer Science' },
        { id: 'dept-2', name: 'Electronics' },
        { id: 'dept-3', name: 'Mechanical' }
      ]);

      await Classroom.insertMany([
        { id: 'room-101', name: 'Room 101' },
        { id: 'room-102', name: 'Room 102' },
        { id: 'lab-a', name: 'Lab A' }
      ]);

      await Subject.insertMany([
        { id: 'sub-1', name: 'Operating Systems' },
        { id: 'sub-2', name: 'Machine Learning' },
        { id: 'sub-3', name: 'Data Structures' }
      ]);

      console.log('✅ Demo registry seeded successfully inside MongoDB!');
    }
  } catch (error) {
    console.warn(`⚠️  MongoDB connection failed: ${error.message}`);
    console.warn(`⚙️  Starting in simulated database MOCK MODE for sandboxed testing.`);
    global.isMongoMock = true;
  }
};

export default connectDB;
