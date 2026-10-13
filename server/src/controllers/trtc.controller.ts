import { Request, Response } from 'express';
import { trtcService } from '../services/trtc.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class TRTCController {
  /**
   * Generates a temporary UserSig for an authenticated host or validated participant
   */
  async getUserSig(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id || (req.query.userId as string);
      if (!userId) {
        res.status(400).json({ error: 'userId is required' });
        return;
      }

      const credentials = trtcService.generateUserSig(userId);
      res.json(credentials);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}

export const trtcController = new TRTCController();
