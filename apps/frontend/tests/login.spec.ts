import { test, expect } from '@playwright/test';

const EMAIL = process.env.TEST_EMAIL ?? 'test@example.com';
const PASSWORD = process.env.TEST_PASSWORD ?? 'password';

test('login with valid credentials redirects to dashboard', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Email address').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: /^Welcome,/ })).toBeVisible();
});
