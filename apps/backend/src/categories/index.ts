import { Elysia } from 'elysia';
import { db } from '../lib/db';
import { categories } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { authPlugin, requireRole } from '../auth';
import { categoriesModel } from './model';

export const categoriesRoutes = new Elysia({ prefix: '/categories' })
  .use(categoriesModel)
  .use(authPlugin)
  .get('/', async () => {
    return db.select().from(categories).orderBy(categories.name);
  })
  .post(
    '/',
    async ({ body, user, set }) => {
      requireRole(user, 'admin');
      const [created] = await db.insert(categories).values(body).returning();
      set.status = 201;
      return created;
    },
    { body: 'category.create' }
  )
  .put(
    '/:id',
    async ({ params, body, user, set }) => {
      requireRole(user, 'admin');
      const [updated] = await db
        .update(categories)
        .set(body)
        .where(eq(categories.id, params.id))
        .returning();
      if (!updated) {
        set.status = 404;
        return { error: 'Category not found' };
      }
      return updated;
    },
    {
      params: 'category.params',
      body: 'category.update',
    }
  )
  .delete(
    '/:id',
    async ({ params, user, set }) => {
      requireRole(user, 'admin');
      const [deleted] = await db
        .delete(categories)
        .where(eq(categories.id, params.id))
        .returning();
      if (!deleted) {
        set.status = 404;
        return { error: 'Category not found' };
      }
      return { success: true };
    },
    { params: 'category.params' }
  );
