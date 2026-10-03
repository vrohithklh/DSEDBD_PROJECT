import express from 'express';
import { 
  getActiveSessions, 
  getSessions, 
  startSession, 
  endSession, 
  logAttendance, 
  getAttendanceHistory, 
  approveSession, 
  startLiveSession,
  declineSession 
} from '../controllers/attendanceController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/sessions/active', requireAuth, getActiveSessions);
router.get('/sessions', requireAuth, getSessions);
router.post('/sessions/start', requireAuth, requireRole(['ADMIN']), startSession);
router.post('/sessions/:id/approve', requireAuth, requireRole(['EMPLOYEE']), approveSession);
router.post('/sessions/:id/start-live', requireAuth, requireRole(['EMPLOYEE']), startLiveSession);
router.post('/sessions/:id/decline', requireAuth, requireRole(['EMPLOYEE']), declineSession);
router.post('/sessions/:id/reject', requireAuth, requireRole(['EMPLOYEE']), declineSession);
router.post('/sessions/:id/end', requireAuth, requireRole(['EMPLOYEE']), endSession);
router.post('/log', requireAuth, logAttendance);
router.get('/history', requireAuth, getAttendanceHistory);

export default router;
