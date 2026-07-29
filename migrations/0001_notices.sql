PRAGMA foreign_keys = ON;

CREATE TABLE notices (
  id TEXT PRIMARY KEY,
  owner_token_hash TEXT NOT NULL,
  creator_session_id TEXT NOT NULL,
  sender TEXT NOT NULL CHECK (length(sender) <= 40),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 60),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 800),
  response_mode TEXT NOT NULL CHECK (response_mode IN ('read', 'attendance')),
  expected_count INTEGER NOT NULL CHECK (expected_count BETWEEN 1 AND 200),
  deadline TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'hidden')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX notices_expires_at ON notices (expires_at);
CREATE INDEX notices_creator ON notices (creator_session_id);

CREATE TABLE acknowledgements (
  id TEXT PRIMARY KEY,
  notice_id TEXT NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  edit_token_hash TEXT NOT NULL,
  respondent_session_id TEXT NOT NULL,
  label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 20),
  response TEXT NOT NULL CHECK (response IN ('read', 'yes', 'maybe', 'no')),
  note TEXT NOT NULL CHECK (length(note) <= 80),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (notice_id, respondent_session_id)
);

CREATE INDEX acknowledgements_notice ON acknowledgements (notice_id, created_at);

CREATE TABLE reports (
  notice_id TEXT NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  reporter_session_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (notice_id, reporter_session_id)
);

CREATE TABLE product_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (
    name IN (
      'visited',
      'notice_created',
      'link_copied',
      'response_saved',
      'owner_opened',
      'notice_closed',
      'returned'
    )
  ),
  context TEXT NOT NULL DEFAULT '',
  occurred_on TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (session_id, name, context, occurred_on)
);

CREATE INDEX product_events_created_at ON product_events (created_at);
