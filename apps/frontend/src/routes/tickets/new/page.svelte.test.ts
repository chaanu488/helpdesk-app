import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/api', () => ({
	api: {
		categories: { get: vi.fn() },
		tickets: { post: vi.fn() },
	},
}));

import { goto } from '$app/navigation';
import { api } from '$lib/api';
import NewTicketPage from './+page.svelte';

const mockApi = api as any;
const mockGoto = goto as ReturnType<typeof vi.fn>;

describe('New Ticket page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Default: no categories
		mockApi.categories.get.mockResolvedValue({ data: [], error: null });
	});

	test('renders title, description, priority and tags fields', async () => {
		render(NewTicketPage);
		expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
	});

	test('renders create ticket button', () => {
		render(NewTicketPage);
		expect(screen.getByRole('button', { name: /create ticket/i })).toBeInTheDocument();
	});

	test('renders cancel as a link to /tickets', () => {
		render(NewTicketPage);
		const cancelLink = screen.getByRole('link', { name: /cancel/i });
		expect(cancelLink).toBeInTheDocument();
		expect(cancelLink).toHaveAttribute('href', '/tickets');
	});

	test('loads and renders categories on mount', async () => {
		const cats = [
			{ id: '1', name: 'Bug' },
			{ id: '2', name: 'Feature' },
		];
		mockApi.categories.get.mockResolvedValue({ data: cats, error: null });

		render(NewTicketPage);

		await waitFor(() => {
			expect(screen.getByRole('option', { name: 'Bug' })).toBeInTheDocument();
			expect(screen.getByRole('option', { name: 'Feature' })).toBeInTheDocument();
		});
	});

	test('submits ticket with form values and redirects on success', async () => {
		const user = userEvent.setup();
		mockApi.tickets.post.mockResolvedValue({ data: { id: 'ticket-123' }, error: null });

		render(NewTicketPage);

		await user.type(screen.getByLabelText(/title/i), 'Something is broken');
		await user.type(screen.getByLabelText(/description/i), 'It stopped working after the update');
		await user.click(screen.getByRole('button', { name: /create ticket/i }));

		await waitFor(() => {
			expect(mockApi.tickets.post).toHaveBeenCalledWith(
				expect.objectContaining({
					title: 'Something is broken',
					description: 'It stopped working after the update',
				})
			);
			expect(mockGoto).toHaveBeenCalledWith('/tickets/ticket-123');
		});
	});

	test('splits comma-separated tags and trims whitespace', async () => {
		const user = userEvent.setup();
		mockApi.tickets.post.mockResolvedValue({ data: { id: 'ticket-1' }, error: null });

		render(NewTicketPage);

		await user.type(screen.getByLabelText(/title/i), 'Tagged ticket');
		await user.type(screen.getByLabelText(/description/i), 'With tags');
		await user.type(screen.getByLabelText(/tags/i), 'bug, ui, api');
		await user.click(screen.getByRole('button', { name: /create ticket/i }));

		await waitFor(() => {
			expect(mockApi.tickets.post).toHaveBeenCalledWith(
				expect.objectContaining({ tags: ['bug', 'ui', 'api'] })
			);
		});
	});

	test('shows error message on submission failure', async () => {
		const user = userEvent.setup();
		mockApi.tickets.post.mockResolvedValue({
			data: null,
			error: { value: { error: 'Validation failed' } },
		});

		render(NewTicketPage);

		await user.type(screen.getByLabelText(/title/i), 'Bad ticket');
		await user.type(screen.getByLabelText(/description/i), 'Will fail');
		await user.click(screen.getByRole('button', { name: /create ticket/i }));

		await waitFor(() => {
			expect(screen.getByText('Validation failed')).toBeInTheDocument();
		});
	});

	test('button shows loading text during submission', async () => {
		const user = userEvent.setup();
		let resolvePost: (value: unknown) => void;
		mockApi.tickets.post.mockImplementation(
			() => new Promise((resolve) => { resolvePost = resolve; })
		);

		render(NewTicketPage);

		await user.type(screen.getByLabelText(/title/i), 'Test');
		await user.type(screen.getByLabelText(/description/i), 'Desc');
		user.click(screen.getByRole('button', { name: /create ticket/i }));

		await waitFor(() => {
			expect(screen.getByText('Creating...')).toBeInTheDocument();
		});

		resolvePost!({ data: { id: '1' }, error: null });
	});
});
