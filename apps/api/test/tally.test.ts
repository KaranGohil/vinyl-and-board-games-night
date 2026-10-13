import { describe, expect, it } from "vitest";
import { rankByVotes } from "../src/lib/tally.js";

const people = [
  { id: "p1", name: "Karan" },
  { id: "p2", name: "Aisha" },
  { id: "p3", name: "Ben" },
];
const items = [{ id: "catan" }, { id: "wingspan" }, { id: "codenames" }];

describe("rankByVotes", () => {
  it("sorts by vote count, highest first", () => {
    const ranked = rankByVotes(
      items,
      [
        { itemId: "wingspan", participantId: "p1" },
        { itemId: "wingspan", participantId: "p2" },
        { itemId: "codenames", participantId: "p3" },
      ],
      people,
    );
    expect(ranked.map((r) => [r.item.id, r.count])).toEqual([
      ["wingspan", 2],
      ["codenames", 1],
      ["catan", 0],
    ]);
  });

  it("keeps original order on ties", () => {
    const ranked = rankByVotes(items, [], people);
    expect(ranked.map((r) => r.item.id)).toEqual(["catan", "wingspan", "codenames"]);
  });

  it("lists voter names alphabetically and ignores unknown voters", () => {
    const ranked = rankByVotes(
      items,
      [
        { itemId: "catan", participantId: "p3" },
        { itemId: "catan", participantId: "p2" },
        { itemId: "catan", participantId: "ghost" },
      ],
      people,
    );
    expect(ranked[0]).toMatchObject({ count: 2, voters: ["Aisha", "Ben"] });
  });
});
