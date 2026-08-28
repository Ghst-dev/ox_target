/**
 * `lucide` ships no TypeScript declarations — no .d.ts anywhere in the package, and no
 * `types` field in its package.json — so every import from it is implicitly `any` and
 * svelte-check fails on it.
 *
 * One wildcard declaration types all of them. It is written against the per-icon module
 * paths rather than the `lucide` barrel because a barrel declaration would have to name
 * every export individually: TypeScript has no way to give a module an index signature over
 * its named exports, so `export const Car: IconNode` would need repeating ~90 times and
 * would drift out of step with lib/icons.ts.
 *
 * The cost is a dependency on lucide's internal layout (`dist/esm/icons/<name>.mjs`). The
 * package has no `exports` map, so deep imports are permitted, and `sideEffects: false`
 * means they tree-shake identically to barrel imports. If a lucide upgrade moves these
 * files, this declaration and the imports in lib/icons.ts are what need updating.
 */
declare module 'lucide/dist/esm/icons/*.mjs' {
  const icon: [tag: string, attrs: Record<string, string | number>][];
  export default icon;
}
