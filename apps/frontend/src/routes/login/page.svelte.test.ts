import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/stores/user.svelte', () => ({
	userState: { login: vi.fn() },
}));

import { goto } from '$app/navigation';
import { userState } from '$lib/stores/user.svelte';
import LoginPage from './+page.svelte';

const mockUserState = userState as any;
const mockGoto = goto as ReturnType<typeof vi.fn>;

describe('Login page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('renders email and password fields', () => {
		render(LoginPage);
		expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
	});

	test('renders sign in button', () => {
		render(LoginPage);
		expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
	});

	test('calls userState.login with form values on submit', async () => {
		const user = userEvent.setup();
		const mockUser = { id: '1', email: 'a@b.com', name: 'Alice', role: 'customer' };
		mockUserState.login.mockResolvedValue(mockUser);

		render(LoginPage);

		await user.type(screen.getByLabelText(/email address/i), 'a@b.com');
		await user.type(screen.getByLabelText(/password/i), 'password123');
		await user.click(screen.getByRole('button', { name: /sign in/i }));

		await waitFor(() => {
			expect(mockUserState.login).toHaveBeenCalledWith('a@b.com', 'password123');
		});
	});

	test('redirects to / on successful login', async () => {
		const user = userEvent.setup();
		mockUserState.login.mockResolvedValue({ id: '1', email: 'a@b.com', name: 'Alice', role: 'customer' });

		render(LoginPage);

		await user.type(screen.getByLabelText(/email address/i), 'a@b.com');
		await user.type(screen.getByLabelText(/password/i), 'pass');
		await user.click(screen.getByRole('button', { name: /sign in/i }));

		await waitFor(() => {
			expect(mockGoto).toHaveBeenCalledWith('/');
		});
	});

	test('shows error message on login failure', async () => {
		const user = userEvent.setup();
		mockUserState.login.mockRejectedValue(new Error('Invalid credentials'));

		render(LoginPage);

		await user.type(screen.getByLabelText(/email address/i), 'bad@example.com');
		await user.type(screen.getByLabelText(/password/i), 'wrong');
		await user.click(screen.getByRole('button', { name: /sign in/i }));

		await waitFor(() => {
			expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
		});
	});

	test('button is disabled and shows loading text during submission', async () => {
		const user = userEvent.setup();
		let resolveLogin: (value: unknown) => void;
		mockUserState.login.mockImplementation(
			() => new Promise((resolve) => { resolveLogin = resolve; })
		);

		render(LoginPage);

		await user.type(screen.getByLabelText(/email address/i), 'a@b.com');
		await user.type(screen.getByLabelText(/password/i), 'pass');
		// Don't await — we want to observe the in-flight state
		user.click(screen.getByRole('button', { name: /sign in/i }));

		await waitFor(() => {
			expect(screen.getByText('Signing in...')).toBeInTheDocument();
		});

		resolveLogin!({ id: '1', email: 'a@b.com', name: 'Alice', role: 'customer' });
	});
});
