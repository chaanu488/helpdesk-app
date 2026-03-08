<script lang="ts">
  const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3300';

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

  type FileItem = {
    id: number;
    file: File;
    progress: number;
    status: 'pending' | 'uploading' | 'done' | 'error';
    error?: string;
    result?: any;
  };

  let nextId = 0;
  let dragOver = $state(false);
  let items = $state<FileItem[]>([]);
  let fileInput: HTMLInputElement;

  const MAX_SIZE = 20 * 1024 * 1024;
  const pendingCount = $derived(items.filter(i => i.status === 'pending').length);
  const isUploading = $derived(items.some(i => i.status === 'uploading'));

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function updateItem(id: number, patch: Partial<FileItem>) {
    items = items.map(i => i.id === id ? { ...i, ...patch } : i);
  }

  async function doUpload(item: FileItem, tid: string, mid?: string) {
    if (item.file.size > MAX_SIZE) {
      updateItem(item.id, { status: 'error', error: 'File exceeds 20MB limit' });
      return null;
    }

    updateItem(item.id, { status: 'uploading', progress: 0 });

    return new Promise<any>((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', item.file);
      formData.append('ticketId', tid);
      if (mid) formData.append('messageId', mid);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/api/attachments/upload`);
      xhr.withCredentials = true;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          updateItem(item.id, { progress: Math.round((e.loaded / e.total) * 100) });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const result = JSON.parse(xhr.responseText);
          updateItem(item.id, { status: 'done', progress: 100, result });
          onUploaded(result);
          resolve(result);
        } else {
          let msg = 'Upload failed';
          try { msg = JSON.parse(xhr.responseText).error ?? msg; } catch {}
          updateItem(item.id, { status: 'error', error: msg });
          reject(new Error(msg));
        }
      };
      xhr.onerror = () => {
        updateItem(item.id, { status: 'error', error: 'Network error' });
        reject(new Error('Network error'));
      };
      xhr.send(formData);
    });
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const item: FileItem = { id: nextId++, file, progress: 0, status: 'pending' };
      items = [...items, item];

      // If not deferred and we have a ticketId, upload immediately
      if (!deferred && ticketId) {
        doUpload(item, ticketId, messageId);
      }
    }
    if (fileInput) fileInput.value = '';
  }

  /** Called externally to flush all pending files after ticket/message is created */
  export async function uploadPending(tid: string, mid?: string): Promise<any[]> {
    const pending = items.filter(i => i.status === 'pending');
    const results: any[] = [];
    for (const item of pending) {
      try {
        const result = await doUpload(item, tid, mid);
        if (result) results.push(result);
      } catch {}
    }
    return results;
  }

  /** Check if there are pending files waiting to be uploaded */
  export function hasPending(): boolean {
    return items.some(i => i.status === 'pending');
  }

  function removeItem(id: number) {
    items = items.filter(i => i.id !== id);
  }

  function onDrop(e: DragEvent) { e.preventDefault(); dragOver = false; addFiles(e.dataTransfer?.files ?? null); }
  function onDragOver(e: DragEvent) { e.preventDefault(); dragOver = true; }
  function onDragLeave() { dragOver = false; }
</script>

<div class="space-y-2">
  <div
    role="button"
    tabindex="0"
    class="border-2 border-dashed rounded-lg transition-colors cursor-pointer
      {compact ? 'px-3 py-2' : 'px-4 py-3'}
      {dragOver ? 'border-blue-400 bg-blue-50' : 'border-border hover:border-muted-foreground/40'}
      {disabled ? 'opacity-50 pointer-events-none' : ''}"
    ondrop={onDrop}
    ondragover={onDragOver}
    ondragleave={onDragLeave}
    onclick={() => fileInput?.click()}
    onkeydown={(e) => e.key === 'Enter' && fileInput?.click()}
  >
    <input
      bind:this={fileInput}
      type="file"
      multiple
      class="hidden"
      onchange={(e) => addFiles((e.target as HTMLInputElement).files)}
      {disabled}
    />
    <div class="text-sm text-muted-foreground {compact ? 'text-xs' : ''}">
      <span class="font-medium text-foreground">{compact ? 'Attach files' : 'Click to upload'}</span>
      {#if !compact} or drag & drop{/if}
      <span class="text-xs ml-1">(max 20MB)</span>
    </div>
  </div>

  {#if items.length > 0}
    <div class="space-y-1.5">
      {#each items as item (item.id)}
        <div class="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm bg-muted/20">
          <span class="text-base shrink-0">
            {#if item.file.type.startsWith('image/')}🖼️{:else if item.file.type === 'application/pdf'}📄{:else if item.file.type.includes('zip')}📦{:else}📎{/if}
          </span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <span class="truncate text-xs font-medium">{item.file.name}</span>
              <span class="text-[10px] text-muted-foreground shrink-0">{formatBytes(item.file.size)}</span>
            </div>
            {#if item.status === 'uploading'}
              <div class="w-full bg-neutral-200 rounded-full h-1.5 mt-1">
                <div class="bg-blue-500 h-1.5 rounded-full transition-all duration-300" style="width: {item.progress}%"></div>
              </div>
            {/if}
            {#if item.status === 'pending'}
              <p class="text-[10px] text-muted-foreground mt-0.5">Ready to upload</p>
            {/if}
            {#if item.status === 'done'}
              <p class="text-[10px] text-green-600 mt-0.5">Uploaded successfully</p>
            {/if}
            {#if item.status === 'error'}
              <p class="text-[10px] text-destructive mt-0.5">{item.error}</p>
            {/if}
          </div>
          <div class="shrink-0 flex items-center gap-1">
            {#if item.status === 'uploading'}
              <span class="text-xs text-blue-600 font-medium">{item.progress}%</span>
            {:else if item.status === 'done'}
              <span class="text-green-600 font-bold">✓</span>
            {:else if item.status === 'pending'}
              <span class="text-xs text-muted-foreground">pending</span>
            {/if}
            {#if item.status !== 'uploading'}
              <button class="text-muted-foreground hover:text-destructive text-xs ml-1" onclick={() => removeItem(item.id)} title="Remove">✕</button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
