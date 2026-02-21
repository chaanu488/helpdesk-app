<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import { userState } from '$lib/stores/user.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import * as Card from '$lib/components/ui/card';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Select from '$lib/components/ui/select';

  type UserRow = {
    id: string;
    email: string;
    name: string;
    role: string;
    companyId: string | null;
    companyName: string | null;
    createdAt: string;
  };

  type Company = { id: string; name: string };

  let users = $state<UserRow[]>([]);
  let companies = $state<Company[]>([]);
  let loading = $state(true);

  let dialogOpen = $state(false);
  let selectedUser = $state<UserRow | null>(null);
  let selectedRole = $state('');
  let selectedCompanyId = $state<string>('none');
  let saving = $state(false);
  let error = $state('');

  const isAdmin = $derived(userState.user?.role === 'admin');

  const roleOptions = [
    { value: 'customer', label: 'Customer' },
    { value: 'agent', label: 'Agent' },
    { value: 'developer', label: 'Developer' },
    { value: 'admin', label: 'Admin' },
  ];

  const roleColors: Record<string, string> = {
    admin: 'destructive',
    agent: 'default',
    developer: 'secondary',
    customer: 'outline',
  };

  onMount(async () => {
    if (!isAdmin) {
      goto('/');
      return;
    }
    await Promise.all([fetchUsers(), fetchCompanies()]);
  });

  async function fetchUsers() {
    loading = true;
    try {
      const res = await api.users.get();
      users = (res.data as any) ?? [];
    } catch {}
    loading = false;
  }

  async function fetchCompanies() {
    try {
      const res = await api.companies.get();
      companies = (res.data as any) ?? [];
    } catch {}
  }

  function openEdit(user: UserRow) {
    selectedUser = user;
    selectedRole = user.role;
    selectedCompanyId = user.companyId ?? 'none';
    error = '';
    dialogOpen = true;
  }

  async function handleSave() {
    if (!selectedUser) return;
    saving = true;
    error = '';

    try {
      const roleChanged = selectedRole !== selectedUser.role;
      const companyChanged = (selectedCompanyId === 'none' ? null : selectedCompanyId) !== selectedUser.companyId;

      if (roleChanged) {
        const res = await (api.users as any)({ id: selectedUser.id }).role.patch({ role: selectedRole });
        if (res.error) throw new Error('Failed to update role');
      }

      if (companyChanged) {
        const companyId = selectedCompanyId === 'none' ? null : selectedCompanyId;
        const res = await (api.users as any)({ id: selectedUser.id }).company.patch({ companyId });
        if (res.error) throw new Error('Failed to update company');
      }

      dialogOpen = false;
      await fetchUsers();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Operation failed';
    } finally {
      saving = false;
    }
  }

  function getCompanyName(companyId: string | null) {
    if (!companyId) return '—';
    return companies.find((c) => c.id === companyId)?.name ?? '—';
  }
</script>

<svelte:head>
  <title>Users - Helpdesk</title>
</svelte:head>

{#if !isAdmin}
  <div class="text-muted-foreground py-8 text-center">Access denied. Admin only.</div>
{:else}
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">User Management</h1>
      <div class="flex gap-2">
        <Button variant="outline" href="/companies">Manage Companies</Button>
      </div>
    </div>

    {#if loading}
      <div class="text-muted-foreground py-8 text-center">Loading...</div>
    {:else if users.length === 0}
      <Card.Root>
        <Card.Content class="py-8 text-center text-muted-foreground">
          No users found.
        </Card.Content>
      </Card.Root>
    {:else}
      <div class="border rounded-lg overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 border-b">
            <tr>
              <th class="text-left px-4 py-3 font-medium">Name</th>
              <th class="text-left px-4 py-3 font-medium">Email</th>
              <th class="text-left px-4 py-3 font-medium">Role</th>
              <th class="text-left px-4 py-3 font-medium">Company</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody class="divide-y">
            {#each users as u}
              <tr class="hover:bg-muted/30 transition-colors">
                <td class="px-4 py-3 font-medium">{u.name}</td>
                <td class="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td class="px-4 py-3">
                  <Badge variant={roleColors[u.role] as any} class="capitalize">{u.role}</Badge>
                </td>
                <td class="px-4 py-3 text-muted-foreground">
                  {u.companyName ?? '—'}
                </td>
                <td class="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" onclick={() => openEdit(u)}>Edit</Button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <Dialog.Root bind:open={dialogOpen}>
    <Dialog.Content class="sm:max-w-md">
      <Dialog.Header>
        <Dialog.Title>Edit User</Dialog.Title>
        <Dialog.Description>{selectedUser?.name} · {selectedUser?.email}</Dialog.Description>
      </Dialog.Header>

      {#if error}
        <div class="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-md">
          {error}
        </div>
      {/if}

      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <label class="text-sm font-medium" for="user-role">Role</label>
          <Select.Root type="single" bind:value={selectedRole}>
            <Select.Trigger id="user-role" class="w-full" disabled={saving}>
              {roleOptions.find(r => r.value === selectedRole)?.label ?? 'Select role'}
            </Select.Trigger>
            <Select.Content>
              {#each roleOptions as option}
                <Select.Item value={option.value}>{option.label}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium" for="user-company">Company</label>
          <Select.Root type="single" bind:value={selectedCompanyId}>
            <Select.Trigger id="user-company" class="w-full" disabled={saving}>
              {selectedCompanyId === 'none' ? 'No company' : (companies.find(c => c.id === selectedCompanyId)?.name ?? 'Select company')}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="none">No company</Select.Item>
              {#each companies as company}
                <Select.Item value={company.id}>{company.name}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
      </div>

      <Dialog.Footer>
        <Button variant="outline" onclick={() => dialogOpen = false}>Cancel</Button>
        <Button onclick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save changes'}
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}
