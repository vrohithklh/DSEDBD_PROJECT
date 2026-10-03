import express from 'express';
import { getUsers, getUser, createUser, updateUser, deleteUser } from '../controllers/userController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateUser } from '../middleware/validation.js';

const router = express.Router();

router.get('/', requireAuth, requireRole(['ADMIN', 'EMPLOYEE']), getUsers);
router.get('/:id', requireAuth, getUser);
router.post('/', requireAuth, requireRole(['ADMIN']), validateUser, createUser);
router.put('/:id', requireAuth, updateUser);
router.delete('/:id', requireAuth, requireRole(['ADMIN']), deleteUser);

export default router;
