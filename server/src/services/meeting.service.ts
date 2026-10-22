import { prisma } from '../database/prisma';
import { inMemoryStore, MemoryMeeting } from '../database/store';
import { toCallUserId, trtcService } from './trtc.service';

export class MeetingService {
  /**
   * Generates a unique 9-digit formatted meeting code (e.g., 783-492-105)
   */
  private generateMeetingCode(): string {
    const min = 100000000;
    const max = 999999999;
    const num = Math.floor(min + Math.random() * (max - min)).toString();
    return `${num.slice(0, 3)}-${num.slice(3, 6)}-${num.slice(6, 9)}`;
  }

  /**
   * Host creates an instant meeting
   */
  async createInstantMeeting(hostId: string, title?: string) {
    const meetingCode = this.generateMeetingCode();

    try {
      const host = await prisma.host.findUnique({ where: { id: hostId } });
      if (!host) {
        throw new Error('Host not found');
      }
      if (host.isDisabled) {
        throw new Error('Host account is disabled');
      }

      const meeting = await prisma.meeting.create({
        data: {
          meetingCode,
          title: title || `${host.displayName}'s Meeting`,
          hostId,
          status: 'ACTIVE',
        },
        include: {
          host: {
            select: { id: true, displayName: true, username: true },
          },
        },
      });

      // Record Host as first participant
      await prisma.participant.create({
        data: {
          meetingId: meeting.id,
          userId: hostId,
          displayName: host.displayName,
          role: 'HOST',
        },
      });

      const trtcCreds = trtcService.generateUserSig(hostId);
      const trtcRoomId = parseInt(meetingCode.replace(/-/g, ''), 10);

      return {
        meeting,
        trtc: {
          ...trtcCreds,
          roomId: trtcRoomId,
          strRoomId: trtcRoomId.toString(),
          isHost: true,
          hostUserId: trtcCreds.userId,
          displayName: host.displayName,
        },
      };
    } catch (e: any) {
      if (e.message && (e.message.includes('not found') || e.message.includes('disabled'))) {
        throw e;
      }

      // Memory fallback
      const memHost = inMemoryStore.hosts.find((h) => h.id === hostId);
      const hostName = memHost?.displayName || 'Host';
      const hostUsername = memHost?.username || 'host';

      const memMeeting: MemoryMeeting = {
        id: `meet_${Date.now()}`,
        meetingCode,
        title: title || `${hostName}'s Meeting`,
        hostId,
        hostName,
        hostUsername,
        status: 'ACTIVE',
        startedAt: new Date(),
        participantsCount: 1,
      };
      inMemoryStore.meetings.unshift(memMeeting);

      const trtcCreds = trtcService.generateUserSig(hostId);
      const trtcRoomId = parseInt(meetingCode.replace(/-/g, ''), 10);

      return {
        meeting: {
          id: memMeeting.id,
          meetingCode: memMeeting.meetingCode,
          title: memMeeting.title,
          status: memMeeting.status,
          host: { id: hostId, displayName: hostName, username: hostUsername },
        },
        trtc: {
          ...trtcCreds,
          roomId: trtcRoomId,
          strRoomId: trtcRoomId.toString(),
          isHost: true,
          hostUserId: trtcCreds.userId,
          displayName: hostName,
        },
      };
    }
  }

  /**
   * Validate meeting code before joining
   */
  async validateMeetingCode(code: string) {
    const normalized = code.replace(/\s+/g, '').trim();

    try {
      let meeting = await prisma.meeting.findUnique({
        where: { meetingCode: normalized },
        include: { host: { select: { displayName: true } } },
      });

      if (!meeting && normalized.length === 9) {
        const withDashes = `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6, 9)}`;
        meeting = await prisma.meeting.findUnique({
          where: { meetingCode: withDashes },
          include: { host: { select: { displayName: true } } },
        });
      }

      if (meeting) {
        if (meeting.status === 'ENDED') {
          return { valid: false, reason: 'This meeting has already ended' };
        }
        return {
          valid: true,
          meeting: {
            id: meeting.id,
            meetingCode: meeting.meetingCode,
            title: meeting.title,
            hostName: meeting.host.displayName,
            hostUserId: toCallUserId(meeting.hostId),
            status: meeting.status,
          },
        };
      }
    } catch (e) {
      // Memory fallback check
    }

    // Check memory store
    const mem = inMemoryStore.meetings.find(
      (m) =>
        m.meetingCode === normalized ||
        m.meetingCode.replace(/-/g, '') === normalized.replace(/-/g, '')
    );

    if (mem) {
      if (mem.status === 'ENDED') {
        return { valid: false, reason: 'This meeting has already ended' };
      }
      return {
        valid: true,
        meeting: {
          id: mem.id,
          meetingCode: mem.meetingCode,
          title: mem.title,
          hostName: mem.hostName,
          hostUserId: toCallUserId(mem.hostId),
          status: mem.status,
        },
      };
    }

    return { valid: false, reason: 'Meeting code not found' };
  }

  /**
   * Guest joins meeting
   */
  async joinMeetingAsGuest(meetingCode: string, guestDisplayName: string, guestUserId?: string) {
    const validation = await this.validateMeetingCode(meetingCode);
    if (!validation.valid || !validation.meeting) {
      throw new Error(validation.reason || 'Invalid meeting');
    }

    const userId = toCallUserId(
      guestUserId || `guest_${Date.now()}_${Math.floor(Math.random() * 1000)}`
    );

    try {
      await prisma.participant.create({
        data: {
          meetingId: validation.meeting.id,
          userId,
          displayName: guestDisplayName || 'Guest',
          role: 'GUEST',
        },
      });
    } catch (e) {
      // Update memory count if present
      const mem = inMemoryStore.meetings.find((m) => m.id === validation.meeting!.id);
      if (mem) {
        mem.participantsCount += 1;
        mem.emptySince = undefined;
      }
    }

    const trtcCreds = trtcService.generateUserSig(userId);
    const trtcRoomId = parseInt(validation.meeting.meetingCode.replace(/-/g, ''), 10);

    return {
      meeting: validation.meeting,
      trtc: {
        ...trtcCreds,
        roomId: trtcRoomId,
        strRoomId: trtcRoomId.toString(),
        displayName: guestDisplayName,
        isHost: false,
        hostUserId: validation.meeting.hostUserId,
      },
    };
  }

  /**
   * Get active participants in a meeting
   */
  async getMeetingParticipants(code: string) {
    const normalized = code.replace(/\s+/g, '').trim();
    let meeting: any = null;

    try {
      meeting = await prisma.meeting.findUnique({
        where: { meetingCode: normalized },
        include: {
          participants: {
            where: { leftAt: null },
            orderBy: { joinedAt: 'asc' },
            select: {
              id: true,
              userId: true,
              displayName: true,
              role: true,
              joinedAt: true,
            },
          },
        },
      });

      if (!meeting && normalized.length === 9) {
        const withDashes = `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6, 9)}`;
        meeting = await prisma.meeting.findUnique({
          where: { meetingCode: withDashes },
          include: {
            participants: {
              where: { leftAt: null },
              orderBy: { joinedAt: 'asc' },
              select: {
                id: true,
                userId: true,
                displayName: true,
                role: true,
                joinedAt: true,
              },
            },
          },
        });
      }

      if (meeting) {
        return meeting.participants;
      }
    } catch (e) {
      // Memory fallback
    }

    const mem = inMemoryStore.meetings.find(
      (m) =>
        m.meetingCode === normalized ||
        m.meetingCode.replace(/-/g, '') === normalized.replace(/-/g, '')
    );
    if (mem) {
      return [
        {
          id: 'host_p',
          userId: mem.hostId,
          displayName: mem.hostName,
          role: 'HOST',
          joinedAt: mem.startedAt,
        },
      ];
    }

    return [];
  }

  /**
   * Marks one person as having left. Guests send their room user id.
   */
  async markParticipantLeft(meetingId: string, userId: string) {
    const now = new Date();
    const normalized = userId.trim();
    if (!meetingId || !normalized) return;

    try {
      await prisma.participant.updateMany({
        where: { meetingId, userId: normalized, leftAt: null },
        data: { leftAt: now },
      });

      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        select: { hostId: true },
      });
      if (meeting && toCallUserId(meeting.hostId) === normalized) {
        await prisma.participant.updateMany({
          where: { meetingId, userId: meeting.hostId, leftAt: null },
          data: { leftAt: now },
        });
      }
      return;
    } catch (e) {
      const mem = inMemoryStore.meetings.find((m) => m.id === meetingId);
      if (!mem || mem.status === 'ENDED') return;
      mem.participantsCount = Math.max(0, mem.participantsCount - 1);
      if (mem.participantsCount === 0) {
        mem.emptySince = now;
      }
    }
  }

  /**
   * Ends active meetings that have had nobody inside for 5 minutes.
   */
  async endEmptyMeetings() {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000);
    let ended = 0;

    try {
      const meetings = await prisma.meeting.findMany({
        where: { status: 'ACTIVE' },
        include: { participants: { select: { leftAt: true } } },
      });

      for (const meeting of meetings) {
        const stillInside = meeting.participants.some((person) => person.leftAt == null);
        if (stillInside) continue;

        const lastLeft = meeting.participants.reduce<Date | null>((latest, person) => {
          if (!person.leftAt) return latest;
          if (!latest || person.leftAt > latest) return person.leftAt;
          return latest;
        }, null);
        const emptySince = lastLeft ?? meeting.startedAt;
        if (emptySince > cutoff) continue;

        await prisma.meeting.update({
          where: { id: meeting.id },
          data: { status: 'ENDED', endedAt: new Date() },
        });
        ended += 1;
      }
    } catch (e) {
      const now = new Date();
      for (const meeting of inMemoryStore.meetings) {
        if (meeting.status !== 'ACTIVE') continue;
        if (meeting.participantsCount > 0 || !meeting.emptySince) continue;
        if (meeting.emptySince > cutoff) continue;
        meeting.status = 'ENDED';
        meeting.endedAt = now;
        ended += 1;
      }
    }

    if (ended > 0) {
      console.log(`[MeetingService] Ended ${ended} empty meeting(s) after 5 minutes.`);
    }
    return ended;
  }

  /**
   * Host or Admin ends meeting for all
   */
  async endMeeting(meetingId: string, userId: string, isAdmin = false) {
    try {
      const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
      if (meeting) {
        if (!isAdmin && meeting.hostId !== userId) {
          throw new Error('Only the meeting host or administrator can end the meeting');
        }
        return await prisma.meeting.update({
          where: { id: meetingId },
          data: { status: 'ENDED', endedAt: new Date() },
        });
      }
    } catch (e: any) {
      if (e.message && e.message.includes('Only the meeting host')) throw e;
    }

    // Memory fallback
    const mem = inMemoryStore.meetings.find((m) => m.id === meetingId);
    if (mem) {
      if (!isAdmin && mem.hostId !== userId) {
        throw new Error('Only the meeting host or administrator can end the meeting');
      }
      mem.status = 'ENDED';
      mem.endedAt = new Date();
      return mem;
    }

    throw new Error('Meeting not found');
  }
}

export const meetingService = new MeetingService();
