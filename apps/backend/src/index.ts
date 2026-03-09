import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { authRoutes } from './auth';
import { categoriesRoutes } from './categories';
import { companiesRoutes } from './companies';
import { ticketsRoutes } from './tickets';
import { messagesRoutes } from './messages';
import { usersRoutes } from './users';
import { integrationsRoutes } from './integrations';
import { linkedIssuesRoutes } from './linked-issues';
import { attachmentsRoutes } from './attachments';
import { invitationsRoutes } from './invitations';
import { notificationsRoutes } from './notifications';
import { auditLogsRoutes } from './audit-logs';
import { startAutoSync } from './services/sync';
import { ensureBucketExists } from './lib/storage';

const isDev = process.env.NODE_ENV !== 'production';

const devOpenapi = isDev
  ? new Elysia()
      .use((await import('@elysiajs/openapi')).openapi({
        references: (await import('@elysiajs/openapi')).fromTypes('src/index.ts'),
        documentation: {
          info: {
            title: 'Helpdesk API',
            version: '1.0.0',
            description: 'Customer support ticketing system API',
          },
          components: {
            securitySchemes: {
              bearer: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
              },
            },
          },
        },
      }))
  : new Elysia();

const apiRoutes = new Elysia({ prefix: '/api' })
  .use(authRoutes)
  .use(categoriesRoutes)
  .use(companiesRoutes)
  .use(ticketsRoutes)
  .use(messagesRoutes)
  .use(usersRoutes)
  .use(integrationsRoutes)
  .use(linkedIssuesRoutes)
  .use(attachmentsRoutes)
  .use(invitationsRoutes)
  .use(notificationsRoutes)
  .use(auditLogsRoutes);

const app = new Elysia()
  .use(cors())
  .use(devOpenapi)
  .onError(({ code, error, set }) => {
    if (code === 'VALIDATION') {
      set.status = 422;
      try {
        const parsed = JSON.parse('message' in error ? error.message : '{}');
        const summary = parsed.summary ?? parsed.errors?.[0]?.summary ?? 'Validation error';
        const field = (parsed.property ?? '').replace(/^\//, '');
        return { error: field ? `${field}: ${summary}` : summary };
      } catch {
        return { error: 'Validation error' };
      }
    }
    const msg = 'message' in error ? error.message : '';
    if (msg === 'Unauthorized') {
      set.status = 401;
      return { error: 'Unauthorized' };
    }
    if (msg === 'Forbidden') {
      set.status = 403;
      return { error: 'Forbidden' };
    }
    console.error(error);
    set.status = 500;
    return { error: 'Internal server error' };
  })
  .get('/', () => ({ status: 'ok', service: 'helpdesk-api' }))
  .use(apiRoutes)
  .listen(Number(process.env.PORT ?? 3000));

// Start auto-sync for linked issues
startAutoSync();

// Ensure MinIO bucket exists
ensureBucketExists();

console.log(`Helpdesk API running at http://localhost:${process.env.PORT ?? 3000}`);

export type App = typeof app;
