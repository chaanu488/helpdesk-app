import { Elysia, t } from 'elysia';

export const categoriesModel = new Elysia({ name: 'categories/model' }).model({
  'category.create': t.Object({
    name: t.String({ minLength: 1 }),
    description: t.Optional(t.String()),
  }),
  'category.update': t.Object({
    name: t.Optional(t.String({ minLength: 1 })),
    description: t.Optional(t.String()),
  }),
  'category.params': t.Object({ id: t.String() }),
});
