<script lang="ts">
  import { fetchNui } from '../lib/nui';
  import Icon from '../lib/Icon.svelte';
  import Option from './Option.svelte';
  import { settings } from '../lib/settings.svelte';
  import { blockedReason, groupLabel, GROUP_ORDER, type TargetOption } from '../lib/types';

  let {
    options = {},
    zones = [],
  }: { options?: Record<string, TargetOption[]>; zones?: TargetOption[][] } = $props();

  interface Entry {
    key: string;
    option: TargetOption;
    /** Arguments for the select callback, in the exact order client/main.lua reads them. */
    type: string;
    id: number;
    zoneId?: number;
  }

  interface Group {
    key: string;
    label: string;
    entries: Entry[];
  }

  /**
   * Blocked options are rendered only when we can name the requirement. shouldHide() also
   * fires for range and canInteract, and surfacing those would mean every distant action
   * on an entity permanently cluttering the list with no explanation.
   */
  const isVisible = (option: TargetOption) =>
    !option.hide || blockedReason(option, settings.locale, settings.showRestricted) !== null;

  /**
   * Groups and the back entry are produced together, in one derived.
   *
   * ox_target inserts a synthetic back option at the top of __global while a submenu is
   * open, carrying the current menu's name. Lifting it into a header turns an anonymous
   * row into an actual breadcrumb — you can see where you are, not just that you can
   * leave. It has to come out of the same pass that builds the groups, and assigning it
   * to a separate $state from inside a $derived is a state_unsafe_mutation error.
   */
  const model = $derived.by(() => {
    const result: Group[] = [];
    let backEntry: Entry | null = null;

    // sort_keys=true on the Lua side means the payload arrives alphabetically; impose a
    // broad-to-specific order instead. Unknown buckets sort last rather than vanishing.
    const buckets = Object.entries(options ?? {}).sort(([a], [b]) => {
      const ia = GROUP_ORDER.indexOf(a);
      const ib = GROUP_ORDER.indexOf(b);
      return (ia === -1 ? GROUP_ORDER.length : ia) - (ib === -1 ? GROUP_ORDER.length : ib);
    });

    for (const [type, list] of buckets) {
      const entries: Entry[] = [];

      list?.forEach((option, index) => {
        // ids are 1-based: upstream's createOptions passed `id + 1`.
        const entry: Entry = { key: `${type}:${index}:${option.label}`, option, type, id: index + 1 };

        if (option.name === 'builtin:goback') {
          backEntry = entry;
          return;
        }

        if (isVisible(option)) entries.push(entry);
      });

      if (entries.length) {
        result.push({ key: type, label: groupLabel(type, settings.locale), entries });
      }
    }

    zones?.forEach((list, zoneIndex) => {
      const entries: Entry[] = [];

      list?.forEach((option, index) => {
        if (!isVisible(option)) return;
        entries.push({
          key: `zone${zoneIndex}:${index}:${option.label}`,
          option,
          type: 'zones',
          id: index + 1,
          zoneId: zoneIndex + 1,
        });
      });

      if (entries.length) {
        result.push({ key: `zone${zoneIndex}`, label: groupLabel('zones', settings.locale), entries });
      }
    });

    // Annotated because the only assignment happens inside a forEach callback, which
    // narrows the inferred type to `never` at this point.
    return { groups: result, back: backEntry as Entry | null };
  });

  const groups = $derived(model.groups);
  const back = $derived(model.back);

  // Labels are noise when there is only one bucket, which is the common case.
  const showLabels = $derived(groups.length > 1);
  const menuName = $derived(back?.option.menuName);

  /**
   * The order the player is actually looking at, pushed to Lua so a number key can mean the
   * row on screen rather than the row Lua happens to hold third.
   *
   * It has to come from here. This component filters blocked rows, reorders the buckets
   * broad-to-specific and lifts the back row out into a breadcrumb — none of which Lua sees.
   * Recomputing it there would be a second implementation of the same rule, and the two would
   * disagree the first time either one changed.
   *
   * Blocked rows are left out rather than numbered and refused: pressing 3 should never do
   * nothing. The breadcrumb is not numbered either, because it has Backspace.
   */
  const selectable = $derived(
    groups.flatMap((group) => group.entries.filter((entry) => entry.option.hide !== true)),
  );

  /**
   * Which number key each row answers to, keyed by the entry's own key so the badge follows
   * the row rather than the position — a blocked row appearing above it must not renumber
   * everything below.
   *
   * Only the first nine get one. A tenth row is still clickable; it just has no shortcut,
   * which is better than showing a `0` that does nothing.
   */
  const hotkeys = $derived(
    new Map(selectable.slice(0, 9).map((entry, i) => [entry.key, i + 1])),
  );

  $effect(() => {
    fetchNui(
      'order',
      selectable.map((entry) => [entry.type, entry.id, entry.zoneId]),
    );
  });

  function select(entry: Entry) {
    fetchNui('select', [entry.type, entry.id, entry.zoneId]);
  }
</script>

{#if groups.length || back}
  <div class="panel">
    {#if back}
      <button class="crumb" onclick={() => back && select(back)}>
        <Icon icon="fa-solid fa-chevron-left" size="11px" />
        <span class="crumb-label">{menuName ?? settings.locale.go_back}</span>
      </button>
    {/if}

    {#each groups as group (group.key)}
      {#if showLabels}
        <p class="group-label">{group.label}</p>
      {/if}
      {#each group.entries as entry, index (entry.key)}
        <Option
          option={entry.option}
          {index}
          hotkey={hotkeys.get(entry.key)}
          onselect={() => select(entry)}
        />
      {/each}
    {/each}
  </div>
{/if}

<style>
  /*
   * A bare column, not a surface. Upstream faded a gradient out at a fixed 150pt; the
   * first pass here replaced that with a bordered panel, which put a bordered row inside
   * a bordered box — two nested rectangles and 8px of dead space around a single "Use
   * pump". ox_lib's context menu does not do that either: its rows ARE the surface and
   * the column around them is only a layout box. Same here, so the two match.
   *
   * Width follows the content. A fixed 240px is right for a vehicle's six options and
   * absurd for one short label, which is the common case at a pump or a door.
   */
  .panel {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translateY(-50%);
    margin-left: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-0-5);
    width: max-content;
    min-width: 150px;
    max-width: 260px;
    max-height: 60vh;
    overflow-y: auto;
    pointer-events: auto;
  }

  /* Carries its own surface now that the column has none — the same one an option row
     uses, so the breadcrumb reads as part of the same stack. */
  .crumb {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1-5) var(--space-2);
    margin-bottom: var(--space-0-5);
    background: var(--surface-ambient);
    border: 1px solid var(--border-ambient);
    border-radius: var(--radius-sm);
    color: var(--color-gray);
    font-size: var(--text-sm);
    text-align: left;
  }
  .crumb:hover {
    border-color: var(--primary-glow-border);
    color: var(--color-primary);
  }

  .crumb-label {
    font-weight: 500;
  }

  /* Sits directly on the game, with no surface of its own, so it takes the shared outline.
     A single directional drop leaves the up-side of a glyph unprotected against a bright sky;
     the four-way ring closes it. See --legible-text in theme/tokens.css. */
  .group-label {
    margin: var(--space-1-5) 0 var(--space-0-5) var(--space-0-5);
    font-size: var(--text-meta);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-gray);
    text-shadow: var(--legible-text);
  }
  .group-label:first-child {
    margin-top: 0;
  }
</style>
