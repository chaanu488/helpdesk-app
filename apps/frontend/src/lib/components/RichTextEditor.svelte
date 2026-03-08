<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Placeholder from '@tiptap/extension-placeholder';
  import Link from '@tiptap/extension-link';

  let {
    value = $bindable(''),
    placeholder = 'Write something...',
    disabled = false,
    minHeight = '120px',
    class: className = '',
  }: {
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    minHeight?: string;
    class?: string;
  } = $props();

  let element: HTMLDivElement;
  // NOT reactive — avoids effect cascades from TipTap callbacks
  let editor: Editor | null = null;
  let mounted = $state(false);

  onMount(() => {
    editor = new Editor({
      element,
      extensions: [
        StarterKit,
        Placeholder.configure({ placeholder }),
        Link.configure({ openOnClick: false, autolink: true }),
      ],
      content: value || '',
      editable: !disabled,
      onUpdate: ({ editor: ed }) => {
        value = ed.getHTML();
      },
    });
    mounted = true;
  });

  onDestroy(() => {
    if (editor) {
      editor.destroy();
      editor = null;
    }
  });

  // Sync value from parent → editor (e.g. when parent resets value to '')
  $effect(() => {
    const v = value;
    if (!mounted || !editor) return;
    // Only sync if parent set a genuinely different value
    if (editor.getHTML() !== v) {
      // Use queueMicrotask to break out of Svelte's effect cycle
      queueMicrotask(() => {
        if (editor && editor.getHTML() !== v) {
          editor.commands.setContent(v || '');
        }
      });
    }
  });

  // Sync disabled prop
  $effect(() => {
    const d = disabled;
    if (!mounted || !editor) return;
    queueMicrotask(() => {
      editor?.setEditable(!d);
    });
  });

  function toggleBold() { editor?.chain().focus().toggleBold().run(); }
  function toggleItalic() { editor?.chain().focus().toggleItalic().run(); }
  function toggleCode() { editor?.chain().focus().toggleCodeBlock().run(); }
  function toggleBulletList() { editor?.chain().focus().toggleBulletList().run(); }
  function toggleOrderedList() { editor?.chain().focus().toggleOrderedList().run(); }
  function setLink() {
    const url = window.prompt('URL:');
    if (url) {
      editor?.chain().focus().setLink({ href: url }).run();
    } else {
      editor?.chain().focus().unsetLink().run();
    }
  }
</script>

<div class="border rounded-md overflow-hidden {disabled ? 'opacity-60 pointer-events-none' : ''} {className}">
  <!-- Toolbar -->
  <div class="flex items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30 flex-wrap">
    <button
      type="button"
      onclick={toggleBold}
      class="h-7 w-7 rounded flex items-center justify-center text-sm font-bold hover:bg-muted transition-colors text-muted-foreground"
      title="Bold"
    >B</button>
    <button
      type="button"
      onclick={toggleItalic}
      class="h-7 w-7 rounded flex items-center justify-center text-sm italic hover:bg-muted transition-colors text-muted-foreground"
      title="Italic"
    >I</button>
    <div class="w-px h-5 bg-border mx-0.5"></div>
    <button
      type="button"
      onclick={toggleBulletList}
      class="h-7 px-1.5 rounded flex items-center justify-center text-xs hover:bg-muted transition-colors text-muted-foreground"
      title="Bullet list"
    >&#8226; List</button>
    <button
      type="button"
      onclick={toggleOrderedList}
      class="h-7 px-1.5 rounded flex items-center justify-center text-xs hover:bg-muted transition-colors text-muted-foreground"
      title="Numbered list"
    >1. List</button>
    <div class="w-px h-5 bg-border mx-0.5"></div>
    <button
      type="button"
      onclick={toggleCode}
      class="h-7 px-1.5 rounded flex items-center justify-center text-xs font-mono hover:bg-muted transition-colors text-muted-foreground"
      title="Code block"
    >Code</button>
    <button
      type="button"
      onclick={setLink}
      class="h-7 px-1.5 rounded flex items-center justify-center text-xs hover:bg-muted transition-colors text-muted-foreground"
      title="Link"
    >Link</button>
  </div>

  <!-- Editor area -->
  <div
    bind:this={element}
    class="px-3 py-2 prose prose-sm max-w-none focus-within:outline-none"
    style="min-height: {minHeight};"
  ></div>
</div>

<style>
  :global(.tiptap) {
    outline: none;
  }
  :global(.tiptap p.is-editor-empty:first-child::before) {
    color: #9ca3af;
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }
  :global(.tiptap pre) {
    background: #f3f4f6;
    border-radius: 4px;
    padding: 8px 12px;
    font-size: 0.875em;
  }
  :global(.tiptap a) {
    color: #2563eb;
    text-decoration: underline;
  }
  :global(.tiptap ul) {
    list-style: disc;
    padding-left: 1.5em;
  }
  :global(.tiptap ol) {
    list-style: decimal;
    padding-left: 1.5em;
  }
</style>
