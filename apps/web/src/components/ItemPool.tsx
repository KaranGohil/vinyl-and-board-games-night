import { useState, type FormEvent } from "react";
import { plural } from "../format";
import type { ItemKind, PoolItem } from "../types";

interface Props {
  kind: ItemKind;
  items: PoolItem[];
  myVotes: Set<string>;
  canVote: boolean;
  isHost: boolean;
  onToggleVote: (itemId: string) => void;
  onAdd: (item: { kind: ItemKind; title: string; subtitle: string; url: string }) => Promise<void>;
  onRemove: (itemId: string) => void;
}

const copy = {
  game: {
    heading: "Board games",
    hint: "Vote for every game you'd happily play.",
    title: "Game",
    titlePh: "e.g. Wingspan",
    subtitlePh: "Players or play time, e.g. 1–5 players",
    empty: "No games yet. Add one you can bring.",
  },
  vinyl: {
    heading: "Vinyl",
    hint: "Vote for the records you want spinning.",
    title: "Record",
    titlePh: "e.g. Rumours",
    subtitlePh: "Artist, e.g. Fleetwood Mac",
    empty: "No records yet. Add one you can bring.",
  },
} as const;

export function ItemPool({ kind, items, myVotes, canVote, isHost, onToggleVote, onAdd, onRemove }: Props) {
  const c = copy[kind];
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const top = items[0]?.votes ?? 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onAdd({ kind, title, subtitle, url });
      setTitle("");
      setSubtitle("");
      setUrl("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className={`card stack pool pool-${kind}`}>
      <header>
        <h2>{c.heading}</h2>
        <p className="muted">{c.hint}</p>
      </header>

      {items.length === 0 ? (
        <p className="muted">{c.empty}</p>
      ) : (
        <ul className="items">
          {items.map((item) => {
            const voted = myVotes.has(item.id);
            return (
              <li key={item.id} className={voted ? "item voted" : "item"}>
                <button
                  type="button"
                  className="vote"
                  aria-pressed={voted}
                  disabled={!canVote}
                  onClick={() => onToggleVote(item.id)}
                  title={canVote ? (voted ? "Remove your vote" : "Vote for this") : "Join to vote"}
                >
                  <span className="vote-count">{item.votes}</span>
                  <span className="vote-label">{voted ? "voted" : "vote"}</span>
                </button>
                <div className="item-body">
                  <div className="item-title">
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {item.title}
                      </a>
                    ) : (
                      item.title
                    )}
                    {top > 0 && item.votes === top && <span className="badge">Top pick</span>}
                  </div>
                  {item.subtitle && <div className="muted">{item.subtitle}</div>}
                  <div className="meta">
                    {item.addedBy && <>Brought by {item.addedBy} · </>}
                    {plural(item.votes, "vote")}
                    {item.voters.length > 0 && <> · {item.voters.join(", ")}</>}
                  </div>
                </div>
                {(item.addedByMe || isHost) && (
                  <button type="button" className="ghost small" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.title}`}>
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canVote && (
        <form className="add-item" onSubmit={submit}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={c.titlePh} required maxLength={120} aria-label={c.title} />
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder={c.subtitlePh} maxLength={120} aria-label="Details" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link (optional)" type="url" maxLength={500} aria-label="Link" />
          <button type="submit">Add {c.title.toLowerCase()}</button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </section>
  );
}
