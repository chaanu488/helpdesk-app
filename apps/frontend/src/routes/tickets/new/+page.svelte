<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import { userState } from '$lib/stores/user.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Separator } from '$lib/components/ui/separator';
  import * as Card from '$lib/components/ui/card';
  import RichTextEditor from '$lib/components/RichTextEditor.svelte';
  import FileUpload from '$lib/components/FileUpload.svelte';

  let title = $state('');
  let description = $state('');
  let priority = $state('medium');
  let categoryId = $state('');
  let tagsInput = $state('');
  let error = $state('');
  let submitting = $state(false);
  let categories = $state<any[]>([]);
  let fileUploadRef: FileUpload;

  onMount(async () => {
    try {
      const res = await api.categories.get();
      categories = (res.data as any) ?? [];
    } catch {}
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';
    const descText = description.replace(/<[^>]+>/g, '').trim();
    if (!title.trim() || !descText) {
      error = 'Title and description are required';
      return;
    }
    submitting = true;
    try {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const body: any = { title, description, priority };
      if (categoryId) body.categoryId = categoryId;
      if (tags.length) body.tags = tags;

      const res = await api.tickets.post(body);
      if (res.error) {
        const errData = res.error.value as any;
        throw new Error(errData?.error ?? 'Failed to create ticket');
      }
      const ticket = res.data as any;

      // Upload pending files now that we have a ticketId
      if (fileUploadRef?.hasPending()) {
        await fileUploadRef.uploadPending(ticket.id);
      }

      goto(`/tickets/${ticket.id}`);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create ticket';
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>New Ticket - Helpdesk</title>
</svelte:head>

<div>
  <Button variant="ghost" size="sm" href="/tickets" class="text-muted-foreground mb-2">&larr; Back</Button>
  <h1 class="text-2xl font-semibold mb-6">Create a new ticket</h1>

  {#if error}
    <div class="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-md mb-4">{error}</div>
  {/if}

  <form onsubmit={handleSubmit}>
    <div class="flex gap-6 flex-col lg:flex-row">
      <div class="flex-1 min-w-0">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center text-sm font-medium shrink-0">
            {userState.user?.name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div class="flex-1 border rounded-lg">
            <div class="bg-muted/50 px-4 py-2 border-b rounded-t-lg">
              <span class="font-medium text-sm">{userState.user?.name}</span>
              <span class="text-xs text-muted-foreground ml-2">creating a new ticket</span>
            </div>
            <div class="p-4 space-y-4">
              <div class="space-y-2">
                <Label for="title">Title</Label>
                <Input id="title" bind:value={title} required placeholder="Brief summary of the issue" disabled={submitting} />
              </div>
              <div class="space-y-2">
                <Label>Description</Label>
                <RichTextEditor bind:value={description} placeholder="Describe the issue in detail..." disabled={submitting} minHeight="200px" />
              </div>
              <FileUpload bind:this={fileUploadRef} deferred compact disabled={submitting} />
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3 mt-6 pl-[52px]">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create ticket'}
          </Button>
          <Button variant="outline" href="/tickets">Cancel</Button>
        </div>
      </div>

      <div class="w-full lg:w-64 shrink-0 space-y-4">
        <Card.Root>
          <Card.Content class="pt-6 space-y-4">
            <div class="space-y-2">
              <Label for="priority" class="text-xs text-muted-foreground font-medium">Priority</Label>
              <select id="priority" bind:value={priority} class="w-full h-9 rounded-md border bg-background px-3 text-sm" disabled={submitting}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
              </select>
            </div>
            <div class="space-y-2">
              <Label for="category" class="text-xs text-muted-foreground font-medium">Category</Label>
              <select id="category" bind:value={categoryId} class="w-full h-9 rounded-md border bg-background px-3 text-sm" disabled={submitting}>
                <option value="">None</option>
                {#each categories as cat}<option value={cat.id}>{cat.name}</option>{/each}
              </select>
            </div>
            <Separator />
            <div class="space-y-2">
              <Label for="tags" class="text-xs text-muted-foreground font-medium">Tags</Label>
              <Input id="tags" bind:value={tagsInput} placeholder="bug, ui, api" disabled={submitting} class="text-sm h-8" />
              <p class="text-xs text-muted-foreground">Comma-separated</p>
            </div>
          </Card.Content>
        </Card.Root>
      </div>
    </div>
  </form>
</div>
