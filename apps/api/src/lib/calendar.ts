export interface CalendarEvent {
  uid: string;
  title: string;
  description: string;
  location: string;
  start: Date;
  end: Date;
  url?: string;
}

/** Formats a date as an iCalendar / Google Calendar UTC timestamp: 20261016T020000Z */
export function toCalendarUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escapes text per RFC 5545 section 3.3.11. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Folds a content line so no physical line exceeds 75 octets (RFC 5545 section 3.1). */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let limit = 75;
  for (const ch of line) {
    if (encoder.encode(current + ch).length > limit) {
      parts.push(current);
      current = ch;
      limit = 74; // continuation lines start with a space
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** Builds a single-event .ics file that Google, Apple and Outlook calendars can import. */
export function buildIcs(event: CalendarEvent, now: Date = new Date()): string {
  const description = event.url ? `${event.description}\n\n${event.url}`.trim() : event.description;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//vinyl-and-board-games-night//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}@vinyl-and-board-games-night`,
    `DTSTAMP:${toCalendarUtc(now)}`,
    `DTSTART:${toCalendarUtc(event.start)}`,
    `DTEND:${toCalendarUtc(event.end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    ...(description ? [`DESCRIPTION:${escapeIcsText(description)}`] : []),
    ...(event.location ? [`LOCATION:${escapeIcsText(event.location)}`] : []),
    ...(event.url ? [`URL:${event.url}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

/** Link that opens Google Calendar's "create event" screen pre-filled. */
export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toCalendarUtc(event.start)}/${toCalendarUtc(event.end)}`,
    details: event.url ? `${event.description}\n\n${event.url}`.trim() : event.description,
    location: event.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
