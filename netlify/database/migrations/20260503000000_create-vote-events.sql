CREATE TABLE IF NOT EXISTS vote_events (
  id SERIAL PRIMARY KEY,
  contestant_id TEXT NOT NULL,
  contestant_name TEXT,
  voter_email TEXT NOT NULL,
  votes_added INTEGER NOT NULL DEFAULT 1,
  voted_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vote_events_contestant_id_idx
  ON vote_events (contestant_id);

CREATE INDEX IF NOT EXISTS vote_events_voter_email_idx
  ON vote_events (voter_email);
