<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { userState } from '$lib/stores/user.svelte';
  import { Button } from '$lib/components/ui/button';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { Badge } from '$lib/components/ui/badge';
  import { Separator } from '$lib/components/ui/separator';

  let { children } = $props();

  onMount(async () => {
    await userState.init();
    if (!userState.isAuthenticated && $page.url.pathname !== '/login') {
      goto('/login');
    }
  });

  async function handleLogout() {
    await userState.logout();
    goto('/login');
  }

  const isAdmin = $derived(userState.user?.role === 'admin');
  const isStaff = $derived(
    userState.user?.role === 'admin' ||
    userState.user?.role === 'agent' ||
    userState.user?.role === 'developer'
  );
</script>

<svelte:head>
  <link rel="icon" href="/favicon.svg" />
</svelte:head>

{#if userState.loading}
  <div class="flex items-center justify-center min-h-screen text-muted-foreground text-lg">
    Loading...
  </div>
{:else}
  {#if userState.isAuthenticated && $page.url.pathname !== '/login'}
    <header class="bg-neutral-900 text-white border-b border-neutral-700">
      <nav class="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <div class="flex items-center gap-6">
          <a href="/" class="text-white font-semibold text-lg no-underline hover:text-neutral-300 transition-colors">
            Helpdesk
          </a>
          <div class="flex items-center gap-1">
            <Button variant="ghost" size="sm" href="/tickets"
              class="text-neutral-300 hover:text-white hover:bg-neutral-800">
              Tickets
            </Button>
            {#if isAdmin}
              <Button variant="ghost" size="sm" href="/categories"
                class="text-neutral-300 hover:text-white hover:bg-neutral-800">
                Categories
              </Button>
            {/if}
          </div>
        </div>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <Button variant="ghost" size="sm" class="text-neutral-300 hover:text-white hover:bg-neutral-800 gap-2">
              <div class="w-6 h-6 rounded-full bg-neutral-600 flex items-center justify-center text-xs font-medium text-white">
                {userState.user?.name?.charAt(0).toUpperCase()}
              </div>
              <span>{userState.user?.name}</span>
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end" class="w-48">
            <DropdownMenu.Label>
              <div class="flex flex-col">
                <span>{userState.user?.name}</span>
                <span class="text-xs text-muted-foreground font-normal">{userState.user?.email}</span>
              </div>
            </DropdownMenu.Label>
            <DropdownMenu.Separator />
            <DropdownMenu.Item disabled>
              Role: <Badge variant="secondary" class="ml-1 text-[10px] capitalize">{userState.user?.role}</Badge>
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item onclick={handleLogout}>
              Sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </nav>
    </header>
  {/if}

  <main class={userState.isAuthenticated && $page.url.pathname !== '/login' ? 'max-w-7xl mx-auto px-4 py-6' : ''}>
    {@render children()}
  </main>
{/if}
