import { describe, test, expect, vi, beforeEach } from 'vitest';
import { flushSync } from 'svelte';

vi.mock('$lib/api', () => ({
	auth: {
		me: vi.fn(),
		login: vi.fn(),
		register: vi.fn(),
		logout: vi.fn(),
	},
}));

import { auth } from '$lib/api';
import { UserState } from '$lib/stores/user.svelte';

const mockAuth = auth as any;

describe('UserState', () => {
	let state: UserState;

	beforeEach(() => {
		vi.clearAllMocks();
		state = new UserState();
	});

	test('initial state: user=null, loading=true, isAuthenticated=false', () => {
		expect(state.user).toBeNull();
		expect(state.loading).toBe(true);
		expect(state.isAuthenticated).toBe(false);
	});

	describe('init()', () => {
		test('sets user and loading=false when session is valid', async () => {
			const mockUser = { id: '1', email: 'a@b.com', name: 'Alice', role: 'customer' as const };
			mockAuth.me.mockResolvedValue(mockUser);

			await state.init();
			flushSync();

			expect(state.user).toEqual(mockUser);
			expect(state.loading).toBe(false);
			expect(state.isAuthenticated).toBe(true);
		});

		test('sets user=null when not authenticated', async () => {
			mockAuth.me.mockResolvedValue(null);

			await state.init();
			flushSync();

			expect(state.user).toBeNull();
			expect(state.loading).toBe(false);
		});

		test('handles auth.me() throwing — sets user=null and loading=false', async () => {
			mockAuth.me.mockRejectedValue(new Error('Network error'));

			await state.init();
			flushSync();

			expect(state.user).toBeNull();
			expect(state.loading).toBe(false);
		});
	});

	describe('login()', () => {
		test('sets user state and returns the user', async () => {
			const mockUser = { id: '2', email: 'b@b.com', name: 'Bob', role: 'customer' as const };
			mockAuth.login.mockResolvedValue(mockUser);

			const result = await state.login('b@b.com', 'pass');
			flushSync();

			expect(result).toEqual(mockUser);
			expect(state.user).toEqual(mockUser);
			expect(state.isAuthenticated).toBe(true);
		});

		test('propagates login error without changing state', async () => {
			mockAuth.login.mockRejectedValue(new Error('Invalid credentials'));

			await expect(state.login('a@b.com', 'wrong')).rejects.toThrow('Invalid credentials');
			expect(state.user).toBeNull();
		});
	});

	describe('register()', () => {
		test('sets user state and returns the user', async () => {
			const mockUser = { id: '3', email: 'c@c.com', name: 'Carol', role: 'customer' as const };
			mockAuth.register.mockResolvedValue(mockUser);

			const result = await state.register('c@c.com', 'pass', 'Carol');
			flushSync();

			expect(result).toEqual(mockUser);
			expect(state.user).toEqual(mockUser);
			expect(state.isAuthenticated).toBe(true);
		});
	});

	describe('logout()', () => {
		test('clears user and sets isAuthenticated=false', async () => {
			const mockUser = { id: '1', email: 'a@b.com', name: 'Alice', role: 'customer' as const };
			state.user = mockUser;
			mockAuth.logout.mockResolvedValue(undefined);

			await state.logout();
			flushSync();

			expect(state.user).toBeNull();
			expect(state.isAuthenticated).toBe(false);
		});
	});
});
