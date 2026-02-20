import { Elysia } from 'elysia';
import { db } from '../lib/db';
import { integrations } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { authPlugin, requireRole } from '../auth';
import { integrationsModel } from './model';

export const integrationsRoutes = new Elysia({ prefix: '/integrations' })
  .use(integrationsModel)
  .use(authPlugin)
  .post(
    '/',
    async ({ body, user, set }) => {
      const authed = requireRole(user, 'admin');
      const [created] = await db
        .insert(integrations)
        .values({
          provider: body.provider,
          accessToken: body.accessToken,
          refreshToken: body.refreshToken,
          owner: body.owner,
          createdBy: authed.id,
        })
        .returning({
          id: integrations.id,
          provider: integrations.provider,
          owner: integrations.owner,
          createdAt: integrations.createdAt,
        });
      set.status = 201;
      return created;
    },
    { body: 'integration.create' }
  )
  .get('/', async ({ user }) => {
    requireRole(user, 'admin');
    return db
      .select({
        id: integrations.id,
        provider: integrations.provider,
        owner: integrations.owner,
        createdAt: integrations.createdAt,
      })
      .from(integrations)
      .orderBy(integrations.createdAt);
  })
  .delete(
    '/:id',
    async ({ params, user, set }) => {
      requireRole(user, 'admin');
      const [deleted] = await db
        .delete(integrations)
        .where(eq(integrations.id, params.id))
        .returning();
      if (!deleted) {
        set.status = 404;
        return { error: 'Integration not found' };
      }
      return { success: true };
    },
    { params: 'integration.params' }
  );
