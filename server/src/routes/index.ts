import { Router } from 'express';
import authRoutes from './auth.routes';
import meetingRoutes from './meeting.routes';
import adminRoutes from './admin.routes';
import trtcRoutes from './trtc.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/meetings', meetingRoutes);
router.use('/admin', adminRoutes);
router.use('/trtc', trtcRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'CloudNews API Engine',
  });
});

export default router;
