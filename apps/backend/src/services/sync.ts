import { db } from '../lib/db';
import { linkedIssues, integrations } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import * as github from './github';
import * as bitbucket from './bitbucket';

export async function syncLinkedIssue(linkedIssueId: string) {
  const [issue] = await db
    .select()
    .from(linkedIssues)
    .where(eq(linkedIssues.id, linkedIssueId))
    .limit(1);

  if (!issue) return null;

  const [integration] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.id, issue.integrationId))
    .limit(1);

  if (!integration) return null;

  let state: string | null = null;
  let assignee: string | null = null;

  if (issue.provider === 'github') {
    const data = await github.getIssue(
      integration.accessToken,
      issue.repoFullName,
      issue.issueNumber
    );
    state = data.state;
    assignee = data.assignee?.login ?? null;
  } else if (issue.provider === 'bitbucket') {
    const parts = issue.repoFullName.split('/');
    const data = await bitbucket.getIssue(
      integration.accessToken,
      parts[0] ?? '',
      parts[1] ?? '',
      issue.issueNumber
    );
    state = data.state;
    assignee = data.assignee?.display_name ?? null;
  }

  const [updated] = await db
    .update(linkedIssues)
    .set({
      issueState: state,
      assigneeLogin: assignee,
      syncedAt: new Date(),
    })
    .where(eq(linkedIssues.id, linkedIssueId))
    .returning();

  return updated;
}

export async function syncAllLinkedIssues() {
  const allIssues = await db.select({ id: linkedIssues.id }).from(linkedIssues);
  const results = [];
  for (const issue of allIssues) {
    try {
      const result = await syncLinkedIssue(issue.id);
      results.push({ id: issue.id, success: true, result });
    } catch (error) {
      results.push({ id: issue.id, success: false, error: String(error) });
    }
  }
  return results;
}

let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoSync(intervalMs = 5 * 60 * 1000) {
  if (syncInterval) return;
  syncInterval = setInterval(async () => {
    try {
      await syncAllLinkedIssues();
    } catch (e) {
      console.error('Auto-sync failed:', e);
    }
  }, intervalMs);
  console.log(`Auto-sync started (every ${intervalMs / 1000}s)`);
}

export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
