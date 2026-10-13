import { describe, expect, it } from "vitest";
import { buildIcs, escapeIcsText, foldIcsLine, googleCalendarUrl, toCalendarUtc } from "../src/lib/calendar.js";

const event = {
  uid: "abc-123",
  title: "Vinyl & Board Games Night",
  description: "Bring snacks, please",
  location: "Karan's place, Vancouver",
  start: new Date("2026-10-17T02:00:00Z"),
  end: new Date("2026-10-17T06:00:00Z"),
  url: "https://games.example.com/e/abc-123",
};

describe("toCalendarUtc", () => {
  it("formats dates in basic UTC form", () => {
    expect(toCalendarUtc(new Date("2026-10-17T02:00:00.000Z"))).toBe("20261017T020000Z");
  });
});

describe("escapeIcsText", () => {
  it("escapes commas, semicolons, backslashes and newlines", () => {
    expect(escapeIcsText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });
});

describe("foldIcsLine", () => {
  it("leaves short lines alone", () => {
    expect(foldIcsLine("SUMMARY:short")).toBe("SUMMARY:short");
  });

  it("folds long lines at 75 octets with a leading space", () => {
    const folded = foldIcsLine("DESCRIPTION:" + "x".repeat(200));
    const lines = folded.split("\r\n");
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(lines.slice(1).every((l) => l.startsWith(" "))).toBe(true);
    expect(lines.map((l, i) => (i === 0 ? l : l.slice(1))).join("")).toBe("DESCRIPTION:" + "x".repeat(200));
  });

  it("never splits a multi-byte character", () => {
    const folded = foldIcsLine("SUMMARY:" + "🎲".repeat(40));
    expect(folded).not.toContain("�");
    expect(folded.replace(/\r\n /g, "")).toBe("SUMMARY:" + "🎲".repeat(40));
  });
});

describe("buildIcs", () => {
  const ics = buildIcs(event, new Date("2026-10-13T00:00:00Z"));

  it("produces a valid single-event calendar with CRLF line endings", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261017T020000Z");
    expect(ics).toContain("DTEND:20261017T060000Z");
    expect(ics).toContain("UID:abc-123@vinyl-and-board-games-night");
  });

  it("escapes text fields", () => {
    expect(ics).toContain("LOCATION:Karan's place\\, Vancouver");
    expect(ics).toContain("SUMMARY:Vinyl & Board Games Night");
  });
});

describe("googleCalendarUrl", () => {
  it("pre-fills title and dates", () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.hostname).toBe("calendar.google.com");
    expect(url.searchParams.get("text")).toBe("Vinyl & Board Games Night");
    expect(url.searchParams.get("dates")).toBe("20261017T020000Z/20261017T060000Z");
  });
});
