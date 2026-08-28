import { resolveIcon, type IconNode } from './icons';

/**
 * ox_target's icon API is a **FontAwesome class string**, not a name: consumers write
 * `icon = 'fa-solid fa-car'` and the original UI dropped it straight into `<i class="...">`.
 * That is why the stock index.html pulled FontAwesome's stylesheet off a CDN — which fails
 * outright in CEF with no internet, rendering every icon as an empty box.
 *
 * The class string is still the contract. What changed underneath is what it resolves to:
 * lib/icons.ts parses the string and returns Lucide geometry, so no icon font, no CDN and
 * no FontAwesome packs are involved.
 *
 * `parseIconClass` and its STYLE_TO_PREFIX / MODIFIERS tables are gone — normaliseIconName
 * in lib/icons.ts does the same job, including dropping modifier classes like `fa-2x`, and
 * is shared with ox_lib rather than duplicated with slightly different rules.
 */

export type { IconNode };

/** Drawable geometry for a class string, or null if the icon is unknown. */
export function iconNodes(value?: string): IconNode | null {
  return value ? resolveIcon(value) : null;
}
