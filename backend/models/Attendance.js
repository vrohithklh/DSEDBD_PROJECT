import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  attendanceId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userType: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['PRESENT', 'ABSENT', 'LATE'],
    default: 'PRESENT'
  },
  sessionId: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  classroom: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  teacher: {
    type: String,
    default: null
  },
  createdAt: {
    type: Number,
    default: Date.now
  }
});

attendanceSchema.index({ sessionId: 1, userId: 1 }, { unique: true });

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;
