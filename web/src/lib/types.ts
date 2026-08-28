import type { Locale } from './settings.svelte';

/** A requirement table from Lua: 'lockpick', ['a','b'], or { lockpick = 2 }. */
export type Requirement = string | string[] | Record<string, number>;

/** Why shouldHide() rejected an option — see client/main.lua. */
export type HideReason =
  | 'menu'
  | 'distance'
  | 'groups'
  | 'items'
  | 'bone'
  | 'offset'
  | 'canInteract';

export interface TargetOption {
  label: string;
  /** FontAwesome class string, e.g. 'fa-solid fa-car'. */
  icon?: string;
  iconColor?: string;
  /**
   * Set by shouldHide(). The option is still *sent* — upstream's UI simply dropped it,
   * so everything you cannot currently do was already in the payload, unused.
   */
  hide?: boolean;
  hideReason?: HideReason;
  groups?: Requirement;
  items?: Requirement;
  name?: string;
  /** The option's configured max range, not the live distance to the target. */
  distance?: number;
  openMenu?: string;
  menuName?: string;
  bones?: string | string[];
}

export interface SetTargetMessage {
  event: 'setTarget';
  options?: Record<string, TargetOption[]>;
  zones?: TargetOption[][];
}

/**
 * Buckets in the order they should read: broadest first, narrowing to this exact entity.
 *
 * Order matters because client/main.lua encodes with `sort_keys = true`, so the payload
 * arrives alphabetically — which puts 'entity' above 'global' and makes the list read
 * backwards.
 */
export const GROUP_ORDER = ['__global', 'global', 'model', 'entity', 'localEntity'];

export function groupLabel(key: string, locale: Locale): string {
  switch (key) {
    case '__global':
      return locale.group_general;
    case 'global':
      return locale.group_type;
    case 'model':
      return locale.group_model;
    case 'entity':
    case 'localEntity':
      return locale.group_entity;
    case 'zones':
      return locale.group_zone;
    default:
      return key;
  }
}

/** Flatten a requirement into readable names. */
export function requirementNames(value?: Requirement): string[] {
  if (!value) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.map(String);
  return Object.keys(value);
}

/**
 * Why an option cannot be used, or null to keep it hidden.
 *
 * Only reasons that can be stated usefully are surfaced:
 *
 *   items       always — a missing item is a hint, not a secret
 *   groups      only when the server opts in, since "Restricted to police" can be a
 *               design leak (ox_target:showRestricted)
 *   distance    always — "Too far" is actionable, you can walk closer
 *   menu        never — structural, it belongs to a different submenu
 *   bone/offset never — you are aimed at a different part of the entity, and listing
 *               every door while looking at the bonnet is noise
 *   canInteract never — arbitrary server logic with no message to show
 *
 * Falls back to inferring from groups/items when `hideReason` is absent, so the UI still
 * behaves against an ox_target whose Lua has not been patched.
 */
export function blockedReason(
  option: TargetOption,
  locale: Locale,
  showRestricted: boolean,
): string | null {
  if (!option.hide) return null;

  const items = requirementNames(option.items);
  const groups = requirementNames(option.groups);

  switch (option.hideReason) {
    case 'items':
      return items.length ? `${locale.requires} ${items.join(', ')}` : null;
    case 'groups':
      return showRestricted && groups.length ? `${locale.restricted_to} ${groups.join(', ')}` : null;
    case 'distance':
      return locale.too_far;
    case 'menu':
    case 'bone':
    case 'offset':
    case 'canInteract':
      return null;
    default:
      // Unpatched Lua: no reason code, so infer one from the gating data.
      if (items.length) return `${locale.requires} ${items.join(', ')}`;
      if (showRestricted && groups.length) return `${locale.restricted_to} ${groups.join(', ')}`;
      return null;
  }
}
