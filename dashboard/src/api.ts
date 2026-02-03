import { Stats, Status, Activity, Warning } from './types';

const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';

export const api = {
  // Auth
  async login(password: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password }),
    });
    if (!res.ok) throw new Error('Login failed');
    return res.json();
  },

  async logout(): Promise<void> {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  },

  async checkAuth(): Promise<{ authenticated: boolean }> {
    const res = await fetch(`${API_BASE}/auth/check`, {
      credentials: 'include',
    });
    return res.json();
  },

  // Dashboard data
  async getStats(): Promise<Stats> {
    const res = await fetch(`${API_BASE}/dashboard/stats`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  async getStatus(): Promise<Status> {
    const res = await fetch(`${API_BASE}/dashboard/status`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch status');
    return res.json();
  },

  async getActivities(limit = 10): Promise<Activity[]> {
    const res = await fetch(`${API_BASE}/dashboard/activities?limit=${limit}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch activities');
    return res.json();
  },

  async getWarnings(): Promise<Warning[]> {
    const res = await fetch(`${API_BASE}/dashboard/warnings`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch warnings');
    return res.json();
  },

  getFileUrl(filename: string): string {
    return `${API_BASE}/files/${filename}`;
  },
};
