<script lang="ts">
  let {
    value = $bindable(''),
    placeholder = '',
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
</script>

<textarea
  bind:value
  {placeholder}
  {disabled}
  aria-label="rich-text-editor"
  style="min-height: {minHeight};"
  class={className}
></textarea>
