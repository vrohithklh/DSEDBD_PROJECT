import express from 'express';
import { getProfile, enrollFace, verifyFace, deleteProfile, recognizeFace } from '../controllers/faceController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/profile', requireAuth, getProfile);
router.post('/enroll', requireAuth, requireRole(['ADMIN', 'EMPLOYEE']), enrollFace);
router.post('/verify', requireAuth, verifyFace);
router.delete('/profile', requireAuth, requireRole(['ADMIN', 'EMPLOYEE']), deleteProfile);
router.post('/recognize', requireAuth, recognizeFace);

export default router;
