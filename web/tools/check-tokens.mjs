/**
 * Fails on a `var(--x)` with no fallback that nothing in src declares, and on any `var()` in a
 * markup attribute. Declarations are a CSS rule, an inline style, or Svelte's `style:--x`
 * directive; `var(--x, 1)` is a contract with an ancestor and is deliberately allowed.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src';

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

/**
 * `var()` in a markup attribute, which CEF silently drops. `style` and `style:--x` are exempt
 * because they are the CSS path, and only markup is scanned -- a `<style>` block is fine.
 */
const inAttribute = [];

for (const file of files) {
  const source = readFileSync(file, 'utf8');

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

if (!missing.length) {
  console.log(
    `check-tokens: ${used.size} custom properties used, all declared, none in a markup attribute.`,
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
