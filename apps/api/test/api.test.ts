import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createDb, type Db } from "../src/db.js";
import { migrate } from "../src/migrate.js";

/**
 * End-to-end API tests against a real Postgres.
 * Set TEST_DATABASE_URL to run them, e.g.
 *   TEST_DATABASE_URL=postgres://vbgn:vbgn@localhost:5432/vbgn_test npm test
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("API", () => {
  let db: Db;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    db = createDb(url!);
    await db.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await migrate(db, () => {});
    app = await buildApp({
      db,
      logger: false,
      config: { databaseUrl: url!, port: 0, host: "127.0.0.1", publicUrl: "http://test.local", corsOrigins: [] },
    });
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it("runs a whole game night: create, join, vote, lock, calendar", async () => {
    // Host creates the event with two possible nights.
    const created = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: {
        title: "Friday games",
        location: "Karan's place",
        slots: [
          { startsAt: "2026-10-17T02:00:00Z", endsAt: "2026-10-17T06:00:00Z" },
          { startsAt: "2026-10-24T02:00:00Z", endsAt: "2026-10-24T06:00:00Z" },
        ],
      },
    });
    expect(created.statusCode).toBe(201);
    const { id, hostToken, hostUrl } = created.json();
    expect(hostUrl).toBe(`http://test.local/e/${id}?host=${hostToken}`);

    // Two friends join.
    const karan = (await app.inject({ method: "POST", url: `/api/events/${id}/participants`, payload: { name: "Karan" } })).json();
    const aisha = (await app.inject({ method: "POST", url: `/api/events/${id}/participants`, payload: { name: "Aisha" } })).json();
    const dup = await app.inject({ method: "POST", url: `/api/events/${id}/participants`, payload: { name: "Karan" } });
    expect(dup.statusCode).toBe(409);

    const asKaran = { "x-participant-token": karan.token };
    const asAisha = { "x-participant-token": aisha.token };

    // Each adds something; adding counts as a vote.
    let view = (
      await app.inject({ method: "POST", url: `/api/events/${id}/items`, headers: asKaran, payload: { kind: "game", title: "Wingspan", subtitle: "1–5 players" } })
    ).json();
    view = (
      await app.inject({ method: "POST", url: `/api/events/${id}/items`, headers: asAisha, payload: { kind: "vinyl", title: "Rumours", subtitle: "Fleetwood Mac" } })
    ).json();
    expect(view.games[0]).toMatchObject({ title: "Wingspan", votes: 1, addedBy: "Karan", addedByMe: false });
    expect(view.vinyls[0]).toMatchObject({ title: "Rumours", votes: 1, addedByMe: true });

    // Aisha votes for Wingspan too, and both pick nights.
    const wingspan = view.games[0].id;
    const rumours = view.vinyls[0].id;
    await app.inject({ method: "PUT", url: `/api/events/${id}/votes`, headers: asAisha, payload: { itemIds: [wingspan, rumours] } });
    const secondNight = view.slots[1].id;
    await app.inject({ method: "PUT", url: `/api/events/${id}/availability`, headers: asKaran, payload: { slotIds: [secondNight] } });
    view = (
      await app.inject({ method: "PUT", url: `/api/events/${id}/availability`, headers: asAisha, payload: { slotIds: view.slots.map((s: { id: string }) => s.id) } })
    ).json();

    expect(view.games[0]).toMatchObject({ votes: 2, voters: ["Aisha", "Karan"] });
    expect(view.bestSlotId).toBe(secondNight);
    expect(view.me).toMatchObject({ name: "Aisha" });
    expect(view.me.slotIds).toHaveLength(2);

    // Not joined → can't vote.
    const anon = await app.inject({ method: "PUT", url: `/api/events/${id}/votes`, payload: { itemIds: [] } });
    expect(anon.statusCode).toBe(401);

    // Only the host can lock, and no calendar until then.
    expect((await app.inject({ method: "GET", url: `/api/events/${id}/calendar.ics` })).statusCode).toBe(409);
    const notHost = await app.inject({ method: "POST", url: `/api/events/${id}/lock`, headers: asKaran, payload: { slotId: secondNight } });
    expect(notHost.statusCode).toBe(403);
    const locked = await app.inject({ method: "POST", url: `/api/events/${id}/lock`, headers: { "x-host-token": hostToken }, payload: { slotId: secondNight } });
    expect(locked.json()).toMatchObject({ lockedSlotId: secondNight, isHost: true });
    expect(locked.json().calendar.googleUrl).toContain("calendar.google.com");

    const ics = await app.inject({ method: "GET", url: `/api/events/${id}/calendar.ics` });
    expect(ics.statusCode).toBe(200);
    expect(ics.headers["content-type"]).toContain("text/calendar");
    expect(ics.body).toContain("DTSTART:20261024T020000Z");
    expect(ics.body).toContain("Games: Wingspan");
    expect(ics.body).toContain("Records: Rumours");

    // Tokens never leak in the public view.
    const publicView = await app.inject({ method: "GET", url: `/api/events/${id}` });
    expect(publicView.body).not.toContain(hostToken);
    expect(publicView.body).not.toContain(karan.token);
  });

  it("only lets the adder or host remove an item", async () => {
    const { id, hostToken } = (
      await app.inject({
        method: "POST",
        url: "/api/events",
        payload: { title: "x", slots: [{ startsAt: "2026-11-01T02:00:00Z", endsAt: "2026-11-01T05:00:00Z" }] },
      })
    ).json();
    const a = (await app.inject({ method: "POST", url: `/api/events/${id}/participants`, payload: { name: "A" } })).json();
    const b = (await app.inject({ method: "POST", url: `/api/events/${id}/participants`, payload: { name: "B" } })).json();
    const view = (
      await app.inject({ method: "POST", url: `/api/events/${id}/items`, headers: { "x-participant-token": a.token }, payload: { kind: "game", title: "Catan" } })
    ).json();
    const itemId = view.games[0].id;

    const byB = await app.inject({ method: "DELETE", url: `/api/events/${id}/items/${itemId}`, headers: { "x-participant-token": b.token } });
    expect(byB.statusCode).toBe(403);
    const byHost = await app.inject({ method: "DELETE", url: `/api/events/${id}/items/${itemId}`, headers: { "x-host-token": hostToken } });
    expect(byHost.json().games).toHaveLength(0);
  });

  it("validates input", async () => {
    const noSlots = await app.inject({ method: "POST", url: "/api/events", payload: { title: "x", slots: [] } });
    expect(noSlots.statusCode).toBe(400);
    const backwards = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: { title: "x", slots: [{ startsAt: "2026-11-01T05:00:00Z", endsAt: "2026-11-01T02:00:00Z" }] },
    });
    expect(backwards.statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: "/api/events/not-a-uuid" })).statusCode).toBe(404);
  });
});
