import { Elysia } from 'elysia';
import { db } from '../lib/db';
import { tickets, ticketTags, linkedIssues, users } from '../lib/db/schema';
import { eq, and, like, desc, count, inArray } from 'drizzle-orm';
import { authPlugin, requireAuth, requireRole, isStaff } from '../auth';
import { ticketsModel } from './model';
import { createAuditLog } from '../lib/audit';
import { createNotification } from '../lib/notify';
import { sendEmail, emailTemplates } from '../lib/email';

async function getCompanyCustomerIds(companyId: string): Promise<string[]> {
  const companyUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.companyId, companyId));
  return companyUsers.map((u) => u.id);
}

export const ticketsRoutes = new Elysia({ prefix: '/tickets' })
  .use(ticketsModel)
  .use(authPlugin)
  .post(
    '/',
    async ({ body, user, set }) => {
      const authed = requireAuth(user);
      const { tags, ...ticketData } = body;
      const [created] = await db
        .insert(tickets)
        .values({
          ...ticketData,
          customerId: authed.id,
        })
        .returning();

      if (!created) {
        set.status = 500;
        return { error: 'Failed to create ticket' };
      }

      if (tags && tags.length > 0) {
        await db.insert(ticketTags).values(
          tags.map((tag) => ({ ticketId: created.id, tag }))
        );
      }

      await createAuditLog({
        actor: authed,
        action: 'ticket.created',
        entityType: 'ticket',
        entityId: created.id,
        newValue: { title: created.title, priority: created.priority },
      });

      // Send email confirmation to customer
      const tmpl = emailTemplates.ticketCreated(created.ticketNumber, created.title, created.id);
      sendEmail(authed.email, tmpl.subject, tmpl.html);

      set.status = 201;
      return created;
    },
    { body: 'ticket.create' }
  )
  .get(
    '/',
    async ({ query, user }) => {
      const authed = requireAuth(user);
      const conditions = [];

      // Customers see all tickets from their company (or just their own if no company)
      if (authed.role === 'customer') {
        const [currentUser] = await db
          .select({ companyId: users.companyId })
          .from(users)
          .where(eq(users.id, authed.id))
          .limit(1);

        if (currentUser?.companyId) {
          const companyCustomerIds = await getCompanyCustomerIds(currentUser.companyId);
          if (companyCustomerIds.length > 0) {
            conditions.push(inArray(tickets.customerId, companyCustomerIds));
          } else {
            conditions.push(eq(tickets.customerId, authed.id));
          }
        } else {
          conditions.push(eq(tickets.customerId, authed.id));
        }
      }

      if (query.status) {
        conditions.push(eq(tickets.status, query.status));
      }
      if (query.priority) {
        conditions.push(eq(tickets.priority, query.priority));
      }
      if (query.assignedTo) {
        conditions.push(eq(tickets.assignedAgentId, query.assignedTo));
      }
      if (query.categoryId) {
        conditions.push(eq(tickets.categoryId, query.categoryId));
      }
      if (query.search) {
        conditions.push(like(tickets.title, `%${query.search}%`));
      }

      const page = query.page ? query.page : 1;
      const limit = query.limit ? query.limit : 20;
      const offset = (page - 1) * limit;

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, countResult] = await Promise.all([
        db
          .select()
          .from(tickets)
          .where(where)
          .orderBy(desc(tickets.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count() })
          .from(tickets)
          .where(where),
      ]);

      const total = countResult[0]?.total ?? 0;

      return { items, total, page, limit };
    },
    { query: 'ticket.query' }
  )
  .get(
    '/:id',
    async ({ params, user, set }) => {
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

      // Customers can see their own or company tickets
      if (authed.role === 'customer') {
        const [currentUser] = await db
          .select({ companyId: users.companyId })
          .from(users)
          .where(eq(users.id, authed.id))
          .limit(1);

        if (currentUser?.companyId) {
          const companyCustomerIds = await getCompanyCustomerIds(currentUser.companyId);
          if (!companyCustomerIds.includes(ticket.customerId)) {
            set.status = 403;
            return { error: 'Forbidden' };
          }
        } else if (ticket.customerId !== authed.id) {
          set.status = 403;
          return { error: 'Forbidden' };
        }
      }

      const tags = await db
        .select()
        .from(ticketTags)
        .where(eq(ticketTags.ticketId, ticket.id));

      const countResult = await db
        .select({ linkedCount: count() })
        .from(linkedIssues)
        .where(eq(linkedIssues.ticketId, ticket.id));

      const linkedCount = countResult[0]?.linkedCount ?? 0;

      return { ...ticket, tags: tags.map((t) => t.tag), linkedIssuesCount: linkedCount };
    },
    { params: 'ticket.params' }
  )
  .patch(
    '/:id',
    async ({ params, body, user, set }) => {
      const authed = requireAuth(user);

      const [existing] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, params.id))
        .limit(1);

      if (!existing) {
        set.status = 404;
        return { error: 'Ticket not found' };
      }

      // Access check for non-staff roles
      if (!isStaff(authed.role)) {
        if (authed.role === 'product_owner') {
          // PO: can manage tickets within their company
          const [poUser] = await db.select({ companyId: users.companyId }).from(users).where(eq(users.id, authed.id)).limit(1);
          const [ticketUser] = await db.select({ companyId: users.companyId }).from(users).where(eq(users.id, existing.customerId)).limit(1);
          if (!poUser?.companyId || poUser.companyId !== ticketUser?.companyId) {
            set.status = 403;
            return { error: 'Forbidden' };
          }
          // PO can edit: title, description, status, priority, categoryId, tags (same as staff except assignedAgentId)
        } else {
          // Customer: can only update their own tickets, title + description only
          if (existing.customerId !== authed.id) {
            set.status = 403;
            return { error: 'Forbidden' };
          }
          const { title, description } = body;
          const [updated] = await db
            .update(tickets)
            .set({ ...(title && { title }), ...(description && { description }), updatedAt: new Date() })
            .where(eq(tickets.id, params.id))
            .returning();

          if (description && description !== existing.description) {
            await createAuditLog({
              actor: authed, action: 'ticket.description_edited', entityType: 'ticket', entityId: params.id,
              oldValue: { body: existing.description }, newValue: { body: description },
            });
          }
          if (title && title !== existing.title) {
            await createAuditLog({
              actor: authed, action: 'ticket.updated', entityType: 'ticket', entityId: params.id,
              oldValue: { title: existing.title }, newValue: { title },
            });
          }
          return updated;
        }
      }

      const { tags, status, priority, assignedAgentId, ...rest } = body;

      // Track what changed for audit log
      const changes: Record<string, unknown> = {};
      const oldValues: Record<string, unknown> = {};

      if (status && status !== existing.status) {
        changes.status = status;
        oldValues.status = existing.status;
      }
      if (priority && priority !== existing.priority) {
        changes.priority = priority;
        oldValues.priority = existing.priority;
      }
      if (assignedAgentId !== undefined && assignedAgentId !== existing.assignedAgentId) {
        changes.assignedAgentId = assignedAgentId;
        oldValues.assignedAgentId = existing.assignedAgentId;
      }

      // PO cannot assign agents
      const canAssign = isStaff(authed.role);

      const updateData: Record<string, unknown> = {
        ...rest,
        ...(status && { status }),
        ...(priority && { priority }),
        ...(canAssign && assignedAgentId !== undefined && { assignedAgentId }),
        updatedAt: new Date(),
      };

      // Set resolvedAt when status changes to resolved/closed
      if (status === 'resolved' || status === 'closed') {
        if (existing.status !== 'resolved' && existing.status !== 'closed') {
          updateData.resolvedAt = new Date();
        }
      }

      const [updated] = await db
        .update(tickets)
        .set(updateData as any)
        .where(eq(tickets.id, params.id))
        .returning();

      if (tags !== undefined) {
        await db.delete(ticketTags).where(eq(ticketTags.ticketId, params.id));
        if (tags.length > 0) {
          await db.insert(ticketTags).values(
            tags.map((tag) => ({ ticketId: params.id, tag }))
          );
        }
      }

      // Audit: description edit (separate from other changes, like GitHub)
      if (rest.description && rest.description !== existing.description) {
        await createAuditLog({
          actor: authed,
          action: 'ticket.description_edited',
          entityType: 'ticket',
          entityId: params.id,
          oldValue: { body: existing.description },
          newValue: { body: rest.description },
        });
      }

      // Audit log for each significant change
      if (status && status !== existing.status) {
        await createAuditLog({
          actor: authed,
          action: 'ticket.status_changed',
          entityType: 'ticket',
          entityId: params.id,
          oldValue: { status: existing.status },
          newValue: { status },
        });

        // Notify customer of status change
        const [customer] = await db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, existing.customerId))
          .limit(1);
        if (customer) {
          const tmpl = emailTemplates.ticketStatusChanged(
            existing.ticketNumber, existing.title, params.id, status
          );
          sendEmail(customer.email, tmpl.subject, tmpl.html);
        }

        createNotification({
          userId: existing.customerId,
          type: 'ticket.status_changed',
          title: `Ticket #${existing.ticketNumber} status updated`,
          body: `Status changed to ${status.replace('_', ' ')}`,
          entityType: 'ticket',
          entityId: params.id,
        });
      }

      if (priority && priority !== existing.priority) {
        await createAuditLog({
          actor: authed,
          action: 'ticket.priority_changed',
          entityType: 'ticket',
          entityId: params.id,
          oldValue: { priority: existing.priority },
          newValue: { priority },
        });
      }

      if (assignedAgentId !== undefined && assignedAgentId !== existing.assignedAgentId) {
        await createAuditLog({
          actor: authed,
          action: assignedAgentId ? 'ticket.assigned' : 'ticket.reassigned',
          entityType: 'ticket',
          entityId: params.id,
          oldValue: { assignedAgentId: existing.assignedAgentId },
          newValue: { assignedAgentId },
        });

        // Notify newly assigned agent
        if (assignedAgentId) {
          const [agent] = await db
            .select({ email: users.email, name: users.name })
            .from(users)
            .where(eq(users.id, assignedAgentId))
            .limit(1);
          if (agent) {
            const tmpl = emailTemplates.ticketAssigned(
              agent.name, existing.ticketNumber, existing.title, params.id
            );
            sendEmail(agent.email, tmpl.subject, tmpl.html);

            createNotification({
              userId: assignedAgentId,
              type: 'ticket.assigned',
              title: `Ticket #${existing.ticketNumber} assigned to you`,
              body: existing.title,
              entityType: 'ticket',
              entityId: params.id,
            });
          }
        }
      }

      return updated;
    },
    {
      params: 'ticket.params',
      body: 'ticket.update',
    }
  )
  .post(
    '/:id/assign',
    async ({ params, body, user, set }) => {
      requireRole(user, 'agent', 'admin');

      const [existing] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, params.id))
        .limit(1);

      const [updated] = await db
        .update(tickets)
        .set({ assignedAgentId: body.agentId, updatedAt: new Date() })
        .where(eq(tickets.id, params.id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { error: 'Ticket not found' };
      }

      if (existing) {
        await createAuditLog({
          actor: user!,
          action: 'ticket.assigned',
          entityType: 'ticket',
          entityId: params.id,
          oldValue: { assignedAgentId: existing.assignedAgentId },
          newValue: { assignedAgentId: body.agentId },
        });
      }

      return updated;
    },
    {
      params: 'ticket.params',
      body: 'ticket.assign',
    }
  );
