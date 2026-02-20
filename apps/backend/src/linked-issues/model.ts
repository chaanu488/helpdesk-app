import { Elysia, t } from 'elysia';

const provider = t.Union([t.Literal('github'), t.Literal('bitbucket')]);

export const linkedIssuesModel = new Elysia({ name: 'linked-issues/model' }).model({
  'linkedIssue.params': t.Object({ id: t.String() }),
  'linkedIssue.itemParams': t.Object({ id: t.String(), linkedIssueId: t.String() }),
  'linkedIssue.link': t.Object({
    integrationId: t.String(),
    provider,
    repoFullName: t.String(),
    issueNumber: t.Number(),
    issueUrl: t.String(),
  }),
  'linkedIssue.create': t.Object({
    integrationId: t.String(),
    repoFullName: t.String(),
    title: t.Optional(t.String()),
    body: t.Optional(t.String()),
    labels: t.Optional(t.Array(t.String())),
  }),
});
