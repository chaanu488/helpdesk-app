import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@elysiajs/eden', () => ({
	treaty: vi.fn(() => ({
		api: {
			auth: {
				login: { post: vi.fn() },
				register: { post: vi.fn() },
				logout: { post: vi.fn() },
				me: { get: vi.fn() },
			},
		},
	})),
}));

import { api, auth } from '$lib/api';

// Cast to any to call mock methods without TS complaints
const mockApi = api as any;

describe('AuthClient', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('login()', () => {
		test('returns user on success', async () => {
			const mockUser = { id: '1', email: 'a@b.com', name: 'Alice', role: 'customer' as const };
			mockApi.auth.login.post.mockResolvedValue({ data: { user: mockUser }, error: null });

			const user = await auth.login('a@b.com', 'password');
			expect(user).toEqual(mockUser);
			expect(mockApi.auth.login.post).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password' });
		});

		test('throws the server error message', async () => {
			mockApi.auth.login.post.mockResolvedValue({
				data: null,
				error: { value: { error: 'Invalid credentials' } },
			});

			await expect(auth.login('bad@example.com', 'wrong')).rejects.toThrow('Invalid credentials');
		});

		test('throws generic message when error has no detail', async () => {
			mockApi.auth.login.post.mockResolvedValue({ data: null, error: { value: {} } });

			await expect(auth.login('a@b.com', 'pass')).rejects.toThrow('Login failed');
		});
	});

	describe('register()', () => {
		test('returns user on success', async () => {
			const mockUser = { id: '2', email: 'b@b.com', name: 'Bob', role: 'customer' as const };
			mockApi.auth.register.post.mockResolvedValue({ data: { user: mockUser }, error: null });

			const user = await auth.register('b@b.com', 'pass', 'Bob');
			expect(user).toEqual(mockUser);
			expect(mockApi.auth.register.post).toHaveBeenCalledWith({
				email: 'b@b.com',
				password: 'pass',
				name: 'Bob',
			});
		});

		test('throws the server error message', async () => {
			mockApi.auth.register.post.mockResolvedValue({
				data: null,
				error: { value: { error: 'Email taken' } },
			});

			await expect(auth.register('taken@example.com', 'pass', 'X')).rejects.toThrow('Email taken');
		});
	});

	describe('logout()', () => {
		test('calls logout endpoint and resolves', async () => {
			mockApi.auth.logout.post.mockResolvedValue({ data: null, error: null });

			await expect(auth.logout()).resolves.toBeUndefined();
			expect(mockApi.auth.logout.post).toHaveBeenCalled();
		});
	});

	describe('me()', () => {
		test('returns user when session is valid', async () => {
			const mockUser = { id: '1', email: 'a@b.com', name: 'Alice', role: 'customer' as const };
			mockApi.auth.me.get.mockResolvedValue({ data: mockUser, error: null });

			const user = await auth.me();
			expect(user).toEqual(mockUser);
		});

		test('returns null when not authenticated', async () => {
			mockApi.auth.me.get.mockResolvedValue({ data: null, error: { value: 'Unauthorized' } });

			const user = await auth.me();
			expect(user).toBeNull();
		});
	});
});
