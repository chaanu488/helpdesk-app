import { test, expect, describe, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { authRoutes } from '../src/auth';
import { categoriesRoutes } from '../src/categories';
import { ticketsRoutes } from '../src/tickets';
import { messagesRoutes } from '../src/messages';
import { usersRoutes } from '../src/users';
import { integrationsRoutes } from '../src/integrations';
import { linkedIssuesRoutes } from '../src/linked-issues';
import { db } from '../src/lib/db';
import { users, categories, tickets, messages, ticketTags, integrations, linkedIssues } from '../src/lib/db/schema';
import { sql } from 'drizzle-orm';

const apiRoutes = new Elysia({ prefix: '/api' })
  .use(authRoutes)
  .use(categoriesRoutes)
  .use(ticketsRoutes)
  .use(messagesRoutes)
  .use(usersRoutes)
  .use(integrationsRoutes)
  .use(linkedIssuesRoutes);

const app = new Elysia()
  .use(cors())
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
    set.status = 500;
    return { error: 'Internal server error' };
  })
  .get('/', () => ({ status: 'ok', service: 'helpdesk-api' }))
  .use(apiRoutes);

async function req(method: string, path: string, body?: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  );
}

async function json(res: Response): Promise<any> {
  return res.json();
}

// Test state
let adminToken: string;
let agentToken: string;
let customerToken: string;
let categoryId: string;
let ticketId: string;

beforeAll(async () => {
  // Clean tables in dependency order
  await db.delete(linkedIssues);
  await db.delete(integrations);
  await db.delete(messages);
  await db.delete(ticketTags);
  await db.delete(tickets);
  await db.delete(categories);
  await db.delete(users);
});

afterAll(async () => {
  await db.delete(linkedIssues);
  await db.delete(integrations);
  await db.delete(messages);
  await db.delete(ticketTags);
  await db.delete(tickets);
  await db.delete(categories);
  await db.delete(users);
});

// --- Health ---
describe('Health', () => {
  test('GET / returns ok', async () => {
    const res = await req('GET', '/');
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.status).toBe('ok');
  });
});

// --- Auth ---
describe('Auth', () => {
  test('register admin', async () => {
    const res = await req('POST', '/api/auth/register', {
      email: 'admin@test.com',
      password: 'admin123',
      name: 'Test Admin',
      role: 'admin',
    });
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.token).toBeDefined();
    expect(data.user.role).toBe('admin');
    adminToken = data.token;
  });

  test('register agent', async () => {
    const res = await req('POST', '/api/auth/register', {
      email: 'agent@test.com',
      password: 'agent123',
      name: 'Test Agent',
      role: 'agent',
    });
    expect(res.status).toBe(200);
    agentToken = (await json(res)).token;
  });

  test('register customer', async () => {
    const res = await req('POST', '/api/auth/register', {
      email: 'customer@test.com',
      password: 'cust123',
      name: 'Test Customer',
    });
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.user.role).toBe('customer');
    customerToken = data.token;
  });

  test('register duplicate email returns 409', async () => {
    const res = await req('POST', '/api/auth/register', {
      email: 'admin@test.com',
      password: 'admin123',
      name: 'Duplicate',
    });
    expect(res.status).toBe(409);
  });

  test('login with valid credentials', async () => {
    const res = await req('POST', '/api/auth/login', {
      email: 'admin@test.com',
      password: 'admin123',
    });
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.token).toBeDefined();
    expect(data.user.email).toBe('admin@test.com');
  });

  test('login with wrong password returns 401', async () => {
    const res = await req('POST', '/api/auth/login', {
      email: 'admin@test.com',
      password: 'wrongpass',
    });
    expect(res.status).toBe(401);
  });

  test('login with non-existent email returns 401', async () => {
    const res = await req('POST', '/api/auth/login', {
      email: 'nobody@test.com',
      password: 'any',
    });
    expect(res.status).toBe(401);
  });
});

// --- Categories ---
describe('Categories', () => {
  test('GET /api/categories returns empty initially', async () => {
    const res = await req('GET', '/api/categories');
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data).toBeArray();
  });

  test('POST /api/categories requires admin', async () => {
    const res = await req('POST', '/api/categories', { name: 'Bug' }, customerToken);
    expect(res.status).toBe(403);
  });

  test('POST /api/categories as admin creates category', async () => {
    const res = await req('POST', '/api/categories', {
      name: 'Bug Report',
      description: 'Something broken',
    }, adminToken);
    expect(res.status).toBe(201);
    const data = await json(res);
    expect(data.name).toBe('Bug Report');
    categoryId = data.id;
  });

  test('PUT /api/categories/:id updates category', async () => {
    const res = await req('PUT', `/api/categories/${categoryId}`, {
      description: 'Updated description',
    }, adminToken);
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.description).toBe('Updated description');
  });
});

// --- Tickets ---
describe('Tickets', () => {
  test('POST /api/tickets requires auth', async () => {
    const res = await req('POST', '/api/tickets', { title: 'Test', description: 'Test' });
    expect(res.status).toBe(401);
  });

  test('POST /api/tickets creates ticket', async () => {
    const res = await req('POST', '/api/tickets', {
      title: 'Login broken',
      description: 'Cannot login after update',
      priority: 'high',
      categoryId,
      tags: ['login', 'urgent'],
    }, customerToken);
    expect(res.status).toBe(201);
    const data = await json(res);
    expect(data.title).toBe('Login broken');
    expect(data.status).toBe('open');
    expect(data.priority).toBe('high');
    ticketId = data.id;
  });

  test('GET /api/tickets as customer returns own tickets', async () => {
    const res = await req('GET', '/api/tickets', undefined, customerToken);
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.items.length).toBe(1);
    expect(data.total).toBe(1);
  });

  test('GET /api/tickets as admin returns all', async () => {
    const res = await req('GET', '/api/tickets', undefined, adminToken);
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.items.length).toBeGreaterThanOrEqual(1);
  });

  test('GET /api/tickets/:id returns ticket with tags', async () => {
    const res = await req('GET', `/api/tickets/${ticketId}`, undefined, customerToken);
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.title).toBe('Login broken');
    expect(data.tags).toContain('login');
    expect(data.tags).toContain('urgent');
  });

  test('GET /api/tickets with status filter', async () => {
    const res = await req('GET', '/api/tickets?status=open', undefined, adminToken);
    expect(res.status).toBe(200);
    const data = await json(res);
    for (const item of data.items) {
      expect(item.status).toBe('open');
    }
  });

  test('PATCH /api/tickets/:id - customer can update title', async () => {
    const res = await req('PATCH', `/api/tickets/${ticketId}`, {
      title: 'Login broken (updated)',
    }, customerToken);
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.title).toBe('Login broken (updated)');
  });

  test('POST /api/tickets/:id/assign as agent', async () => {
    // Get agent user id from token
    const meRes = await req('GET', '/api/users/me', undefined, agentToken);
    const agent = await json(meRes);

    const res = await req('POST', `/api/tickets/${ticketId}/assign`, {
      agentId: agent.id,
    }, agentToken);
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.assignedAgentId).toBe(agent.id);
  });

  test('POST /api/tickets/:id/assign as customer fails', async () => {
    const res = await req('POST', `/api/tickets/${ticketId}/assign`, {
      agentId: 'any',
    }, customerToken);
    expect(res.status).toBe(403);
  });
});

// --- Messages ---
describe('Messages', () => {
  test('POST message to ticket', async () => {
    const res = await req('POST', `/api/tickets/${ticketId}/messages`, {
      body: 'Help! I cannot login.',
    }, customerToken);
    expect(res.status).toBe(201);
    const data = await json(res);
    expect(data.body).toBe('Help! I cannot login.');
    expect(data.isInternal).toBe(false);
  });

  test('POST internal note as agent', async () => {
    const res = await req('POST', `/api/tickets/${ticketId}/messages`, {
      body: 'Checking server logs now.',
      isInternal: true,
    }, agentToken);
    expect(res.status).toBe(201);
    const data = await json(res);
    expect(data.isInternal).toBe(true);
  });

  test('customer cannot post internal note', async () => {
    const res = await req('POST', `/api/tickets/${ticketId}/messages`, {
      body: 'Try to be internal',
      isInternal: true,
    }, customerToken);
    expect(res.status).toBe(201);
    const data = await json(res);
    expect(data.isInternal).toBe(false); // forced to false
  });

  test('GET messages - customer cannot see internal notes', async () => {
    const res = await req('GET', `/api/tickets/${ticketId}/messages`, undefined, customerToken);
    expect(res.status).toBe(200);
    const data = await json(res);
    for (const msg of data) {
      expect(msg.isInternal).toBe(false);
    }
  });

  test('GET messages - agent sees all including internal', async () => {
    const res = await req('GET', `/api/tickets/${ticketId}/messages`, undefined, agentToken);
    expect(res.status).toBe(200);
    const data = await json(res);
    const internal = data.filter((m: any) => m.isInternal);
    expect(internal.length).toBeGreaterThanOrEqual(1);
  });
});

// --- Users ---
describe('Users', () => {
  test('GET /api/users/me returns current user', async () => {
    const res = await req('GET', '/api/users/me', undefined, adminToken);
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.email).toBe('admin@test.com');
    expect(data.role).toBe('admin');
  });

  test('PATCH /api/users/me updates profile', async () => {
    const res = await req('PATCH', '/api/users/me', {
      name: 'Updated Admin',
    }, adminToken);
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.name).toBe('Updated Admin');
  });

  test('GET /api/users as admin lists all', async () => {
    const res = await req('GET', '/api/users', undefined, adminToken);
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.length).toBeGreaterThanOrEqual(3);
  });

  test('GET /api/users as customer fails', async () => {
    const res = await req('GET', '/api/users', undefined, customerToken);
    expect(res.status).toBe(403);
  });

  test('PATCH /api/users/:id/role as admin', async () => {
    const listRes = await req('GET', '/api/users', undefined, adminToken);
    const allUsers = await json(listRes);
    const customer = allUsers.find((u: any) => u.role === 'customer');

    const res = await req('PATCH', `/api/users/${customer.id}/role`, {
      role: 'agent',
    }, adminToken);
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.role).toBe('agent');

    // Revert
    await req('PATCH', `/api/users/${customer.id}/role`, { role: 'customer' }, adminToken);
  });
});

// --- Integrations ---
describe('Integrations', () => {
  let integrationId: string;

  test('POST /api/integrations requires admin', async () => {
    const res = await req('POST', '/api/integrations', {
      provider: 'github',
      accessToken: 'ghp_test123',
      owner: 'testorg',
    }, customerToken);
    expect(res.status).toBe(403);
  });

  test('POST /api/integrations as admin', async () => {
    const res = await req('POST', '/api/integrations', {
      provider: 'github',
      accessToken: 'ghp_test123',
      owner: 'testorg',
    }, adminToken);
    expect(res.status).toBe(201);
    const data = await json(res);
    expect(data.provider).toBe('github');
    expect(data.owner).toBe('testorg');
    integrationId = data.id;
  });

  test('GET /api/integrations as admin', async () => {
    const res = await req('GET', '/api/integrations', undefined, adminToken);
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.length).toBeGreaterThanOrEqual(1);
    // Token should not be exposed in list
    expect(data[0].accessToken).toBeUndefined();
  });

  test('DELETE /api/integrations/:id', async () => {
    const res = await req('DELETE', `/api/integrations/${integrationId}`, undefined, adminToken);
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.success).toBe(true);
  });
});
