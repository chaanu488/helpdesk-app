import { Elysia, t } from 'elysia';

export const attachmentsModel = new Elysia({ name: 'attachments/model' }).model({
  'attachment.ticket.params': t.Object({ id: t.String() }),
  'attachment.params': t.Object({ attachmentId: t.String() }),
  'attachment.upload': t.Object({
    file: t.File({ maxSize: '20m' }),
    ticketId: t.String(),
    messageId: t.Optional(t.String()),
  }),
});
