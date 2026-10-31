-- Cloudflare D1: run once before deploying the new attendance UI.
CREATE TABLE IF NOT EXISTS host_attendance_accounts (host_id INTEGER PRIMARY KEY REFERENCES hosts(id) ON DELETE CASCADE, salt TEXT NOT NULL, password_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS host_attendance_events (id INTEGER PRIMARY KEY AUTOINCREMENT, host_id INTEGER NOT NULL REFERENCES hosts(id) ON DELETE CASCADE, status TEXT NOT NULL CHECK(status IN ('on','off')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_host_attendance_events_host ON host_attendance_events(host_id,id DESC);
