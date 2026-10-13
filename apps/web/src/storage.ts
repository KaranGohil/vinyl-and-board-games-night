// Per-event secrets live in this browser only. Wrapped in try/catch because
// storage can be unavailable (private mode, blocked site data).

const key = (eventId: string, kind: "host" | "participant") => `vbgn:${eventId}:${kind}`;

export function getToken(eventId: string, kind: "host" | "participant"): string | null {
  try {
    return localStorage.getItem(key(eventId, kind));
  } catch {
    return null;
  }
}

export function setToken(eventId: string, kind: "host" | "participant", token: string): void {
  try {
    localStorage.setItem(key(eventId, kind), token);
  } catch {
    /* ignore: the session just won't persist */
  }
}

export function clearToken(eventId: string, kind: "host" | "participant"): void {
  try {
    localStorage.removeItem(key(eventId, kind));
  } catch {
    /* ignore */
  }
}
