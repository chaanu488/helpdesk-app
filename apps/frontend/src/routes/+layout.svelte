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

  const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3300';

  let { children } = $props();

  let notifications = $state<any[]>([]);
  let notifOpen = $state(false);

  const unreadCount = $derived(notifications.filter((n: any) => !n.isRead).length);

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/forgot-password', '/invite', '/reset-password'];
  const isPublicRoute = $derived(
    publicRoutes.some(r => $page.url.pathname.startsWith(r))
  );

  onMount(async () => {
    await userState.init();
    if (!userState.isAuthenticated && !isPublicRoute) {
      goto('/login');
    }
    if (userState.isAuthenticated) {
      loadNotifications();
    }
  });

  async function loadNotifications() {
    try {
      const res = await fetch(`${API_URL}/api/notifications`, { credentials: 'include' });
      if (res.ok) {
        notifications = await res.json();
      }
    } catch {}
  }

  async function markRead(id: string) {
    try {
      await fetch(`${API_URL}/api/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'include',
      });
      notifications = notifications.map((n: any) =>
        n.id === id ? { ...n, isRead: true } : n
      );
    } catch {}
  }

  async function markAllRead() {
    try {
      await fetch(`${API_URL}/api/notifications/read-all`, {
        method: 'POST',
        credentials: 'include',
      });
      notifications = notifications.map((n: any) => ({ ...n, isRead: true }));
    } catch {}
  }

  async function handleLogout() {
    await userState.logout();
    goto('/login');
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  const isAdmin = $derived(userState.user?.role === 'admin');
  const isStaff = $derived(
    userState.user?.role === 'admin' ||
    userState.user?.role === 'agent' ||
    userState.user?.role === 'developer'
  );
  const showNav = $derived(userState.isAuthenticated && !isPublicRoute);
</script>

<svelte:head>
  <link rel="icon" href="/favicon.svg" />
</svelte:head>

{#if userState.loading}
  <div class="flex items-center justify-center min-h-screen text-muted-foreground text-lg">
    Loading...
  </div>
{:else}
  {#if showNav}
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
              <Button variant="ghost" size="sm" href="/companies"
                class="text-neutral-300 hover:text-white hover:bg-neutral-800">
                Companies
              </Button>
              <Button variant="ghost" size="sm" href="/users"
                class="text-neutral-300 hover:text-white hover:bg-neutral-800">
                Users
              </Button>
            {/if}
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- Notification Bell -->
          <DropdownMenu.Root bind:open={notifOpen} onOpenChange={(o) => { if (o) loadNotifications(); }}>
            <DropdownMenu.Trigger>
              <button
                class="relative p-2 rounded-md text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
                aria-label="Notifications"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {#if unreadCount > 0}
                  <span class="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                {/if}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" class="w-80 max-h-96 overflow-y-auto">
              <div class="flex items-center justify-between px-3 py-2">
                <span class="font-medium text-sm">Notifications</span>
                {#if unreadCount > 0}
                  <button onclick={markAllRead} class="text-xs text-muted-foreground hover:text-foreground">
                    Mark all read
                  </button>
                {/if}
              </div>
              <DropdownMenu.Separator />
              {#if notifications.length === 0}
                <div class="px-3 py-6 text-center text-sm text-muted-foreground">
                  No notifications
                </div>
              {:else}
                {#each notifications.slice(0, 20) as notif}
                  <button
                    class="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0
                      {!notif.isRead ? 'bg-blue-50/50' : ''}"
                    onclick={() => { markRead(notif.id); if (notif.entityId) goto(`/tickets/${notif.entityId}`); notifOpen = false; }}
                  >
                    <div class="flex items-start gap-2">
                      {#if !notif.isRead}
                        <span class="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5"></span>
                      {:else}
                        <span class="w-2 h-2 shrink-0 mt-1.5"></span>
                      {/if}
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium truncate">{notif.title}</p>
                        <p class="text-xs text-muted-foreground truncate">{notif.body}</p>
                        <p class="text-xs text-muted-foreground/70 mt-0.5">{timeAgo(notif.createdAt)}</p>
                      </div>
                    </div>
                  </button>
                {/each}
              {/if}
            </DropdownMenu.Content>
          </DropdownMenu.Root>

          <!-- User menu -->
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
        </div>
      </nav>
    </header>
  {/if}

  <main class={showNav ? 'max-w-7xl mx-auto px-4 py-6' : ''}>
    {@render children()}
  </main>
{/if}
