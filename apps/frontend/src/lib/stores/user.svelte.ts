import { auth, type User } from '$lib/api';

export class UserState {
  user = $state<User | null>(null);
  loading = $state(true);

  get isAuthenticated() {
    return this.user !== null;
  }

  async init() {
    this.loading = true;
    try {
      // Check if session is valid by calling /me
      this.user = await auth.me();
    } catch {
      this.user = null;
    } finally {
      this.loading = false;
    }
  }

  async login(email: string, password: string) {
    const user = await auth.login(email, password);
    this.user = user;
    return user;
  }

  async register(email: string, password: string, name: string) {
    const user = await auth.register(email, password, name);
    this.user = user;
    return user;
  }

  async logout() {
    await auth.logout();
    this.user = null;
  }
}

export const userState = new UserState();
