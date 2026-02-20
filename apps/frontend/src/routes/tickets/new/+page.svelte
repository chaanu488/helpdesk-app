<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';
  import * as Card from '$lib/components/ui/card';

  let title = $state('');
  let description = $state('');
  let priority = $state('medium');
  let categoryId = $state('');
  let tagsInput = $state('');
  let error = $state('');
  let submitting = $state(false);

  let categories = $state<any[]>([]);

  onMount(async () => {
    try {
      const res = await api.categories.get();
      categories = (res.data as any) ?? [];
    } catch {}
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';
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
      goto(`/tickets/${ticket.id}`);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create ticket';
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>New Ticket - Helpdesk</title>
</svelte:head>

<div class="max-w-4xl">
  <h1 class="text-2xl font-semibold mb-6">Create a new ticket</h1>

  {#if error}
    <div class="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-md mb-4">
      {error}
    </div>
  {/if}

  <form onsubmit={handleSubmit}>
    <div class="flex gap-6 flex-col lg:flex-row">
      <!-- Main content -->
      <div class="flex-1 space-y-4">
        <div class="space-y-2">
          <Label for="title">Title</Label>
          <Input
            id="title"
            bind:value={title}
            required
            placeholder="Brief summary of the issue"
            disabled={submitting}
          />
        </div>

        <div class="space-y-2">
          <Label for="description">Description</Label>
          <Textarea
            id="description"
            bind:value={description}
            required
            placeholder="Describe the issue in detail..."
            class="min-h-[200px]"
            disabled={submitting}
          />
        </div>
      </div>

      <!-- Sidebar -->
      <div class="w-full lg:w-64 space-y-4">
        <Card.Root>
          <Card.Content class="pt-6 space-y-4">
            <div class="space-y-2">
              <Label for="priority">Priority</Label>
              <select
                id="priority"
                bind:value={priority}
                class="w-full h-9 rounded-md border bg-background px-3 text-sm"
                disabled={submitting}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div class="space-y-2">
              <Label for="category">Category</Label>
              <select
                id="category"
                bind:value={categoryId}
                class="w-full h-9 rounded-md border bg-background px-3 text-sm"
                disabled={submitting}
              >
                <option value="">None</option>
                {#each categories as cat}
                  <option value={cat.id}>{cat.name}</option>
                {/each}
              </select>
            </div>

            <div class="space-y-2">
              <Label for="tags">Tags</Label>
              <Input
                id="tags"
                bind:value={tagsInput}
                placeholder="bug, ui, api"
                disabled={submitting}
              />
              <p class="text-xs text-muted-foreground">Comma-separated</p>
            </div>
          </Card.Content>
        </Card.Root>
      </div>
    </div>

    <div class="flex items-center gap-3 mt-6">
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Creating...' : 'Create ticket'}
      </Button>
      <Button variant="outline" href="/tickets">Cancel</Button>
    </div>
  </form>
</div>
