import bcrypt from 'bcryptjs';
import { prisma } from '../database/prisma';
import { ENV } from '../config/env';
import { inMemoryStore, MemoryHost } from '../database/store';

export class AdminService {
  async getAllHosts() {
    try {
      return await prisma.host.findMany({
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          isDisabled: true,
          createdAt: true,
          _count: {
            select: { meetings: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (e) {
      // Memory fallback
      return inMemoryStore.hosts.map((h) => ({
        id: h.id,
        email: h.email,
        displayName: h.displayName,
        avatarUrl: h.avatarUrl,
        isDisabled: h.isDisabled,
        createdAt: h.createdAt,
        _count: {
          meetings: inMemoryStore.meetings.filter((m) => m.hostId === h.id).length,
        },
      }));
    }
  }

  async createHost(data: { email: string; password: string; displayName: string }) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    try {
      const existing = await prisma.host.findUnique({ where: { email: data.email } });
      if (existing) {
        throw new Error('Host with this email already exists');
      }

      return await prisma.host.create({
        data: {
          email: data.email,
          passwordHash,
          displayName: data.displayName,
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          isDisabled: true,
          createdAt: true,
        },
      });
    } catch (e: any) {
      if (e.message && e.message.includes('already exists')) {
        throw e;
      }

      // Memory fallback
      const existsMem = inMemoryStore.hosts.some((h) => h.email.toLowerCase() === data.email.toLowerCase());
      if (existsMem) {
        throw new Error('Host with this email already exists');
      }

      const newHost: MemoryHost = {
        id: `host_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        email: data.email,
        passwordHash,
        displayName: data.displayName,
        isDisabled: false,
        createdAt: new Date(),
      };
      inMemoryStore.hosts.unshift(newHost);

      return {
        id: newHost.id,
        email: newHost.email,
        displayName: newHost.displayName,
        isDisabled: newHost.isDisabled,
        createdAt: newHost.createdAt,
      };
    }
  }

  async toggleHostStatus(hostId: string, isDisabled: boolean) {
    try {
      const host = await prisma.host.findUnique({ where: { id: hostId } });
      if (!host) {
        throw new Error('Host not found');
      }

      return await prisma.host.update({
        where: { id: hostId },
        data: { isDisabled },
        select: {
          id: true,
          email: true,
          displayName: true,
          isDisabled: true,
        },
      });
    } catch (e: any) {
      if (e.message === 'Host not found') throw e;

      // Memory fallback
      const memHost = inMemoryStore.hosts.find((h) => h.id === hostId);
      if (!memHost) throw new Error('Host not found');
      memHost.isDisabled = isDisabled;

      return {
        id: memHost.id,
        email: memHost.email,
        displayName: memHost.displayName,
        isDisabled: memHost.isDisabled,
      };
    }
  }

  async deleteHost(hostId: string) {
    try {
      return await prisma.host.delete({
        where: { id: hostId },
      });
    } catch (e) {
      // Memory fallback
      inMemoryStore.hosts = inMemoryStore.hosts.filter((h) => h.id !== hostId);
      return { id: hostId };
    }
  }

  async getMeetingsOverview() {
    try {
      const active = await prisma.meeting.count({ where: { status: 'ACTIVE' } });
      const total = await prisma.meeting.count();
      const hostsCount = await prisma.host.count();
      const liveParticipants = await prisma.participant.count({
        where: { leftAt: null, meeting: { status: 'ACTIVE' } },
      });

      const recentMeetings = await prisma.meeting.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          host: {
            select: { id: true, displayName: true, email: true },
          },
          _count: {
            select: { participants: true },
          },
        },
      });

      return {
        activeMeetingsCount: active,
        totalMeetingsCount: total,
        totalHostsCount: hostsCount,
        liveParticipants,
        sdkAppId: ENV.TRTC_SDK_APP_ID,
        sdkConfigured: ENV.TRTC_SDK_APP_ID > 0 && ENV.TRTC_SECRET_KEY.length > 16,
        recentMeetings,
      };
    } catch (e) {
      // Memory fallback
      const activeMeetings = inMemoryStore.meetings.filter((m) => m.status === 'ACTIVE');
      const active = activeMeetings.length;
      const total = inMemoryStore.meetings.length;
      const hostsCount = inMemoryStore.hosts.length;
      const liveParticipants = activeMeetings.reduce((sum, m) => sum + m.participantsCount, 0);

      return {
        activeMeetingsCount: active,
        totalMeetingsCount: total,
        totalHostsCount: hostsCount,
        liveParticipants,
        sdkAppId: ENV.TRTC_SDK_APP_ID,
        sdkConfigured: ENV.TRTC_SDK_APP_ID > 0 && ENV.TRTC_SECRET_KEY.length > 16,
        recentMeetings: inMemoryStore.meetings.slice(0, 10).map((m) => ({
          id: m.id,
          meetingCode: m.meetingCode,
          title: m.title,
          status: m.status,
          createdAt: m.startedAt,
          host: {
            id: m.hostId,
            displayName: m.hostName,
            email: m.hostEmail,
          },
          _count: {
            participants: m.participantsCount,
          },
        })),
      };
    }
  }

  async getAllMeetings(page = 1, pageSize = 10) {
    const safePage = Math.max(1, page);
    const safeSize = Math.max(1, Math.min(pageSize, 50));
    try {
      const total = await prisma.meeting.count();
      const meetings = await prisma.meeting.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeSize,
        take: safeSize,
        include: {
          host: {
            select: { id: true, displayName: true, email: true },
          },
          _count: {
            select: { participants: true },
          },
        },
      });
      return { meetings, total, page: safePage, pageSize: safeSize };
    } catch (e) {
      const sorted = [...inMemoryStore.meetings].sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
      const start = (safePage - 1) * safeSize;
      return {
        total: sorted.length,
        page: safePage,
        pageSize: safeSize,
        meetings: sorted.slice(start, start + safeSize).map((m) => ({
          id: m.id,
          meetingCode: m.meetingCode,
          title: m.title,
          status: m.status,
          createdAt: m.startedAt,
          host: {
            id: m.hostId,
            displayName: m.hostName,
            email: m.hostEmail,
          },
          _count: {
            participants: m.participantsCount,
          },
        })),
      };
    }
  }

  async endMeeting(meetingId: string) {
    try {
      const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
      if (!meeting) {
        throw new Error('Meeting not found');
      }
      return await prisma.meeting.update({
        where: { id: meetingId },
        data: { status: 'ENDED', endedAt: new Date() },
      });
    } catch (e: any) {
      if (e.message === 'Meeting not found') throw e;

      // Memory fallback
      const mem = inMemoryStore.meetings.find((m) => m.id === meetingId);
      if (!mem) throw new Error('Meeting not found');
      mem.status = 'ENDED';
      mem.endedAt = new Date();
      return mem;
    }
  }

  async deleteMeeting(meetingId: string) {
    try {
      const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
      if (!meeting) {
        throw new Error('Meeting not found');
      }
      await prisma.meeting.delete({ where: { id: meetingId } });
      return { id: meetingId };
    } catch (e: any) {
      if (e.message === 'Meeting not found') throw e;
      const before = inMemoryStore.meetings.length;
      inMemoryStore.meetings = inMemoryStore.meetings.filter((m) => m.id !== meetingId);
      if (inMemoryStore.meetings.length === before) {
        throw new Error('Meeting not found');
      }
      return { id: meetingId };
    }
  }
}

export const adminService = new AdminService();
