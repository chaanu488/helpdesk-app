import { Elysia } from 'elysia';
import { db } from '../lib/db';
import { tickets, ticketTags, linkedIssues, users } from '../lib/db/schema';
import { eq, and, like, desc, count, inArray } from 'drizzle-orm';
import { authPlugin, requireAuth, requireRole } from '../auth';
import { ticketsModel } from './model';

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

      // Customers can only update their own tickets (limited fields)
      if (authed.role === 'customer') {
        if (existing.customerId !== authed.id) {
          set.status = 403;
          return { error: 'Forbidden' };
        }
        // Customers can only update title and description
        const { title, description } = body;
        const [updated] = await db
          .update(tickets)
          .set({ ...(title && { title }), ...(description && { description }), updatedAt: new Date() })
          .where(eq(tickets.id, params.id))
          .returning();
        return updated;
      }

      const { tags, status, priority, ...rest } = body;
      const [updated] = await db
        .update(tickets)
        .set({
          ...rest,
          ...(status && { status }),
          ...(priority && { priority }),
          updatedAt: new Date(),
        })
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

      const [updated] = await db
        .update(tickets)
        .set({ assignedAgentId: body.agentId, updatedAt: new Date() })
        .where(eq(tickets.id, params.id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { error: 'Ticket not found' };
      }

      return updated;
    },
    {
      params: 'ticket.params',
      body: 'ticket.assign',
    }
  );
