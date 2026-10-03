import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    default: ''
  },
  studentId: {
    type: String,
    default: null
  },
  employeeId: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: ['ADMIN', 'STUDENT', 'EMPLOYEE'],
    default: 'STUDENT'
  },
  department: {
    type: String,
    required: true
  },
  designation: {
    type: String,
    default: null
  },
  course: {
    type: String,
    default: null
  },
  year: {
    type: String,
    default: null
  },
  batch: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE'
  },
  createdAt: {
    type: Number,
    default: Date.now
  }
});

// Enforce virtual fields or methods if necessary
const User = mongoose.model('User', userSchema);

export default User;
