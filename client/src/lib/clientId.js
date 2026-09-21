const KEY = 'reelhunt.clientId';
let memoryId = null;

/** RFC 4122 v4 UUID. crypto.randomUUID only exists on https/localhost, so we fall back. */
function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Anonymous identity for this browser. The wishlist lives on the server,
 * keyed by this id, so it survives closing the tab/browser.
 * If localStorage is blocked (some private modes) we still work for the session.
 */
export function getClientId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    memoryId ??= uuid();
    return memoryId;
  }
}
