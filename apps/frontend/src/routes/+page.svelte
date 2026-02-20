<script lang="ts">
  import { onMount } from 'svelte';
  import { userState } from '$lib/stores/user.svelte';
  import { api } from '$lib/api';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { Badge } from '$lib/components/ui/badge';

  let stats = $state({ open: 0, in_progress: 0, resolved: 0 });
  let recentTickets = $state<any[]>([]);
  let loading = $state(true);

  onMount(async () => {
    try {
      const [openRes, progressRes, resolvedRes, recentRes] = await Promise.all([
        api.tickets.get({ query: { status: 'open', limit: 1 } }),
        api.tickets.get({ query: { status: 'in_progress', limit: 1 } }),
        api.tickets.get({ query: { status: 'resolved', limit: 1 } }),
        api.tickets.get({ query: { limit: 5 } }),
      ]);
      stats = {
        open: (openRes.data as any)?.total ?? 0,
        in_progress: (progressRes.data as any)?.total ?? 0,
        resolved: (resolvedRes.data as any)?.total ?? 0,
      };
      recentTickets = (recentRes.data as any)?.items ?? [];
    } catch {
      // ignore
    } finally {
      loading = false;
    }
  });

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  const priorityColor: Record<string, string> = {
    low: 'bg-neutral-100 text-neutral-600',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700',
  };

  const statusColor: Record<string, string> = {
    open: 'bg-green-100 text-green-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    waiting: 'bg-purple-100 text-purple-700',
    resolved: 'bg-blue-100 text-blue-700',
    closed: 'bg-neutral-100 text-neutral-600',
  };
</script>

<svelte:head>
  <title>Dashboard - Helpdesk</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-semibold">Welcome, {userState.user?.name}</h1>
    <Button href="/tickets/new">New Ticket</Button>
  </div>

  {#if loading}
    <div class="text-muted-foreground">Loading dashboard...</div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card.Root>
        <Card.Header class="pb-2">
          <Card.Description>Open</Card.Description>
        </Card.Header>
        <Card.Content>
          <div class="text-3xl font-bold text-green-600">{stats.open}</div>
        </Card.Content>
      </Card.Root>
      <Card.Root>
        <Card.Header class="pb-2">
          <Card.Description>In Progress</Card.Description>
        </Card.Header>
        <Card.Content>
          <div class="text-3xl font-bold text-yellow-600">{stats.in_progress}</div>
        </Card.Content>
      </Card.Root>
      <Card.Root>
        <Card.Header class="pb-2">
          <Card.Description>Resolved</Card.Description>
        </Card.Header>
        <Card.Content>
          <div class="text-3xl font-bold text-blue-600">{stats.resolved}</div>
        </Card.Content>
      </Card.Root>
    </div>

    <div>
      <h2 class="text-lg font-medium mb-3">Recent Tickets</h2>
      {#if recentTickets.length === 0}
        <Card.Root>
          <Card.Content class="py-8 text-center text-muted-foreground">
            No tickets yet. <a href="/tickets/new" class="text-primary underline">Create one</a>
          </Card.Content>
        </Card.Root>
      {:else}
        <div class="border rounded-lg divide-y">
          {#each recentTickets as ticket}
            <a href="/tickets/{ticket.id}" class="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors no-underline">
              <div class="flex items-center gap-3 min-w-0">
                <svg class={ticket.status === 'closed' || ticket.status === 'resolved' ? 'text-purple-500 shrink-0' : 'text-green-500 shrink-0'} width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  {#if ticket.status === 'closed' || ticket.status === 'resolved'}
                    <path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16zm3.78-9.72a.75.75 0 0 0-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l4.5-4.5z"/>
                  {:else}
                    <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/>
                  {/if}
                </svg>
                <div class="min-w-0">
                  <span class="font-medium text-foreground truncate block">{ticket.title}</span>
                  <span class="text-xs text-muted-foreground">#{ticket.ticketNumber} opened {timeAgo(ticket.createdAt)}</span>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0 ml-4">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium {priorityColor[ticket.priority] ?? ''}">{ticket.priority}</span>
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium {statusColor[ticket.status] ?? ''}">{ticket.status.replace('_', ' ')}</span>
              </div>
            </a>
          {/each}
        </div>
        <div class="mt-3">
          <Button variant="outline" size="sm" href="/tickets">View all tickets</Button>
        </div>
      {/if}
    </div>
  {/if}
</div>
