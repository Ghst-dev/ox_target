<script lang="ts">
  import { iconNodes } from './icon';
  import { ICON_ATTRS, ICON_VIEWBOX } from './icons';

  let {
    icon,
    color,
    size = '1em',
    class: className = '',
  }: { icon?: string; color?: string; size?: string; class?: string } = $props();

  // Lucide icons are plain `[tag, attrs]` data, so the SVG is built from real elements.
  // That removes the {@html} the FontAwesome renderer needed, and with it the question of
  // whether the injected markup was trustworthy.
  const nodes = $derived(iconNodes(icon));
</script>

{#if nodes}
  <span class="icon {className}" style:color style:font-size={size}>
    <svg viewBox="0 0 {ICON_VIEWBOX} {ICON_VIEWBOX}" {...ICON_ATTRS} aria-hidden="true">
      {#each nodes as [tag, attrs], i (i)}
        <svelte:element this={tag} {...attrs} />
      {/each}
    </svg>
  </span>
{:else if icon}
  <!-- The class string was given but did not resolve — a typo, or a name with no entry in
       lib/icons.ts. A neutral dot keeps the row aligned with its neighbours instead of
       leaving a ragged gap where the glyph should be. In development resolveIcon returns a
       placeholder and logs the name, so this branch is production-only in practice. -->
  <span class="icon {className}" style:font-size={size} aria-hidden="true">
    <span class="unknown"></span>
  </span>
{/if}

<style>
  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .icon svg {
    width: 1em;
    height: 1em;
  }

  .unknown {
    width: 0.32em;
    height: 0.32em;
    border-radius: var(--radius-full);
    background: currentColor;
    opacity: 0.45;
  }
</style>
