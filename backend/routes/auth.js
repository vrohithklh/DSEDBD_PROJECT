import express from 'express';
import { login, getCurrentUser, forgotPassword, register } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/forgot-password', forgotPassword);
router.get('/me', requireAuth, getCurrentUser);

export default router;
