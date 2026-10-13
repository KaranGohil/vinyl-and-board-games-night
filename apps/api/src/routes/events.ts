import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { withTx, type Db } from "../db.js";
import type { Config } from "../config.js";
import { buildIcs, googleCalendarUrl, type CalendarEvent } from "../lib/calendar.js";
import { rankByVotes } from "../lib/tally.js";
import { newToken, tokensMatch } from "../lib/tokens.js";

const HOST_HEADER = "x-host-token";
const PARTICIPANT_HEADER = "x-participant-token";

const uuid = z.string().uuid();
const isoDate = z.string().datetime({ offset: true });

const createEventBody = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).default(""),
  location: z.string().trim().max(200).default(""),
  slots: z
    .array(z.object({ startsAt: isoDate, endsAt: isoDate }))
    .min(1, "Add at least one possible night")
    .max(30),
});

const joinBody = z.object({ name: z.string().trim().min(1).max(40) });
const availabilityBody = z.object({ slotIds: z.array(uuid).max(30) });
const itemBody = z.object({
  kind: z.enum(["game", "vinyl"]),
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().max(120).default(""),
  url: z
    .string()
    .trim()
    .max(500)
    .default("")
    .refine((v) => v === "" || /^https?:\/\//i.test(v), "Link must start with http:// or https://"),
});
const votesBody = z.object({ itemIds: z.array(uuid).max(200) });
const lockBody = z.object({ slotId: uuid.nullable() });

// `type` (not `interface`) so rows satisfy pg's QueryResultRow index signature.
type EventRow = {
  id: string;
  title: string;
  description: string;
  location: string;
  host_token: string;
  locked_slot_id: string | null;
  created_at: Date;
};

type ParticipantRow = {
  id: string;
  name: string;
  token: string;
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function header(req: FastifyRequest, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

export async function eventRoutes(app: FastifyInstance, opts: { db: Db; config: Config }) {
  const { db, config } = opts;

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: err.issues.map((i) => i.message).join("; ") });
    }
    if (err instanceof HttpError) {
      return reply.status(err.status).send({ error: err.message });
    }
    app.log.error(err);
    return reply.status(500).send({ error: "Something went wrong" });
  });

  async function loadEvent(id: string): Promise<EventRow> {
    if (!uuid.safeParse(id).success) throw new HttpError(404, "Event not found");
    const { rows } = await db.query<EventRow>("SELECT * FROM events WHERE id = $1", [id]);
    if (!rows[0]) throw new HttpError(404, "Event not found");
    return rows[0];
  }

  async function currentParticipant(req: FastifyRequest, eventId: string): Promise<ParticipantRow | null> {
    const token = header(req, PARTICIPANT_HEADER);
    if (!token) return null;
    const { rows } = await db.query<ParticipantRow>(
      "SELECT id, name, token FROM participants WHERE event_id = $1 AND token = $2",
      [eventId, token],
    );
    return rows[0] ?? null;
  }

  async function requireParticipant(req: FastifyRequest, eventId: string): Promise<ParticipantRow> {
    const p = await currentParticipant(req, eventId);
    if (!p) throw new HttpError(401, "Join the event first");
    return p;
  }

  function requireHost(req: FastifyRequest, event: EventRow) {
    if (!tokensMatch(event.host_token, header(req, HOST_HEADER))) {
      throw new HttpError(403, "Only the host can do that");
    }
  }

  function eventUrl(id: string) {
    return `${config.publicUrl}/e/${id}`;
  }

  async function lockedCalendarEvent(event: EventRow): Promise<CalendarEvent | null> {
    if (!event.locked_slot_id) return null;
    const { rows } = await db.query<{ starts_at: Date; ends_at: Date }>(
      "SELECT starts_at, ends_at FROM time_slots WHERE id = $1",
      [event.locked_slot_id],
    );
    if (!rows[0]) return null;

    const picks = await db.query<{ kind: string; title: string }>(
      `SELECT i.kind, i.title, COUNT(v.item_id) AS votes
         FROM items i LEFT JOIN item_votes v ON v.item_id = i.id
        WHERE i.event_id = $1
        GROUP BY i.id
        ORDER BY votes DESC, i.created_at ASC`,
      [event.id],
    );
    const top = (kind: string) =>
      picks.rows.filter((r) => r.kind === kind).slice(0, 3).map((r) => r.title).join(", ");
    const extras = [
      top("game") && `Games: ${top("game")}`,
      top("vinyl") && `Records: ${top("vinyl")}`,
    ].filter(Boolean);

    return {
      uid: event.id,
      title: event.title,
      description: [event.description, ...extras].filter(Boolean).join("\n"),
      location: event.location,
      start: rows[0].starts_at,
      end: rows[0].ends_at,
      url: eventUrl(event.id),
    };
  }

  async function eventView(req: FastifyRequest, event: EventRow) {
    const [participants, slots, availability, items, votes] = await Promise.all([
      db.query<{ id: string; name: string }>(
        "SELECT id, name FROM participants WHERE event_id = $1 ORDER BY created_at",
        [event.id],
      ),
      db.query<{ id: string; starts_at: Date; ends_at: Date }>(
        "SELECT id, starts_at, ends_at FROM time_slots WHERE event_id = $1 ORDER BY starts_at",
        [event.id],
      ),
      db.query<{ slot_id: string; participant_id: string }>(
        `SELECT a.slot_id, a.participant_id FROM availability a
           JOIN time_slots s ON s.id = a.slot_id WHERE s.event_id = $1`,
        [event.id],
      ),
      db.query<{
        id: string;
        kind: "game" | "vinyl";
        title: string;
        subtitle: string;
        url: string;
        added_by: string | null;
      }>(
        "SELECT id, kind, title, subtitle, url, added_by FROM items WHERE event_id = $1 ORDER BY created_at",
        [event.id],
      ),
      db.query<{ item_id: string; participant_id: string }>(
        `SELECT v.item_id, v.participant_id FROM item_votes v
           JOIN items i ON i.id = v.item_id WHERE i.event_id = $1`,
        [event.id],
      ),
    ]);

    const people = participants.rows;
    const nameById = new Map(people.map((p) => [p.id, p.name]));
    const me = await currentParticipant(req, event.id);

    const rankedSlots = rankByVotes(
      slots.rows,
      availability.rows.map((a) => ({ itemId: a.slot_id, participantId: a.participant_id })),
      people,
    );
    const slotTally = new Map(rankedSlots.map((r) => [r.item.id, r]));
    const bestSlot = rankedSlots[0] && rankedSlots[0].count > 0 ? rankedSlots[0].item.id : null;

    const itemVotes = votes.rows.map((v) => ({ itemId: v.item_id, participantId: v.participant_id }));
    const rankedItems = (kind: "game" | "vinyl") =>
      rankByVotes(
        items.rows.filter((i) => i.kind === kind),
        itemVotes,
        people,
      ).map(({ item, count, voters }) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        url: item.url,
        addedBy: item.added_by ? nameById.get(item.added_by) ?? null : null,
        addedByMe: !!me && item.added_by === me.id,
        votes: count,
        voters,
      }));

    const calendar = await lockedCalendarEvent(event);

    return {
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      createdAt: event.created_at,
      lockedSlotId: event.locked_slot_id,
      bestSlotId: bestSlot,
      slots: slots.rows.map((s) => ({
        id: s.id,
        startsAt: s.starts_at,
        endsAt: s.ends_at,
        count: slotTally.get(s.id)?.count ?? 0,
        voters: slotTally.get(s.id)?.voters ?? [],
      })),
      games: rankedItems("game"),
      vinyls: rankedItems("vinyl"),
      participants: people.map((p) => ({ id: p.id, name: p.name })),
      me: me
        ? {
            id: me.id,
            name: me.name,
            slotIds: availability.rows.filter((a) => a.participant_id === me.id).map((a) => a.slot_id),
            itemIds: votes.rows.filter((v) => v.participant_id === me.id).map((v) => v.item_id),
          }
        : null,
      isHost: tokensMatch(event.host_token, header(req, HOST_HEADER)),
      calendar: calendar
        ? { icsUrl: `/api/events/${event.id}/calendar.ics`, googleUrl: googleCalendarUrl(calendar) }
        : null,
    };
  }

  // Create an event with its candidate nights.
  app.post("/api/events", async (req, reply) => {
    const body = createEventBody.parse(req.body);
    for (const s of body.slots) {
      if (new Date(s.endsAt) <= new Date(s.startsAt)) {
        throw new HttpError(400, "Each night must end after it starts");
      }
    }
    const id = randomUUID();
    const hostToken = newToken();
    await withTx(db, async (tx) => {
      await tx.query(
        "INSERT INTO events (id, title, description, location, host_token) VALUES ($1, $2, $3, $4, $5)",
        [id, body.title, body.description, body.location, hostToken],
      );
      for (const s of body.slots) {
        await tx.query("INSERT INTO time_slots (id, event_id, starts_at, ends_at) VALUES ($1, $2, $3, $4)", [
          randomUUID(),
          id,
          s.startsAt,
          s.endsAt,
        ]);
      }
    });
    reply.status(201);
    return { id, hostToken, url: eventUrl(id), hostUrl: `${eventUrl(id)}?host=${hostToken}` };
  });

  app.get<{ Params: { id: string } }>("/api/events/:id", async (req) => {
    const event = await loadEvent(req.params.id);
    return eventView(req, event);
  });

  // Join with a display name; returns a secret the browser keeps for this event.
  app.post<{ Params: { id: string } }>("/api/events/:id/participants", async (req, reply) => {
    const event = await loadEvent(req.params.id);
    const { name } = joinBody.parse(req.body);
    const id = randomUUID();
    const token = newToken();
    try {
      await db.query("INSERT INTO participants (id, event_id, name, token) VALUES ($1, $2, $3, $4)", [
        id,
        event.id,
        name,
        token,
      ]);
    } catch (err) {
      if ((err as { code?: string }).code === "23505") {
        throw new HttpError(409, `Someone already joined as "${name}". Pick another name.`);
      }
      throw err;
    }
    reply.status(201);
    return { id, name, token };
  });

  // Replace my available nights.
  app.put<{ Params: { id: string } }>("/api/events/:id/availability", async (req) => {
    const event = await loadEvent(req.params.id);
    const me = await requireParticipant(req, event.id);
    const { slotIds } = availabilityBody.parse(req.body);
    await withTx(db, async (tx) => {
      await tx.query("DELETE FROM availability WHERE participant_id = $1", [me.id]);
      if (slotIds.length) {
        await tx.query(
          `INSERT INTO availability (participant_id, slot_id)
           SELECT $1, s.id FROM time_slots s WHERE s.event_id = $2 AND s.id = ANY($3::uuid[])`,
          [me.id, event.id, slotIds],
        );
      }
    });
    return eventView(req, event);
  });

  // Add a board game or vinyl to the pool.
  app.post<{ Params: { id: string } }>("/api/events/:id/items", async (req, reply) => {
    const event = await loadEvent(req.params.id);
    const me = await requireParticipant(req, event.id);
    const body = itemBody.parse(req.body);
    const itemId = randomUUID();
    await withTx(db, async (tx) => {
      await tx.query(
        "INSERT INTO items (id, event_id, kind, title, subtitle, url, added_by) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [itemId, event.id, body.kind, body.title, body.subtitle, body.url, me.id],
      );
      // Bringing something counts as wanting it.
      await tx.query("INSERT INTO item_votes (participant_id, item_id) VALUES ($1, $2)", [me.id, itemId]);
    });
    reply.status(201);
    return eventView(req, event);
  });

  // Remove an item: whoever added it, or the host.
  app.delete<{ Params: { id: string; itemId: string } }>("/api/events/:id/items/:itemId", async (req, reply) => {
    const event = await loadEvent(req.params.id);
    const isHost = tokensMatch(event.host_token, header(req, HOST_HEADER));
    const me = await currentParticipant(req, event.id);
    const { rows } = await db.query<{ added_by: string | null }>(
      "SELECT added_by FROM items WHERE id = $1 AND event_id = $2",
      [uuid.parse(req.params.itemId), event.id],
    );
    if (!rows[0]) throw new HttpError(404, "Item not found");
    if (!isHost && (!me || rows[0].added_by !== me.id)) {
      throw new HttpError(403, "Only the person who added it, or the host, can remove it");
    }
    await db.query("DELETE FROM items WHERE id = $1", [req.params.itemId]);
    reply.status(200);
    return eventView(req, event);
  });

  // Replace my votes for games and vinyls.
  app.put<{ Params: { id: string } }>("/api/events/:id/votes", async (req) => {
    const event = await loadEvent(req.params.id);
    const me = await requireParticipant(req, event.id);
    const { itemIds } = votesBody.parse(req.body);
    await withTx(db, async (tx) => {
      await tx.query("DELETE FROM item_votes WHERE participant_id = $1", [me.id]);
      if (itemIds.length) {
        await tx.query(
          `INSERT INTO item_votes (participant_id, item_id)
           SELECT $1, i.id FROM items i WHERE i.event_id = $2 AND i.id = ANY($3::uuid[])`,
          [me.id, event.id, itemIds],
        );
      }
    });
    return eventView(req, event);
  });

  // Host locks in the night (or unlocks with slotId: null).
  app.post<{ Params: { id: string } }>("/api/events/:id/lock", async (req) => {
    const event = await loadEvent(req.params.id);
    requireHost(req, event);
    const { slotId } = lockBody.parse(req.body);
    if (slotId) {
      const { rowCount } = await db.query("SELECT 1 FROM time_slots WHERE id = $1 AND event_id = $2", [
        slotId,
        event.id,
      ]);
      if (!rowCount) throw new HttpError(400, "That night isn't part of this event");
    }
    await db.query("UPDATE events SET locked_slot_id = $1 WHERE id = $2", [slotId, event.id]);
    return eventView(req, await loadEvent(event.id));
  });

  // Calendar file for the locked-in night.
  app.get<{ Params: { id: string } }>("/api/events/:id/calendar.ics", async (req, reply) => {
    const event = await loadEvent(req.params.id);
    const calendar = await lockedCalendarEvent(event);
    if (!calendar) throw new HttpError(409, "The host hasn't picked a night yet");
    reply
      .header("content-type", "text/calendar; charset=utf-8")
      .header("content-disposition", `attachment; filename="game-night.ics"`);
    return buildIcs(calendar);
  });
}
