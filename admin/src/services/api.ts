import { ENV } from '../config/env';

const TOKEN_KEY = 'cloudmeet_admin_token';
const USER_KEY = 'cloudmeet_admin_user';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface RealHost {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  isDisabled: boolean;
  createdAt: string;
  _count?: {
    meetings: number;
  };
}

export interface RealMeeting {
  id: string;
  meetingCode: string;
  title: string;
  status: 'ACTIVE' | 'ENDED';
  createdAt: string;
  host: {
    id: string;
    displayName: string;
    email: string;
  };
  _count?: {
    participants: number;
  };
}

export class AdminApiClient {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  getUser(): AdminUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  setUser(user: AdminUser) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${ENV.API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (res.status === 401 || res.status === 403) {
      // If unauthorized, clear token so login panel shows
      if (!endpoint.includes('/auth/admin/login')) {
        this.logout();
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }

    return data as T;
  }

  // Admin Auth
  async login(email: string, password: string): Promise<{ token: string; user: AdminUser }> {
    const res = await this.request<{ token: string; user: AdminUser }>('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.token);
    this.setUser(res.user);
    return res;
  }

  // Dashboard Overview
  async getDashboard(): Promise<{
    activeMeetingsCount: number;
    totalMeetingsCount: number;
    totalHostsCount: number;
    liveParticipants?: number;
    sdkAppId?: number;
    sdkConfigured?: boolean;
    recentMeetings: RealMeeting[];
  }> {
    return this.request('/admin/dashboard');
  }

  // Hosts Management
  async getHosts(): Promise<{ hosts: RealHost[] }> {
    return this.request('/admin/hosts');
  }

  async createHost(data: { email: string; password: string; displayName: string }): Promise<{ host: RealHost }> {
    return this.request('/admin/hosts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async toggleHostStatus(id: string, isDisabled: boolean): Promise<{ host: RealHost }> {
    return this.request(`/admin/hosts/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isDisabled }),
    });
  }

  async deleteHost(id: string): Promise<{ message: string }> {
    return this.request(`/admin/hosts/${id}`, {
      method: 'DELETE',
    });
  }

  // Meetings Oversight
  async getMeetings(): Promise<{ meetings: RealMeeting[] }> {
    return this.request('/admin/meetings');
  }

  async endMeeting(id: string): Promise<{ message: string; meeting: RealMeeting }> {
    return this.request(`/admin/meetings/${id}/end`, {
      method: 'POST',
    });
  }
}

export const adminApi = new AdminApiClient();
