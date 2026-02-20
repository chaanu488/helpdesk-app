import { test, expect } from 'bun:test';
import { hashPassword, verifyPassword } from './password';

test('hashPassword returns a bcrypt hash', async () => {
  const hash = await hashPassword('test123');
  expect(hash).toStartWith('$2');
  expect(hash.length).toBeGreaterThan(50);
});

test('verifyPassword returns true for correct password', async () => {
  const hash = await hashPassword('mypassword');
  const result = await verifyPassword('mypassword', hash);
  expect(result).toBe(true);
});

test('verifyPassword returns false for wrong password', async () => {
  const hash = await hashPassword('mypassword');
  const result = await verifyPassword('wrongpassword', hash);
  expect(result).toBe(false);
});
