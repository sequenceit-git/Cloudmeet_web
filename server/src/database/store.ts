/**
 * In-memory fallback and state cache
 * Ensures that CloudNews operates reliably and without crashing even before
 * PostgreSQL container/daemon is launched.
 */

export interface MemoryHost {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  avatarUrl?: string;
  isDisabled: boolean;
  createdAt: Date;
}

export interface MemoryMeeting {
  id: string;
  meetingCode: string;
  title: string;
  hostId: string;
  hostName: string;
  hostUsername: string;
  status: 'ACTIVE' | 'ENDED';
  startedAt: Date;
  endedAt?: Date;
  participantsCount: number;
  emptySince?: Date;
}

export const inMemoryStore = {
  admin: {
    id: 'admin-super-001',
    email: 'admin@cloudmeet.cn',
    // bcrypt hash of 'admin123456'
    passwordHash: '$2a$10$wT5H5iXQc1g4KqR1b2d.TeWqYmYh9lG2o7V3pL4.x4sY5nO7vFqO6',
    name: '超级管理员',
    role: 'ADMIN' as const,
  },

  hosts: [] as MemoryHost[],

  meetings: [] as MemoryMeeting[],
};
