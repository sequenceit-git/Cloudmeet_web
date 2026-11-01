import crypto from 'crypto';
import { WebSocket } from 'ws';
import { meetingService } from './meeting.service';
import { removeMeetingFiles, safeMeetingCode } from './meeting-files';

type Member = {
  ws: WebSocket;
  userId: string;
  displayName: string;
};

export type ChatPayload = {
  type: 'text' | 'image' | 'file' | 'ended' | 'host_transferred';
  id?: string;
  userId?: string;
  displayName?: string;
  text?: string;
  url?: string;
  name?: string;
  size?: number;
  at?: string;
};

const rooms = new Map<string, Set<Member>>();

function roomKey(code: string): string {
  return safeMeetingCode(code);
}

export function broadcastMeetingChat(code: string, message: ChatPayload) {
  const room = rooms.get(roomKey(code));
  if (!room) return;
  const payload = JSON.stringify(message);
  for (const member of room) {
    try {
      if (member.ws.readyState === WebSocket.OPEN) {
        member.ws.send(payload);
      }
    } catch (err) {
      console.error('[Chat Broadcast Error]:', err);
    }
  }
}

export function closeMeetingRoom(code: string) {
  const key = roomKey(code);
  const room = rooms.get(key);
  if (room) {
    const payload = JSON.stringify({ type: 'ended' });
    for (const member of room) {
      try {
        member.ws.send(payload);
        member.ws.close();
      } catch {
        // The socket may already be gone.
      }
    }
    rooms.delete(key);
  }
  removeMeetingFiles(code);
}

export async function attachMeetingChat(ws: WebSocket, code: string) {
  const key = roomKey(code);
  const validation = await meetingService.validateMeetingCode(key);
  if (!validation.valid) {
    ws.close(1008, 'Meeting is not active');
    return;
  }

  let member: Member | null = null;
  const timer = setTimeout(() => {
    if (!member) ws.close(1008, 'Join required');
  }, 8000);

  ws.on('message', (raw) => {
    let data: { type?: string; userId?: string; displayName?: string; text?: string };
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (!member) {
      const userId = String(data.userId || '').trim().slice(0, 64);
      if (data.type !== 'join' || !userId) {
        ws.close(1008, 'Join required');
        return;
      }
      clearTimeout(timer);
      member = {
        ws,
        userId,
        displayName: String(data.displayName || 'Guest').trim().slice(0, 80) || 'Guest',
      };
      const set = rooms.get(key) ?? new Set<Member>();
      set.add(member);
      rooms.set(key, set);
      return;
    }

    if (data.type !== 'text') return;
    const text = String(data.text || '').trim().slice(0, 2000);
    if (!text) return;
    broadcastMeetingChat(key, {
      type: 'text',
      id: crypto.randomBytes(8).toString('hex'),
      userId: member.userId,
      displayName: member.displayName,
      text,
      at: new Date().toISOString(),
    });
  });

  ws.on('close', () => {
    clearTimeout(timer);
    const set = rooms.get(key);
    if (!member || !set) return;
    set.delete(member);
    if (set.size === 0) rooms.delete(key);
  });
}
