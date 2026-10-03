import mongoose from 'mongoose';

const attendanceSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'ACTIVE', 'COMPLETED', 'DECLINED', 'REJECTED'],
    default: 'PENDING'
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
  date: {
    type: String,
    required: true
  },
  startTime: {
    type: Number,
    default: null
  },
  endTime: {
    type: Number,
    default: null
  },
  assignedTeacherId: {
    type: String,
    required: true
  },
  teacherName: {
    type: String,
    default: null
  },
  checkInDetails: {
    type: Object,
    default: {}
  },
  checkedInStudents: {
    type: [String],
    default: []
  },
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Number,
    default: Date.now
  }
});

attendanceSessionSchema.index(
  { classroom: 1 },
  { unique: true, partialFilterExpression: { status: 'ACTIVE' } }
);

const AttendanceSession = mongoose.model('AttendanceSession', attendanceSessionSchema);

export default AttendanceSession;
