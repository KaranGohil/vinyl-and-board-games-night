/** "Fri, Oct 16 · 7:00 – 11:00 PM" in the viewer's own time zone. */
export function formatSlot(startsAt: string, endsAt: string, locale?: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const day = start.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
  const time = (d: Date) => d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  const sameDay = start.toDateString() === end.toDateString();
  return sameDay ? `${day} · ${time(start)} – ${time(end)}` : `${day} · ${time(start)} – ${end.toLocaleDateString(locale, { weekday: "short" })} ${time(end)}`;
}

/**
 * Turns a date ("2026-10-16") and start/end times ("19:00", "23:00") in the
 * browser's local time into UTC ISO strings. An end time earlier than the
 * start rolls over to the next day, so 20:00–01:00 works.
 */
export function toSlot(date: string, startTime: string, endTime: string): { startsAt: string; endsAt: string } {
  const start = new Date(`${date}T${startTime}`);
  const end = new Date(`${date}T${endTime}`);
  if (end <= start) end.setDate(end.getDate() + 1);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
