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
import { startAutoSync } from './services/sync';

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
  .use(linkedIssuesRoutes);

const app = new Elysia()
  .use(cors())
  .use(devOpenapi)
  .onError(({ error, set }) => {
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

console.log(`Helpdesk API running at http://localhost:${process.env.PORT ?? 3000}`);

export type App = typeof app;
