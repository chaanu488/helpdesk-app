<script lang="ts">
  let {
    attachments,
    onDelete,
    canDelete = false,
  }: {
    attachments: any[];
    onDelete?: (id: string) => void;
    canDelete?: boolean;
  } = $props();

  const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3300';

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getFileIcon(mimeType: string) {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return '📦';
    if (mimeType.includes('text/') || mimeType.includes('json')) return '📝';
    return '📎';
  }

  function isImage(mimeType: string) {
    return mimeType.startsWith('image/');
  }
</script>

{#if attachments.length > 0}
  <div class="flex flex-wrap gap-2 mt-2">
    {#each attachments as att}
      <div class="flex items-center gap-2 border rounded-md px-2 py-1.5 bg-muted/30 text-sm">
        <span class="text-base">{getFileIcon(att.mimeType)}</span>
        <a
          href="{API_URL}/api/attachments/{att.id}"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:underline text-foreground max-w-[160px] truncate"
          title={att.fileName}
        >
          {att.fileName}
        </a>
        <span class="text-xs text-muted-foreground">{formatBytes(att.fileSize)}</span>
        {#if canDelete && onDelete}
          <button
            type="button"
            onclick={() => onDelete!(att.id)}
            class="text-muted-foreground hover:text-destructive transition-colors ml-1"
            title="Remove"
          >
            ×
          </button>
        {/if}
      </div>
    {/each}
  </div>
{/if}
