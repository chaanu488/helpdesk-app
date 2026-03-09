import { Elysia, t } from 'elysia';
import { db } from '../lib/db';
import { auditLogs } from '../lib/db/schema';
import { eq, desc, and, ne, asc, or } from 'drizzle-orm';
import { authPlugin, requireAuth, requireRole } from '../auth';

export const auditLogsRoutes = new Elysia({ prefix: '/audit-logs' })
  .use(authPlugin)
  // Global audit log (admin only)
  .get(
    '/',
    async ({ query, user }) => {
      requireRole(user, 'admin');
      return db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(Number(query.limit ?? 100))
        .offset(Number(query.offset ?? 0));
    },
    {
      query: t.Object({
        limit: t.Optional(t.Number()),
        offset: t.Optional(t.Number()),
        entityType: t.Optional(t.String()),
      }),
    }
  )
  // Ticket timeline — events for inline display (excludes description/message edits)
  .get(
    '/tickets/:id/timeline',
    async ({ params, user }) => {
      const authed = requireAuth(user);
      const isCustomer = authed.role === 'customer';

      const conditions = [
        eq(auditLogs.entityType, 'ticket'),
        eq(auditLogs.entityId, params.id),
        // Exclude edit actions — those are shown via the "Edits" dropdown
        ne(auditLogs.action, 'ticket.description_edited'),
      ];

      // Customers should not see internal message audit entries
      if (isCustomer) {
        // We'll filter in JS since we need to check newValue.isInternal
      }

      const rows = await db
        .select()
        .from(auditLogs)
        .where(and(...conditions))
        .orderBy(asc(auditLogs.createdAt));

      if (isCustomer) {
        return rows.filter((r) => {
          // Hide internal message events
          if (r.action === 'message.created' || r.action === 'message.edited') {
            const nv = r.newValue as Record<string, unknown> | null;
            if (nv?.isInternal) return false;
          }
          return true;
        });
      }

      return rows;
    },
    { params: t.Object({ id: t.String() }) }
  )
  // Ticket history (all events, for History tab) — kept for backward compat
  .get(
    '/tickets/:id',
    async ({ params, user }) => {
      const authed = requireAuth(user);
      const isCustomer = authed.role === 'customer';

      const rows = await db
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityType, 'ticket'), eq(auditLogs.entityId, params.id)))
        .orderBy(desc(auditLogs.createdAt));

      if (isCustomer) {
        return rows.filter((r) => {
          if (r.action === 'message.created' || r.action === 'message.edited') {
            const nv = r.newValue as Record<string, unknown> | null;
            if (nv?.isInternal) return false;
          }
          return true;
        });
      }

      return rows;
    },
    { params: t.Object({ id: t.String() }) }
  )
  // Edit history for ticket description
  .get(
    '/tickets/:id/description-edits',
    async ({ params, user }) => {
      requireAuth(user);
      return db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.entityType, 'ticket'),
            eq(auditLogs.entityId, params.id),
            eq(auditLogs.action, 'ticket.description_edited')
          )
        )
        .orderBy(desc(auditLogs.createdAt));
    },
    { params: t.Object({ id: t.String() }) }
  )
  // Edit history for a specific message
  .get(
    '/messages/:messageId/edits',
    async ({ params, user }) => {
      requireAuth(user);
      return db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.entityType, 'message'),
            eq(auditLogs.entityId, params.messageId),
            eq(auditLogs.action, 'message.edited')
          )
        )
        .orderBy(desc(auditLogs.createdAt));
    },
    { params: t.Object({ messageId: t.String() }) }
  );
