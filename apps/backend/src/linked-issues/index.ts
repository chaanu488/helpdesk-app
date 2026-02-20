import { Elysia } from 'elysia';
import { db } from '../lib/db';
import { linkedIssues, integrations, tickets } from '../lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { authPlugin, requireAuth, requireRole } from '../auth';
import * as github from '../services/github';
import * as bitbucket from '../services/bitbucket';
import { syncLinkedIssue } from '../services/sync';
import { linkedIssuesModel } from './model';

export const linkedIssuesRoutes = new Elysia({ prefix: '/tickets/:id/linked-issues' })
  .use(linkedIssuesModel)
  .use(authPlugin)
  .get(
    '/',
    async ({ params, user }) => {
      requireAuth(user);
      return db
        .select()
        .from(linkedIssues)
        .where(eq(linkedIssues.ticketId, params.id))
        .orderBy(linkedIssues.createdAt);
    },
    { params: 'linkedIssue.params' }
  )
  .post(
    '/',
    async ({ params, body, user, set }) => {
      requireRole(user, 'agent', 'admin', 'developer');

      const [created] = await db
        .insert(linkedIssues)
        .values({
          ticketId: params.id,
          integrationId: body.integrationId,
          provider: body.provider,
          repoFullName: body.repoFullName,
          issueNumber: body.issueNumber,
          issueUrl: body.issueUrl,
        })
        .returning();

      set.status = 201;

      if (!created) {
        return { error: 'Failed to create linked issue' };
      }

      try {
        return await syncLinkedIssue(created.id) ?? created;
      } catch {
        return created;
      }
    },
    {
      params: 'linkedIssue.params',
      body: 'linkedIssue.link',
    }
  )
  .post(
    '/create',
    async ({ params, body, user, set }) => {
      requireRole(user, 'agent', 'admin', 'developer');

      const [integration] = await db
        .select()
        .from(integrations)
        .where(eq(integrations.id, body.integrationId))
        .limit(1);

      if (!integration) {
        set.status = 404;
        return { error: 'Integration not found' };
      }

      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, params.id))
        .limit(1);

      if (!ticket) {
        set.status = 404;
        return { error: 'Ticket not found' };
      }

      const title = body.title ?? `[Helpdesk #${ticket.ticketNumber}] ${ticket.title}`;
      const issueBody = body.body ?? ticket.description;

      let issueData: any;

      if (integration.provider === 'github') {
        issueData = await github.createIssue(
          integration.accessToken,
          body.repoFullName,
          title,
          issueBody,
          body.labels
        );
      } else {
        const parts = body.repoFullName.split('/');
        issueData = await bitbucket.createIssue(
          integration.accessToken,
          parts[0] ?? '',
          parts[1] ?? '',
          title,
          issueBody
        );
      }

      const issueNumber = integration.provider === 'github' ? issueData.number : issueData.id;
      const issueUrl = integration.provider === 'github'
        ? issueData.html_url
        : issueData.links?.html?.href ?? '';

      const [created] = await db
        .insert(linkedIssues)
        .values({
          ticketId: params.id,
          integrationId: integration.id,
          provider: integration.provider,
          repoFullName: body.repoFullName,
          issueNumber,
          issueUrl,
          issueState: issueData.state ?? 'new',
          assigneeLogin: issueData.assignee?.login ?? issueData.assignee?.display_name ?? null,
          syncedAt: new Date(),
        })
        .returning();

      set.status = 201;
      return created;
    },
    {
      params: 'linkedIssue.params',
      body: 'linkedIssue.create',
    }
  )
  .delete(
    '/:linkedIssueId',
    async ({ params, user, set }) => {
      requireRole(user, 'agent', 'admin', 'developer');
      const [deleted] = await db
        .delete(linkedIssues)
        .where(
          and(
            eq(linkedIssues.id, params.linkedIssueId),
            eq(linkedIssues.ticketId, params.id)
          )
        )
        .returning();
      if (!deleted) {
        set.status = 404;
        return { error: 'Linked issue not found' };
      }
      return { success: true };
    },
    { params: 'linkedIssue.itemParams' }
  )
  .post(
    '/:linkedIssueId/sync',
    async ({ params, user, set }) => {
      requireRole(user, 'agent', 'admin', 'developer');
      try {
        const result = await syncLinkedIssue(params.linkedIssueId);
        if (!result) {
          set.status = 404;
          return { error: 'Linked issue not found' };
        }
        return result;
      } catch (error) {
        set.status = 500;
        return { error: String(error) };
      }
    },
    { params: 'linkedIssue.itemParams' }
  );
