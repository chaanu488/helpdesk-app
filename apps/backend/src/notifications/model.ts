import { Elysia, t } from 'elysia';

export const notificationsModel = new Elysia({ name: 'notifications/model' }).model({
  'notification.params': t.Object({ id: t.String() }),
});
