import { Request, Response } from 'express';
import { meetingService } from '../services/meeting.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class MeetingController {
  async createInstantMeeting(req: AuthenticatedRequest, res: Response) {
    try {
      const hostId = req.user?.id;
      if (!hostId) {
        res.status(401).json({ error: 'Unauthorized host' });
        return;
      }
      const { title } = req.body;
      const result = await meetingService.createInstantMeeting(hostId, title);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  async validateMeeting(req: Request, res: Response) {
    try {
      const { code } = req.params;
      const result = await meetingService.validateMeetingCode(code);
      if (!result.valid) {
        res.status(404).json(result);
        return;
      }
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  async joinMeetingAsGuest(req: Request, res: Response) {
    try {
      const { code } = req.params;
      const { displayName, userId } = req.body;
      if (!displayName) {
        res.status(400).json({ error: 'Display name is required' });
        return;
      }
      const result = await meetingService.joinMeetingAsGuest(code, displayName, userId);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  async getMeetingParticipants(req: Request, res: Response) {
    try {
      const { code } = req.params;
      const participants = await meetingService.getMeetingParticipants(code);
      res.json({ participants });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  async endMeeting(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
      const { id } = req.params;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized user' });
        return;
      }
      const result = await meetingService.endMeeting(id, userId, isAdmin);
      res.json({ message: 'Meeting ended successfully', meeting: result });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
}

export const meetingController = new MeetingController();
