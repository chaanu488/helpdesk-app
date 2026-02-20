import { Elysia } from 'elysia';
import { db } from '../lib/db';
import { users } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword } from './password';
import { redis } from '../lib/redis';
import { authModel } from './model';

// Session expires after 30 min of inactivity (Redis handles this)
const SESSION_TTL = 60 * 30;

function generateSessionToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
}

export type User = {
  id: string;
  email: string;
  role: string;
  name: string;
};

type SessionData = {
  user: User;
};

/**
 * Auth plugin - checks session on EVERY request
 * Uses Redis TTL for inactivity timeout (no manual checking needed)
 * User data cached in session (no DB query per request)
 */
export const authPlugin = new Elysia({ name: 'auth' }).derive(
  { as: 'scoped' },
  async ({ headers, cookie }) => {
    // Accept token from cookie OR Authorization header
    const cookieValue = cookie.session?.value;
    const headerValue = headers.authorization?.replace('Bearer ', '');
    const token = (typeof cookieValue === 'string' ? cookieValue : null) || headerValue;

    if (!token) {
      return { user: null, sessionId: null as string | null };
    }

    // Check session in Redis
    const sessionStr = await redis.get(`session:${token}`);
    if (!sessionStr) {
      return { user: null, sessionId: null };
    }

    const session: SessionData = JSON.parse(sessionStr);

    // Reset TTL (sliding window) - Redis handles expiration
    await redis.expire(`session:${token}`, SESSION_TTL);

    return { user: session.user, sessionId: token };
  }
);

// Auth routes
export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(authModel)
  .use(authPlugin)
  .post(
    '/register',
    async ({ body, set, cookie }) => {
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, body.email))
        .limit(1);
      if (existing.length > 0) {
        set.status = 409;
        return { error: 'Email already registered' };
      }

      const passwordHash = await hashPassword(body.password);
      const [newUser] = await db
        .insert(users)
        .values({
          email: body.email,
          passwordHash,
          name: body.name,
          role: body.role ?? 'customer',
        })
        .returning();

      if (!newUser) {
        set.status = 500;
        return { error: 'Failed to create user' };
      }

      // Create session with user data
      const sessionToken = generateSessionToken();
      const user: User = {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      };
      const sessionData: SessionData = { user };
      await redis.set(`session:${sessionToken}`, JSON.stringify(sessionData), 'EX', SESSION_TTL);

      // Set cookie
      cookie.session?.set({
        value: sessionToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_TTL,
        path: '/',
      });

      return { token: sessionToken, user };
    },
    { body: 'auth.register' }
  )
  .post(
    '/login',
    async ({ body, set, cookie }) => {
      const [found] = await db
        .select()
        .from(users)
        .where(eq(users.email, body.email))
        .limit(1);
      if (!found) {
        set.status = 401;
        return { error: 'Invalid credentials' };
      }

      const valid = await verifyPassword(body.password, found.passwordHash);
      if (!valid) {
        set.status = 401;
        return { error: 'Invalid credentials' };
      }

      // Create session with user data
      const sessionToken = generateSessionToken();
      const user: User = {
        id: found.id,
        email: found.email,
        name: found.name,
        role: found.role,
      };
      const sessionData: SessionData = { user };
      await redis.set(`session:${sessionToken}`, JSON.stringify(sessionData), 'EX', SESSION_TTL);

      // Set cookie
      cookie.session?.set({
        value: sessionToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_TTL,
        path: '/',
      });

      return { token: sessionToken, user };
    },
    { body: 'auth.login' }
  )
  .post('/logout', async ({ cookie, sessionId }) => {
    if (sessionId) {
      await redis.del(`session:${sessionId}`);
    }
    cookie.session?.remove();
    return { success: true };
  })
  .get('/me', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    // Return cached user from session (no DB query!)
    return user;
  })
  .post(
    '/kick/:sessionToken',
    async ({ user, params, set }) => {
      if (!user || user.role !== 'admin') {
        set.status = 403;
        return { error: 'Forbidden' };
      }

      await redis.del(`session:${params.sessionToken}`);
      return { success: true, message: 'Session terminated' };
    },
    { params: 'auth.kick.params' }
  );

// Helper functions
export function requireAuth(user: User | null): User {
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export function requireRole(user: User | null, ...roles: string[]): User {
  const authed = requireAuth(user);
  if (!roles.includes(authed.role)) {
    throw new Error('Forbidden');
  }
  return authed;
}

/**
 * Refresh user data in session (call after profile update)
 */
export async function refreshSessionUser(sessionToken: string, user: User): Promise<void> {
  const sessionData: SessionData = { user };
  await redis.set(`session:${sessionToken}`, JSON.stringify(sessionData), 'EX', SESSION_TTL);
}
