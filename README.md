# ox_target

A "third-eye" interaction system — hold a key, look at something, pick what to do with it.

Forked from [overextended/ox_target](https://github.com/overextended/ox_target) at **v1.18.1**.
Upstream's own documentation is at [overextended.dev/ox_target](https://overextended.dev/ox_target)
and still describes the registration API correctly; this file covers what is *different* here.

## Licence

**MIT**, as upstream — see [LICENSE](LICENSE), which is Overextended's and unmodified. This
is a fork, not a rewrite.

Worth stating plainly because the neighbouring resources differ: `ghst_garage` and
`ghst_vehiclekeys` are GPL-3.0 because they derive from qbx resources. ox_target does not, and
carrying a copyleft notice on an MIT codebase would be a licence claim nobody is entitled to
make.

## How it stands against upstream

Level, and likely to stay that way. v1.18.1 was released in April 2026 and the only commit
on upstream's main branch since is a README edit, so there is no stream of fixes to track —
anything ox_target becomes from here is this server's decision rather than a merge.

## What this fork changes

| | |
|---|---|
| Svelte UI | The hand-written page is a Svelte 5 app. Keyed lists, so an unchanged row keeps its node and does not restart its entrance animation mid-interaction |
| Blocked options are shown | An action you cannot take says **why** — *Requires lockpick* — instead of vanishing. Upstream sent those options to the page anyway and the page dropped them |
| Number keys | `1`–`9` run the row with that badge, without reaching for the mouse |
| Lucide icons | Replaces FontAwesome, which was 27MB in `node_modules` and most of a 1.81MB bundle |
| Locale channel | `locales/*.json` never reached the page, because upstream's page had no strings of its own. This one does |
| Reticle | A dot that reacts when something is under it |
| `canInteract` throttling | See below |
| Ambient markers | Optional dots on nearby interactions, so the world advertises itself |
| Sounds | Optional ticks on acquire and select |

## Convars

Upstream's six are unchanged: `toggleHotkey`, `defaultHotkey`, `leftClick`, `debug`,
`defaults`, `drawSprite`. These are this fork's.

| Convar | Default | |
|---|---|---|
| `ox_target:numberKeys` | `1` | `1`–`9` select the Nth row. On, because those keys did nothing at all while targeting |
| `ox_target:interactCacheMs` | `200` | How long a `canInteract` result stays good for. `0` runs it every tick, as upstream does |
| `ox_target:showRestricted` | `0` | Show options blocked by `groups` as greyed-out rows naming the requirement |
| `ox_target:holdToConfirm` | `0` | Hold the mouse this many ms to confirm instead of clicking once. `0` keeps the click |
| `ox_target:sounds` | `0` | A tick on target acquired and option selected |
| `ox_target:ambientMarkers` | `0` | Dots on nearby interactions while *not* targeting |
| `ox_target:ambientRadius` | `12` | How far those dots reach, in metres |
| `ox_target:ambientMax` | `12` | Hard ceiling on dots drawn at once |
| `ox_target:ambientScanMs` | `500` | How often the world is re-scanned for them |

Everything that changes how the server *feels* is off by default. Everything that is purely
additive — number keys, the throttle — is on.

## `offsetAbsolute` also works

Upstream's documentation lists an `offsetAbsolute` property. Upstream's code reads
`absoluteOffset`, and always has. Following the documentation therefore does nothing at all:
the offset silently stays model-relative, lands somewhere plausible, raises no error and
prints nothing.

**Both spellings are accepted here.** This is not a redesign of the property, just an end to
the trap — and it is safe to fix locally precisely because upstream is dormant.

## Number keys, and why they are not in the page

The page cannot see a keypress until NUI focus is taken, and focus is only taken when you
click. A keyboard shortcut implemented in the UI would therefore have started with the mouse,
which is the thing it exists to avoid. So the keys are read in `client/main.lua`, from the
same draw loop that reads the mouse.

That leaves one problem: **Lua does not know what order the rows are in.** The page filters
blocked rows out, reorders the buckets broad-to-specific, and lifts the back row into a
breadcrumb. So the page reports its own render order back through an `order` callback, and
Lua indexes into that. Recomputing the order in Lua would be a second implementation of the
same rule, and the two would disagree the first time either changed.

The number-key controls are disabled only while a target is up, so weapon switching is
untouched the rest of the time. Blocked rows get no number — pressing `3` should never do
nothing.

## `canInteract` is throttled, not cached

`canInteract` is arbitrary code from whichever resource registered the option, run under
`pcall`, for every visible option, on a 50ms loop. It is the only cost in this resource that
nothing here bounds.

It is a **throttle** rather than a cache because the callback is handed `distance` and
`coords`: a result is only true for where the player was standing when it ran, so keeping one
indefinitely would be wrong. An entry is dropped the moment the target entity changes and
expires on its own after `interactCacheMs`. `option.distance` is still evaluated every tick,
uncached, so the gate players actually feel never goes stale.

Set `ox_target:interactCacheMs` to `0` for upstream's behaviour.

## Ambient markers

Off by default, and the default is the interesting part: this is the only loop in the
resource that runs while the player is *not* targeting, so it is the only one that costs
anything at rest — and it puts permanent marks on a screen that already carries a HUD, which
is a decision about the server's look rather than a straight improvement.

**Only specific registrations get a marker.** `addModel`, `addEntity`, `addLocalEntity` and
zones — never the `global` buckets. `ox_target:defaults` alone registers door, bonnet and boot
options against every vehicle in the game, so marking global options would put a dot on every
car on the street, and the marker would come to mean "this is a vehicle" rather than
"something is here". A marker that is always on is not a signal.

Zones are the case it exists for: an interaction volume is invisible by definition.

## Hold-to-confirm

`ox_target:holdToConfirm` in ms, `0` for the single click. Only the pointer holds — a number
key is already a deliberate, unambiguous press, and the hold exists to stop a misclick on a
dense list under a moving cursor, which is not a problem the keyboard has.

The page owns the timing rather than Lua, because the bar the player watches and the moment
the action fires have to be on the same clock.

## Building the UI

```bash
pnpm --dir Scripts/ox_target/web install
pnpm --dir Scripts/ox_target/web run dev     # the option list in a browser
pnpm --dir Scripts/ox_target/web run build
```

`build` runs two checks after Vite:

- **`check-devpanel.mjs`** fails if the dev harness reached the bundle. It is reached through
  a dynamic import behind `import.meta.env.DEV`; one static import would ship the drawer and
  its invented payloads to every player. This used to be a grep written in a comment, which
  is to say it was never run.
- **`check-tokens.mjs`** fails on a `var(--x)` with no fallback that nothing declares.

## What this fork deliberately does not do

**No in-world DUI rendering.** The paid replacements render the option list onto a screen in
the world and advertise that moving the camera then costs no NUI messages. That is a real
saving for an always-on system; ox_target's loop only runs while the key is held, so the idle
cost it removes is a cost this server does not pay. It would trade a working Svelte UI for a
much harder one to build.

**No qb-target bridge.** Upstream's qtarget shim is kept and `provide 'qtarget'` still stands.
Nothing here calls qb-target's events.
