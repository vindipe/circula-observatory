CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('network', 'asset', 'protocol', 'system')),
  category TEXT NOT NULL,
  symbol TEXT,
  source TEXT NOT NULL,
  network_id TEXT,
  website TEXT,
  description TEXT,
  testnet INTEGER NOT NULL DEFAULT 0
) STRICT;
CREATE INDEX IF NOT EXISTS entities_kind_name ON entities (kind, name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS entities_network ON entities (network_id);

CREATE TABLE IF NOT EXISTS relations (
  entity_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  label TEXT NOT NULL,
  PRIMARY KEY (entity_id, target_id, label)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS observations (
  entity_id TEXT NOT NULL REFERENCES entities (id),
  metric_id TEXT NOT NULL,
  day TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  collected_at TEXT NOT NULL,
  context TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (entity_id, metric_id, day)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS coverage (
  entity_id TEXT NOT NULL REFERENCES entities (id),
  metric_id TEXT NOT NULL,
  unit TEXT NOT NULL,
  first_day TEXT NOT NULL,
  last_day TEXT NOT NULL,
  last_value REAL NOT NULL,
  observed_at TEXT NOT NULL,
  collected_at TEXT NOT NULL,
  PRIMARY KEY (entity_id, metric_id)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS coverage_metric ON coverage (metric_id, entity_id);
CREATE INDEX IF NOT EXISTS coverage_recency ON coverage (metric_id, last_day DESC, entity_id);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  payload TEXT NOT NULL,
  cadence_minutes INTEGER NOT NULL,
  next_at INTEGER NOT NULL,
  expected_since TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  leased_until INTEGER NOT NULL DEFAULT 0,
  lease TEXT,
  failures INTEGER NOT NULL DEFAULT 0,
  last_success TEXT
) STRICT;
CREATE INDEX IF NOT EXISTS jobs_due ON jobs (enabled, next_at);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  source TEXT NOT NULL,
  trigger TEXT NOT NULL CHECK (trigger IN ('bootstrap','manual','scheduled')),
  scheduled_at TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok','partial','error')),
  row_count INTEGER NOT NULL,
  note TEXT
) STRICT;
CREATE INDEX IF NOT EXISTS runs_source ON runs (source, id DESC);
CREATE INDEX IF NOT EXISTS runs_job ON runs (job_id, id DESC);

CREATE TABLE IF NOT EXISTS coin_pairs (
  upstream TEXT NOT NULL,
  coin TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  min_day TEXT NOT NULL,
  max_day TEXT NOT NULL,
  PRIMARY KEY (upstream, coin)
) WITHOUT ROWID;
