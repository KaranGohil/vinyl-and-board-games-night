import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { setToken } from "../storage";
import { toSlot } from "../format";

interface NightInput {
  key: number;
  date: string;
  start: string;
  end: string;
}

function nextFriday(offsetWeeks = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7) + offsetWeeks * 7);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

let nextKey = 3;

export function CreateEvent() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("Vinyl & Board Games Night");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [nights, setNights] = useState<NightInput[]>([
    { key: 1, date: nextFriday(0), start: "19:00", end: "23:00" },
    { key: 2, date: nextFriday(1), start: "19:00", end: "23:00" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (key: number, patch: Partial<NightInput>) =>
    setNights((ns) => ns.map((n) => (n.key === key ? { ...n, ...patch } : n)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const created = await api.createEvent({
        title,
        location,
        description,
        slots: nights.filter((n) => n.date).map((n) => toSlot(n.date, n.start, n.end)),
      });
      setToken(created.id, "host", created.hostToken);
      navigate(`/e/${created.id}?created=1`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-lg">
      <section className="hero">
        <h1>Pick the night. Pick the games. Pick the records.</h1>
        <p className="lede">
          Offer a few nights, share one link, and let everyone vote on when to meet, which board games to play and
          which vinyl to spin. Then drop it straight into your calendar.
        </p>
      </section>

      <form className="card stack" onSubmit={submit}>
        <h2>Start a night</h2>
        <label className="field">
          <span>Name</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
        </label>
        <label className="field">
          <span>Where</span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Karan's place, Main St"
            maxLength={200}
          />
        </label>
        <label className="field">
          <span>Notes</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Snacks, parking, house rules…"
            rows={3}
            maxLength={2000}
          />
        </label>

        <fieldset className="stack-sm">
          <legend>Possible nights</legend>
          {nights.map((n) => (
            <div className="night-row" key={n.key}>
              <input type="date" value={n.date} onChange={(e) => update(n.key, { date: e.target.value })} required aria-label="Date" />
              <input type="time" value={n.start} onChange={(e) => update(n.key, { start: e.target.value })} required aria-label="Starts" />
              <span className="muted">to</span>
              <input type="time" value={n.end} onChange={(e) => update(n.key, { end: e.target.value })} required aria-label="Ends" />
              <button
                type="button"
                className="ghost"
                onClick={() => setNights((ns) => ns.filter((x) => x.key !== n.key))}
                disabled={nights.length === 1}
                aria-label="Remove this night"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="ghost"
            onClick={() =>
              setNights((ns) => [...ns, { key: nextKey++, date: nextFriday(ns.length), start: "19:00", end: "23:00" }])
            }
          >
            + Add another night
          </button>
        </fieldset>

        {error && <p className="error">{error}</p>}
        <button type="submit" className="primary" disabled={busy}>
          {busy ? "Creating…" : "Create and get the link"}
        </button>
      </form>
    </div>
  );
}
