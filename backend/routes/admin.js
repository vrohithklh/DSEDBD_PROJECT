import express from 'express';
import { getMetadata, addDepartment, addClassroom, addSubject } from '../controllers/adminController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/metadata', requireAuth, getMetadata);
router.post('/departments', requireAuth, requireRole(['ADMIN']), addDepartment);
router.post('/classrooms', requireAuth, requireRole(['ADMIN']), addClassroom);
router.post('/subjects', requireAuth, requireRole(['ADMIN']), addSubject);

export default router;
