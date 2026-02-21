import { Elysia } from 'elysia';
import { db } from '../lib/db';
import { companies, users } from '../lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { authPlugin, requireRole } from '../auth';
import { companiesModel } from './model';

export const companiesRoutes = new Elysia({ prefix: '/companies' })
  .use(companiesModel)
  .use(authPlugin)
  .get('/', async ({ user }) => {
    requireRole(user, 'admin');
    return db
      .select({
        id: companies.id,
        name: companies.name,
        createdAt: companies.createdAt,
        updatedAt: companies.updatedAt,
      })
      .from(companies)
      .orderBy(asc(companies.name));
  })
  .post(
    '/',
    async ({ body, user, set }) => {
      requireRole(user, 'admin');
      const [created] = await db
        .insert(companies)
        .values({ name: body.name })
        .returning();

      if (!created) {
        set.status = 500;
        return { error: 'Failed to create company' };
      }

      set.status = 201;
      return created;
    },
    { body: 'company.create' }
  )
  .patch(
    '/:id',
    async ({ params, body, user, set }) => {
      requireRole(user, 'admin');
      const [updated] = await db
        .update(companies)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(companies.id, params.id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { error: 'Company not found' };
      }
      return updated;
    },
    {
      params: 'company.params',
      body: 'company.update',
    }
  )
  .delete(
    '/:id',
    async ({ params, user, set }) => {
      requireRole(user, 'admin');
      const [deleted] = await db
        .delete(companies)
        .where(eq(companies.id, params.id))
        .returning();

      if (!deleted) {
        set.status = 404;
        return { error: 'Company not found' };
      }
      return { success: true };
    },
    { params: 'company.params' }
  )
  .get(
    '/:id/users',
    async ({ params, user }) => {
      requireRole(user, 'admin');
      return db
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
        .where(eq(users.companyId, params.id))
        .orderBy(asc(users.name));
    },
    { params: 'company.params' }
  );
