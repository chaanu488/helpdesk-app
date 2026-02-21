import { Elysia, t } from 'elysia';

const userRole = t.Union([
  t.Literal('customer'), t.Literal('agent'), t.Literal('developer'), t.Literal('admin'),
]);

export const usersModel = new Elysia({ name: 'users/model' }).model({
  'user.params': t.Object({ id: t.String() }),
  'user.update.me': t.Object({
    name: t.Optional(t.String({ minLength: 1 })),
    avatarUrl: t.Optional(t.Union([t.String(), t.Null()])),
  }),
  'user.update.role': t.Object({ role: userRole }),
  'user.update.company': t.Object({
    companyId: t.Union([t.String(), t.Null()]),
  }),
});
