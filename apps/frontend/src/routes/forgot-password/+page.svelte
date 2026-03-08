<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Card from '$lib/components/ui/card';

  const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3300';

  let email = $state('');
  let submitting = $state(false);
  let success = $state(false);
  let error = $state('');

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';
    submitting = true;
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      success = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Something went wrong';
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Forgot Password - Helpdesk</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
  <div class="w-full max-w-md">
    <div class="text-center mb-8">
      <h1 class="text-2xl font-bold">Helpdesk</h1>
      <p class="text-muted-foreground mt-1">Reset your password</p>
    </div>

    <Card.Root>
      <Card.Content class="pt-6">
        {#if success}
          <div class="text-center py-4">
            <div class="text-green-600 font-medium mb-2">Check your email</div>
            <p class="text-sm text-muted-foreground">
              If that email address is registered, you'll receive a reset link shortly.
            </p>
            <Button href="/login" variant="outline" class="mt-4">Back to login</Button>
          </div>
        {:else}
          {#if error}
            <div class="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-md mb-4">
              {error}
            </div>
          {/if}

          <form onsubmit={handleSubmit} class="space-y-4">
            <div class="space-y-2">
              <Label for="email">Email address</Label>
              <Input
                id="email"
                type="email"
                bind:value={email}
                required
                placeholder="you@example.com"
                disabled={submitting}
              />
            </div>

            <Button type="submit" class="w-full" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send reset link'}
            </Button>
          </form>

          <div class="mt-4 text-center">
            <a href="/login" class="text-sm text-muted-foreground hover:text-foreground">
              Back to login
            </a>
          </div>
        {/if}
      </Card.Content>
    </Card.Root>
  </div>
</div>
