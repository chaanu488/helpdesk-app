<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { api } from '$lib/api';
  import { userState } from '$lib/stores/user.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Badge } from '$lib/components/ui/badge';

  let tickets = $state<any[]>([]);
  let total = $state(0);
  let loading = $state(true);

  let search = $state('');
  let statusFilter = $state('open');
  let priorityFilter = $state('');
  let currentPage = $state(1);
  const limit = 20;

  let categories = $state<any[]>([]);
  let users = $state<any[]>([]);

  const isStaff = $derived(
    userState.user?.role === 'admin' ||
    userState.user?.role === 'agent' ||
    userState.user?.role === 'developer'
  );

  onMount(async () => {
    try {
      const catRes = await api.categories.get();
      categories = (catRes.data as any) ?? [];
      if (isStaff) {
        const usersRes = await api.users.get();
        users = (usersRes.data as any) ?? [];
      }
    } catch {}
    await fetchTickets();
  });

  async function fetchTickets() {
    loading = true;
    try {
      const query: any = { page: currentPage, limit };
      if (statusFilter) query.status = statusFilter;
      if (priorityFilter) query.priority = priorityFilter;
      if (search.trim()) query.search = search.trim();

      const res = await api.tickets.get({ query });
      const data = res.data as any;
      tickets = data?.items ?? [];
      total = data?.total ?? 0;
    } catch {
      tickets = [];
    } finally {
      loading = false;
    }
  }

  function handleSearch() {
    currentPage = 1;
    fetchTickets();
  }

  function setStatus(s: string) {
    statusFilter = s;
    currentPage = 1;
    fetchTickets();
  }

  function setPriority(p: string) {
    priorityFilter = p;
    currentPage = 1;
    fetchTickets();
  }

  function nextPage() {
    if (currentPage * limit < total) {
      currentPage++;
      fetchTickets();
    }
  }

  function prevPage() {
    if (currentPage > 1) {
      currentPage--;
      fetchTickets();
    }
  }

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

  function getUserName(id: string) {
    return users.find((u: any) => u.id === id)?.name ?? '';
  }

  function getCategoryName(id: string) {
    return categories.find((c: any) => c.id === id)?.name ?? '';
  }

  const totalPages = $derived(Math.ceil(total / limit));
</script>

<svelte:head>
  <title>Tickets - Helpdesk</title>
</svelte:head>

<div class="space-y-4">
  <!-- Top bar -->
  <div class="flex items-center gap-3">
    <form onsubmit={(e) => { e.preventDefault(); handleSearch(); }} class="flex-1 flex gap-2">
      <Input
        type="text"
        placeholder="Search tickets..."
        bind:value={search}
        class="max-w-md"
      />
      <Button variant="outline" type="submit">Search</Button>
    </form>
    <Button href="/tickets/new">New ticket</Button>
  </div>

  <!-- Filter bar -->
  <div class="flex items-center gap-2 flex-wrap">
    <!-- Status tabs -->
    <div class="flex items-center border rounded-lg overflow-hidden">
      <button
        class="px-3 py-1.5 text-sm font-medium transition-colors {statusFilter === 'open' ? 'bg-neutral-900 text-white' : 'text-muted-foreground hover:bg-muted'}"
        onclick={() => setStatus('open')}
      >
        Open
      </button>
      <button
        class="px-3 py-1.5 text-sm font-medium transition-colors {statusFilter === 'in_progress' ? 'bg-neutral-900 text-white' : 'text-muted-foreground hover:bg-muted'}"
        onclick={() => setStatus('in_progress')}
      >
        In Progress
      </button>
      <button
        class="px-3 py-1.5 text-sm font-medium transition-colors {statusFilter === 'resolved' ? 'bg-neutral-900 text-white' : 'text-muted-foreground hover:bg-muted'}"
        onclick={() => setStatus('resolved')}
      >
        Resolved
      </button>
      <button
        class="px-3 py-1.5 text-sm font-medium transition-colors {statusFilter === 'closed' ? 'bg-neutral-900 text-white' : 'text-muted-foreground hover:bg-muted'}"
        onclick={() => setStatus('closed')}
      >
        Closed
      </button>
      <button
        class="px-3 py-1.5 text-sm font-medium transition-colors {statusFilter === '' ? 'bg-neutral-900 text-white' : 'text-muted-foreground hover:bg-muted'}"
        onclick={() => setStatus('')}
      >
        All
      </button>
    </div>

    <!-- Priority filter -->
    <select
      class="h-8 rounded-md border bg-background px-2 text-sm"
      value={priorityFilter}
      onchange={(e) => setPriority((e.target as HTMLSelectElement).value)}
    >
      <option value="">All priorities</option>
      <option value="low">Low</option>
      <option value="medium">Medium</option>
      <option value="high">High</option>
      <option value="urgent">Urgent</option>
    </select>

    <span class="text-sm text-muted-foreground ml-auto">{total} ticket{total !== 1 ? 's' : ''}</span>
  </div>

  <!-- Ticket list -->
  {#if loading}
    <div class="text-muted-foreground py-8 text-center">Loading tickets...</div>
  {:else if tickets.length === 0}
    <div class="border rounded-lg py-12 text-center text-muted-foreground">
      No tickets found.
    </div>
  {:else}
    <div class="border rounded-lg divide-y">
      {#each tickets as ticket}
        <a href="/tickets/{ticket.id}" class="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors no-underline group">
          <!-- Status icon -->
          <svg class="mt-0.5 shrink-0 {ticket.status === 'closed' || ticket.status === 'resolved' ? 'text-purple-500' : 'text-green-500'}" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            {#if ticket.status === 'closed' || ticket.status === 'resolved'}
              <path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16zm3.78-9.72a.75.75 0 0 0-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l4.5-4.5z"/>
            {:else}
              <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/>
            {/if}
          </svg>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-semibold text-foreground group-hover:text-primary transition-colors">{ticket.title}</span>
              <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium {priorityColor[ticket.priority] ?? ''}">{ticket.priority}</span>
              {#if ticket.categoryId}
                <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{getCategoryName(ticket.categoryId)}</span>
              {/if}
              {#if ticket.tags}
                {#each ticket.tags as tag}
                  <span class="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[10px] font-medium">{tag}</span>
                {/each}
              {/if}
            </div>
            <div class="text-xs text-muted-foreground mt-0.5">
              #{ticket.ticketNumber} opened {timeAgo(ticket.createdAt)}
              {#if ticket.assignedAgentId}
                &middot; assigned to {getUserName(ticket.assignedAgentId)}
              {/if}
            </div>
          </div>
        </a>
      {/each}
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="flex items-center justify-between pt-2">
        <Button variant="outline" size="sm" disabled={currentPage <= 1} onclick={prevPage}>
          Previous
        </Button>
        <span class="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onclick={nextPage}>
          Next
        </Button>
      </div>
    {/if}
  {/if}
</div>
