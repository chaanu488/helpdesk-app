import { Elysia } from 'elysia';
import { db } from '../lib/db';
import { notifications } from '../lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { authPlugin, requireAuth } from '../auth';
import { notificationsModel } from './model';

export const notificationsRoutes = new Elysia({ prefix: '/notifications' })
  .use(notificationsModel)
  .use(authPlugin)
  .get('/', async ({ user }) => {
    const authed = requireAuth(user);
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, authed.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  })
  .patch(
    '/:id/read',
    async ({ params, user, set }) => {
      const authed = requireAuth(user);

      const [updated] = await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.id, params.id), eq(notifications.userId, authed.id)))
        .returning();

      if (!updated) {
        set.status = 404;
        return { error: 'Notification not found' };
      }

      return updated;
    },
    { params: 'notification.params' }
  )
  .post('/read-all', async ({ user }) => {
    const authed = requireAuth(user);
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, authed.id));
    return { success: true };
  });
