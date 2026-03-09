import { Elysia } from 'elysia';
import { db } from '../lib/db';
import { messages, tickets, users } from '../lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { authPlugin, requireAuth, isStaff } from '../auth';
import { messagesModel } from './model';
import { createAuditLog } from '../lib/audit';
import { createNotification } from '../lib/notify';
import { sendEmail, emailTemplates } from '../lib/email';

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

      // Access: customer can see own/company tickets. PO can see company tickets.
      if (authed.role === 'customer' && ticket.customerId !== authed.id) {
        // Check company access
        const [currentUser] = await db.select({ companyId: users.companyId }).from(users).where(eq(users.id, authed.id)).limit(1);
        const [ticketUser] = await db.select({ companyId: users.companyId }).from(users).where(eq(users.id, ticket.customerId)).limit(1);
        if (!currentUser?.companyId || currentUser.companyId !== ticketUser?.companyId) {
          throw new Error('Forbidden');
        }
      }

      const conditions = [eq(messages.ticketId, params.id)];

      // Customers and POs don't see internal notes
      if (!isStaff(authed.role) || authed.role === 'product_owner') {
        conditions.push(eq(messages.isInternal, false));
      }

      const rows = await db
        .select({
          id: messages.id,
          ticketId: messages.ticketId,
          authorId: messages.authorId,
          body: messages.body,
          isInternal: messages.isInternal,
          createdAt: messages.createdAt,
          updatedAt: messages.updatedAt,
          authorName: users.name,
          authorRole: users.role,
        })
        .from(messages)
        .leftJoin(users, eq(messages.authorId, users.id))
        .where(and(...conditions))
        .orderBy(asc(messages.createdAt));

      // Mask staff names for customers (show "Support Team")
      if (authed.role === 'customer' || authed.role === 'product_owner') {
        return rows.map((r) => ({
          ...r,
          authorName: r.authorRole && isStaff(r.authorRole) ? 'Support Team' : r.authorName,
        }));
      }

      return rows;
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

      // Access check — customers & PO can comment on accessible tickets
      if (!isStaff(authed.role)) {
        if (ticket.customerId !== authed.id) {
          // Check company
          const [cu] = await db.select({ companyId: users.companyId }).from(users).where(eq(users.id, authed.id)).limit(1);
          const [tu] = await db.select({ companyId: users.companyId }).from(users).where(eq(users.id, ticket.customerId)).limit(1);
          if (!cu?.companyId || cu.companyId !== tu?.companyId) {
            set.status = 403;
            return { error: 'Forbidden' };
          }
        }
      }

      const isInternalNote = body.isInternal && isStaff(authed.role) && authed.role !== 'product_owner';

      const [created] = await db
        .insert(messages)
        .values({
          ticketId: params.id,
          authorId: authed.id,
          body: body.body,
          isInternal: isInternalNote,
        })
        .returning();

      // Set firstResponseAt if staff replies for the first time
      if (!isInternalNote && isStaff(authed.role) && !ticket.firstResponseAt) {
        await db
          .update(tickets)
          .set({ firstResponseAt: new Date(), updatedAt: new Date() })
          .where(eq(tickets.id, params.id));
      }

      await createAuditLog({
        actor: authed,
        action: 'message.created',
        entityType: 'ticket',
        entityId: params.id,
        newValue: { messageId: created!.id, isInternal: isInternalNote, authorId: authed.id },
      });

      // Notifications (non-internal only)
      if (!isInternalNote) {
        if (isStaff(authed.role)) {
          const [customer] = await db.select({ email: users.email }).from(users).where(eq(users.id, ticket.customerId)).limit(1);
          if (customer && authed.id !== ticket.customerId) {
            const tmpl = emailTemplates.ticketReply(ticket.ticketNumber, ticket.title, params.id, body.body);
            sendEmail(customer.email, tmpl.subject, tmpl.html);
            createNotification({ userId: ticket.customerId, type: 'message.created', title: `New reply on ticket #${ticket.ticketNumber}`, body: ticket.title, entityType: 'ticket', entityId: params.id });
          }
        } else {
          if (ticket.assignedAgentId && authed.id !== ticket.assignedAgentId) {
            const [agent] = await db.select({ email: users.email }).from(users).where(eq(users.id, ticket.assignedAgentId)).limit(1);
            if (agent) {
              const tmpl = emailTemplates.ticketReply(ticket.ticketNumber, ticket.title, params.id, body.body);
              sendEmail(agent.email, tmpl.subject, tmpl.html);
              createNotification({ userId: ticket.assignedAgentId, type: 'message.created', title: `Customer replied on ticket #${ticket.ticketNumber}`, body: ticket.title, entityType: 'ticket', entityId: params.id });
            }
          }
        }
      }

      set.status = 201;
      return created;
    },
    { params: 'message.params', body: 'message.create' }
  )
  // Edit message
  .patch(
    '/:messageId',
    async ({ params, body, user, set }) => {
      const authed = requireAuth(user);

      const [msg] = await db
        .select()
        .from(messages)
        .where(and(eq(messages.id, params.messageId), eq(messages.ticketId, params.id)))
        .limit(1);

      if (!msg) {
        set.status = 404;
        return { error: 'Message not found' };
      }

      // Only the author or staff can edit
      const canEdit = msg.authorId === authed.id || (isStaff(authed.role) && authed.role !== 'product_owner');
      if (!canEdit) {
        set.status = 403;
        return { error: 'Forbidden' };
      }

      const oldBody = msg.body;

      const [updated] = await db
        .update(messages)
        .set({ body: body.body, updatedAt: new Date() })
        .where(eq(messages.id, params.messageId))
        .returning();

      await createAuditLog({
        actor: authed,
        action: 'message.edited',
        entityType: 'message',
        entityId: params.messageId,
        oldValue: { body: oldBody },
        newValue: { body: body.body, ticketId: params.id },
      });

      return updated;
    },
    { params: 'message.msg.params', body: 'message.update' }
  );
