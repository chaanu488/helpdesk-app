import { test, expect } from '@playwright/test';
import type { BrowserContext } from '@playwright/test';

const EMAIL = process.env.TEST_EMAIL ?? 'test@example.com';
const PASSWORD = process.env.TEST_PASSWORD ?? 'password';
const API_URL = process.env.VITE_API_URL ?? 'http://localhost:3000';

// Run tests serially so ticketId flows from create → read
test.describe.configure({ mode: 'serial' });

let authContext: BrowserContext;
let ticketId: string;

test.beforeAll(async ({ browser }) => {
  authContext = await browser.newContext();
  const response = await authContext.request.post(`${API_URL}/api/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(response.ok()).toBeTruthy();
});

test.afterAll(async () => {
  await authContext.close();
});

test('create a new ticket', async () => {
  const page = await authContext.newPage();

  await page.goto('/tickets/new');
  await page.getByLabel('Title').fill('E2E Test Ticket');
  await page.getByLabel('Description').fill('This is a test ticket created by Playwright E2E tests.');
  await page.locator('#priority').selectOption('high');

  await page.getByRole('button', { name: 'Create ticket' }).click();

  await expect(page).toHaveURL(/\/tickets\/[^/]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('E2E Test Ticket');

  ticketId = page.url().split('/tickets/')[1];

  await page.close();
});

test('read the created ticket', async () => {
  expect(ticketId).toBeTruthy();

  const page = await authContext.newPage();
  await page.goto(`/tickets/${ticketId}`);

  await expect(page.getByRole('heading', { level: 1 })).toContainText('E2E Test Ticket');
  await expect(page.getByText('high priority')).toBeVisible();
  await expect(page.getByText('open', { exact: true })).toBeVisible();
  await expect(page.getByText('This is a test ticket created by Playwright E2E tests.')).toBeVisible();

  await page.close();
});
