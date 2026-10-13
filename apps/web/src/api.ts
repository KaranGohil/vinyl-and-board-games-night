import { getToken } from "./storage";
import type { EventView, ItemKind } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(eventId: string | null, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  if (eventId) {
    const participant = getToken(eventId, "participant");
    const host = getToken(eventId, "host");
    if (participant) headers.set("x-participant-token", participant);
    if (host) headers.set("x-host-token", host);
  }
  const res = await fetch(path, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  createEvent: (body: {
    title: string;
    description: string;
    location: string;
    slots: { startsAt: string; endsAt: string }[];
  }) =>
    request<{ id: string; hostToken: string; url: string; hostUrl: string }>(null, "/api/events", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getEvent: (id: string) => request<EventView>(id, `/api/events/${id}`),

  join: (id: string, name: string) =>
    request<{ id: string; name: string; token: string }>(id, `/api/events/${id}/participants`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  setAvailability: (id: string, slotIds: string[]) =>
    request<EventView>(id, `/api/events/${id}/availability`, {
      method: "PUT",
      body: JSON.stringify({ slotIds }),
    }),

  setVotes: (id: string, itemIds: string[]) =>
    request<EventView>(id, `/api/events/${id}/votes`, {
      method: "PUT",
      body: JSON.stringify({ itemIds }),
    }),

  addItem: (id: string, item: { kind: ItemKind; title: string; subtitle: string; url: string }) =>
    request<EventView>(id, `/api/events/${id}/items`, { method: "POST", body: JSON.stringify(item) }),

  removeItem: (id: string, itemId: string) =>
    request<EventView>(id, `/api/events/${id}/items/${itemId}`, { method: "DELETE" }),

  lock: (id: string, slotId: string | null) =>
    request<EventView>(id, `/api/events/${id}/lock`, { method: "POST", body: JSON.stringify({ slotId }) }),
};
