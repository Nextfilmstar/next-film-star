ALTER TABLE vote_events
  ADD COLUMN IF NOT EXISTS voter_name TEXT;
