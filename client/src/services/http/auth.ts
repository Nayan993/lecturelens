import { apiClient } from '../../lib/apiClient';
import type { AuthResponse, User } from '../../types';
import type { AuthService } from '../types';

export const httpAuthService: AuthService = {
  async login(email, password) {
    return (await apiClient.post<AuthResponse>('/auth/login', { email, password })).data;
  },
  async register(payload) {
    return (await apiClient.post<AuthResponse>('/auth/register', payload)).data;
  },
  async me(token) {
    const res = await apiClient.get<{ user: User }>('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    return res.data.user;
  },
  async updateProfile(payload) {
    return (await apiClient.patch<{ user: User }>('/users/me', payload)).data.user;
  },
};
