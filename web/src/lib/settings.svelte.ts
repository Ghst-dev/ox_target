import { fetchNui, onNuiEvent } from './nui';

/**
 * Locale strings and server config, fetched once on mount.
 *
 * ox_target ships locales/*.json but never had a channel to the NUI, because upstream's
 * page had no strings of its own. The rebuilt UI does, so client/main.lua answers an
 * `init` callback with them — the same handshake ox_lib uses.
 *
 * The defaults below are English on purpose: if the handshake ever fails, the UI reads as
 * English rather than rendering blank labels.
 */
export const settings = $state({
  /** ox_target:showRestricted — see client/main.lua. */
  showRestricted: false,
  /**
   * ox_target:holdToConfirm, in ms. 0 keeps the single click, which is the default.
   *
   * The page owns the timing rather than Lua, because the fill the player watches and the
   * moment the action fires have to be the same clock — running the bar here and the timer
   * there means the bar completes and nothing happens, or the reverse.
   */
  holdToConfirm: 0,
  locale: {
    go_back: 'Go back',
    requires: 'Requires',
    restricted_to: 'Restricted to',
    too_far: 'Too far',
    group_general: 'General',
    group_type: 'This type',
    group_model: 'This model',
    group_entity: 'This entity',
    group_zone: 'Zone',
  },
});

export type Locale = typeof settings.locale;

export function initSettings(): () => void {
  const off = onNuiEvent<{
    showRestricted?: boolean;
    holdToConfirm?: number;
    locale?: Partial<Locale>;
  }>('init', (data) => {
    if (typeof data.showRestricted === 'boolean') settings.showRestricted = data.showRestricted;
    if (typeof data.holdToConfirm === 'number') settings.holdToConfirm = data.holdToConfirm;
    if (data.locale) Object.assign(settings.locale, data.locale);
  });

  fetchNui('init');

  return off;
}
