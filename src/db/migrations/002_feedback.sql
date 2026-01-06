-- Feedback table for user feedback submissions
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  guild_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for rate limiting by user
CREATE INDEX IF NOT EXISTS idx_feedback_user_created ON feedback(user_id, created_at DESC);
