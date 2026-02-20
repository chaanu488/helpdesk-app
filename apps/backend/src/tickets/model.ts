import { Elysia, t } from 'elysia';

const ticketStatus = t.Union([
  t.Literal('open'), t.Literal('in_progress'), t.Literal('waiting'),
  t.Literal('resolved'), t.Literal('closed'),
]);
const ticketPriority = t.Union([
  t.Literal('low'), t.Literal('medium'), t.Literal('high'), t.Literal('urgent'),
]);

export const ticketsModel = new Elysia({ name: 'tickets/model' }).model({
  'ticket.create': t.Object({
    title: t.String({ minLength: 1 }),
    description: t.String({ minLength: 1 }),
    priority: t.Optional(ticketPriority),
    categoryId: t.Optional(t.String()),
    tags: t.Optional(t.Array(t.String())),
  }),
  'ticket.query': t.Object({
    status: t.Optional(ticketStatus),
    priority: t.Optional(ticketPriority),
    assignedTo: t.Optional(t.String()),
    categoryId: t.Optional(t.String()),
    search: t.Optional(t.String()),
    page: t.Optional(t.Number()),
    limit: t.Optional(t.Number()),
  }),
  'ticket.params': t.Object({ id: t.String() }),
  'ticket.update': t.Object({
    title: t.Optional(t.String()),
    description: t.Optional(t.String()),
    status: t.Optional(ticketStatus),
    priority: t.Optional(ticketPriority),
    assignedAgentId: t.Optional(t.Union([t.String(), t.Null()])),
    categoryId: t.Optional(t.Union([t.String(), t.Null()])),
    tags: t.Optional(t.Array(t.String())),
  }),
  'ticket.assign': t.Object({ agentId: t.String() }),
});
