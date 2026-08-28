<script lang="ts">
  import { debugData } from '../lib/nui';
  import { settings } from '../lib/settings.svelte';

  /** Browser-only harness. App.svelte mounts it behind isEnvBrowser(). */

  /**
   * Exists only to be found by `web/tools/check-devpanel.mjs`.
   *
   * The check used to be a documented grep for the words "Developer drawer", which is prose:
   * rewording the heading would have disarmed it silently, and a disarmed check reads exactly
   * like a passing one. A constant nobody has a reason to edit cannot be reworded by accident.
   *
   * Referenced below so no bundler can treat it as unused and drop it.
   */
  const DEV_MARKER = 'ox-target-dev-panel';

  let open = $state(false);

  const show = () => debugData([{ event: 'visible', state: true }]);
  const hide = () => debugData([{ event: 'visible', state: false }]);
  const left = () => debugData([{ event: 'leftTarget' }]);

  /** A vehicle with options from several buckets, plus two blocked by requirements. */
  const vehicle = () =>
    debugData([
      {
        event: 'setTarget',
        options: {
          __global: [
            { label: 'Inspect', icon: 'fa-solid fa-magnifying-glass' },
            { label: 'Hotwire', icon: 'fa-solid fa-screwdriver', hide: true, items: 'lockpick' },
          ],
          global: [
            { label: 'Open door', icon: 'fa-solid fa-car-side' },
            { label: 'Open boot', icon: 'fa-solid fa-suitcase' },
          ],
          model: [
            { label: 'Repair engine', icon: 'fa-solid fa-wrench', hide: true, groups: ['mechanic'] },
            { label: 'More…', icon: 'fa-solid fa-ellipsis', openMenu: 'vehicle_more' },
          ],
        },
        zones: [],
      },
    ]);

  /** The same, one level deep, so the breadcrumb appears. */
  const submenu = () =>
    debugData([
      {
        event: 'setTarget',
        options: {
          __global: [
            {
              label: 'Go back',
              icon: 'fa-solid fa-circle-chevron-left',
              name: 'builtin:goback',
              menuName: 'vehicle_more',
              openMenu: 'home',
            },
            { label: 'Flip vehicle', icon: 'fa-solid fa-rotate' },
            { label: 'Clean vehicle', icon: 'fa-solid fa-soap' },
          ],
        },
        zones: [],
      },
    ]);

  const zone = () =>
    debugData([
      {
        event: 'setTarget',
        options: {},
        zones: [
          [
            { label: 'Enter garage', icon: 'fa-solid fa-warehouse' },
            { label: 'Staff only', icon: 'fa-solid fa-lock', hide: true, groups: { police: 2 } },
          ],
        ],
      },
    ]);

  /** Hidden with no groups/items — must stay hidden, since the reason is unknowable. */
  const unknowable = () =>
    debugData([
      {
        event: 'setTarget',
        options: {
          __global: [
            { label: 'Visible action', icon: 'fa-solid fa-check' },
            { label: 'Out of range', icon: 'fa-solid fa-xmark', hide: true },
          ],
        },
        zones: [],
      },
    ]);

  /**
   * Every reason an option can be blocked for, side by side.
   *
   * `hideReason` decides whether a blocked option explains itself, and the rules are not
   * uniform: items always say what is missing, groups only say so when the server opts in,
   * distance always says "too far", and `bone`/`offset`/`canInteract`/`menu` say nothing at
   * all because nothing useful can be said. Four of those seven were unreachable here, so
   * the only way to see whether the list still reads sensibly with a mix of stated and
   * silent exclusions was to build the situation in game.
   */
  const reasons = () =>
    debugData([
      {
        event: 'setTarget',
        options: {
          __global: [
            { label: 'Allowed', icon: 'fa-solid fa-check' },
            {
              label: 'Needs an item',
              icon: 'fa-solid fa-screwdriver',
              hide: true,
              hideReason: 'items',
              items: { lockpick: 2 },
            },
            {
              label: 'Needs a job',
              icon: 'fa-solid fa-shield',
              hide: true,
              hideReason: 'groups',
              groups: { police: 2 },
            },
            {
              label: 'Out of range',
              icon: 'fa-solid fa-arrows-left-right',
              hide: true,
              hideReason: 'distance',
              distance: 1.5,
            },
            {
              label: 'Wrong bone',
              icon: 'fa-solid fa-bone',
              hide: true,
              hideReason: 'bone',
              bones: 'door_dside_f',
            },
            {
              label: 'canInteract said no',
              icon: 'fa-solid fa-ban',
              hide: true,
              hideReason: 'canInteract',
            },
          ],
        },
        zones: [],
      },
    ]);

  /**
   * More options than fit on screen.
   *
   * The list has no max height and no scroll, so this is the payload that says whether it
   * needs one. Reachable in play the moment two resources both add options to the same
   * model.
   */
  const many = () =>
    debugData([
      {
        event: 'setTarget',
        options: {
          __global: Array.from({ length: 8 }, (_, index) => ({
            label: `Global option ${index + 1}`,
            icon: 'fa-solid fa-circle',
          })),
          model: Array.from({ length: 8 }, (_, index) => ({
            label: `Model option ${index + 1}`,
            icon: 'fa-solid fa-cube',
          })),
          entity: Array.from({ length: 6 }, (_, index) => ({
            label: `This entity ${index + 1}`,
            icon: 'fa-solid fa-cube',
          })),
        },
        zones: [],
      },
    ]);

  /** A label long enough to wrap, which is what a translated option is. */
  const long = () =>
    debugData([
      {
        event: 'setTarget',
        options: {
          __global: [
            {
              label: 'Fahrzeuginteraktionen — Kofferraum öffnen und Inhalt durchsuchen',
              icon: 'fa-solid fa-suitcase',
            },
            { label: 'Short', icon: 'fa-solid fa-check' },
          ],
        },
        zones: [],
      },
    ]);

  const ACTIONS: [string, () => void][] = [
    ['Targeting on', show],
    ['Targeting off', hide],
    ['Left target', left],
    ['Vehicle (mixed)', vehicle],
    ['Submenu + crumb', submenu],
    ['Zone options', zone],
    ['Hidden, no reason', unknowable],
    ['Every hide reason', reasons],
    ['22 options', many],
    ['Long label', long],
  ];
</script>

<button class="launcher" data-marker={DEV_MARKER} onclick={() => (open = !open)} title="Developer drawer">DEV</button>

{#if open}
  <aside class="drawer">
    <h2>Developer drawer</h2>
    {#each ACTIONS as [label, run]}
      <button class="action" onclick={run}>{label}</button>
    {/each}

    <!--
      The one setting that changes what the list says rather than what it contains, and the
      only way to reach it: it arrives on the `init` handshake from client/main.lua, which
      has no browser equivalent. With it off, "Restricted to police" is withheld — that is
      deliberate, because a job requirement can itself be a spoiler — so leaving it
      unreachable meant half of `blockedReason` never ran outside the game.
    -->
    <label class="toggle">
      <input type="checkbox" bind:checked={settings.showRestricted} />
      showRestricted
    </label>

    <p class="note">Browser only — never mounted in game.</p>
  </aside>
{/if}

<style>
  .launcher {
    position: absolute;
    right: 20px;
    bottom: 20px;
    padding: 8px 12px;
    border-radius: var(--radius-full);
    background: var(--color-warn);
    color: var(--color-bg);
    font-size: var(--text-meta);
    font-weight: 700;
    letter-spacing: var(--tracking-label);
    pointer-events: auto;
    z-index: 100;
  }

  .drawer {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 220px;
    padding: 16px;
    background: var(--surface-panel);
    border-right: 1px solid var(--color-border);
    pointer-events: auto;
    z-index: 100;
  }

  h2 {
    font-size: var(--text-sm);
    font-weight: 600;
    margin-bottom: 6px;
  }

  .action {
    width: 100%;
    padding: 7px 10px;
    text-align: left;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-white);
    font-size: var(--text-sm);
  }
  .action:hover {
    opacity: 0.88;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    font-size: var(--text-meta);
    color: var(--color-gray);
  }

  .note {
    margin-top: auto;
    font-size: var(--text-meta);
    color: var(--color-dim);
  }
</style>
