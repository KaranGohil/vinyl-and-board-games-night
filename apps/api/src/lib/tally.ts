export interface Voter {
  id: string;
  name: string;
}

export interface Ranked<T> {
  item: T;
  count: number;
  voters: string[];
}

/**
 * Counts votes per item and sorts by count (desc), breaking ties by the
 * item's original order so results are stable.
 */
export function rankByVotes<T extends { id: string }>(
  items: T[],
  votes: { itemId: string; participantId: string }[],
  participants: Voter[],
): Ranked<T>[] {
  const nameById = new Map(participants.map((p) => [p.id, p.name]));
  const votersByItem = new Map<string, string[]>();
  for (const v of votes) {
    const name = nameById.get(v.participantId);
    if (!name) continue;
    const list = votersByItem.get(v.itemId) ?? [];
    list.push(name);
    votersByItem.set(v.itemId, list);
  }
  return items
    .map((item, index) => {
      const voters = (votersByItem.get(item.id) ?? []).sort((a, b) => a.localeCompare(b));
      return { item, count: voters.length, voters, index };
    })
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map(({ item, count, voters }) => ({ item, count, voters }));
}
