import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// Protect all admin routes
router.use(authenticateToken, requireAdmin);

// Dashboard overview & metrics
router.get('/dashboard', adminController.getDashboardOverview);

// Host management
router.get('/hosts', adminController.getAllHosts);
router.post('/hosts', adminController.createHost);
router.patch('/hosts/:id/status', adminController.toggleHostStatus);
router.delete('/hosts/:id', adminController.deleteHost);

// Meetings oversight
router.get('/meetings', adminController.getAllMeetings);

export default router;
