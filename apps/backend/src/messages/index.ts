import { Elysia } from 'elysia';
import { db } from '../lib/db';
import { messages, tickets } from '../lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { authPlugin, requireAuth } from '../auth';
import { messagesModel } from './model';

export const messagesRoutes = new Elysia({ prefix: '/tickets/:id/messages' })
  .use(messagesModel)
  .use(authPlugin)
  .get(
    '/',
    async ({ params, user }) => {
      const authed = requireAuth(user);

      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, params.id))
        .limit(1);

      if (!ticket) {
        throw new Error('Ticket not found');
      }

      if (authed.role === 'customer' && ticket.customerId !== authed.id) {
        throw new Error('Forbidden');
      }

      const conditions = [eq(messages.ticketId, params.id)];

      if (authed.role === 'customer') {
        conditions.push(eq(messages.isInternal, false));
      }

      return db
        .select()
        .from(messages)
        .where(and(...conditions))
        .orderBy(asc(messages.createdAt));
    },
    { params: 'message.params' }
  )
  .post(
    '/',
    async ({ params, body, user, set }) => {
      const authed = requireAuth(user);

      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, params.id))
        .limit(1);

      if (!ticket) {
        set.status = 404;
        return { error: 'Ticket not found' };
      }

      if (authed.role === 'customer' && ticket.customerId !== authed.id) {
        set.status = 403;
        return { error: 'Forbidden' };
      }

      const isInternal = body.isInternal && ['agent', 'admin', 'developer'].includes(authed.role);

      const [created] = await db
        .insert(messages)
        .values({
          ticketId: params.id,
          authorId: authed.id,
          body: body.body,
          isInternal,
        })
        .returning();

      set.status = 201;
      return created;
    },
    {
      params: 'message.params',
      body: 'message.create',
    }
  );
