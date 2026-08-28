/*
 * Fails the build if the dev harness reached `build`.
 *
 * DevPanel.svelte fires the same `window.postMessage` payloads Lua sends, so a developer can
 * drive the option list from a browser. It is reached through a dynamic import behind
 * `import.meta.env.DEV`, which Vite replaces with a literal `false` for production, so Rollup
 * drops the branch and everything only it reaches.
 *
 * That is easy to break by accident. One static `import DevPanel from './features/DevPanel'`
 * would not be dropped, and would ship the drawer and its invented payloads to every player.
 *
 * Until now the guarantee here was a grep written in a comment in App.svelte, run by hand and
 * therefore run never. `ghst_garage` and `ghst_hud` both automate exactly this; ox_target is
 * the same risk with none of the protection, which is what this closes.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = 'build/assets';

const MARKERS = [
  // A constant that exists only to be found. Pointed at prose ("Developer drawer") this check
  // could be disarmed by rewording a heading, and a disarmed check reads like a passing one.
  { needle: 'ox-target-dev-panel', from: 'src/features/DevPanel.svelte (DEV_MARKER)' },
  // And one piece of sample data, so a marker deleted by hand still leaves a tripwire. This
  // is the overflow-test label: long, German, and with no reason to exist anywhere else.
  { needle: 'Fahrzeuginteraktionen', from: 'src/features/DevPanel.svelte' },
];

let files;

try {
  files = await readdir(DIST);
} catch {
  console.error(`check-devpanel: no ${DIST} to check. Run the build first.`);
  process.exit(1);
}

const bundles = files.filter((name) => name.endsWith('.js') || name.endsWith('.css'));

if (bundles.length === 0) {
  console.error(`check-devpanel: ${DIST} has no .js or .css in it.`);
  process.exit(1);
}

const leaks = [];

for (const name of bundles) {
  const text = await readFile(join(DIST, name), 'utf8');

  for (const { needle, from } of MARKERS) {
    if (text.includes(needle)) {
      leaks.push(`  ${name} contains ${JSON.stringify(needle)} (from ${from})`);
    }
  }
}

if (leaks.length > 0) {
  console.error('check-devpanel: the dev harness shipped in the production bundle.\n');
  console.error(leaks.join('\n'));
  console.error(
    '\nThe usual cause is a static import of ./features/DevPanel.svelte.' +
      '\nIt must be reached only through the dynamic import behind `import.meta.env.DEV`.',
  );
  process.exit(1);
}

console.log(`check-devpanel: ${bundles.length} bundle(s) clean, ${MARKERS.length} markers checked`);
