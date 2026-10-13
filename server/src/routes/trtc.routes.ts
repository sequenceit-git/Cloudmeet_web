import { Router } from 'express';
import { trtcController } from '../controllers/trtc.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Ephemeral userSig issuance
router.get('/usersig', authenticateToken, trtcController.getUserSig);

export default router;
