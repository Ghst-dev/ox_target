<script lang="ts">
  import { onDestroy, onMount, type Component } from 'svelte';
  import { onNuiEvent, isEnvBrowser } from './lib/nui';
  import { initSettings } from './lib/settings.svelte';
  import Reticle from './features/Reticle.svelte';
  import OptionList from './features/OptionList.svelte';
  import type { SetTargetMessage, TargetOption } from './lib/types';

  /**
   * The dev harness, loaded dynamically so that it does not ship.
   *
   * `isEnvBrowser()` gates the *render*, not the *bundle*: a static import is resolved at
   * build time regardless, so the drawer and its debug payloads were shipping to every
   * player. `import.meta.env.DEV` is the half that matters — Vite substitutes `false` in a
   * production build and Rollup drops the branch and everything only it reaches.
   *
   *     pnpm build && grep -c "Developer drawer" build/assets/*.js
   */
  let DevPanel = $state<Component | null>(null);

  if (import.meta.env.DEV && isEnvBrowser()) {
    void import('./features/DevPanel.svelte').then((module) => (DevPanel = module.default));
  }

  /**
   * ox_target's whole contract: three inbound events and one callback.
   *
   *   visible {state}  targeting turned on or off
   *   leftTarget       still targeting, nothing under the cursor
   *   setTarget        options and zones for whatever is under the cursor
   *
   * Upstream cleared and rebuilt the DOM on every one of these. Keyed lists here mean an
   * unchanged option keeps its node, so entrance animations do not restart and hover is
   * not lost mid-interaction — which is what made state worth having.
   */

  let visible = $state(false);
  let options = $state<Record<string, TargetOption[]>>({});
  let zones = $state<TargetOption[][]>([]);

  const hasTarget = $derived(
    Object.values(options).some((list) => list?.length) || zones.some((list) => list?.length),
  );

  function clearTarget() {
    options = {};
    zones = [];
  }

  const offVisible = onNuiEvent<{ state: boolean }>('visible', (data) => {
    visible = data.state;
    clearTarget();
  });

  const offLeft = onNuiEvent('leftTarget', clearTarget);

  const offSet = onNuiEvent<SetTargetMessage>('setTarget', (data) => {
    options = data.options ?? {};
    zones = data.zones ?? [];
  });

  // Pulls locale strings and ox_target:showRestricted from client/main.lua.
  onMount(initSettings);

  onDestroy(() => {
    offVisible();
    offLeft();
    offSet();
  });
</script>

{#if visible}
  <Reticle {hasTarget} />
  <OptionList {options} {zones} />
{/if}

{#if DevPanel}
  <DevPanel />
{/if}
