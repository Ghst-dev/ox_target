<script lang="ts">
  import { onDestroy } from 'svelte';
  import Icon from '../lib/Icon.svelte';
  import { settings } from '../lib/settings.svelte';
  import { blockedReason, type TargetOption } from '../lib/types';

  let {
    option,
    index,
    hotkey,
    onselect,
  }: {
    option: TargetOption;
    /** Position within its group, for the entrance stagger. */
    index: number;
    /** The number key that runs this row, 1-9, or undefined past the ninth. */
    hotkey?: number;
    onselect: () => void;
  } = $props();

  const reason = $derived(blockedReason(option, settings.locale, settings.showRestricted));
  const blocked = $derived(option.hide === true);
  const submenu = $derived(!!option.openMenu);

  /**
   * Hold-to-confirm, when the server has asked for it (ox_target:holdToConfirm).
   *
   * Only the pointer path holds. A number key is already an unambiguous, deliberate press —
   * the hold exists to stop a misclick on a dense list under a moving cursor, which is not a
   * problem the keyboard has.
   *
   * The fill is CSS, driven by a class and a duration variable rather than a rAF loop, so a
   * player who has asked for reduced motion gets the same timing with no animation.
   */
  let holding = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function cancelHold() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    holding = false;
  }

  function activate() {
    if (blocked) return;
    onselect();
  }

  function pointerDown(event: PointerEvent) {
    if (blocked || event.button !== 0) return;
    if (!settings.holdToConfirm) return activate();

    holding = true;
    timer = setTimeout(() => {
      cancelHold();
      activate();
    }, settings.holdToConfirm);
  }

  onDestroy(cancelHold);
</script>

<button
  class="option"
  class:blocked
  class:holding
  disabled={blocked}
  style:--stagger="{Math.min(index, 8) * 22}ms"
  style:--hold="{settings.holdToConfirm}ms"
  onpointerdown={pointerDown}
  onpointerup={cancelHold}
  onpointerleave={cancelHold}
  oncontextmenu={cancelHold}
>
  <span class="icon">
    <Icon icon={option.icon} color={blocked ? undefined : option.iconColor} size="14px" />
  </span>

  <span class="body">
    <span class="label">{option.label}</span>
    {#if blocked && reason}
      <span class="reason">{reason}</span>
    {/if}
  </span>

  {#if submenu && !blocked}
    <span class="chevron"><Icon icon="fa-solid fa-chevron-right" size="10px" /></span>
  {/if}

  <!-- The shortcut is only worth showing on rows that have one, and only while the row can
       actually be used. A number on a blocked row is an invitation to press it. -->
  {#if hotkey && !blocked}
    <kbd class="hotkey">{hotkey}</kbd>
  {/if}
</button>

<style>
  .option {
    /* Positioning context and clip for the hold-to-confirm fill below, which is an
       absolutely-positioned ::before that has to stop at the row's rounded corners. */
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 7px 12px 7px 10px;
    /* Ambient tier. The row is the only surface between the text and the game -- OptionList
       dropped the panel it used to sit on -- so it carries the separation itself, and it is
       doing that over live gameplay rather than a dimmed scene. */
    background: var(--surface-ambient);
    border: 1px solid var(--border-ambient);
    border-left: 2px solid transparent;
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-ambient);
    color: var(--color-gray);
    font-size: var(--text-sm);
    text-align: left;
    animation: option-in var(--dur-base) var(--ease-out) both;
    animation-delay: var(--stagger);
    transition:
      background var(--dur-fast) var(--ease-out),
      border-color var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out),
      transform var(--dur-fast) var(--ease-out);
  }

  /* Neutral lift, accent on the edges only — the shared hover convention, see
     tokens.css. The left rule stays the strongest signal of which row is live. */
  .option:hover:not(.blocked) {
    background: var(--color-surface-2);
    border-color: var(--primary-glow-border);
    border-left-color: var(--color-primary);
    color: var(--color-white);
    transform: translateX(3px);
  }

  /* Blocked entries are shown, not hidden — but they must never read as clickable. */
  .blocked {
    background: color-mix(in srgb, var(--color-bg) 88%, transparent);
    border-style: dashed;
    color: var(--color-dim);
    cursor: not-allowed;
  }

  .icon {
    display: grid;
    place-items: center;
    width: 16px;
    flex: none;
  }

  .body {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }

  .label {
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .reason {
    font-size: var(--text-meta);
    color: var(--color-warn);
    line-height: 1.3;
  }

  .chevron {
    display: grid;
    place-items: center;
    color: var(--color-dim);
    flex: none;
  }

  /*
   * The number key that runs this row. Dim by default and lit on hover, because it is a
   * standing reference rather than a call to action — the row already says what it does.
   */
  .hotkey {
    flex: none;
    min-width: 15px;
    padding: 1px 4px;
    border: 1px solid var(--border-ambient);
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: var(--text-meta);
    line-height: 1.4;
    text-align: center;
    color: var(--color-dim);
    transition: color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
  }

  .option:hover:not(.blocked) .hotkey {
    color: var(--color-primary);
    border-color: var(--primary-glow-border);
  }

  /*
   * Hold-to-confirm fill.
   *
   * A ::before wipe rather than a background transition, so the row keeps its own surface
   * underneath and the fill reads as something arriving over it. --color-action, not
   * --color-primary: the palette reserves action for live moments and names fill animations
   * as the example.
   */
  .option::before {
    content: '';
    position: absolute;
    inset: 0;
    width: 0;
    border-radius: inherit;
    background: color-mix(in srgb, var(--color-action) 22%, transparent);
    border-right: 1px solid var(--color-action);
    pointer-events: none;
    opacity: 0;
  }

  .option.holding::before {
    opacity: 1;
    animation: hold-fill var(--hold) linear forwards;
  }

  @keyframes hold-fill {
    from { width: 0; }
    to { width: 100%; }
  }

  @keyframes option-in {
    from {
      opacity: 0;
      transform: translateX(-6px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .option {
      animation: none;
    }
  }
</style>
