<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Card from '$lib/components/ui/card';

  const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3300';

  let token = $derived($page.params.token);
  let invitation = $state<{ email: string; role: string; companyId: string | null } | null>(null);
  let loading = $state(true);
  let error = $state('');
  let name = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let submitting = $state(false);
  let success = $state(false);

  onMount(async () => {
    try {
      const res = await fetch(`${API_URL}/api/invitations/accept/${token}`);
      if (!res.ok) {
        const data = await res.json();
        error = data.error ?? 'Invalid invitation';
      } else {
        invitation = await res.json();
      }
    } catch {
      error = 'Failed to load invitation';
    } finally {
      loading = false;
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';

    if (password !== confirmPassword) {
      error = 'Passwords do not match';
      return;
    }
    if (password.length < 8) {
      error = 'Password must be at least 8 characters';
      return;
    }

    submitting = true;
    try {
      const res = await fetch(`${API_URL}/api/invitations/accept/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to accept invitation');
      }

      success = true;
      setTimeout(() => goto('/login'), 2000);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to accept invitation';
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Accept Invitation - Helpdesk</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
  <div class="w-full max-w-md">
    <div class="text-center mb-8">
      <h1 class="text-2xl font-bold">Helpdesk</h1>
      <p class="text-muted-foreground mt-1">Accept your invitation</p>
    </div>

    <Card.Root>
      <Card.Content class="pt-6">
        {#if loading}
          <p class="text-center text-muted-foreground py-8">Loading invitation...</p>
        {:else if error && !invitation}
          <div class="text-center py-8">
            <p class="text-destructive mb-4">{error}</p>
            <Button href="/login" variant="outline">Back to login</Button>
          </div>
        {:else if success}
          <div class="text-center py-8">
            <div class="text-green-600 font-medium mb-2">Account created successfully!</div>
            <p class="text-sm text-muted-foreground">Redirecting to login...</p>
          </div>
        {:else if invitation}
          <div class="mb-4 p-3 bg-blue-50 rounded-md text-sm">
            <p class="text-blue-800">
              You've been invited as <strong class="capitalize">{invitation.role}</strong>
            </p>
            <p class="text-blue-600 text-xs mt-1">{invitation.email}</p>
          </div>

          {#if error}
            <div class="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-md mb-4">
              {error}
            </div>
          {/if}

          <form onsubmit={handleSubmit} class="space-y-4">
            <div class="space-y-2">
              <Label for="name">Full name</Label>
              <Input
                id="name"
                bind:value={name}
                required
                placeholder="Your name"
                disabled={submitting}
              />
            </div>

            <div class="space-y-2">
              <Label for="password">Password</Label>
              <Input
                id="password"
                type="password"
                bind:value={password}
                required
                placeholder="At least 8 characters"
                disabled={submitting}
              />
            </div>

            <div class="space-y-2">
              <Label for="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                bind:value={confirmPassword}
                required
                placeholder="Repeat password"
                disabled={submitting}
              />
            </div>

            <Button type="submit" class="w-full" disabled={submitting}>
              {submitting ? 'Creating account...' : 'Create account'}
            </Button>
          </form>
        {/if}
      </Card.Content>
    </Card.Root>
  </div>
</div>
