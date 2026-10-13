-- Initial schema for Vinyl & Board Games Night.

CREATE TABLE events (
  id            uuid PRIMARY KEY,
  title         text NOT NULL,
  description   text NOT NULL DEFAULT '',
  location      text NOT NULL DEFAULT '',
  host_token    text NOT NULL,
  locked_slot_id uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE participants (
  id          uuid PRIMARY KEY,
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name        text NOT NULL,
  token       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, name)
);

CREATE TABLE time_slots (
  id          uuid PRIMARY KEY,
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  CHECK (ends_at > starts_at)
);

ALTER TABLE events
  ADD CONSTRAINT events_locked_slot_fk
  FOREIGN KEY (locked_slot_id) REFERENCES time_slots(id) ON DELETE SET NULL;

CREATE TABLE availability (
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  slot_id        uuid NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  PRIMARY KEY (participant_id, slot_id)
);

-- A board game or a vinyl record someone offers to bring.
CREATE TABLE items (
  id          uuid PRIMARY KEY,
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('game', 'vinyl')),
  title       text NOT NULL,
  subtitle    text NOT NULL DEFAULT '',
  url         text NOT NULL DEFAULT '',
  added_by    uuid REFERENCES participants(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE item_votes (
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  item_id        uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  PRIMARY KEY (participant_id, item_id)
);

CREATE INDEX items_event_idx ON items(event_id);
CREATE INDEX slots_event_idx ON time_slots(event_id);
CREATE INDEX participants_event_idx ON participants(event_id);
