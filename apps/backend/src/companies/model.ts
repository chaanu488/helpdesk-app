import { Elysia, t } from 'elysia';

export const companiesModel = new Elysia({ name: 'companies/model' }).model({
  'company.params': t.Object({ id: t.String() }),
  'company.create': t.Object({
    name: t.String({ minLength: 1 }),
  }),
  'company.update': t.Object({
    name: t.Optional(t.String({ minLength: 1 })),
  }),
});
