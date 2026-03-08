import { Elysia, t } from 'elysia';

export const messagesModel = new Elysia({ name: 'messages/model' }).model({
  'message.params': t.Object({ id: t.String() }),
  'message.msg.params': t.Object({ id: t.String(), messageId: t.String() }),
  'message.create': t.Object({
    body: t.String({ minLength: 1 }),
    isInternal: t.Optional(t.Boolean()),
  }),
  'message.update': t.Object({
    body: t.String({ minLength: 1 }),
  }),
});
