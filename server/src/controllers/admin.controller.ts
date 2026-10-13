import { Request, Response } from 'express';
import { adminService } from '../services/admin.service';

export class AdminController {
  async getDashboardOverview(req: Request, res: Response) {
    try {
      const stats = await adminService.getMeetingsOverview();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async getAllHosts(req: Request, res: Response) {
    try {
      const hosts = await adminService.getAllHosts();
      res.json({ hosts });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async createHost(req: Request, res: Response) {
    try {
      const { email, password, displayName } = req.body;
      if (!email || !password || !displayName) {
        res.status(400).json({ error: 'Email, password, and display name are required' });
        return;
      }
      const host = await adminService.createHost({ email, password, displayName });
      res.status(201).json({ message: 'Host account created successfully', host });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  async toggleHostStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { isDisabled } = req.body;
      if (typeof isDisabled !== 'boolean') {
        res.status(400).json({ error: 'isDisabled boolean flag is required' });
        return;
      }
      const host = await adminService.toggleHostStatus(id, isDisabled);
      res.json({ message: `Host account ${isDisabled ? 'disabled' : 'enabled'} successfully`, host });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  async deleteHost(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await adminService.deleteHost(id);
      res.json({ message: 'Host deleted successfully' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  async getAllMeetings(req: Request, res: Response) {
    try {
      const result = await adminService.getAllMeetings();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}

export const adminController = new AdminController();
