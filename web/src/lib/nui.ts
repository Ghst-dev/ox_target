/**
 * NUI bridge.
 *
 * ox_target's envelope is **flat**: `{ event: 'setTarget', options, zones }`, with the
 * payload as sibling keys. That differs from ox_lib's `{ action, data }` and from
 * ghst_template's `{ type, payload }` — three resources, three shapes. Every event name
 * here has to match `client/main.lua` exactly.
 */

const realFetch = window.fetch;

/** True when running in a normal browser rather than the game's CEF instance. */
export const isEnvBrowser = (): boolean => !(window as any).invokeNative;

const resourceName = (): string =>
  (window as any).GetParentResourceName?.() ?? 'ox_target';

/**
 * POST to a `RegisterNUICallback` endpoint.
 *
 * Short-circuits outside CEF so the dev harness does not spew DNS failures — the only
 * callback ox_target has is `select`, which returns nothing meaningful.
 */
export async function fetchNui<T = any>(eventName: string, data?: unknown): Promise<T> {
  if (isEnvBrowser()) {
    console.debug(`[nui] fetchNui("${eventName}")`, data);
    return undefined as T;
  }

  const resp = await realFetch(`https://${resourceName()}/${eventName}`, {
    method: 'post',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(data),
  });

  return resp.json();
}

/** Subscribe to an inbound event. Returns an unsubscribe function. */
export function onNuiEvent<T = any>(event: string, handler: (data: T) => void): () => void {
  const listener = (message: MessageEvent) => {
    if (message.data?.event === event) handler(message.data);
  };

  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}

/** Fire an inbound message at ourselves. No-ops in game and in production builds. */
export function debugData(messages: Record<string, unknown>[], delay = 0): void {
  if (!import.meta.env.DEV || !isEnvBrowser()) return;

  for (const message of messages) {
    setTimeout(() => {
      window.dispatchEvent(new MessageEvent('message', { data: message }));
    }, delay);
  }
}
