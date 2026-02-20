import { Elysia, t } from 'elysia';

export const authModel = new Elysia({ name: 'auth/model' }).model({
  'auth.register': t.Object({
    email: t.String({ format: 'email' }),
    password: t.String({ minLength: 6 }),
    name: t.String({ minLength: 1 }),
    role: t.Optional(t.Union([
      t.Literal('customer'), t.Literal('agent'), t.Literal('developer'), t.Literal('admin'),
    ])),
  }),
  'auth.login': t.Object({
    email: t.String({ format: 'email' }),
    password: t.String(),
  }),
  'auth.kick.params': t.Object({ sessionToken: t.String() }),
});
