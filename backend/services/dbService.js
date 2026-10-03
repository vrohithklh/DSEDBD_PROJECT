import User from '../models/User.js';
import FaceProfile from '../models/FaceProfile.js';
import { db, isFirebaseEnabled } from '../config/firebase.js';
import Attendance from '../models/Attendance.js';
import AttendanceSession from '../models/AttendanceSession.js';
import Department from '../models/Department.js';
import Classroom from '../models/Classroom.js';
import Subject from '../models/Subject.js';

// In-Memory Mock Store Fallback
const mockDb = {
  users: [
    {
      userId: 'admin-uuid-123',
      name: 'System Administrator',
      email: 'admin@college.edu',
      password: 'password123', // Clean password for mock logins
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
      password: 'password123',
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
      password: 'password123',
      phone: '9876543212',
      employeeId: 'EMP101',
      role: 'EMPLOYEE',
      department: 'Computer Science',
      designation: 'Assistant Professor',
      status: 'ACTIVE',
      createdAt: Date.now()
    }
  ],
  faceProfiles: [],
  attendance: [],
  attendanceSessions: [],
  departments: [
    { id: 'dept-1', name: 'Computer Science' },
    { id: 'dept-2', name: 'Electronics' },
    { id: 'dept-3', name: 'Mechanical' }
  ],
  classrooms: [
    { id: 'room-101', name: 'Room 101' },
    { id: 'room-102', name: 'Room 102' },
    { id: 'lab-a', name: 'Lab A' }
  ],
  subjects: [
    { id: 'sub-1', name: 'Operating Systems' },
    { id: 'sub-2', name: 'Machine Learning' },
    { id: 'sub-3', name: 'Data Structures' }
  ]
};

export const dbService = {
  // === USERS ===
  async getAllUsers() {
    if (global.isMongoMock) {
      return mockDb.users;
    }
    return User.find().lean();
  },

  async getUserById(userId) {
    if (global.isMongoMock) {
      return mockDb.users.find(u => u.userId === userId) || null;
    }
    return User.findOne({ userId }).lean();
  },

  async getUserByEmail(email) {
    if (global.isMongoMock) {
      return mockDb.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
    }
    return User.findOne({ email: email.toLowerCase() }).lean();
  },

  async createUser(userData) {
    const id = userData.userId || `user-${Date.now()}`;
    const timestamp = Date.now();
    const newUser = { ...userData, userId: id, createdAt: userData.createdAt || timestamp };
    
    if (global.isMongoMock) {
      mockDb.users.push(newUser);
      return newUser;
    }
    
    const dbUser = new User(newUser);
    await dbUser.save();
    return dbUser.toObject();
  },

  async updateUser(userId, data) {
    if (global.isMongoMock) {
      const idx = mockDb.users.findIndex(u => u.userId === userId);
      if (idx !== -1) {
        mockDb.users[idx] = { ...mockDb.users[idx], ...data };
        return mockDb.users[idx];
      }
      return null;
    }
    return User.findOneAndUpdate({ userId }, data, { new: true }).lean();
  },

  async deleteUser(userId) {
    if (global.isMongoMock) {
      const idx = mockDb.users.findIndex(u => u.userId === userId);
      if (idx !== -1) {
        mockDb.users.splice(idx, 1);
        return true;
      }
      return false;
    }
    const result = await User.deleteOne({ userId });
    return result.deletedCount > 0;
  },

  // === FACE PROFILES ===
  async getFaceProfileByUserId(userId) {
    if (isFirebaseEnabled && db) {
      try {
        const docRef = db.collection('faceProfiles').doc(userId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          return docSnap.data();
        }
      } catch (err) {
        console.error('❌ Failed to retrieve face profile from Firestore:', err.message);
      }
    }

    if (global.isMongoMock) {
      return mockDb.faceProfiles.find(f => f.userId === userId) || null;
    }
    return FaceProfile.findOne({ userId }).lean();
  },

  async getAllFaceProfiles() {
    if (isFirebaseEnabled && db) {
      try {
        const snapshot = await db.collection('faceProfiles').get();
        const profiles = [];
        snapshot.forEach(doc => {
          profiles.push(doc.data());
        });
        return profiles;
      } catch (err) {
        console.error('❌ Failed to retrieve all face profiles from Firestore:', err.message);
      }
    }

    if (global.isMongoMock) {
      return mockDb.faceProfiles;
    }
    return FaceProfile.find().lean();
  },

  async createOrUpdateFaceProfile(faceProfile) {
    const userId = faceProfile.userId;
    const existing = await this.getFaceProfileByUserId(userId);
    const timestamp = Date.now();
    
    let result;
    if (existing) {
      const updated = { ...existing, ...faceProfile, updatedAt: timestamp };
      if (global.isMongoMock) {
        const idx = mockDb.faceProfiles.findIndex(f => f.userId === userId);
        mockDb.faceProfiles[idx] = updated;
        result = updated;
      } else {
        result = await FaceProfile.findOneAndUpdate(
          { userId },
          { ...faceProfile, updatedAt: timestamp },
          { new: true }
        ).lean();
      }
    } else {
      const faceProfileId = faceProfile.faceProfileId || `face-${Date.now()}`;
      const newProfile = { ...faceProfile, faceProfileId, createdAt: timestamp, updatedAt: timestamp };
      if (global.isMongoMock) {
        mockDb.faceProfiles.push(newProfile);
        result = newProfile;
      } else {
        const dbProfile = new FaceProfile(newProfile);
        await dbProfile.save();
        result = dbProfile.toObject();
      }
    }

    if (isFirebaseEnabled && db) {
      try {
        const docRef = db.collection('faceProfiles').doc(userId);
        await docRef.set({
          faceProfileId: result.faceProfileId,
          userId: result.userId,
          faceFeatures: result.faceFeatures,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt
        }, { merge: true });
        console.log(`🔥 Synchronized face profile to Firestore for user: ${userId}`);
      } catch (err) {
        console.error('❌ Failed to sync face profile to Firestore:', err.message);
      }
    }

    return result;
  },

  async deleteFaceProfile(userId) {
    if (global.isMongoMock) {
      const idx = mockDb.faceProfiles.findIndex(f => f.userId === userId);
      if (idx !== -1) {
        mockDb.faceProfiles.splice(idx, 1);
      }
    } else {
      await FaceProfile.deleteOne({ userId });
    }

    if (isFirebaseEnabled && db) {
      try {
        await db.collection('faceProfiles').doc(userId).delete();
        console.log(`🔥 Deleted face profile from Firestore for user: ${userId}`);
      } catch (err) {
        console.error('❌ Failed to delete face profile from Firestore:', err.message);
      }
    }
    return true;
  },

  // === ATTENDANCE ===
  async getAttendanceRecords(filters = {}) {
    if (isFirebaseEnabled && db) {
      try {
        let query = db.collection('attendance');
        if (filters.userId) {
          query = query.where('userId', '==', filters.userId);
        }
        if (filters.sessionId) {
          query = query.where('sessionId', '==', filters.sessionId);
        }
        if (filters.date) {
          query = query.where('date', '==', filters.date);
        }
        const snapshot = await query.get();
        const records = [];
        snapshot.forEach(doc => {
          records.push(doc.data());
        });
        return records;
      } catch (err) {
        console.error('❌ Failed to fetch attendance records from Firestore:', err.message);
      }
    }

    if (global.isMongoMock) {
      let records = [...mockDb.attendance];
      if (filters.userId) {
        records = records.filter(r => r.userId === filters.userId);
      }
      if (filters.sessionId) {
        records = records.filter(r => r.sessionId === filters.sessionId);
      }
      if (filters.date) {
        records = records.filter(r => r.date === filters.date);
      }
      return records;
    }

    const query = {};
    if (filters.userId) query.userId = filters.userId;
    if (filters.sessionId) query.sessionId = filters.sessionId;
    if (filters.date) query.date = filters.date;
    return Attendance.find(query).lean();
  },

  async createAttendanceRecord(record) {
    const attendanceId = record.attendanceId || `att-${Date.now()}`;
    const newRecord = { ...record, attendanceId, createdAt: Date.now() };
    
    let result;
    if (global.isMongoMock) {
      mockDb.attendance.push(newRecord);
      result = newRecord;
    } else {
      const dbRecord = new Attendance(newRecord);
      await dbRecord.save();
      result = dbRecord.toObject();
    }

    if (isFirebaseEnabled && db) {
      try {
        await db.collection('attendance').doc(attendanceId).set(result);
        console.log(`🔥 Synchronized attendance record to Firestore: ${attendanceId}`);
      } catch (err) {
        console.error('❌ Failed to sync attendance to Firestore:', err.message);
      }
    }
    return result;
  },

  // === ATTENDANCE SESSIONS ===
  async getSessions(filters = {}) {
    if (isFirebaseEnabled && db) {
      try {
        let query = db.collection('attendanceSessions');
        if (filters.status) {
          query = query.where('status', '==', filters.status);
        }
        if (filters.date) {
          query = query.where('date', '==', filters.date);
        }
        const snapshot = await query.get();
        const sessions = [];
        snapshot.forEach(doc => {
          sessions.push(doc.data());
        });
        return sessions;
      } catch (err) {
        console.error('❌ Failed to fetch sessions from Firestore:', err.message);
      }
    }

    if (global.isMongoMock) {
      let list = [...mockDb.attendanceSessions];
      if (filters.status) {
        list = list.filter(s => s.status === filters.status);
      }
      if (filters.date) {
        list = list.filter(s => s.date === filters.date);
      }
      return list;
    }

    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.date) query.date = filters.date;
    return AttendanceSession.find(query).lean();
  },

  async getActiveSessions() {
    if (isFirebaseEnabled && db) {
      try {
        const snapshot = await db.collection('attendanceSessions').where('status', '==', 'ACTIVE').get();
        const sessions = [];
        snapshot.forEach(doc => {
          sessions.push(doc.data());
        });
        return sessions;
      } catch (err) {
        console.error('❌ Failed to fetch active sessions from Firestore:', err.message);
      }
    }

    if (global.isMongoMock) {
      return mockDb.attendanceSessions.filter(s => s.status === 'ACTIVE');
    }
    return AttendanceSession.find({ status: 'ACTIVE' }).lean();
  },

  async getSessionById(sessionId) {
    if (isFirebaseEnabled && db) {
      try {
        const docRef = db.collection('attendanceSessions').doc(sessionId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          return docSnap.data();
        }
      } catch (err) {
        console.error('❌ Failed to fetch session from Firestore:', err.message);
      }
    }

    if (global.isMongoMock) {
      return mockDb.attendanceSessions.find(s => s.sessionId === sessionId) || null;
    }
    return AttendanceSession.findOne({ sessionId }).lean();
  },

  async createSession(session) {
    const sessionId = session.sessionId || `sess-${Date.now()}`;
    const newSession = { 
      checkedInStudents: [], 
      ...session, 
      sessionId, 
      createdAt: Date.now() 
    };
    
    let result;
    if (global.isMongoMock) {
      mockDb.attendanceSessions.push(newSession);
      result = newSession;
    } else {
      const dbSession = new AttendanceSession(newSession);
      await dbSession.save();
      result = dbSession.toObject();
    }

    if (isFirebaseEnabled && db) {
      try {
        await db.collection('attendanceSessions').doc(sessionId).set(result);
        console.log(`🔥 Synchronized session to Firestore: ${sessionId}`);
      } catch (err) {
        console.error('❌ Failed to sync session to Firestore:', err.message);
      }
    }
    return result;
  },

  async updateSession(sessionId, data) {
    let result;
    if (global.isMongoMock) {
      const idx = mockDb.attendanceSessions.findIndex(s => s.sessionId === sessionId);
      if (idx !== -1) {
        mockDb.attendanceSessions[idx] = { ...mockDb.attendanceSessions[idx], ...data };
        result = mockDb.attendanceSessions[idx];
      } else {
        result = null;
      }
    } else {
      result = await AttendanceSession.findOneAndUpdate({ sessionId }, data, { new: true }).lean();
    }

    if (result && isFirebaseEnabled && db) {
      try {
        await db.collection('attendanceSessions').doc(sessionId).set(result, { merge: true });
        console.log(`🔥 Updated session in Firestore: ${sessionId}`);
      } catch (err) {
        console.error('❌ Failed to update session in Firestore:', err.message);
      }
    }
    return result;
  },

  // === AUXILIARY METADATA (DEPARTMENTS, CLASSROOMS, SUBJECTS) ===
  async getDepartments() {
    if (global.isMongoMock) return mockDb.departments;
    return Department.find().lean();
  },

  async getClassrooms() {
    if (global.isMongoMock) return mockDb.classrooms;
    return Classroom.find().lean();
  },

  async getSubjects() {
    if (global.isMongoMock) return mockDb.subjects;
    return Subject.find().lean();
  },

  async createDepartment(name) {
    const id = `dept-${Date.now()}`;
    if (global.isMongoMock) {
      const d = { id, name };
      mockDb.departments.push(d);
      return d;
    }
    const newDept = new Department({ id, name });
    await newDept.save();
    return { id, name };
  },

  async createClassroom(name) {
    const id = `room-${Date.now()}`;
    if (global.isMongoMock) {
      const r = { id, name };
      mockDb.classrooms.push(r);
      return r;
    }
    const newRoom = new Classroom({ id, name });
    await newRoom.save();
    return { id, name };
  },

  async createSubject(name) {
    const id = `sub-${Date.now()}`;
    if (global.isMongoMock) {
      const s = { id, name };
      mockDb.subjects.push(s);
      return s;
    }
    const newSub = new Subject({ id, name });
    await newSub.save();
    return { id, name };
  }
};
