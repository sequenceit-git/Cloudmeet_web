import { Router } from 'express';
import { meetingController } from '../controllers/meeting.controller';
import { authenticateToken, requireHost } from '../middleware/auth.middleware';

const router = Router();

// Host creates an instant meeting room
router.post('/instant', authenticateToken, requireHost, meetingController.createInstantMeeting);

// Validate meeting code (accessible to anyone / guest lobby)
router.get('/:code/validate', meetingController.validateMeeting);

// Guest joins meeting without registration
router.post('/:code/join', meetingController.joinMeetingAsGuest);

// Host ends meeting for all
router.post('/:id/end', authenticateToken, requireHost, meetingController.endMeeting);

export default router;
