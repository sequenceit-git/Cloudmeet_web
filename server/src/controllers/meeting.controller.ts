import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { Request, Response } from 'express';
import { meetingService } from '../services/meeting.service';
import { broadcastMeetingChat, closeMeetingRoom } from '../services/meeting-chat';
import { meetingFileDir, newFileId, resolveMeetingFile, safeMeetingCode } from '../services/meeting-files';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      try {
        const dir = meetingFileDir(String(req.params.code || ''));
        cb(null, dir);
      } catch (err: any) {
        cb(err, '');
      }
    },
    filename: (_req, file, cb) => {
      try {
        const stored = newFileId(file.originalname || 'file');
        cb(null, stored.storedName);
      } catch (err: any) {
        cb(err, '');
      }
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
});

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

  async leaveMeeting(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = String(req.body?.userId || '').trim();
      if (!id || !userId) {
        res.status(400).json({ error: 'Meeting id and user id are required' });
        return;
      }
      await meetingService.markParticipantLeft(id, userId);
      res.json({ message: 'Left meeting' });
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
      if (result?.meetingCode) closeMeetingRoom(result.meetingCode);
      res.json({ message: 'Meeting ended successfully', meeting: result });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  uploadMeetingFile = [
    upload.single('file'),
    async (req: Request, res: Response) => {
      try {
        const code = safeMeetingCode(String(req.params.code || ''));
        const validation = await meetingService.validateMeetingCode(code);
        if (!validation.valid) {
          res.status(404).json({ error: validation.reason || 'Meeting not found' });
          return;
        }
        const file = (req as any).file;
        const userId = String(req.body?.userId || '').trim();
        const displayName = String(req.body?.displayName || 'Guest').trim() || 'Guest';
        if (!file || !userId) {
          res.status(400).json({ error: 'File and user id are required' });
          return;
        }
        const id = path.basename(file.filename, path.extname(file.filename));
        const url = `/api/v1/meetings/${encodeURIComponent(code)}/files/${id}`;
        const kind = file.mimetype.startsWith('image/') ? 'image' : 'file';
        broadcastMeetingChat(code, {
          type: kind,
          id: crypto.randomBytes(8).toString('hex'),
          userId,
          displayName,
          url,
          name: file.originalname,
          size: file.size,
          at: new Date().toISOString(),
        });
        res.status(201).json({ id, url, name: file.originalname, size: file.size, type: kind });
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Upload failed' });
      }
    },
  ];

  async downloadMeetingFile(req: Request, res: Response) {
    try {
      const code = safeMeetingCode(String(req.params.code || ''));
      const validation = await meetingService.validateMeetingCode(code);
      if (!validation.valid) {
        res.status(404).json({ error: 'Meeting not found' });
        return;
      }
      const filePath = resolveMeetingFile(code, String(req.params.fileId || ''));
      if (!filePath) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      res.sendFile(filePath);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
}

export const meetingController = new MeetingController();
