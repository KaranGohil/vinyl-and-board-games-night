import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api";
import { ItemPool } from "../components/ItemPool";
import { Nights } from "../components/Nights";
import { formatSlot } from "../format";
import { getToken, setToken } from "../storage";
import type { EventView, ItemKind } from "../types";

export function EventPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const [event, setEvent] = useState<EventView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const justCreated = params.get("created") === "1";

  // A host link carries ?host=<secret>. Save it for this browser, then tidy the URL.
  useEffect(() => {
    const host = params.get("host");
    if (host) {
      setToken(id, "host", host);
      params.delete("host");
      setParams(params, { replace: true });
    }
  }, [id, params, setParams]);

  const load = useCallback(async () => {
    try {
      setEvent(await api.getEvent(id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else setError((err as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
    // Light polling so votes from friends show up without a refresh.
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const mySlots = useMemo(() => new Set(event?.me?.slotIds ?? []), [event]);
  const myVotes = useMemo(() => new Set(event?.me?.itemIds ?? []), [event]);

  async function run(action: () => Promise<EventView>) {
    setError(null);
    try {
      setEvent(await action());
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const p = await api.join(id, name.trim());
      setToken(id, "participant", p.token);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function toggle(set: Set<string>, value: string): string[] {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return [...next];
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("Copy this link:", text);
    }
  }

  if (notFound) return <p className="muted">This event doesn't exist. Check the link with whoever invited you.</p>;
  if (!event) return <p className="muted">{error ?? "Loading…"}</p>;

  const shareUrl = `${window.location.origin}/e/${event.id}`;
  const hostToken = getToken(event.id, "host");
  const lockedSlot = event.slots.find((s) => s.id === event.lockedSlotId);

  return (
    <div className="stack-lg">
      <section className="event-head">
        <h1>{event.title}</h1>
        {event.location && <p className="lede">{event.location}</p>}
        {event.description && <p className="pre">{event.description}</p>}
        <div className="share">
          <button type="button" onClick={() => copy(shareUrl, "invite")}>
            {copied === "invite" ? "Copied!" : "Copy invite link"}
          </button>
          {event.isHost && hostToken && (
            <button type="button" className="ghost" onClick={() => copy(`${shareUrl}?host=${hostToken}`, "host")}>
              {copied === "host" ? "Copied!" : "Copy host link (keep private)"}
            </button>
          )}
          <span className="muted">
            {event.participants.length === 0
              ? "Nobody has joined yet."
              : `In: ${event.participants.map((p) => p.name).join(", ")}`}
          </span>
        </div>
        {justCreated && event.isHost && (
          <p className="note">
            You're the host. Share the invite link with friends. Save the host link somewhere safe: it's how you lock in
            the night from another device.
          </p>
        )}
      </section>

      {lockedSlot && event.calendar && (
        <section className="card locked-banner">
          <div>
            <h2>It's on: {formatSlot(lockedSlot.startsAt, lockedSlot.endsAt)}</h2>
            <p className="muted">Add it to your calendar so nobody forgets the snacks.</p>
          </div>
          <div className="share">
            <a className="button primary" href={event.calendar.googleUrl} target="_blank" rel="noreferrer">
              Add to Google Calendar
            </a>
            <a className="button" href={event.calendar.icsUrl}>
              Apple / Outlook (.ics)
            </a>
          </div>
        </section>
      )}

      {!event.me && (
        <form className="card join" onSubmit={join}>
          <h2>Join in</h2>
          <p className="muted">Just a name. No account, no password.</p>
          <div className="row">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required maxLength={40} aria-label="Your name" />
            <button type="submit" className="primary">
              Join
            </button>
          </div>
        </form>
      )}
      {event.me && <p className="muted">You're in as <strong>{event.me.name}</strong>.</p>}
      {error && <p className="error">{error}</p>}

      <Nights
        event={event}
        mySlots={mySlots}
        onToggle={(slotId) => run(() => api.setAvailability(id, toggle(mySlots, slotId)))}
        onLock={(slotId) => run(() => api.lock(id, slotId))}
      />

      <div className="pools">
        {(["game", "vinyl"] as ItemKind[]).map((kind) => (
          <ItemPool
            key={kind}
            kind={kind}
            items={kind === "game" ? event.games : event.vinyls}
            myVotes={myVotes}
            canVote={!!event.me}
            isHost={event.isHost}
            onToggleVote={(itemId) => run(() => api.setVotes(id, toggle(myVotes, itemId)))}
            onAdd={async (item) => setEvent(await api.addItem(id, item))}
            onRemove={(itemId) => run(() => api.removeItem(id, itemId))}
          />
        ))}
      </div>
    </div>
  );
}
