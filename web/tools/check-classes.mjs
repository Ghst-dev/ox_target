/**
 * Fail on semantic class names that collide with a Tailwind utility.
 *
 *     node tools/check-classes.mjs        (run from web/, after a build)
 *
 * Tailwind v4 scans source files as *text*, so a word used as a semantic class name also emits
 * that utility and both apply to the element. Tailwind's output is unscoped (`.grid{…}`) while
 * Svelte's is scoped (`.grid.s-Ab1`), so any single-class rule with no `.s-` suffix came from
 * Tailwind; cross that against the class names used in markup.
 *
 * ONE FILE WITH COPIES, listed in `Tools/checks/copies.py`. It was not, for its first weeks, and
 * the result is the argument for the list: six resources carried six copies, the code identical in
 * all of them and the comment at the top rewritten four separate times. Nothing broke -- but the
 * next real fix would have landed in one copy and been re-derived in the other five, which is what
 * this file exists to prevent happening to a class name.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'src';

/**
 * Where `vite build` put the CSS.
 *
 * Read from the config rather than assumed, because the tree has two answers: the `ghst_*`
 * resources build to `dist/` and the three `ox_*` forks to `build/`, which is upstream's layout
 * and not ours to change. A hardcoded `dist/assets` is why this gate was never installed in
 * ox_lib -- the resource with eight consumers and the most to lose from a silent collision.
 */
function assetsDir() {
  for (const config of ['vite.config.js', 'vite.config.mjs', 'vite.config.ts']) {
    if (!existsSync(config)) continue;

    const [, outDir] = readFileSync(config, 'utf8').match(/outDir\s*:\s*['"]([^'"]+)['"]/) ?? [];
    if (outDir) return join(outDir, 'assets');
  }

  return join('dist', 'assets');
}

/**
 * Every class name the resource declares itself in a rule Svelte does NOT scope: a plain
 * stylesheet under `src/`, or a `:global(.name)` in a component's style block.
 *
 * WITHOUT THIS THE GATE ACCUSES A RESOURCE OF ITS OWN CSS. The test below is "unscoped, therefore
 * Tailwind's", and that inference has a hole the size of every global stylesheet in the tree: a
 * rule in `theme/world.css` or `app.css` is unscoped for the ordinary reason that nothing scoped
 * it. Installing this gate across the tree turned that hole up immediately -- `ghst_interact`'s
 * four `world-*` names, `ghst_loadingscreen`'s `.eyebrow`, `ghst_multichar`'s `.rail` -- all of
 * them the resource's own, none of them anything Tailwind would ever emit.
 */
function ownGlobals() {
  const names = new Set();

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(path);
        continue;
      }

      if (entry.name.endsWith('.css')) {
        const css = readFileSync(path, 'utf8');
        for (const [, name] of css.matchAll(/(?:^|[,}{\s])\.([a-zA-Z][\w-]*)[\s,:>{]/g)) {
          names.add(name);
        }
        continue;
      }

      if (!entry.name.endsWith('.svelte')) continue;

      const source = readFileSync(path, 'utf8');
      for (const [, name] of source.matchAll(/:global\(\s*\.([a-zA-Z][\w-]*)/g)) names.add(name);
    }
  };

  walk(SRC);
  return names;
}

/** Every `.name{…}` rule in the built CSS that Svelte did not scope. */
function tailwindUtilities(dir) {
  const names = new Set();
  const sheets = readdirSync(dir).filter((f) => f.endsWith('.css'));

  /*
   * An empty run is a broken gate, not a clean one. Every failure mode here -- the wrong
   * directory, a build that did not happen, a config this cannot read -- produces zero utilities
   * and therefore zero collisions, and reports success. That is worse than no gate at all,
   * because the green line is what stops anyone looking.
   */
  if (sheets.length === 0) {
    console.error(`check-classes: no CSS in ${dir}. Run \`vite build\` first.`);
    process.exit(1);
  }

  for (const file of sheets) {
    const css = readFileSync(join(dir, file), 'utf8');

    for (const [, name] of css.matchAll(/(?:^|[,}])\.([a-zA-Z][\w-]*)\s*\{/g)) {
      names.add(name);
    }
  }

  return names;
}

/**
 * Every class name a component styles in its own scoped `<style>` block.
 *
 * This is the half that makes a collision a collision. Read the note over `collisions` below.
 *
 * Over-inclusive on purpose: it takes any `.name` token in the block rather than parsing
 * selectors, so `.mark.align-top` counts `align-top` and a stray `.png` in a `url()` counts too.
 * Erring this way flags more, and the direction that hurts is the one that flags less -- which is
 * the opposite of `ownGlobals` above, where a name matched too eagerly gets SUBTRACTED and a
 * collision goes quiet. That one keeps its boundary; this one does not.
 */
function styledClasses() {
  const names = new Set();

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(path);
        continue;
      }

      if (!entry.name.endsWith('.svelte')) continue;

      for (const [, block] of readFileSync(path, 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
        // No lookbehind, so a compound selector counts both halves: `.mark.align-top` has to
        // yield `align-top` or ox_lib's one real overlap walks straight through this.
        for (const [, name] of block.matchAll(/\.([a-zA-Z][\w-]*)/g)) names.add(name);
      }
    }
  };

  walk(SRC);
  return names;
}

/** Every class name used in markup — `class="a b"`, `class:name`, `class:name={…}`. */
function markupClasses() {
  const used = new Map();

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(path);
        continue;
      }

      if (!entry.name.endsWith('.svelte')) continue;

      const source = readFileSync(path, 'utf8');
      // Only the markup half, or a `<style>` block reads as a page full of class names.
      const markup = source.replace(/<style[\s\S]*?<\/style>/g, '');

      const add = (name) => {
        if (!used.has(name)) used.set(name, new Set());
        used.get(name).add(path);
      };

      /*
       * `[^"]` and not `[^"{]`, and the difference is a bug this gate was written to catch and
       * then walked straight past. The old pattern refused any attribute holding an
       * interpolation, so `class="stat-ring {tone}"` was skipped whole -- and `.ring`, a Tailwind
       * utility that draws a 1px box-shadow ring in `currentcolor`, shipped on every status gauge
       * in ghst_hud, drawing a square on top of each one.
       *
       * Stripping the `{...}` parts and keeping the literal words checks the half that IS a
       * literal, which is the only half a collision can live in anyway: a name computed at runtime
       * is not a name this gate could ever have resolved.
       */
      for (const [, value] of markup.matchAll(/\bclass="([^"]*)"/g)) {
        for (const name of value.replace(/\{[^}]*\}/g, ' ').split(/\s+/).filter(Boolean)) {
          add(name);
        }
      }

      for (const [, name] of markup.matchAll(/\bclass:([\w-]+)/g)) add(name);
    }
  };

  walk(SRC);
  return used;
}

const ours = ownGlobals();
const utilities = tailwindUtilities(assetsDir());
const used = markupClasses();
const styled = styledClasses();

for (const name of ours) utilities.delete(name);

/**
 * A COLLISION IS A NAME THE COMPONENT STYLES *AND* TAILWIND EMITS -- two rules on one element,
 * one of which nobody wrote.
 *
 * This used to flag any markup class that matched a utility, on the argument that `class="grid"`
 * with no `.grid` rule of our own is still an element silently receiving `display: grid`. Taking
 * the gate tree-wide is what retired that: `ghst_loadingscreen` writes
 * `class="eyebrow text-label tracking-label font-bold uppercase"` and `theme/base.css` documents
 * it as the house eyebrow, so thirteen of its class names are utilities ON PURPOSE, and so are ten
 * of `ghst_multichar`'s. Under the old rule the two resources with the most deliberate use of
 * Tailwind were the two that failed hardest -- and a gate that fails a documented practice is a
 * gate somebody deletes.
 *
 * `class="grid"` with no rule of its own is now allowed, and that is the right reading in a tree
 * that uses utilities deliberately: the element receives `display: grid` because somebody asked
 * for `display: grid`. What cannot be allowed is `class="ring"` next to a `.ring` rule of your
 * own -- there the author has said what the name means, and Tailwind quietly says something else
 * on top. That is the bug this was written for, and it is still caught.
 */
const collisions = [...used].filter(([name]) => utilities.has(name) && styled.has(name)).sort();

if (collisions.length === 0) {
  console.log(`check-classes: ${used.size} class names, no Tailwind collisions.`);
  process.exit(0);
}

console.error('check-classes: class names that are also Tailwind utilities.\n');

for (const [name, files] of collisions) {
  console.error(`  .${name}`);
  for (const file of files) console.error(`      ${file}`);
}

console.error('\nRename them, or scope them (`gauge-ring`). See the note at the top of this file.');
process.exit(1);
