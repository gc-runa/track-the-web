import type {
  Entity,
  LogEntry,
  Relation,
  ResearchTask,
  SessionState,
  SwarmStats,
} from "./types";
import { ensureSchema, getPool, hasDatabase } from "./db";

export async function persistSessionMeta(input: {
  id: string;
  company: string;
  task: string;
  stats: SwarmStats;
}) {
  if (!hasDatabase()) return;
  await ensureSchema();
  const p = getPool()!;
  await p.query(
    `INSERT INTO sessions (id, company, task, status, stats, updated_at)
     VALUES ($1,$2,$3,$4,$5::jsonb,NOW())
     ON CONFLICT (id) DO UPDATE SET
       company=EXCLUDED.company,
       task=EXCLUDED.task,
       status=EXCLUDED.status,
       stats=EXCLUDED.stats,
       updated_at=NOW()`,
    [
      input.id,
      input.company,
      input.task,
      input.stats.status,
      JSON.stringify(input.stats),
    ],
  );
}

export async function persistEntity(sessionId: string, entity: Entity) {
  if (!hasDatabase()) return;
  await ensureSchema();
  const p = getPool()!;
  await p.query(
    `INSERT INTO entities (
      id, session_id, type, name, summary, details, tags, confidence,
      sources, source_records, agent_id, created_at, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9::jsonb,$10::jsonb,$11,
      to_timestamp($12/1000.0), to_timestamp($13/1000.0)
    )
    ON CONFLICT (id) DO UPDATE SET
      summary=EXCLUDED.summary,
      details=EXCLUDED.details,
      tags=EXCLUDED.tags,
      confidence=EXCLUDED.confidence,
      sources=EXCLUDED.sources,
      source_records=EXCLUDED.source_records,
      updated_at=EXCLUDED.updated_at`,
    [
      entity.id,
      sessionId,
      entity.type,
      entity.name,
      entity.summary,
      JSON.stringify(entity.details),
      JSON.stringify(entity.tags),
      entity.confidence,
      JSON.stringify(entity.sources),
      JSON.stringify(entity.sourceRecords),
      entity.agentId,
      entity.createdAt,
      entity.updatedAt,
    ],
  );
}

export async function persistRelation(sessionId: string, relation: Relation) {
  if (!hasDatabase()) return;
  await ensureSchema();
  const p = getPool()!;
  await p.query(
    `INSERT INTO relations (
      id, session_id, type, from_id, to_id, label, confidence, agent_id, sources, created_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb, to_timestamp($10/1000.0)
    )
    ON CONFLICT (id) DO NOTHING`,
    [
      relation.id,
      sessionId,
      relation.type,
      relation.fromId,
      relation.toId,
      relation.label,
      relation.confidence,
      relation.agentId,
      JSON.stringify(relation.sources || []),
      relation.createdAt,
    ],
  );
}

export async function persistLog(sessionId: string, log: LogEntry) {
  if (!hasDatabase()) return;
  await ensureSchema();
  const p = getPool()!;
  await p.query(
    `INSERT INTO logs (id, session_id, ts, level, agent_id, parent_id, message, meta)
     VALUES ($1,$2,to_timestamp($3/1000.0),$4,$5,$6,$7,$8::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [
      log.id,
      sessionId,
      log.ts,
      log.level,
      log.agentId,
      log.parentId || null,
      log.message,
      JSON.stringify(log.meta || null),
    ],
  );
}

export async function persistTask(sessionId: string, task: ResearchTask) {
  if (!hasDatabase()) return;
  await ensureSchema();
  const p = getPool()!;
  await p.query(
    `INSERT INTO tasks (
      id, session_id, parent_id, depth, focus, entity_hint, entity_type_hint,
      priority, status, phase, activity, last_narrative, finds_count, spawn_count,
      error, created_at, started_at, finished_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
      to_timestamp($16/1000.0),
      CASE WHEN $17::bigint IS NULL THEN NULL ELSE to_timestamp($17/1000.0) END,
      CASE WHEN $18::bigint IS NULL THEN NULL ELSE to_timestamp($18/1000.0) END
    )
    ON CONFLICT (id) DO UPDATE SET
      status=EXCLUDED.status,
      phase=EXCLUDED.phase,
      activity=EXCLUDED.activity,
      last_narrative=EXCLUDED.last_narrative,
      finds_count=EXCLUDED.finds_count,
      spawn_count=EXCLUDED.spawn_count,
      error=EXCLUDED.error,
      started_at=EXCLUDED.started_at,
      finished_at=EXCLUDED.finished_at`,
    [
      task.id,
      sessionId,
      task.parentId || null,
      task.depth,
      task.focus,
      task.entityHint || null,
      task.entityTypeHint || null,
      task.priority,
      task.status,
      task.phase,
      task.activity,
      task.lastNarrative || null,
      task.findsCount,
      task.spawnCount,
      task.error || null,
      task.createdAt,
      task.startedAt ?? null,
      task.finishedAt ?? null,
    ],
  );
}

export async function loadSessionFromDb(
  sessionId: string,
): Promise<SessionState | null> {
  if (!hasDatabase()) return null;
  await ensureSchema();
  const p = getPool()!;
  const sess = await p.query(`SELECT * FROM sessions WHERE id=$1`, [sessionId]);
  if (!sess.rows[0]) return null;

  const [entities, relations, logs, tasks] = await Promise.all([
    p.query(
      `SELECT * FROM entities WHERE session_id=$1 ORDER BY updated_at DESC LIMIT 2000`,
      [sessionId],
    ),
    p.query(
      `SELECT * FROM relations WHERE session_id=$1 ORDER BY created_at DESC LIMIT 4000`,
      [sessionId],
    ),
    p.query(
      `SELECT * FROM logs WHERE session_id=$1 ORDER BY ts DESC LIMIT 800`,
      [sessionId],
    ),
    p.query(
      `SELECT * FROM tasks WHERE session_id=$1 ORDER BY created_at DESC LIMIT 1000`,
      [sessionId],
    ),
  ]);

  const row = sess.rows[0];
  const stats = (row.stats || {}) as SwarmStats;

  return {
    id: row.id,
    company: row.company,
    task: row.task,
    entities: entities.rows.map((e) => ({
      id: e.id,
      type: e.type,
      name: e.name,
      summary: e.summary,
      details: e.details || [],
      tags: e.tags || [],
      confidence: Number(e.confidence),
      sources: e.sources || [],
      sourceRecords: e.source_records || [],
      createdAt: new Date(e.created_at).getTime(),
      updatedAt: new Date(e.updated_at).getTime(),
      agentId: e.agent_id,
    })),
    relations: relations.rows.map((r) => ({
      id: r.id,
      type: r.type,
      fromId: r.from_id,
      toId: r.to_id,
      label: r.label,
      confidence: Number(r.confidence),
      createdAt: new Date(r.created_at).getTime(),
      agentId: r.agent_id,
      sources: r.sources || [],
    })),
    logs: logs.rows
      .map((l) => ({
        id: l.id,
        ts: new Date(l.ts).getTime(),
        level: l.level,
        agentId: l.agent_id,
        parentId: l.parent_id || undefined,
        message: l.message,
        meta: l.meta || undefined,
      }))
      .reverse(),
    tasks: tasks.rows.map((t) => ({
      id: t.id,
      parentId: t.parent_id || undefined,
      depth: t.depth,
      focus: t.focus,
      entityHint: t.entity_hint || undefined,
      entityTypeHint: t.entity_type_hint || undefined,
      priority: t.priority,
      status: t.status,
      phase: t.phase,
      activity: t.activity,
      lastNarrative: t.last_narrative || undefined,
      findsCount: t.finds_count,
      spawnCount: t.spawn_count,
      createdAt: new Date(t.created_at).getTime(),
      startedAt: t.started_at ? new Date(t.started_at).getTime() : undefined,
      finishedAt: t.finished_at ? new Date(t.finished_at).getTime() : undefined,
      error: t.error || undefined,
    })),
    stats: {
      ...stats,
      status: row.status,
      entities: entities.rowCount || 0,
      relations: relations.rowCount || 0,
    },
  };
}

export async function listPersistedSessions() {
  if (!hasDatabase()) return [];
  await ensureSchema();
  const p = getPool()!;
  const res = await p.query(
    `SELECT id, company, task, status, stats, created_at, updated_at
     FROM sessions ORDER BY updated_at DESC LIMIT 50`,
  );
  return res.rows;
}
