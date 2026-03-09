import { Elysia, t } from 'elysia';

const userRole = t.Union([
  t.Literal('customer'),
  t.Literal('product_owner'),
  t.Literal('agent'),
  t.Literal('developer'),
  t.Literal('admin'),
]);

export const invitationsModel = new Elysia({ name: 'invitations/model' }).model({
  'invitation.create': t.Object({
    email: t.String({ format: 'email' }),
    role: t.Optional(userRole),
    companyId: t.Optional(t.String()),
  }),
  'invitation.accept': t.Object({
    name: t.String({ minLength: 1 }),
    password: t.String({ minLength: 8 }),
  }),
  'invitation.params': t.Object({ token: t.String() }),
  'invitation.id.params': t.Object({ id: t.String() }),
});
