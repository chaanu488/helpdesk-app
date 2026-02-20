import { Elysia, t } from 'elysia';

const provider = t.Union([t.Literal('github'), t.Literal('bitbucket')]);

export const integrationsModel = new Elysia({ name: 'integrations/model' }).model({
  'integration.create': t.Object({
    provider,
    accessToken: t.String({ minLength: 1 }),
    refreshToken: t.Optional(t.String()),
    owner: t.String({ minLength: 1 }),
  }),
  'integration.params': t.Object({ id: t.String() }),
});
