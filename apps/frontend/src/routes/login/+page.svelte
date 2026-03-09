<script lang="ts">
  import { goto } from '$app/navigation';
  import { userState } from '$lib/stores/user.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Card from '$lib/components/ui/card';

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';
    loading = true;

    try {
      await userState.login(email, password);
      goto('/');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Login failed';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Sign in - Helpdesk</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-neutral-50">
  <div class="w-full max-w-sm">
    <div class="text-center mb-6">
      <h1 class="text-2xl font-semibold text-foreground">Sign in to Helpdesk</h1>
    </div>

    <Card.Root>
      <Card.Content class="pt-6">
        {#if error}
          <div class="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-md mb-4">
            {error}
          </div>
        {/if}

        <form onsubmit={handleSubmit} class="space-y-4">
          <div class="space-y-2">
            <Label for="email">Email address</Label>
            <Input
              type="email"
              id="email"
              bind:value={email}
              required
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>

          <div class="space-y-2">
            <Label for="password">Password</Label>
            <Input
              type="password"
              id="password"
              bind:value={password}
              required
              placeholder="********"
              disabled={loading}
            />
          </div>

          <Button type="submit" class="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <div class="mt-4 text-center">
          <a href="/forgot-password" class="text-sm text-muted-foreground hover:text-foreground">
            Forgot your password?
          </a>
        </div>
      </Card.Content>
    </Card.Root>
  </div>
</div>
