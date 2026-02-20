<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import { userState } from '$lib/stores/user.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';
  import * as Card from '$lib/components/ui/card';
  import * as Dialog from '$lib/components/ui/dialog';

  let categories = $state<any[]>([]);
  let loading = $state(true);

  // Dialog state
  let dialogOpen = $state(false);
  let editingId = $state<string | null>(null);
  let name = $state('');
  let description = $state('');
  let saving = $state(false);
  let error = $state('');

  const isAdmin = $derived(userState.user?.role === 'admin');

  onMount(async () => {
    if (!isAdmin) {
      goto('/');
      return;
    }
    await fetchCategories();
  });

  async function fetchCategories() {
    loading = true;
    try {
      const res = await api.categories.get();
      categories = (res.data as any) ?? [];
    } catch {}
    loading = false;
  }

  function openCreate() {
    editingId = null;
    name = '';
    description = '';
    error = '';
    dialogOpen = true;
  }

  function openEdit(cat: any) {
    editingId = cat.id;
    name = cat.name;
    description = cat.description ?? '';
    error = '';
    dialogOpen = true;
  }

  async function handleSave() {
    if (!name.trim()) return;
    saving = true;
    error = '';

    try {
      if (editingId) {
        const res = await api.categories({ id: editingId }).put({ name, description: description || undefined });
        if (res.error) throw new Error('Failed to update');
      } else {
        const res = await api.categories.post({ name, description: description || undefined });
        if (res.error) throw new Error('Failed to create');
      }
      dialogOpen = false;
      await fetchCategories();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Operation failed';
    } finally {
      saving = false;
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this category?')) return;
    try {
      await api.categories({ id }).delete();
      await fetchCategories();
    } catch {}
  }
</script>

<svelte:head>
  <title>Categories - Helpdesk</title>
</svelte:head>

{#if !isAdmin}
  <div class="text-muted-foreground py-8 text-center">Access denied. Admin only.</div>
{:else}
  <div class="space-y-4 max-w-2xl">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Categories</h1>
      <Button onclick={openCreate}>New category</Button>
    </div>

    {#if loading}
      <div class="text-muted-foreground py-8 text-center">Loading...</div>
    {:else if categories.length === 0}
      <Card.Root>
        <Card.Content class="py-8 text-center text-muted-foreground">
          No categories yet. Create one to get started.
        </Card.Content>
      </Card.Root>
    {:else}
      <div class="border rounded-lg divide-y">
        {#each categories as cat}
          <div class="flex items-center justify-between px-4 py-3">
            <div>
              <div class="font-medium">{cat.name}</div>
              {#if cat.description}
                <div class="text-sm text-muted-foreground">{cat.description}</div>
              {/if}
            </div>
            <div class="flex items-center gap-2">
              <Button variant="ghost" size="sm" onclick={() => openEdit(cat)}>Edit</Button>
              <Button variant="ghost" size="sm" class="text-destructive hover:text-destructive" onclick={() => handleDelete(cat.id)}>Delete</Button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <Dialog.Root bind:open={dialogOpen}>
    <Dialog.Content class="sm:max-w-md">
      <Dialog.Header>
        <Dialog.Title>{editingId ? 'Edit' : 'New'} Category</Dialog.Title>
      </Dialog.Header>

      {#if error}
        <div class="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-md">
          {error}
        </div>
      {/if}

      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <Label for="cat-name">Name</Label>
          <Input id="cat-name" bind:value={name} placeholder="Category name" disabled={saving} />
        </div>
        <div class="space-y-2">
          <Label for="cat-desc">Description</Label>
          <Textarea id="cat-desc" bind:value={description} placeholder="Optional description" disabled={saving} />
        </div>
      </div>

      <Dialog.Footer>
        <Button variant="outline" onclick={() => dialogOpen = false}>Cancel</Button>
        <Button onclick={handleSave} disabled={saving || !name.trim()}>
          {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}
