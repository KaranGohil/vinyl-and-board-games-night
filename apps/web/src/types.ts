export interface Slot {
  id: string;
  startsAt: string;
  endsAt: string;
  count: number;
  voters: string[];
}

export interface PoolItem {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  addedBy: string | null;
  addedByMe: boolean;
  votes: number;
  voters: string[];
}

export interface EventView {
  id: string;
  title: string;
  description: string;
  location: string;
  createdAt: string;
  lockedSlotId: string | null;
  bestSlotId: string | null;
  slots: Slot[];
  games: PoolItem[];
  vinyls: PoolItem[];
  participants: { id: string; name: string }[];
  me: { id: string; name: string; slotIds: string[]; itemIds: string[] } | null;
  isHost: boolean;
  calendar: { icsUrl: string; googleUrl: string } | null;
}

export type ItemKind = "game" | "vinyl";
