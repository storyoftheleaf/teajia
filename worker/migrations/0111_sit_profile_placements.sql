CREATE TABLE IF NOT EXISTS sit_profile_placements (
  account_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  contributor_id TEXT NOT NULL,
  role TEXT NOT NULL,
  PRIMARY KEY (event_id, contributor_id),
  FOREIGN KEY (event_id, account_id)
    REFERENCES events(id, account_id) ON DELETE CASCADE,
  FOREIGN KEY (event_id, contributor_id, role)
    REFERENCES event_contributors(event_id, contributor_id, role) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sit_profile_placements_contributor ON sit_profile_placements(contributor_id);
