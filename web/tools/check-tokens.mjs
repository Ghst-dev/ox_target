/**
 * Fails on a `var(--x)` with no fallback that nothing in src declares, and on any `var()` in a
 * markup attribute. Declarations are a CSS rule, an inline style, or Svelte's `style:--x`
 * directive; `var(--x, 1)` is a contract with an ancestor and is deliberately allowed.
 *
 * Comments are not scanned. See `mask` below for why that had to be said out loud.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src';

/**
 * THE SPACING RATCHET.
 *
 * `--space-*` landed 2026-09-01 against 621 hand-written pixel values already in the tree, across
 * twenty distinct steps of which about 355 were off any grid. A gate that simply refused raw
 * pixels would have failed all eighteen builds on the day it was written, so it would have been
 * turned off on the day it was written.
 *
 * So it ratchets instead. Each resource records how many raw-pixel spacing declarations it holds;
 * the number may fall and may never rise. A build that adds one fails. A build that removes one
 * tightens the baseline automatically and says so -- automatic because a ratchet you have to
 * remember to tighten is a ratchet that sits at its starting value forever.
 *
 * WHY THIS AND NOT A LINTER RULE: the value being wrong is not a property of any single
 * declaration. `padding: 10px` is unimprovable in isolation; it is only wrong because eleven other
 * files said 12px for the same gutter. Nothing local can see that, which is why this sits beside
 * the cross-file token check rather than in the editor.
 *
 * `1px` is exempt -- it is `--space-px`, a hairline, and deliberately does not scale. `0` is
 * exempt for the obvious reason. Percentages, `em`, `rem`, `auto`, `var()` and `calc()` are not
 * counted at all: this measures device pixels, which are the thing that cannot answer the player's
 * interface-size preference.
 */
const BASELINE = join('tools', 'spacing-baseline.json');

/*
 * THE TYPE RATCHET, added 2026-09-01 beside the spacing one and for the same reason.
 *
 * `txData/ghst_sv/docs/ui-system.md` closed section 2.3 by naming the two per-resource type
 * scales that had drifted -- ghst_garages' 21 unnamed board sizes, ghst_hud's 62 raw pixels --
 * and then nothing watched the other sixteen. A survey the same day found eleven raw sizes still
 * out there: six identical 9px captions in `ghst_admin` that wanted `--text-micro`, two hero
 * clamps in `ghst_multichar`, and three in `ox_lib` that are correct and stay.
 *
 * Those three are why this ratchets rather than refuses. `CircleProgressbar`'s 16px is in SVG
 * user units inside a 90x90 viewBox, not screen pixels; `SkillCheck`'s keycaps are raw type in a
 * raw-pixel box, and moving one half onto `--ui-px` is exactly the fault the gamified HUD
 * clusters had. A gate that failed on those would be a gate somebody turns off.
 */
const TYPE = /font-size\s*:\s*([^;}"']+)/g;

const SPACING = new RegExp(
  String.raw`(?:^|[;{}\s"'])((?:padding|margin)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|gap|row-gap|column-gap)\s*:\s*([^;}"']+)`,
  'g',
);

/** A device-pixel length that is neither 0 nor a hairline. */
const RAW_PX = /(?<![\w.-])(\d+(?:\.\d+)?)px/g;

const rawPixels = (value) => {
  for (const m of value.matchAll(RAW_PX)) {
    if (Number(m[1]) > 1) return true;
  }
  return false;
};

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') walk(p);
    } else if (/\.(svelte|css|ts)$/.test(entry.name)) {
      files.push(p);
    }
  }
})(ROOT);

const declared = new Set();
const used = new Map();

/** Raw-pixel `padding`/`margin`/`gap` declarations, counted against `tools/spacing-baseline.json`. */
const spacing = [];

/** Raw-pixel `font-size` declarations, counted against the same file. */
const type = [];

/** `color-mix()` declarations with no same-property fallback on the line above. */
const colorMix = [];

/**
 * `var()` in a markup attribute, which CEF silently drops. `style` and `style:--x` are exempt
 * because they are the CSS path, and only markup is scanned -- a `<style>` block is fine.
 */
const inAttribute = [];

/**
 * Comments blanked to spaces of the same length, so every line number stays exact.
 *
 * Prose is not code, and this scanner used to read it as code. The CEF ceiling note in
 * `theme/base.css` documents `--transform-base` by name -- it writes `var(--transform-base)` in a
 * sentence -- and every resource carrying that note was reported as using a property it never
 * declares. The same blindness ran the other way and mattered more: a `--x:` written inside a
 * comment counted as a *declaration*, so a token that was only ever described and never set
 * passed the gate this file exists to be.
 *
 * Block and HTML comments only. A `//` line comment is left alone on purpose: it cannot be told
 * from the `//` in a URL without parsing, and no comment style but these two has ever held a
 * `var()` here.
 */
const mask = (text) =>
  text.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, ' '));

for (const file of files) {
  const source = mask(readFileSync(file, 'utf8'));

  const markup = source.split('<style')[0];

  for (const m of markup.matchAll(/([\w:-]+)\s*=\s*"([^"]*var\(--[^"]*)"/g)) {
    if (m[1] === 'style' || m[1].startsWith('style:')) continue;

    /* Only DOM elements: a component prop is Svelte's to handle. Capitalised tag = component. */
    const tag = markup.slice(0, m.index).match(/<([A-Za-z][\w.:-]*)[^<]*$/)?.[1];

    if (!tag || tag[0] === tag[0].toUpperCase()) continue;

    inAttribute.push({
      file: file.split(/[\\/]/).join('/'),
      line: markup.slice(0, m.index).split('\n').length,
      attribute: m[1],
      value: m[2],
    });
  }

  /* A CSS declaration, or one inside an inline style attribute. */
  for (const m of source.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) declared.add(m[1]);

  /* Svelte's own directive form, which carries no colon. */
  for (const m of source.matchAll(/style:(--[a-zA-Z0-9-]+)/g)) declared.add(m[1]);

  /* A use, only where nothing follows the name but the closing paren. */
  for (const m of source.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*\)/g)) {
    if (!used.has(m[1])) used.set(m[1], new Set());
    used.get(m[1]).add(file.split(/[\\/]/).join('/'));
  }

  /*
   * Raw-pixel rhythm, for the ratchet. The dev harness is excluded: it is a browser-only fixture
   * that never ships to a player, so holding it to the player's interface-size preference is
   * effort spent on something nobody sees. `.ts` is excluded because `padding:` inside a string
   * there is far more likely to be data than a declaration.
   */
  const path = file.split(/[\\/]/).join('/');

  if (/\.(svelte|css)$/.test(path) && !/\/dev\//.test(path) && !/DevPanel\.svelte$/.test(path)) {
    for (const m of source.matchAll(SPACING)) {
      if (!rawPixels(m[2])) continue;

      spacing.push({
        file: path,
        line: source.slice(0, m.index).split('\n').length,
        text: `${m[1]}: ${m[2].trim()}`,
      });
    }

    for (const m of source.matchAll(TYPE)) {
      if (!rawPixels(m[1])) continue;

      type.push({
        file: path,
        line: source.slice(0, m.index).split('\n').length,
        text: `font-size: ${m[1].trim()}`,
      });
    }

    /*
     * An unguarded `color-mix()`, which is not a wrong colour in game -- it is NO DECLARATION.
     *
     * `color-mix()` is Chromium 111 and this runtime is CEF 103 with experimental features on, so
     * an unknown function makes the whole declaration invalid and the property keeps its initial
     * value. `background: color-mix(...)` alone therefore renders as no background at all, and it
     * does so ONLY in game -- `pnpm dev` runs a real browser and shows it perfectly.
     *
     * theme/base.css sets the convention: a plain declaration of the same property immediately
     * above, which 103 keeps because it cannot parse the line after it. This asserts the pair is
     * actually there. Two had been missed in `ox_target`, on a panel drawn over live gameplay,
     * and nothing anywhere said so.
     *
     * Comments are already masked above, which is what makes this checkable at all: the fallback
     * line conventionally carries a trailing comment mentioning `color-mix()` by name, so an
     * unmasked scan flags every correct pair as broken.
     */
    const lines = source.split('\n');

    for (let i = 0; i < lines.length; i += 1) {
      if (!lines[i].includes('color-mix(')) continue;

      /*
       * The property is found wherever it sits on the line, not only at its start. The first
       * version of this anchored on `^\s*prop:` and so skipped `.x { background: color-mix(...) }`
       * written on one line -- it read as a continuation line and passed silently, which is the
       * worst thing a gate can do.
       */
      for (const decl of lines[i].matchAll(/([a-z-]+)\s*:[^;{}]*color-mix\(/g)) {
        const prop = decl[1];
        const guard = new RegExp(`${prop}\\s*:`);

        /* The fallback is the previous declaration of the SAME property with no color-mix() in
           it -- either earlier on this line, or on the line above. */
        const before = lines[i].slice(0, decl.index);
        const previous = i > 0 ? lines[i - 1] : '';

        const guarded =
          (guard.test(before) && !before.includes('color-mix(')) ||
          (guard.test(previous) && !previous.includes('color-mix('));

        if (!guarded) {
          colorMix.push({ file: path, line: i + 1, text: lines[i].trim().slice(0, 90) });
        }
      }
    }
  }
}

const missing = [...used].filter(([name]) => !declared.has(name));

if (inAttribute.length) {
  console.error('check-tokens: var() in a markup attribute, which CEF drops.');
  console.error('');

  for (const hit of inAttribute) {
    console.error(`  ${hit.file}:${hit.line}  ${hit.attribute}="${hit.value}"`);
  }

  console.error('');
  console.error(
    '  Move it into `style` — an inline style is an ordinary CSS declaration and works in every engine.',
  );
  console.error(
    '  As an attribute it renders correctly in the dev harness and falls back to the element default in game.',
  );
  console.error('');
  process.exit(1);
}

if (colorMix.length) {
  console.error(
    `check-tokens: ${colorMix.length} unguarded color-mix() declaration${colorMix.length === 1 ? '' : 's'}.`,
  );
  console.error('');

  for (const hit of colorMix) {
    console.error(`  ${hit.file}:${hit.line}  ${hit.text}`);
  }

  console.error('');
  console.error('  color-mix() is Chromium 111; the game runs CEF 103. An unknown function makes the');
  console.error('  whole declaration invalid, so this is not a wrong colour in game -- it is NO');
  console.error('  background / border / colour at all, and it looks perfect in `pnpm dev`.');
  console.error('');
  console.error('  Put a computed plain declaration of the same property immediately above it:');
  console.error('');
  console.error('      background: rgba(31, 55, 59, 1);');
  console.error('      background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface-2));');
  console.error('');
  console.error('  Compute it, do not eyeball it -- color-mix() composites with premultiplied alpha.');
  console.error('  See theme/base.css.');
  console.error('');
  process.exit(1);
}

/* --- The ratchets -------------------------------------------------------------------------
 *
 * Two counters, one file. Each may fall and may never rise; a build that removes a declaration
 * tightens its own baseline and says so, because a ratchet somebody has to remember to tighten
 * sits at its starting value forever.
 *
 * A counter with no recorded number records and passes rather than failing. That is what lets a
 * new counter be added to eighteen resources at once without breaking eighteen builds on the day
 * it lands -- the same argument the first one was written under.
 */

const RATCHETS = [
  {
    key: 'rawPixelSpacing',
    hits: spacing,
    what: 'raw-pixel spacing declaration',
    advice: [
      '  Use a --space-* token. The scale is in src/theme/tokens.css, and it is',
      "  expressed in --ui-px so the box answers the player's interface-size",
      '  preference the way the text inside it already does.',
      '',
      '  A hairline is --space-px and is exempt. If the value genuinely is not on the',
      '  scale, the scale is the thing to argue with -- see txData/ghst_sv/docs/ui-system.md.',
    ],
  },
  {
    key: 'rawPixelType',
    hits: type,
    what: 'raw-pixel font-size',
    advice: [
      '  Use a --text-* step: micro 9, meta 10, label 11, sm 13, base 15, subheading 16,',
      '  heading 22, display 30. They are expressed in --ui-px, which is the whole point --',
      '  a fixed size ignores the interface-size preference a player reached for because',
      '  they were struggling to read it.',
      '',
      '  A size in SVG user units is not a screen pixel and is a real exception; so is type',
      '  inside a box that is itself raw pixels, where moving one half and not the other is',
      '  worse than moving neither. Say so in a comment.',
    ],
  },
];

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
let record = false;

for (const ratchet of RATCHETS) {
  const was = baseline[ratchet.key];
  const now = ratchet.hits.length;

  if (was === undefined) {
    baseline[ratchet.key] = now;
    record = true;
    console.log(`check-tokens: recorded a baseline of ${now} ${ratchet.what}(s). It may now only fall.`);
    continue;
  }

  if (now > was) {
    const added = now - was;

    console.error(
      `check-tokens: ${added} new ${ratchet.what}${added === 1 ? '' : 's'} (${now}, baseline ${was}).`,
    );
    console.error('');

    for (const hit of ratchet.hits.slice(0, 20)) {
      console.error(`  ${hit.file}:${hit.line}  ${hit.text}`);
    }

    if (now > 20) console.error(`  ... and ${now - 20} more`);

    console.error('');

    for (const line of ratchet.advice) console.error(line);

    console.error('');
    process.exit(1);
  }

  if (now < was) {
    baseline[ratchet.key] = now;
    record = true;
    console.log(
      `check-tokens: ${was - now} ${ratchet.what}(s) gone; baseline tightened to ${now}. ` +
        'Commit tools/spacing-baseline.json.',
    );
  }
}

if (record) writeFileSync(BASELINE, `${JSON.stringify(baseline, null, 2)}\n`);

if (!missing.length) {
  console.log(
    `check-tokens: ${used.size} custom properties used, all declared, none in a markup attribute.` +
      (spacing.length ? ` ${spacing.length} raw-pixel spacing declaration(s) left.` : '') +
      (type.length ? ` ${type.length} raw-pixel font-size(s) left.` : ''),
  );
  process.exit(0);
}

for (const [name, where] of missing) {
  console.error(`  ${name}  used in  ${[...where].join(', ')}`);
}
console.error(
  `check-tokens: ${missing.length} custom propert${missing.length === 1 ? 'y is' : 'ies are'} used but never declared. ` +
    'A var() that resolves to nothing falls back to the property\'s initial value, silently.',
);
process.exit(1);
