import { Router } from 'express';
import { meetingController } from '../controllers/meeting.controller';
import { authenticateToken, requireHost } from '../middleware/auth.middleware';

const router = Router();

// Host creates an instant meeting room
router.post('/instant', authenticateToken, requireHost, meetingController.createInstantMeeting);

// Validate meeting code (accessible to anyone / guest lobby)
router.get('/:code/validate', meetingController.validateMeeting);

// Get active participants roster
router.get('/:code/participants', meetingController.getMeetingParticipants);

// Guest joins meeting without registration
router.post('/:code/join', meetingController.joinMeetingAsGuest);

// A person left the room. The meeting stays open until it has been empty for 5 minutes.
router.post('/:id/leave', meetingController.leaveMeeting);

// Host or Admin ends meeting for all
router.post('/:id/end', authenticateToken, meetingController.endMeeting);

export default router;
