<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import { userState } from '$lib/stores/user.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Card from '$lib/components/ui/card';
  import * as Dialog from '$lib/components/ui/dialog';

  let companies = $state<any[]>([]);
  let loading = $state(true);

  let dialogOpen = $state(false);
  let editingId = $state<string | null>(null);
  let name = $state('');
  let saving = $state(false);
  let error = $state('');

  const isAdmin = $derived(userState.user?.role === 'admin');

  onMount(async () => {
    if (!isAdmin) {
      goto('/');
      return;
    }
    await fetchCompanies();
  });

  async function fetchCompanies() {
    loading = true;
    try {
      const res = await api.companies.get();
      companies = (res.data as any) ?? [];
    } catch {}
    loading = false;
  }

  function openCreate() {
    editingId = null;
    name = '';
    error = '';
    dialogOpen = true;
  }

  function openEdit(company: any) {
    editingId = company.id;
    name = company.name;
    error = '';
    dialogOpen = true;
  }

  async function handleSave() {
    if (!name.trim()) return;
    saving = true;
    error = '';

    try {
      if (editingId) {
        const res = await (api.companies as any)({ id: editingId }).patch({ name });
        if (res.error) throw new Error('Failed to update');
      } else {
        const res = await api.companies.post({ name });
        if (res.error) throw new Error('Failed to create');
      }
      dialogOpen = false;
      await fetchCompanies();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Operation failed';
    } finally {
      saving = false;
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this company? Users in this company will have their company removed.')) return;
    try {
      await (api.companies as any)({ id }).delete();
      await fetchCompanies();
    } catch {}
  }
</script>

<svelte:head>
  <title>Companies - Helpdesk</title>
</svelte:head>

{#if !isAdmin}
  <div class="text-muted-foreground py-8 text-center">Access denied. Admin only.</div>
{:else}
  <div class="space-y-4 max-w-2xl">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Companies</h1>
      <Button onclick={openCreate}>New company</Button>
    </div>

    {#if loading}
      <div class="text-muted-foreground py-8 text-center">Loading...</div>
    {:else if companies.length === 0}
      <Card.Root>
        <Card.Content class="py-8 text-center text-muted-foreground">
          No companies yet. Create one to get started.
        </Card.Content>
      </Card.Root>
    {:else}
      <div class="border rounded-lg divide-y">
        {#each companies as company}
          <div class="flex items-center justify-between px-4 py-3">
            <div class="font-medium">{company.name}</div>
            <div class="flex items-center gap-2">
              <Button variant="ghost" size="sm" onclick={() => openEdit(company)}>Edit</Button>
              <Button variant="ghost" size="sm" class="text-destructive hover:text-destructive" onclick={() => handleDelete(company.id)}>Delete</Button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <Dialog.Root bind:open={dialogOpen}>
    <Dialog.Content class="sm:max-w-md">
      <Dialog.Header>
        <Dialog.Title>{editingId ? 'Edit' : 'New'} Company</Dialog.Title>
      </Dialog.Header>

      {#if error}
        <div class="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-md">
          {error}
        </div>
      {/if}

      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <Label for="company-name">Name</Label>
          <Input id="company-name" bind:value={name} placeholder="Company name" disabled={saving} />
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
