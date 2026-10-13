import { describe, expect, it } from "vitest";
import { plural, toSlot } from "./format";

describe("toSlot", () => {
  it("keeps same-day nights on the same day", () => {
    const { startsAt, endsAt } = toSlot("2026-10-16", "19:00", "23:00");
    expect(new Date(endsAt).getTime() - new Date(startsAt).getTime()).toBe(4 * 60 * 60 * 1000);
  });

  it("rolls an end time past midnight into the next day", () => {
    const { startsAt, endsAt } = toSlot("2026-10-16", "20:00", "01:00");
    expect(new Date(endsAt).getTime() - new Date(startsAt).getTime()).toBe(5 * 60 * 60 * 1000);
  });
});

describe("plural", () => {
  it("handles one and many", () => {
    expect(plural(1, "vote")).toBe("1 vote");
    expect(plural(3, "vote")).toBe("3 votes");
  });
});
