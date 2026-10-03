import express from 'express';
import { getSummaryStats, getDetailedReport } from '../controllers/reportsController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/stats', requireAuth, requireRole(['ADMIN']), getSummaryStats);
router.get('/detailed', requireAuth, requireRole(['ADMIN']), getDetailedReport);

export default router;
