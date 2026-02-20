<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import { userState } from '$lib/stores/user.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Badge } from '$lib/components/ui/badge';
  import { Separator } from '$lib/components/ui/separator';
  import * as Card from '$lib/components/ui/card';

  let ticket = $state<any>(null);
  let messages = $state<any[]>([]);
  let categories = $state<any[]>([]);
  let users = $state<any[]>([]);
  let loading = $state(true);
  let error = $state('');

  // Message form
  let messageBody = $state('');
  let isInternal = $state(false);
  let sendingMessage = $state(false);

  // Edit title
  let editingTitle = $state(false);
  let editTitle = $state('');

  // Sidebar editing
  let saving = $state(false);

  const ticketId: string = $derived($page.params.id ?? '');
  const isStaff = $derived(
    userState.user?.role === 'admin' ||
    userState.user?.role === 'agent' ||
    userState.user?.role === 'developer'
  );
  const isOwner = $derived(ticket?.customerId === userState.user?.id);

  onMount(async () => {
    try {
      const [catRes] = await Promise.all([
        api.categories.get(),
      ]);
      categories = (catRes.data as any) ?? [];
      if (isStaff) {
        const usersRes = await api.users.get();
        users = (usersRes.data as any) ?? [];
      }
    } catch {}
    await fetchTicket();
  });

  async function fetchTicket() {
    loading = true;
    try {
      const [ticketRes, messagesRes] = await Promise.all([
        api.tickets({ id: ticketId }).get(),
        api.tickets({ id: ticketId }).messages.get(),
      ]);
      ticket = ticketRes.data as any;
      messages = (messagesRes.data as any) ?? [];
      if (!ticket) {
        error = 'Ticket not found';
      }
    } catch {
      error = 'Failed to load ticket';
    } finally {
      loading = false;
    }
  }

  async function sendMessage(e: Event) {
    e.preventDefault();
    if (!messageBody.trim()) return;
    sendingMessage = true;
    try {
      const body: any = { body: messageBody };
      if (isInternal && isStaff) body.isInternal = true;
      await api.tickets({ id: ticketId }).messages.post(body);
      messageBody = '';
      isInternal = false;
      // Refetch messages
      const messagesRes = await api.tickets({ id: ticketId }).messages.get();
      messages = (messagesRes.data as any) ?? [];
    } catch {}
    sendingMessage = false;
  }

  async function saveTitle() {
    if (!editTitle.trim() || editTitle === ticket.title) {
      editingTitle = false;
      return;
    }
    saving = true;
    try {
      await api.tickets({ id: ticketId }).patch({ title: editTitle });
      ticket.title = editTitle;
      editingTitle = false;
    } catch {}
    saving = false;
  }

  async function updateField(field: string, value: any) {
    saving = true;
    try {
      const body: any = {};
      body[field] = value || null;
      await api.tickets({ id: ticketId }).patch(body);
      ticket = { ...ticket, [field]: value || null };
    } catch {}
    saving = false;
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

  function getUserName(id: string) {
    if (id === userState.user?.id) return userState.user.name;
    return users.find((u: any) => u.id === id)?.name ?? 'Unknown';
  }

  function getUserInitial(id: string) {
    const name = getUserName(id);
    return name.charAt(0).toUpperCase();
  }

  function getCategoryName(id: string) {
    return categories.find((c: any) => c.id === id)?.name ?? '';
  }

  const priorityColor: Record<string, string> = {
    low: 'bg-neutral-100 text-neutral-600',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700',
  };

  const statusColor: Record<string, string> = {
    open: 'bg-green-100 text-green-700 border-green-200',
    in_progress: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    waiting: 'bg-purple-100 text-purple-700 border-purple-200',
    resolved: 'bg-blue-100 text-blue-700 border-blue-200',
    closed: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  };

  const agents = $derived(users.filter((u: any) => u.role !== 'customer'));
</script>

<svelte:head>
  <title>{ticket ? `#${ticket.ticketNumber} ${ticket.title}` : 'Ticket'} - Helpdesk</title>
</svelte:head>

{#if loading}
  <div class="text-muted-foreground py-8 text-center">Loading ticket...</div>
{:else if error}
  <div class="text-destructive py-8 text-center">{error}</div>
{:else if ticket}
  <div class="mb-4">
    <Button variant="ghost" size="sm" href="/tickets" class="text-muted-foreground">&larr; Back to tickets</Button>
  </div>

  <div class="flex gap-6 flex-col lg:flex-row">
    <!-- Main content -->
    <div class="flex-1 min-w-0">
      <!-- Header -->
      <div class="mb-4">
        {#if editingTitle}
          <div class="flex items-center gap-2">
            <Input bind:value={editTitle} class="text-xl font-semibold" />
            <Button size="sm" onclick={saveTitle} disabled={saving}>Save</Button>
            <Button variant="ghost" size="sm" onclick={() => editingTitle = false}>Cancel</Button>
          </div>
        {:else}
          <div class="flex items-start gap-2">
            <h1 class="text-2xl font-semibold">
              {ticket.title}
              <span class="text-muted-foreground font-normal">#{ticket.ticketNumber}</span>
            </h1>
            {#if isStaff || isOwner}
              <Button variant="ghost" size="sm" class="mt-1 shrink-0" onclick={() => { editTitle = ticket.title; editingTitle = true; }}>
                Edit
              </Button>
            {/if}
          </div>
        {/if}

        <div class="flex items-center gap-2 mt-2 flex-wrap">
          <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium {statusColor[ticket.status] ?? ''}">
            {ticket.status.replace('_', ' ')}
          </span>
          <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {priorityColor[ticket.priority] ?? ''}">
            {ticket.priority} priority
          </span>
          {#if ticket.categoryId}
            <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
              {getCategoryName(ticket.categoryId)}
            </span>
          {/if}
          <span class="text-xs text-muted-foreground">
            opened {timeAgo(ticket.createdAt)} by {getUserName(ticket.customerId)}
          </span>
        </div>
      </div>

      <Separator />

      <!-- Description -->
      <div class="py-4">
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-medium shrink-0">
            {getUserInitial(ticket.customerId)}
          </div>
          <div class="flex-1 border rounded-lg">
            <div class="bg-muted/50 px-4 py-2 border-b rounded-t-lg flex items-center gap-2">
              <span class="font-medium text-sm">{getUserName(ticket.customerId)}</span>
              <span class="text-xs text-muted-foreground">{timeAgo(ticket.createdAt)}</span>
            </div>
            <div class="px-4 py-3 text-sm whitespace-pre-wrap">{ticket.description}</div>
          </div>
        </div>
      </div>

      <!-- Tags -->
      {#if ticket.tags?.length}
        <div class="flex items-center gap-1.5 mb-4">
          {#each ticket.tags as tag}
            <span class="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-medium">{tag}</span>
          {/each}
        </div>
      {/if}

      <!-- Messages timeline -->
      {#if messages.length > 0}
        <div class="space-y-4">
          {#each messages as msg}
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 rounded-full {msg.isInternal ? 'bg-amber-100' : 'bg-neutral-200'} flex items-center justify-center text-xs font-medium shrink-0">
                {getUserInitial(msg.authorId)}
              </div>
              <div class="flex-1 border rounded-lg {msg.isInternal ? 'border-amber-200 bg-amber-50/50' : ''}">
                <div class="bg-muted/50 px-4 py-2 border-b rounded-t-lg flex items-center gap-2 {msg.isInternal ? 'bg-amber-100/50 border-amber-200' : ''}">
                  <span class="font-medium text-sm">{getUserName(msg.authorId)}</span>
                  <span class="text-xs text-muted-foreground">{timeAgo(msg.createdAt)}</span>
                  {#if msg.isInternal}
                    <span class="inline-flex items-center rounded-full bg-amber-200 text-amber-800 px-1.5 py-0 text-[10px] font-medium">Internal note</span>
                  {/if}
                </div>
                <div class="px-4 py-3 text-sm whitespace-pre-wrap">{msg.body}</div>
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <!-- New message -->
      <div class="mt-6">
        <Separator class="mb-6" />
        <form onsubmit={sendMessage}>
          <div class="space-y-3">
            <Textarea
              bind:value={messageBody}
              placeholder="Leave a comment..."
              class="min-h-[100px]"
              disabled={sendingMessage}
            />
            <div class="flex items-center justify-between">
              <div>
                {#if isStaff}
                  <label class="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" bind:checked={isInternal} class="rounded" />
                    <span class="text-amber-700">Internal note</span>
                  </label>
                {/if}
              </div>
              <Button type="submit" disabled={sendingMessage || !messageBody.trim()}>
                {sendingMessage ? 'Sending...' : 'Comment'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <!-- Right sidebar -->
    {#if isStaff}
      <div class="w-full lg:w-64 shrink-0 space-y-4">
        <Card.Root>
          <Card.Content class="pt-6 space-y-4">
            <div class="space-y-2">
              <Label class="text-xs text-muted-foreground">Status</Label>
              <select
                class="w-full h-9 rounded-md border bg-background px-3 text-sm"
                value={ticket.status}
                onchange={(e) => updateField('status', (e.target as HTMLSelectElement).value)}
                disabled={saving}
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting">Waiting</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div class="space-y-2">
              <Label class="text-xs text-muted-foreground">Priority</Label>
              <select
                class="w-full h-9 rounded-md border bg-background px-3 text-sm"
                value={ticket.priority}
                onchange={(e) => updateField('priority', (e.target as HTMLSelectElement).value)}
                disabled={saving}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div class="space-y-2">
              <Label class="text-xs text-muted-foreground">Assignee</Label>
              <select
                class="w-full h-9 rounded-md border bg-background px-3 text-sm"
                value={ticket.assignedAgentId ?? ''}
                onchange={(e) => updateField('assignedAgentId', (e.target as HTMLSelectElement).value)}
                disabled={saving}
              >
                <option value="">Unassigned</option>
                {#each agents as agent}
                  <option value={agent.id}>{agent.name}</option>
                {/each}
              </select>
            </div>

            <div class="space-y-2">
              <Label class="text-xs text-muted-foreground">Category</Label>
              <select
                class="w-full h-9 rounded-md border bg-background px-3 text-sm"
                value={ticket.categoryId ?? ''}
                onchange={(e) => updateField('categoryId', (e.target as HTMLSelectElement).value)}
                disabled={saving}
              >
                <option value="">None</option>
                {#each categories as cat}
                  <option value={cat.id}>{cat.name}</option>
                {/each}
              </select>
            </div>
          </Card.Content>
        </Card.Root>
      </div>
    {/if}
  </div>
{/if}
