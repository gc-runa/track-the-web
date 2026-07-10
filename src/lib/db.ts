import { Pool } from "pg";

let pool: Pool | null = null;
let ready: Promise<void> | null = null;

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.DATABASE_SSL === "false"
          ? false
          : { rejectUnauthorized: false },
      max: 3,
    });
  }
  return pool;
}

export async function ensureSchema() {
  const p = getPool();
  if (!p) return;
  if (!ready) {
    ready = (async () => {
      await p.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL DEFAULT '',
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          company TEXT NOT NULL,
          task TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'idle',
          stats JSONB NOT NULL DEFAULT '{}'::jsonb,
          user_id TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id TEXT;

        CREATE TABLE IF NOT EXISTS entities (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          name TEXT NOT NULL,
          summary TEXT NOT NULL DEFAULT '',
          details JSONB NOT NULL DEFAULT '[]'::jsonb,
          tags JSONB NOT NULL DEFAULT '[]'::jsonb,
          confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
          sources JSONB NOT NULL DEFAULT '[]'::jsonb,
          source_records JSONB NOT NULL DEFAULT '[]'::jsonb,
          agent_id TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS entities_session_idx ON entities(session_id);
        CREATE INDEX IF NOT EXISTS entities_type_idx ON entities(session_id, type);
        CREATE INDEX IF NOT EXISTS entities_name_idx ON entities (lower(name));

        CREATE TABLE IF NOT EXISTS relations (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          from_id TEXT NOT NULL,
          to_id TEXT NOT NULL,
          label TEXT NOT NULL DEFAULT '',
          confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
          agent_id TEXT NOT NULL DEFAULT '',
          sources JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS relations_session_idx ON relations(session_id);

        CREATE TABLE IF NOT EXISTS logs (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          level TEXT NOT NULL,
          agent_id TEXT NOT NULL,
          parent_id TEXT,
          message TEXT NOT NULL,
          meta JSONB
        );
        CREATE INDEX IF NOT EXISTS logs_session_ts_idx ON logs(session_id, ts DESC);

        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          parent_id TEXT,
          depth INT NOT NULL DEFAULT 0,
          focus TEXT NOT NULL,
          entity_hint TEXT,
          entity_type_hint TEXT,
          priority INT NOT NULL DEFAULT 5,
          status TEXT NOT NULL,
          phase TEXT NOT NULL DEFAULT 'queued',
          activity TEXT NOT NULL DEFAULT '',
          last_narrative TEXT,
          finds_count INT NOT NULL DEFAULT 0,
          spawn_count INT NOT NULL DEFAULT 0,
          error TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          started_at TIMESTAMPTZ,
          finished_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS tasks_session_idx ON tasks(session_id);
      `);
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  await ready;
}
