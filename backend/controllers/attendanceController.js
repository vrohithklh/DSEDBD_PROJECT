import { dbService } from '../services/dbService.js';
import User from '../models/User.js';

export const getActiveSessions = async (req, res) => {
  try {
    const sessions = await dbService.getActiveSessions();
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve active sessions' });
  }
};

export const startSession = async (req, res) => {
  let { subject, classroom, department, assignedTeacherId, assignedTeacher } = req.body;
  let teacherIdInput = assignedTeacherId || assignedTeacher;

  if (!subject || !classroom || !department) {
    return res.status(400).json({ error: 'Subject, classroom, and department are required' });
  }

  try {
    let teacher;
    if (teacherIdInput) {
      if (global.isMongoMock) {
        const list = await dbService.getAllUsers();
        teacher = list.find(u => u.employeeId === teacherIdInput || u.userId === teacherIdInput);
      } else {
        teacher = await User.findOne({ $or: [{ employeeId: teacherIdInput }, { userId: teacherIdInput }] }).lean();
      }
    } else if (req.user.role === 'EMPLOYEE') {
      teacherIdInput = req.user.employeeId || req.user.uid;
      if (global.isMongoMock) {
        const list = await dbService.getAllUsers();
        teacher = list.find(u => u.employeeId === teacherIdInput || u.userId === teacherIdInput);
      } else {
        teacher = await User.findOne({ $or: [{ employeeId: teacherIdInput }, { userId: teacherIdInput }] }).lean();
      }
    } else {
      if (global.isMongoMock) {
        const list = await dbService.getAllUsers();
        teacher = list.find(u => u.role === 'EMPLOYEE');
      } else {
        teacher = await User.findOne({ role: 'EMPLOYEE' }).lean();
      }
    }

    if (!teacher || teacher.role !== 'EMPLOYEE') {
      return res.status(400).json({ error: 'Assigned teacher not found or is invalid.' });
    }

    const session = await dbService.createSession({
      status: 'PENDING',
      subject,
      classroom,
      department,
      assignedTeacherId: teacher.employeeId || teacher.userId,
      teacherName: teacher.name,
      date: new Date().toISOString().split('T')[0],
      startTime: null,
      createdBy: req.user.uid,
      checkInDetails: {}
    });
    res.status(201).json(session);
  } catch (error) {
    console.error('startSession error:', error);
    res.status(500).json({ error: 'Failed to create pending session' });
  }
};

export const approveSession = async (req, res) => {
  const { id } = req.params;
  try {
    const session = await dbService.getSessionById(id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const isWatsonOverride = req.user.uid === 'teacher-uuid-999' && session.assignedTeacherId === 'teacher-uuid-999';
    const isAssignedTeacher = session.assignedTeacherId === req.user.employeeId || session.assignedTeacherId === req.user.uid || isWatsonOverride;

    if (!isAssignedTeacher) {
      return res.status(403).json({ error: 'Access denied: You are not the assigned teacher for this session' });
    }

    if (session.status === 'APPROVED' || session.status === 'ACTIVE') {
      return res.json({ message: 'Session already approved', session });
    }

    if (session.status !== 'PENDING') {
      return res.status(400).json({ error: 'Session is not pending approval' });
    }

    const updated = await dbService.updateSession(id, {
      status: 'APPROVED'
    });

    res.json({ message: 'Attendance session approved successfully.', session: updated });
  } catch (error) {
    console.error('approveSession error:', error);
    res.status(500).json({ error: 'Failed to approve session' });
  }
};

export const startLiveSession = async (req, res) => {
  const { id } = req.params;
  try {
    const session = await dbService.getSessionById(id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const isWatsonOverride = req.user.uid === 'teacher-uuid-999' && session.assignedTeacherId === 'teacher-uuid-999';
    const isAssignedTeacher = session.assignedTeacherId === req.user.employeeId || session.assignedTeacherId === req.user.uid || isWatsonOverride;

    if (!isAssignedTeacher) {
      return res.status(403).json({ error: 'Access denied: You are not the assigned teacher for this session' });
    }

    if (session.status === 'ACTIVE') {
      return res.json({ message: 'Session already active', session });
    }

    if (session.status !== 'APPROVED' && session.status !== 'PENDING') {
      return res.status(400).json({ error: 'Session must be approved before starting' });
    }

    // Check whether ANY ACTIVE session already exists for the requested classroom
    const activeSessions = await dbService.getSessions({ status: 'ACTIVE' });
    const duplicateClassroom = activeSessions.find(s => s.classroom === session.classroom && s.sessionId !== id);

    if (duplicateClassroom) {
      return res.status(400).json({ 
        error: 'This classroom already has an active attendance session.' 
      });
    }

    const updated = await dbService.updateSession(id, {
      status: 'ACTIVE',
      startTime: Date.now()
    });

    res.json({ message: 'Attendance session is now live.', session: updated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ 
        error: 'This classroom already has an active attendance session.' 
      });
    }
    console.error('startLiveSession error:', error);
    res.status(500).json({ error: 'Failed to start live session' });
  }
};

export const declineSession = async (req, res) => {
  const { id } = req.params;
  try {
    const session = await dbService.getSessionById(id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const isWatsonOverride = req.user.uid === 'teacher-uuid-999' && session.assignedTeacherId === 'teacher-uuid-999';
    const isAssignedTeacher = session.assignedTeacherId === req.user.employeeId || session.assignedTeacherId === req.user.uid || isWatsonOverride;

    if (!isAssignedTeacher) {
      return res.status(403).json({ error: 'Access denied: You are not the assigned teacher for this session' });
    }

    if (session.status !== 'PENDING') {
      return res.status(400).json({ error: 'Session is not pending approval' });
    }

    const statusToSet = req.originalUrl && req.originalUrl.includes('decline') ? 'DECLINED' : 'REJECTED';
    const updated = await dbService.updateSession(id, {
      status: statusToSet
    });

    res.json({ message: `Attendance session ${statusToSet.toLowerCase()} successfully.`, session: updated });
  } catch (error) {
    console.error('declineSession error:', error);
    res.status(500).json({ error: 'Failed to decline session' });
  }
};

export const endSession = async (req, res) => {
  const { id } = req.params;
  try {
    const session = await dbService.getSessionById(id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Verify assigned teacher matches calling user
    const isWatsonOverride = req.user.uid === 'teacher-uuid-999' && session.assignedTeacherId === 'teacher-uuid-999';
    const isAssignedTeacher = session.assignedTeacherId === req.user.employeeId || session.assignedTeacherId === req.user.uid || isWatsonOverride;

    if (!isAssignedTeacher) {
      return res.status(403).json({ error: 'Access denied: You are not the assigned teacher for this session' });
    }

    // Idempotency: return existing completed session
    if (session.status === 'COMPLETED') {
      const records = await dbService.getAttendanceRecords({ sessionId: id });
      const present = records.filter(r => r.status === 'PRESENT').length;
      const late = records.filter(r => r.status === 'LATE').length;
      const absent = records.filter(r => r.status === 'ABSENT').length;
      const total = records.length;
      const attendancePercentage = total > 0 ? (((present + late) / total) * 100).toFixed(1) : '0.0';

      return res.json({
        message: 'Attendance session ended successfully.',
        session,
        summary: {
          totalStudents: total,
          present,
          late,
          absent,
          attendancePercentage
        }
      });
    }

    if (session.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    const updated = await dbService.updateSession(id, {
      status: 'COMPLETED',
      endTime: Date.now()
    });

    if (!updated) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Finalize attendance for the session
    // Find expected students: role = STUDENT, status = ACTIVE, department matches session department
    let students = [];
    if (global.isMongoMock) {
      const allUsers = await dbService.getAllUsers();
      students = allUsers.filter(u => u.role === 'STUDENT' && u.status === 'ACTIVE' && u.department === session.department);
    } else {
      students = await User.find({
        role: 'STUDENT',
        status: 'ACTIVE',
        department: session.department
      }).lean();
    }

    const existingRecords = await dbService.getAttendanceRecords({ sessionId: id });
    const existingUserIds = new Set(existingRecords.map(r => r.userId));

    const checkInDetails = session.checkInDetails || {};

    for (const student of students) {
      if (existingUserIds.has(student.userId)) {
        continue;
      }

      const detail = checkInDetails[student.userId];
      const status = detail ? detail.status : 'ABSENT';
      const time = detail ? detail.time : '--';

      await dbService.createAttendanceRecord({
        userId: student.userId,
        userName: student.name,
        userType: student.role,
        date: session.date,
        time,
        status,
        sessionId: id,
        subject: session.subject,
        classroom: session.classroom,
        department: session.department,
        teacher: session.teacherName || 'Assigned Teacher'
      });
    }

    // Retrieve all final records for summary calculation
    const allFinalRecords = await dbService.getAttendanceRecords({ sessionId: id });
    const presentCount = allFinalRecords.filter(r => r.status === 'PRESENT').length;
    const lateCount = allFinalRecords.filter(r => r.status === 'LATE').length;
    const absentCount = allFinalRecords.filter(r => r.status === 'ABSENT').length;
    const totalStudents = allFinalRecords.length;
    const attendancePercentage = totalStudents > 0 ? (((presentCount + lateCount) / totalStudents) * 100).toFixed(1) : '0.0';

    res.json({ 
      message: 'Attendance session ended successfully.', 
      session: updated,
      summary: {
        totalStudents,
        present: presentCount,
        late: lateCount,
        absent: absentCount,
        attendancePercentage
      }
    });
  } catch (error) {
    console.error('endSession error:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
};

export const logAttendance = async (req, res) => {
  const { sessionId, userId } = req.body;
  if (!sessionId || !userId) {
    return res.status(400).json({ error: 'sessionId and userId are required' });
  }

  try {
    const session = await dbService.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Attendance session not found' });
    }

    if (session.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Attendance session has ended.' });
    }

    if (session.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    const user = await dbService.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.department !== session.department) {
      return res.status(400).json({ error: 'User does not belong to the department of this session' });
    }

    const checkedInStudents = session.checkedInStudents || [];
    if (checkedInStudents.includes(userId)) {
      return res.status(400).json({ error: 'Attendance already recorded for this session.' });
    }

    // Grace period rules: First 10 minutes (600,000 ms) = PRESENT, After 10 minutes = LATE
    const startTime = session.startTime || Date.now();
    const elapsed = Date.now() - startTime;
    const status = elapsed <= 10 * 60 * 1000 ? 'PRESENT' : 'LATE';
    const now = new Date();
    const scanTime = now.toTimeString().split(' ')[0];

    // Record check-in details in session
    checkedInStudents.push(userId);
    const checkInDetails = session.checkInDetails || {};
    checkInDetails[userId] = {
      time: scanTime,
      status,
      studentName: user.name,
      studentId: user.studentId || user.userId
    };

    await dbService.updateSession(sessionId, { 
      checkedInStudents,
      checkInDetails
    });

    // Also create attendance record in DB immediately so history & reports reflect live check-in
    const existingRecs = await dbService.getAttendanceRecords({ sessionId, userId });
    if (!existingRecs || existingRecs.length === 0) {
      await dbService.createAttendanceRecord({
        userId: user.userId,
        userName: user.name,
        userType: user.role,
        date: session.date,
        time: scanTime,
        status,
        sessionId,
        subject: session.subject,
        classroom: session.classroom,
        department: session.department,
        teacher: session.teacherName || 'Assigned Teacher'
      });
    }

    res.status(201).json({
      message: 'Attendance marked successfully.',
      sessionId,
      userId,
      status,
      time: scanTime
    });
  } catch (error) {
    console.error('logAttendance error:', error);
    res.status(500).json({ error: 'Failed to log attendance' });
  }
};

export const getAttendanceHistory = async (req, res) => {
  const filters = {};
  if (req.query.userId) filters.userId = req.query.userId;
  if (req.query.sessionId) filters.sessionId = req.query.sessionId;
  if (req.query.date) filters.date = req.query.date;

  // Non-admin can only query their own records (teachers are EMPLOYEES and can query as well, but we should make sure teachers can query records of their assigned sessions)
  // Let's allow ADMIN to view all, EMPLOYEE to view all (so teachers can see lists), and STUDENT to only view their own.
  if (req.user.role === 'STUDENT' && filters.userId && filters.userId !== req.user.uid) {
    return res.status(403).json({ error: 'Access denied: Cannot query other users history' });
  }
  if (req.user.role === 'STUDENT' && !filters.userId) {
    filters.userId = req.user.uid;
  }

  try {
    const records = await dbService.getAttendanceRecords(filters);
    res.json(records);
  } catch (error) {
    console.error('getAttendanceHistory error:', error);
    res.status(500).json({ error: 'Failed to retrieve attendance history' });
  }
};

export const getSessions = async (req, res) => {
  const filters = {};
  if (req.query.status) filters.status = req.query.status;
  if (req.query.date) filters.date = req.query.date;

  try {
    let sessions = await dbService.getSessions(filters);
    
    // Filter sessions for assigned teacher if request is from an EMPLOYEE
    if (req.user.role === 'EMPLOYEE') {
      sessions = sessions.filter(s => s.assignedTeacherId === req.user.employeeId || s.assignedTeacherId === req.user.uid);
    }
    
    res.json(sessions);
  } catch (error) {
    console.error('getSessions error:', error);
    res.status(500).json({ error: 'Failed to retrieve sessions' });
  }
};

