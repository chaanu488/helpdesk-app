import { treaty } from '@elysiajs/eden';
import type { App } from '@backend/index';

export const client = treaty<App>(import.meta.env.VITE_API_URL ?? 'http://localhost:3000', {
  fetch: {
    credentials: 'include', // Always send cookies
  },
});

export const api = client.api;

export type User = {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'agent' | 'developer' | 'admin';
  avatarUrl?: string | null;
  createdAt?: string;
};

/**
 * Auth client - uses httpOnly cookies (auto-sent by browser)
 * No need to manage tokens in memory!
 */
class AuthClient {
  async login(email: string, password: string): Promise<User> {
    const { data, error } = await api.auth.login.post({ email, password });
    if (error || !data) {
      const msg = error && 'error' in error.value ? error.value.error : 'Login failed';
      throw new Error(msg as string);
    }
    return data.user as User;
  }

  async register(email: string, password: string, name: string): Promise<User> {
    const { data, error } = await api.auth.register.post({ email, password, name });
    if (error || !data) {
      const msg = error && 'error' in error.value ? error.value.error : 'Registration failed';
      throw new Error(msg as string);
    }
    return data.user as User;
  }

  async logout(): Promise<void> {
    await api.auth.logout.post();
  }

  async me(): Promise<User | null> {
    const { data, error } = await api.auth.me.get();
    if (error || !data) {
      return null;
    }
    return data as User;
  }
}

export const auth = new AuthClient();
