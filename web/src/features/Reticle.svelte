<script lang="ts">
  /**
   * Replaces the hardcoded black eye SVG that only changed fill on hover.
   *
   * Three states, and this is where the two-tier accent rule earns its keep:
   *   idle      a small dim dot — targeting is on, nothing under the cursor
   *   acquired  ring snaps out in --color-action, the "something just happened" colour
   *   holding   settles to --color-primary, which is idle chrome
   */

  let { hasTarget = false }: { hasTarget?: boolean } = $props();

  // Briefly true on the transition into a target, so the flash is tied to the event
  // rather than to the resting state.
  let justAcquired = $state(false);
  let previous = false;

  $effect(() => {
    if (hasTarget && !previous) {
      justAcquired = true;
      const timer = setTimeout(() => (justAcquired = false), 260);
      previous = hasTarget;
      return () => clearTimeout(timer);
    }

    previous = hasTarget;
  });
</script>

<div class="reticle" class:active={hasTarget} class:flash={justAcquired}>
  <span class="dot"></span>
  <span class="reticle-ring"></span>
</div>

<style>
  .reticle {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    pointer-events: none;
  }

  .dot {
    grid-area: 1 / 1;
    width: 5px;
    height: 5px;
    border-radius: var(--radius-full);
    background: var(--color-gray);
    box-shadow: 0 0 3px rgba(0, 0, 0, 0.8);
    transition:
      background var(--dur-base) var(--ease-out),
      transform var(--dur-base) var(--ease-out);
  }

  /*
   * `reticle-ring`, not `ring`.
   *
   * `ring` is a real Tailwind utility, and app.css imports tailwindcss with `@source './'`
   * — so Tailwind scanned this component, found class="ring" and generated the utility,
   * setting --tw-ring-shadow to `0 0 0 1px currentcolor`. Because this element is
   * border-radius: full the result was a circular 1px halo in the inherited text colour,
   * sitting just outside the 2px border whenever the reticle was visible and not
   * flashing — subtle enough to look like anti-aliasing rather than a bug.
   *
   * Semantic class names in a Tailwind project share a namespace with every utility.
   * Check a name against the utility list before using it, or scope it as here.
   */
  .reticle-ring {
    grid-area: 1 / 1;
    width: 34px;
    height: 34px;
    border: 2px solid transparent;
    border-radius: var(--radius-full);
    /* Collapsed at rest so it expands outward when a target appears. */
    transform: scale(0.55);
    opacity: 0;
    transition:
      transform var(--dur-base) var(--ease-out),
      opacity var(--dur-base) var(--ease-out),
      border-color var(--dur-base) var(--ease-out);
  }

  .active .dot {
    background: var(--color-primary);
    transform: scale(0.8);
  }

  .active .reticle-ring {
    border-color: var(--color-primary);
    transform: scale(1);
    opacity: 1;
  }

  /* The acquisition moment only. */
  .flash .reticle-ring {
    border-color: var(--color-action);
    box-shadow: var(--ring-action);
  }

  @media (prefers-reduced-motion: reduce) {
    .dot,
    .reticle-ring {
      transition: none;
    }
  }
</style>
