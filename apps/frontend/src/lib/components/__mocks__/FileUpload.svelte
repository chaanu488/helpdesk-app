<script lang="ts">
  let {
    ticketId = '',
    messageId = undefined,
    onUploaded = (_att: any) => {},
    disabled = false,
    compact = false,
    deferred = false,
  }: {
    ticketId?: string;
    messageId?: string;
    onUploaded?: (attachment: any) => void;
    disabled?: boolean;
    compact?: boolean;
    deferred?: boolean;
  } = $props();

  export function hasPending() { return false; }
  export async function uploadPending(_tid: string, _mid?: string) { return []; }
</script>

<div data-testid="file-upload"></div>
