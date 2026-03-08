<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api';
  import { userState } from '$lib/stores/user.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Separator } from '$lib/components/ui/separator';
  import * as Card from '$lib/components/ui/card';
  import RichTextEditor from '$lib/components/RichTextEditor.svelte';
  import FileUpload from '$lib/components/FileUpload.svelte';
  import AttachmentList from '$lib/components/AttachmentList.svelte';

  const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3300';

  let ticket = $state<any>(null);
  let ticketMessages = $state<any[]>([]);
  let categories = $state<any[]>([]);
  let allUsers = $state<any[]>([]);
  let attachments = $state<any[]>([]);
  let timeline = $state<any[]>([]);
  let loading = $state(true);
  let error = $state('');

  let messageBody = $state('');
  let isInternal = $state(false);
  let sendingMessage = $state(false);

  let editingTitle = $state(false);
  let editTitle = $state('');
  let editingDescription = $state(false);
  let editDescription = $state('');
  let editingMessageId = $state<string | null>(null);
  let editMessageBody = $state('');
  let saving = $state(false);

  let editHistoryTarget = $state<{ type: 'desc' | 'msg'; id: string } | null>(null);
  let editHistoryItems = $state<any[]>([]);
  let editHistoryDetail = $state<any>(null);

  let editingTags = $state(false);
  let editTagsInput = $state('');
  let commentFileUploadRef: any = $state(null);

  const ticketId: string = $derived($page.params.id ?? '');
  const myRole = $derived(userState.user?.role ?? 'customer');
  const isStaff = $derived(['admin', 'agent', 'developer'].includes(myRole));
  const isPO = $derived(myRole === 'product_owner');
  const isCustomer = $derived(myRole === 'customer');
  const isOwner = $derived(ticket?.customerId === userState.user?.id);
  // PO has same privileges as ticket owner + can manage fields
  const canManageFields = $derived(isStaff || isPO);
  // Everyone who can access the ticket can see files (same company, owner, staff, PO)
  const canSeeFiles = $derived(true);
  // Can upload: ticket owner, PO, or staff
  const canUpload = $derived(isOwner || isPO || isStaff);
  const agents = $derived(allUsers.filter((u: any) => u.role !== 'customer' && u.role !== 'product_owner'));

  onMount(async () => {
    try {
      const [catRes] = await Promise.all([api.categories.get()]);
      categories = (catRes.data as any) ?? [];
      if (isStaff) {
        const usersRes = await api.users.get();
        allUsers = (usersRes.data as any) ?? [];
      }
    } catch {}
    await fetchTicket();
  });

  async function fetchTicket() {
    loading = true;
    try {
      const [ticketRes, messagesRes, attsRes, tlRes] = await Promise.all([
        api.tickets({ id: ticketId }).get(),
        api.tickets({ id: ticketId }).messages.get(),
        apiFetch(`/api/attachments/tickets/${ticketId}`),
        apiFetch(`/api/audit-logs/tickets/${ticketId}/timeline`),
      ]);
      ticket = ticketRes.data as any;
      ticketMessages = (messagesRes.data as any) ?? [];
      attachments = attsRes ?? [];
      timeline = tlRes ?? [];
      if (!ticket) error = 'Ticket not found';
    } catch {
      error = 'Failed to load ticket';
    } finally {
      loading = false;
    }
  }

  async function apiFetch(path: string) {
    const res = await fetch(`${API_URL}${path}`, { credentials: 'include' });
    return res.ok ? res.json() : [];
  }

  const unifiedTimeline = $derived(buildTimeline(ticketMessages, timeline));

  function buildTimeline(msgs: any[], events: any[]) {
    const items: Array<{ type: 'message' | 'event'; data: any; time: Date }> = [];
    for (const msg of msgs) items.push({ type: 'message', data: msg, time: new Date(msg.createdAt) });
    for (const ev of events) {
      if (ev.action === 'message.created' || ev.action === 'ticket.created') continue;
      items.push({ type: 'event', data: ev, time: new Date(ev.createdAt) });
    }
    items.sort((a, b) => a.time.getTime() - b.time.getTime());
    return items;
  }

  async function sendMessage(e: Event) {
    e.preventDefault();
    if (!messageBody.replace(/<[^>]+>/g, '').trim()) return;
    sendingMessage = true;
    try {
      const body: any = { body: messageBody };
      if (isInternal && isStaff) body.isInternal = true;
      const res = await api.tickets({ id: ticketId }).messages.post(body);
      const newMsg = res.data as any;

      // Upload pending files attached to this comment
      if (newMsg?.id && commentFileUploadRef?.hasPending()) {
        await commentFileUploadRef.uploadPending(ticketId, newMsg.id);
      }

      messageBody = '';
      isInternal = false;
      await fetchTicket();
    } catch {}
    sendingMessage = false;
  }

  async function saveTitle() {
    if (!editTitle.trim() || editTitle === ticket.title) { editingTitle = false; return; }
    saving = true;
    try {
      await api.tickets({ id: ticketId }).patch({ title: editTitle });
      ticket.title = editTitle;
      editingTitle = false;
    } catch {}
    saving = false;
  }

  async function saveDescription() {
    saving = true;
    try {
      await api.tickets({ id: ticketId }).patch({ description: editDescription });
      ticket.description = editDescription;
      editingDescription = false;
      await fetchTicket();
    } catch {}
    saving = false;
  }

  async function saveMessageEdit() {
    if (!editingMessageId) return;
    saving = true;
    try {
      await fetch(`${API_URL}/api/tickets/${ticketId}/messages/${editingMessageId}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: editMessageBody }),
      });
      editingMessageId = null;
      await fetchTicket();
    } catch {}
    saving = false;
  }

  async function updateField(field: string, value: any) {
    saving = true;
    try {
      await api.tickets({ id: ticketId }).patch({ [field]: value || null });
      ticket = { ...ticket, [field]: value || null };
      timeline = await apiFetch(`/api/audit-logs/tickets/${ticketId}/timeline`);
    } catch {}
    saving = false;
  }

  async function saveTags() {
    const tags = editTagsInput.split(',').map(t => t.trim()).filter(Boolean);
    saving = true;
    try {
      await api.tickets({ id: ticketId }).patch({ tags });
      ticket.tags = tags;
      editingTags = false;
    } catch {}
    saving = false;
  }

  async function deleteAttachment(id: string) {
    try {
      await fetch(`${API_URL}/api/attachments/${id}`, { method: 'DELETE', credentials: 'include' });
      attachments = attachments.filter((a: any) => a.id !== id);
    } catch {}
  }

  async function openEditHistory(type: 'desc' | 'msg', id: string) {
    editHistoryTarget = { type, id };
    editHistoryDetail = null;
    const url = type === 'desc'
      ? `/api/audit-logs/tickets/${ticketId}/description-edits`
      : `/api/audit-logs/messages/${id}/edits`;
    editHistoryItems = (await apiFetch(url)).slice(0, 5);
  }

  function closeEditHistory() { editHistoryTarget = null; editHistoryItems = []; editHistoryDetail = null; }

  function onAttachmentUploaded(att: any) {
    attachments = [...attachments, att];
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  function getAuthorName(msg: any) {
    if (msg.authorName) return msg.authorName;
    if (msg.authorId === userState.user?.id) return userState.user?.name ?? 'You';
    return allUsers.find((u: any) => u.id === msg.authorId)?.name ?? 'Unknown';
  }

  function getUserName(id: string) {
    if (id === userState.user?.id) return userState.user?.name ?? 'You';
    if (isCustomer || isPO) {
      const u = allUsers.find((u: any) => u.id === id);
      if (u && ['agent', 'developer', 'admin'].includes(u.role)) return 'Support Team';
    }
    return allUsers.find((u: any) => u.id === id)?.name ?? 'Unknown';
  }

  function getInitial(name: string) { return (name ?? 'U').charAt(0).toUpperCase(); }
  function getCategoryName(id: string) { return categories.find((c: any) => c.id === id)?.name ?? ''; }
  function wasEdited(createdAt: string, updatedAt: string) { return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 1000; }
  function canEditMsg(msg: any) { return msg.authorId === userState.user?.id || isStaff; }

  // Attachment helpers — separate by messageId
  function getDescAttachments() { return attachments.filter((a: any) => !a.messageId); }
  function getMsgAttachments(msgId: string) { return attachments.filter((a: any) => a.messageId === msgId); }

  const eventIcons: Record<string, string> = {
    'ticket.status_changed': '🔄', 'ticket.priority_changed': '📊', 'ticket.assigned': '👤',
    'ticket.reassigned': '🔀', 'ticket.updated': '✏️', 'attachment.uploaded': '📎', 'attachment.deleted': '🗑️',
  };

  function formatEvent(ev: any): string {
    const nv = ev.newValue as any; const ov = ev.oldValue as any;
    switch (ev.action) {
      case 'ticket.status_changed': return `changed status from <strong>${ov?.status ?? '?'}</strong> to <strong>${nv?.status ?? '?'}</strong>`;
      case 'ticket.priority_changed': return `changed priority from <strong>${ov?.priority ?? '?'}</strong> to <strong>${nv?.priority ?? '?'}</strong>`;
      case 'ticket.assigned': return 'assigned this ticket';
      case 'ticket.reassigned': return 'reassigned this ticket';
      case 'ticket.updated': return 'updated the title';
      case 'attachment.uploaded': return `attached <strong>${nv?.fileName ?? 'a file'}</strong>`;
      case 'attachment.deleted': return `removed <strong>${ov?.fileName ?? 'a file'}</strong>`;
      default: return ev.action.replace(/\./g, ' ');
    }
  }

  const priorityColor: Record<string, string> = { low: 'bg-neutral-100 text-neutral-600', medium: 'bg-blue-100 text-blue-700', high: 'bg-orange-100 text-orange-700', urgent: 'bg-red-100 text-red-700' };
  const statusColor: Record<string, string> = { open: 'bg-green-100 text-green-700 border-green-200', in_progress: 'bg-yellow-100 text-yellow-700 border-yellow-200', waiting: 'bg-purple-100 text-purple-700 border-purple-200', resolved: 'bg-blue-100 text-blue-700 border-blue-200', closed: 'bg-neutral-100 text-neutral-600 border-neutral-200' };
</script>

<svelte:head>
  <title>{ticket ? `#${ticket.ticketNumber} ${ticket.title}` : 'Ticket'} - Helpdesk</title>
</svelte:head>

{#if loading}
  <div class="text-muted-foreground py-8 text-center">Loading ticket...</div>
{:else if error}
  <div class="text-destructive py-8 text-center">{error}</div>
{:else if ticket}
  <div class="mb-2">
    <Button variant="ghost" size="sm" href="/tickets" class="text-muted-foreground mb-2">&larr; Back</Button>
    {#if editingTitle}
      <div class="flex items-center gap-2">
        <Input bind:value={editTitle} class="text-xl font-semibold flex-1" />
        <Button size="sm" onclick={saveTitle} disabled={saving}>Save</Button>
        <Button variant="ghost" size="sm" onclick={() => editingTitle = false}>Cancel</Button>
      </div>
    {:else}
      <div class="flex items-start justify-between gap-4">
        <h1 class="text-2xl font-semibold">{ticket.title} <span class="text-muted-foreground font-normal">#{ticket.ticketNumber}</span></h1>
        {#if isStaff || isOwner || isPO}
          <Button variant="outline" size="sm" class="shrink-0" onclick={() => { editTitle = ticket.title; editingTitle = true; }}>Edit</Button>
        {/if}
      </div>
    {/if}
    <div class="flex items-center gap-2 mt-2 flex-wrap">
      <span class="inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium {statusColor[ticket.status] ?? ''}">{ticket.status.replace('_', ' ')}</span>
      <span class="text-sm text-muted-foreground">{getUserName(ticket.customerId)} opened {timeAgo(ticket.createdAt)}</span>
    </div>
  </div>

  <Separator class="my-4" />

  <div class="flex gap-6 flex-col lg:flex-row">
    <div class="flex-1 min-w-0">

      <!-- Description block -->
      <div class="flex items-start gap-3 mb-6">
        <div class="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center text-sm font-medium shrink-0">{getInitial(getUserName(ticket.customerId))}</div>
        <div class="flex-1 border rounded-lg">
          <div class="bg-muted/50 px-4 py-2 border-b rounded-t-lg flex items-center justify-between">
            <div class="flex items-center gap-2 text-sm flex-wrap">
              <span class="font-medium">{getUserName(ticket.customerId)}</span>
              <span class="text-xs text-muted-foreground">{timeAgo(ticket.createdAt)}</span>
              {#if wasEdited(ticket.createdAt, ticket.updatedAt)}<span class="text-xs text-muted-foreground">· edited</span>{/if}
            </div>
            <div class="flex items-center gap-1">
              {#if wasEdited(ticket.createdAt, ticket.updatedAt)}
                <button class="text-xs text-muted-foreground hover:text-foreground border rounded px-2 py-0.5 hover:bg-muted" onclick={() => openEditHistory('desc', ticketId)}>Edits</button>
              {/if}
              {#if isOwner}<span class="text-[10px] border rounded-full px-2 py-0.5 text-muted-foreground">Owner</span>{/if}
              {#if isStaff || isOwner || isPO}
                <Button variant="ghost" size="sm" class="h-7 px-2 text-xs" onclick={() => { editDescription = ticket.description; editingDescription = true; }}>Edit</Button>
              {/if}
            </div>
          </div>

          {#if editingDescription}
            <div class="p-3 space-y-3">
              <RichTextEditor bind:value={editDescription} minHeight="150px" />
              {#if canUpload}
                <FileUpload {ticketId} compact onUploaded={onAttachmentUploaded} />
              {/if}
              <div class="flex gap-2">
                <Button size="sm" onclick={saveDescription} disabled={saving}>Save</Button>
                <Button variant="ghost" size="sm" onclick={() => editingDescription = false}>Cancel</Button>
              </div>
            </div>
          {:else}
            <div class="px-4 py-3 text-sm prose prose-sm max-w-none">{@html ticket.description}</div>
            <!-- Attachments for ticket description — only visible to owner/admin/staff -->
            {#if canSeeFiles && getDescAttachments().length > 0}
              <div class="px-4 pb-3">
                <AttachmentList attachments={getDescAttachments()} canDelete={isStaff || isOwner} onDelete={deleteAttachment} />
              </div>
            {/if}
          {/if}
        </div>
      </div>

      <!-- Timeline -->
      {#each unifiedTimeline as item}
        {#if item.type === 'event'}
          <div class="flex items-center gap-3 py-2 pl-[52px]">
            <span class="text-sm">{eventIcons[item.data.action] ?? '📋'}</span>
            <span class="text-sm text-muted-foreground">
              <strong class="font-medium text-foreground">{(isCustomer || isPO) && item.data.actorName !== userState.user?.name ? 'Support Team' : item.data.actorName}</strong>
              {@html formatEvent(item.data)}
              <span class="text-xs ml-1">{timeAgo(item.data.createdAt)}</span>
            </span>
          </div>
        {:else}
          {@const msg = item.data}
          {@const msgAtts = getMsgAttachments(msg.id)}
          {@const authorName = getAuthorName(msg)}
          {@const isMsgOwner = msg.authorId === userState.user?.id}
          <div class="flex items-start gap-3 mb-6">
            <div class="w-10 h-10 rounded-full {msg.isInternal ? 'bg-amber-100' : 'bg-neutral-200'} flex items-center justify-center text-sm font-medium shrink-0">{getInitial(authorName)}</div>
            <div class="flex-1 border rounded-lg {msg.isInternal ? 'border-amber-200 bg-amber-50/30' : ''}">
              <div class="bg-muted/50 px-4 py-2 border-b rounded-t-lg flex items-center justify-between {msg.isInternal ? 'bg-amber-100/50 border-amber-200' : ''}">
                <div class="flex items-center gap-2 text-sm flex-wrap">
                  <span class="font-medium">{authorName}</span>
                  <span class="text-xs text-muted-foreground">{timeAgo(msg.createdAt)}</span>
                  {#if wasEdited(msg.createdAt, msg.updatedAt)}<span class="text-xs text-muted-foreground">· edited</span>{/if}
                  {#if msg.isInternal}<span class="inline-flex items-center rounded-full bg-amber-200 text-amber-800 px-1.5 text-[10px] font-medium">Internal</span>{/if}
                </div>
                <div class="flex items-center gap-1">
                  {#if wasEdited(msg.createdAt, msg.updatedAt)}
                    <button class="text-xs text-muted-foreground hover:text-foreground border rounded px-2 py-0.5 hover:bg-muted" onclick={() => openEditHistory('msg', msg.id)}>Edits</button>
                  {/if}
                  {#if isMsgOwner}<span class="text-[10px] border rounded-full px-2 py-0.5 text-muted-foreground">Author</span>{/if}
                  {#if canEditMsg(msg)}<Button variant="ghost" size="sm" class="h-7 px-2 text-xs" onclick={() => { editingMessageId = msg.id; editMessageBody = msg.body; }}>Edit</Button>{/if}
                </div>
              </div>

              {#if editingMessageId === msg.id}
                <div class="p-3 space-y-3">
                  <RichTextEditor bind:value={editMessageBody} minHeight="100px" />
                  {#if canUpload}
                    <FileUpload {ticketId} messageId={msg.id} compact onUploaded={onAttachmentUploaded} />
                  {/if}
                  <div class="flex gap-2">
                    <Button size="sm" onclick={saveMessageEdit} disabled={saving}>Save</Button>
                    <Button variant="ghost" size="sm" onclick={() => editingMessageId = null}>Cancel</Button>
                  </div>
                </div>
              {:else}
                <div class="px-4 py-3 text-sm prose prose-sm max-w-none">{@html msg.body}</div>
                <!-- Attachments for this comment — only visible to msg author, ticket owner, or staff -->
                {#if (isMsgOwner || canSeeFiles) && msgAtts.length > 0}
                  <div class="px-4 pb-3">
                    <AttachmentList attachments={msgAtts} canDelete={isMsgOwner || isStaff} onDelete={deleteAttachment} />
                  </div>
                {/if}
              {/if}
            </div>
          </div>
        {/if}
      {/each}

      <!-- New comment form -->
      <div class="mt-4">
        <Separator class="mb-4" />
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center text-sm font-medium shrink-0">{getInitial(userState.user?.name ?? '?')}</div>
          <div class="flex-1">
            <form onsubmit={sendMessage}>
              <div class="space-y-3">
                <RichTextEditor bind:value={messageBody} placeholder="Leave a comment..." disabled={sendingMessage} />
                {#if canUpload}
                  <FileUpload bind:this={commentFileUploadRef} {ticketId} deferred compact disabled={sendingMessage} onUploaded={onAttachmentUploaded} />
                {/if}
                <div class="flex items-center justify-between">
                  <div>
                    {#if isStaff}
                      <label class="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" bind:checked={isInternal} class="rounded" />
                        <span class="text-amber-700">Internal note</span>
                      </label>
                    {/if}
                  </div>
                  <Button type="submit" disabled={sendingMessage || !messageBody.replace(/<[^>]+>/g, '').trim()}>
                    {sendingMessage ? 'Sending...' : 'Comment'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- Right sidebar -->
    <div class="w-full lg:w-64 shrink-0 space-y-4">
      <Card.Root>
        <Card.Content class="pt-6 space-y-4">
          <!-- Status: editable by staff + PO -->
          <div class="space-y-2">
            <Label class="text-xs text-muted-foreground font-medium">Status</Label>
            {#if canManageFields}
              <select class="w-full h-9 rounded-md border bg-background px-3 text-sm" value={ticket.status} onchange={(e) => updateField('status', (e.target as HTMLSelectElement).value)} disabled={saving}>
                <option value="open">Open</option><option value="in_progress">In Progress</option><option value="waiting">Waiting</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
              </select>
            {:else}
              <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium {statusColor[ticket.status] ?? ''}">{ticket.status.replace('_', ' ')}</span>
            {/if}
          </div>

          <!-- Priority: editable by staff + PO -->
          <div class="space-y-2">
            <Label class="text-xs text-muted-foreground font-medium">Priority</Label>
            {#if canManageFields}
              <select class="w-full h-9 rounded-md border bg-background px-3 text-sm" value={ticket.priority} onchange={(e) => updateField('priority', (e.target as HTMLSelectElement).value)} disabled={saving}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
              </select>
            {:else}
              <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {priorityColor[ticket.priority] ?? ''}">{ticket.priority}</span>
            {/if}
          </div>

          <!-- Assignee: staff only -->
          {#if isStaff}
            <div class="space-y-2">
              <Label class="text-xs text-muted-foreground font-medium">Assignee</Label>
              <select class="w-full h-9 rounded-md border bg-background px-3 text-sm" value={ticket.assignedAgentId ?? ''} onchange={(e) => updateField('assignedAgentId', (e.target as HTMLSelectElement).value)} disabled={saving}>
                <option value="">Unassigned</option>
                {#each agents as agent}<option value={agent.id}>{agent.name}</option>{/each}
              </select>
            </div>
          {/if}

          <!-- Category: editable by staff + PO -->
          <div class="space-y-2">
            <Label class="text-xs text-muted-foreground font-medium">Category</Label>
            {#if canManageFields}
              <select class="w-full h-9 rounded-md border bg-background px-3 text-sm" value={ticket.categoryId ?? ''} onchange={(e) => updateField('categoryId', (e.target as HTMLSelectElement).value)} disabled={saving}>
                <option value="">None</option>
                {#each categories as cat}<option value={cat.id}>{cat.name}</option>{/each}
              </select>
            {:else if ticket.categoryId}
              <span class="text-sm">{getCategoryName(ticket.categoryId)}</span>
            {:else}
              <span class="text-xs text-muted-foreground">None</span>
            {/if}
          </div>

          <Separator />

          <!-- Tags: editable by staff + PO, read-only for owner/customer -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <Label class="text-xs text-muted-foreground font-medium">Tags</Label>
              {#if canManageFields}
                <button class="text-xs text-muted-foreground hover:text-foreground" onclick={() => { editTagsInput = (ticket.tags ?? []).join(', '); editingTags = !editingTags; }}>{editingTags ? 'Cancel' : 'Edit'}</button>
              {/if}
            </div>
            {#if editingTags}
              <div class="space-y-2">
                <Input bind:value={editTagsInput} placeholder="bug, ui" class="text-sm h-8" />
                <Button size="sm" class="w-full h-7 text-xs" onclick={saveTags} disabled={saving}>Save</Button>
              </div>
            {:else if ticket.tags?.length}
              <div class="flex flex-wrap gap-1">
                {#each ticket.tags as tag}<span class="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-medium">{tag}</span>{/each}
              </div>
            {:else}
              <p class="text-xs text-muted-foreground">No tags</p>
            {/if}
          </div>
        </Card.Content>
      </Card.Root>
    </div>
  </div>

  <!-- Edit History Modal -->
  {#if editHistoryTarget}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="presentation">
      <div class="bg-background rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto" role="dialog" aria-label="Edit history">
        <div class="flex items-center justify-between px-5 py-4 border-b">
          <h3 class="font-semibold">Viewing edit history</h3>
          <button class="text-muted-foreground hover:text-foreground text-xl leading-none" onclick={closeEditHistory}>&times;</button>
        </div>

        {#if editHistoryDetail}
          <div class="p-5 space-y-3">
            <button class="text-xs text-muted-foreground hover:text-foreground" onclick={() => editHistoryDetail = null}>&larr; Back</button>
            <div class="text-sm"><strong>{editHistoryDetail.actorName}</strong> edited {timeAgo(editHistoryDetail.createdAt)}</div>
            <div class="border rounded-md overflow-hidden text-sm">
              {#if (editHistoryDetail.oldValue as any)?.body}
                <div class="bg-red-50 px-3 py-2 border-b">
                  <div class="text-xs text-red-600 font-medium mb-1">Previous</div>
                  <div class="prose prose-sm max-w-none text-red-800 line-through opacity-70">{@html (editHistoryDetail.oldValue as any).body}</div>
                </div>
              {/if}
              {#if (editHistoryDetail.newValue as any)?.body}
                <div class="bg-green-50 px-3 py-2">
                  <div class="text-xs text-green-600 font-medium mb-1">Updated</div>
                  <div class="prose prose-sm max-w-none text-green-800">{@html (editHistoryDetail.newValue as any).body}</div>
                </div>
              {/if}
            </div>
          </div>
        {:else}
          <div class="p-5 space-y-2">
            {#if editHistoryItems.length === 0}
              <p class="text-sm text-muted-foreground text-center py-4">No edit history</p>
            {:else}
              <p class="text-sm text-muted-foreground mb-3">Edited {editHistoryItems.length} time{editHistoryItems.length > 1 ? 's' : ''}</p>
              {#each editHistoryItems as edit, i}
                <button class="w-full flex items-center gap-3 p-2.5 rounded-md hover:bg-muted/50 text-left transition-colors" onclick={() => editHistoryDetail = edit}>
                  <div class="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-medium shrink-0">{getInitial(edit.actorName)}</div>
                  <div class="flex-1 min-w-0">
                    <span class="text-sm font-medium">{edit.actorName}</span>
                    <span class="text-xs text-muted-foreground ml-2">{timeAgo(edit.createdAt)}</span>
                  </div>
                  {#if i === 0}<span class="text-[10px] border rounded-full px-2 py-0.5 text-muted-foreground shrink-0">Most recent</span>{/if}
                </button>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}
{/if}
