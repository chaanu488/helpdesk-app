<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Card from '$lib/components/ui/card';

  const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3300';

  let token = $derived($page.params.token);
  let password = $state('');
  let confirmPassword = $state('');
  let submitting = $state(false);
  let success = $state(false);
  let error = $state('');

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';

    if (password !== confirmPassword) {
      error = 'Passwords do not match';
      return;
    }
    if (password.length < 6) {
      error = 'Password must be at least 6 characters';
      return;
    }

    submitting = true;
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to reset password');
      success = true;
      setTimeout(() => goto('/login'), 2000);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Something went wrong';
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Reset Password - Helpdesk</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
  <div class="w-full max-w-md">
    <div class="text-center mb-8">
      <h1 class="text-2xl font-bold">Helpdesk</h1>
      <p class="text-muted-foreground mt-1">Set a new password</p>
    </div>

    <Card.Root>
      <Card.Content class="pt-6">
        {#if success}
          <div class="text-center py-4">
            <div class="text-green-600 font-medium mb-2">Password reset successfully!</div>
            <p class="text-sm text-muted-foreground">Redirecting to login...</p>
          </div>
        {:else}
          {#if error}
            <div class="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-md mb-4">
              {error}
            </div>
          {/if}

          <form onsubmit={handleSubmit} class="space-y-4">
            <div class="space-y-2">
              <Label for="password">New password</Label>
              <Input
                id="password"
                type="password"
                bind:value={password}
                required
                placeholder="At least 6 characters"
                disabled={submitting}
              />
            </div>

            <div class="space-y-2">
              <Label for="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                bind:value={confirmPassword}
                required
                placeholder="Repeat password"
                disabled={submitting}
              />
            </div>

            <Button type="submit" class="w-full" disabled={submitting}>
              {submitting ? 'Resetting...' : 'Reset password'}
            </Button>
          </form>
        {/if}
      </Card.Content>
    </Card.Root>
  </div>
</div>
