import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Host and Admin login
router.post('/admin/login', authController.loginAdmin);
router.post('/host/login', authController.loginHost);
router.get('/me', authenticateToken, authController.getCurrentUser);

export default router;
