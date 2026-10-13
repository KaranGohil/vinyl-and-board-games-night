import { formatSlot } from "../format";
import type { EventView } from "../types";

interface Props {
  event: EventView;
  mySlots: Set<string>;
  onToggle: (slotId: string) => void;
  onLock: (slotId: string | null) => void;
}

export function Nights({ event, mySlots, onToggle, onLock }: Props) {
  const max = Math.max(1, ...event.slots.map((s) => s.count));
  const canVote = !!event.me && !event.lockedSlotId;

  return (
    <section className="card stack">
      <header>
        <h2>When</h2>
        <p className="muted">
          {event.lockedSlotId
            ? "The host locked in the night."
            : event.me
              ? "Tick every night you can make it."
              : "Join to mark the nights you're free."}
        </p>
      </header>
      <ul className="nights">
        {event.slots.map((slot) => {
          const mine = mySlots.has(slot.id);
          const locked = event.lockedSlotId === slot.id;
          const best = !event.lockedSlotId && event.bestSlotId === slot.id;
          return (
            <li key={slot.id} className={locked ? "night locked" : "night"}>
              <label className="night-main">
                <input type="checkbox" checked={mine} disabled={!canVote} onChange={() => onToggle(slot.id)} />
                <span className="night-when">{formatSlot(slot.startsAt, slot.endsAt)}</span>
                {locked && <span className="badge strong">It's on</span>}
                {best && <span className="badge">Most popular</span>}
              </label>
              <div className="bar" aria-hidden="true">
                <span style={{ width: `${(slot.count / max) * 100}%` }} />
              </div>
              <div className="meta">
                {slot.count === 1 ? "1 person" : `${slot.count} people`} free
                {slot.voters.length > 0 && <> · {slot.voters.join(", ")}</>}
              </div>
              {event.isHost &&
                (locked ? (
                  <button type="button" className="ghost small" onClick={() => onLock(null)}>
                    Unlock
                  </button>
                ) : (
                  <button type="button" className="ghost small" onClick={() => onLock(slot.id)}>
                    Lock in this night
                  </button>
                ))}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
