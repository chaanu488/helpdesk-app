import { Elysia } from 'elysia';
import { db } from '../lib/db';
import { users, companies } from '../lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { authPlugin, requireAuth, requireRole } from '../auth';
import { usersModel } from './model';

export const usersRoutes = new Elysia({ prefix: '/users' })
  .use(usersModel)
  .use(authPlugin)
  .get('/me', async ({ user, set }) => {
    const authed = requireAuth(user);
    const [found] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        avatarUrl: users.avatarUrl,
        companyId: users.companyId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, authed.id))
      .limit(1);

    if (!found) {
      set.status = 404;
      return { error: 'User not found' };
    }
    return found;
  })
  .patch(
    '/me',
    async ({ body, user }) => {
      const authed = requireAuth(user);
      const [updated] = await db
        .update(users)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(users.id, authed.id))
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          avatarUrl: users.avatarUrl,
          companyId: users.companyId,
        });
      return updated;
    },
    { body: 'user.update.me' }
  )
  .get('/', async ({ user }) => {
    requireRole(user, 'admin');
    return db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        avatarUrl: users.avatarUrl,
        companyId: users.companyId,
        companyName: companies.name,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(companies, eq(users.companyId, companies.id))
      .orderBy(asc(users.createdAt));
  })
  .patch(
    '/:id/role',
    async ({ params, body, user, set }) => {
      requireRole(user, 'admin');
      const [updated] = await db
        .update(users)
        .set({ role: body.role, updatedAt: new Date() })
        .where(eq(users.id, params.id))
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
        });

      if (!updated) {
        set.status = 404;
        return { error: 'User not found' };
      }
      return updated;
    },
    {
      params: 'user.params',
      body: 'user.update.role',
    }
  )
  .patch(
    '/:id/company',
    async ({ params, body, user, set }) => {
      requireRole(user, 'admin');
      const [updated] = await db
        .update(users)
        .set({ companyId: body.companyId, updatedAt: new Date() })
        .where(eq(users.id, params.id))
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          companyId: users.companyId,
        });

      if (!updated) {
        set.status = 404;
        return { error: 'User not found' };
      }
      return updated;
    },
    {
      params: 'user.params',
      body: 'user.update.company',
    }
  );
