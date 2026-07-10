import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import type {
  AgentPhase,
  Entity,
  EntityType,
  LogEntry,
  Relation,
  RelationType,
  ResearchTask,
  SessionState,
  Source,
  SourceKind,
  SwarmEvent,
  SwarmStats,
} from "../types";

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function slugId(prefix: string) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

const SOURCE_KINDS = new Set<string>([
  "filing",
  "news",
  "company_site",
  "regulatory",
  "research",
  "industry_report",
  "inference",
  "other",
]);

export function normalizeSourceKind(raw: unknown): SourceKind {
  const t = String(raw || "other")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  return (SOURCE_KINDS.has(t) ? t : "other") as SourceKind;
}

type GlobalSwarm = {
  sessions: Map<string, KnowledgeSession>;
  runners: Map<string, { stop: () => void }>;
};

function getGlobal(): GlobalSwarm {
  const g = globalThis as typeof globalThis & { __trackweb?: GlobalSwarm };
  if (!g.__trackweb) {
    g.__trackweb = { sessions: new Map(), runners: new Map() };
  }
  return g.__trackweb;
}

export function getSession(id: string) {
  return getGlobal().sessions.get(id);
}

export function listSessions() {
  return [...getGlobal().sessions.values()].map((s) => s.snapshot());
}

export function registerSession(session: KnowledgeSession) {
  getGlobal().sessions.set(session.id, session);
}

export function registerRunner(id: string, runner: { stop: () => void }) {
  getGlobal().runners.set(id, runner);
}

export function getRunner(id: string) {
  return getGlobal().runners.get(id);
}

export class KnowledgeSession extends EventEmitter {
  readonly id: string;
  readonly company: string;
  readonly task: string;
  readonly createdAt: number;
  readonly minRuntimeMs: number;

  private entities = new Map<string, Entity>();
  private entityByKey = new Map<string, string>();
  private relations = new Map<string, Relation>();
  private relationKeys = new Set<string>();
  private logs: LogEntry[] = [];
  private tasks = new Map<string, ResearchTask>();
  private status: SwarmStats["status"] = "idle";
  private spawned = 0;
  private completed = 0;
  private failed = 0;
  private sourceCount = 0;
  private forever = true;
  private completionTimes: number[] = [];
  private findTimes: number[] = [];

  constructor(opts: {
    company: string;
    task: string;
    minRuntimeMs?: number;
    id?: string;
  }) {
    super();
    this.setMaxListeners(200);
    this.id = opts.id || slugId("sess");
    this.company = opts.company.trim();
    this.task = opts.task.trim();
    this.createdAt = Date.now();
    this.minRuntimeMs = opts.minRuntimeMs ?? 3_600_000;
  }

  private ratePerMin(times: number[]) {
    const cutoff = Date.now() - 60_000;
    const recent = times.filter((t) => t >= cutoff);
    // prune
    times.length = 0;
    times.push(...recent);
    return recent.length;
  }

  getStats(): SwarmStats {
    let running = 0;
    let queued = 0;
    for (const t of this.tasks.values()) {
      if (t.status === "running") running += 1;
      if (t.status === "queued") queued += 1;
    }
    return {
      spawned: this.spawned,
      completed: this.completed,
      failed: this.failed,
      running,
      queued,
      entities: this.entities.size,
      relations: this.relations.size,
      sources: this.sourceCount,
      startedAt: this.createdAt,
      elapsedMs: Date.now() - this.createdAt,
      minRuntimeMs: this.minRuntimeMs,
      forever: this.forever,
      status: this.status,
      agentsPerMin: this.ratePerMin(this.completionTimes),
      findsPerMin: this.ratePerMin(this.findTimes),
    };
  }

  setStatus(status: SwarmStats["status"]) {
    this.status = status;
    this.emitEvent({ type: "stats", stats: this.getStats() });
  }

  snapshot(): SessionState {
    return {
      id: this.id,
      company: this.company,
      task: this.task,
      entities: [...this.entities.values()].sort(
        (a, b) => b.updatedAt - a.updatedAt,
      ),
      relations: [...this.relations.values()].sort(
        (a, b) => b.createdAt - a.createdAt,
      ),
      logs: this.logs.slice(-800),
      tasks: [...this.tasks.values()].sort((a, b) => b.createdAt - a.createdAt),
      stats: this.getStats(),
    };
  }

  private emitEvent(event: SwarmEvent) {
    this.emit("event", event);
  }

  log(
    level: LogEntry["level"],
    agentId: string,
    message: string,
    meta?: Record<string, unknown>,
    parentId?: string,
  ) {
    const entry: LogEntry = {
      id: slugId("log"),
      ts: Date.now(),
      level,
      agentId,
      parentId,
      message,
      meta,
    };
    this.logs.push(entry);
    if (this.logs.length > 8000) this.logs.splice(0, this.logs.length - 8000);
    this.emitEvent({ type: "log", log: entry });
    return entry;
  }

  enqueueTask(input: {
    focus: string;
    parentId?: string;
    depth?: number;
    entityHint?: string;
    entityTypeHint?: EntityType;
    priority?: number;
  }): ResearchTask {
    const task: ResearchTask = {
      id: slugId("agent"),
      parentId: input.parentId,
      depth: input.depth ?? 0,
      focus: input.focus,
      entityHint: input.entityHint,
      entityTypeHint: input.entityTypeHint,
      priority: input.priority ?? 5,
      status: "queued",
      phase: "queued",
      activity: "Waiting in swarm queue",
      findsCount: 0,
      spawnCount: 0,
      createdAt: Date.now(),
    };
    this.tasks.set(task.id, task);
    this.spawned += 1;
    this.emitEvent({ type: "task", task: { ...task } });
    this.emitEvent({ type: "stats", stats: this.getStats() });
    this.log(
      "spawn",
      task.id,
      `SPAWN depth=${task.depth} · ${task.focus}`,
      { focus: task.focus, depth: task.depth },
      task.parentId,
    );
    return task;
  }

  updateTask(
    id: string,
    patch: Partial<
      Pick<
        ResearchTask,
        | "phase"
        | "activity"
        | "lastNarrative"
        | "findsCount"
        | "spawnCount"
        | "status"
        | "error"
        | "startedAt"
        | "finishedAt"
      >
    >,
  ) {
    const task = this.tasks.get(id);
    if (!task) return;
    Object.assign(task, patch);
    this.emitEvent({ type: "task", task: { ...task } });
    this.emitEvent({ type: "stats", stats: this.getStats() });
  }

  setPhase(id: string, phase: AgentPhase, activity: string) {
    this.updateTask(id, { phase, activity });
    this.log("info", id, `[${phase}] ${activity}`);
  }

  markTaskRunning(id: string) {
    this.updateTask(id, {
      status: "running",
      phase: "briefing",
      activity: "Loading mission brief + map context",
      startedAt: Date.now(),
    });
  }

  markTaskDone(id: string) {
    const task = this.tasks.get(id);
    if (!task) return;
    task.status = "done";
    task.phase = "done";
    task.activity = "Complete — children queued";
    task.finishedAt = Date.now();
    this.completed += 1;
    this.completionTimes.push(Date.now());
    this.emitEvent({ type: "task", task: { ...task } });
    this.emitEvent({ type: "stats", stats: this.getStats() });
  }

  markTaskFailed(id: string, error: string) {
    const task = this.tasks.get(id);
    if (!task) return;
    task.status = "failed";
    task.phase = "failed";
    task.activity = error.slice(0, 160);
    task.error = error;
    task.finishedAt = Date.now();
    this.failed += 1;
    this.emitEvent({ type: "task", task: { ...task } });
    this.emitEvent({ type: "stats", stats: this.getStats() });
    this.log("error", id, error);
  }

  nextQueued(limit: number): ResearchTask[] {
    return [...this.tasks.values()]
      .filter((t) => t.status === "queued")
      .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)
      .slice(0, limit);
  }

  makeSources(
    agentId: string,
    raw?: Array<{
      kind?: string;
      title: string;
      publisher?: string;
      url?: string;
      excerpt?: string;
      confidence?: number;
    }>,
  ): Source[] {
    if (!raw?.length) {
      return [
        {
          id: slugId("src"),
          kind: "inference",
          title: "Model inference (ungrounded)",
          publisher: "Hy3",
          excerpt:
            "No explicit source provided — marked as inference until verified.",
          confidence: 0.25,
          observedAt: Date.now(),
          agentId,
        },
      ];
    }

    return raw
      .filter((s) => s?.title)
      .slice(0, 8)
      .map((s) => {
        const kind = normalizeSourceKind(s.kind);
        // Never invent URLs — only keep if looks like a real URL
        const url =
          typeof s.url === "string" && /^https?:\/\//i.test(s.url.trim())
            ? s.url.trim()
            : undefined;
        return {
          id: slugId("src"),
          kind,
          title: s.title.trim(),
          publisher: (s.publisher || kind.replace(/_/g, " ")).trim(),
          url,
          excerpt: (s.excerpt || s.title).trim().slice(0, 400),
          confidence: Math.min(1, Math.max(0, s.confidence ?? 0.55)),
          observedAt: Date.now(),
          agentId,
        };
      });
  }

  upsertEntity(input: {
    type: EntityType;
    name: string;
    summary: string;
    details?: string[];
    tags?: string[];
    confidence?: number;
    sources?: Array<{
      kind?: string;
      title: string;
      publisher?: string;
      url?: string;
      excerpt?: string;
      confidence?: number;
    }>;
    agentId: string;
  }): Entity {
    const sourceRecords = this.makeSources(input.agentId, input.sources);
    const sourceLabels = sourceRecords.map(
      (s) => `${s.publisher}: ${s.title}`,
    );
    const key = `${input.type}:${normalizeName(input.name)}`;
    const existingId = this.entityByKey.get(key);

    if (existingId) {
      const existing = this.entities.get(existingId)!;
      existing.summary = input.summary || existing.summary;
      existing.details = uniqueStrings([
        ...existing.details,
        ...(input.details || []),
      ]).slice(0, 40);
      existing.tags = uniqueStrings([
        ...existing.tags,
        ...(input.tags || []),
      ]).slice(0, 24);
      existing.sources = uniqueStrings([
        ...existing.sources,
        ...sourceLabels,
      ]).slice(0, 40);
      existing.sourceRecords = [
        ...sourceRecords,
        ...existing.sourceRecords,
      ].slice(0, 40);
      existing.confidence = Math.max(
        existing.confidence,
        input.confidence ?? 0.5,
      );
      existing.updatedAt = Date.now();
      this.sourceCount += sourceRecords.length;
      this.findTimes.push(Date.now());
      this.emitEvent({ type: "entity", entity: { ...existing } });
      this.emitEvent({ type: "stats", stats: this.getStats() });
      for (const s of sourceRecords) {
        this.log(
          "source",
          input.agentId,
          `SRC ${existing.name} ← ${s.publisher} · ${s.title}`,
          { entityId: existing.id, sourceId: s.id, kind: s.kind, url: s.url },
        );
      }
      return existing;
    }

    const entity: Entity = {
      id: slugId("ent"),
      type: input.type,
      name: input.name.trim(),
      summary: input.summary.trim(),
      details: uniqueStrings(input.details || []).slice(0, 40),
      tags: uniqueStrings(input.tags || []).slice(0, 24),
      confidence: input.confidence ?? 0.6,
      sources: sourceLabels,
      sourceRecords,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      agentId: input.agentId,
    };
    this.entities.set(entity.id, entity);
    this.entityByKey.set(key, entity.id);
    this.sourceCount += sourceRecords.length;
    this.findTimes.push(Date.now());
    this.emitEvent({ type: "entity", entity: { ...entity } });
    this.emitEvent({ type: "stats", stats: this.getStats() });
    this.log(
      "find",
      input.agentId,
      `FIND ${entity.type.toUpperCase()} ${entity.name}`,
      { entityId: entity.id, type: entity.type },
    );
    for (const s of sourceRecords) {
      this.log(
        "source",
        input.agentId,
        `SRC ${entity.name} ← ${s.publisher} · ${s.title}`,
        { entityId: entity.id, sourceId: s.id, kind: s.kind, url: s.url },
      );
    }
    return entity;
  }

  findEntityIdByName(name: string): string | undefined {
    const n = normalizeName(name);
    for (const [key, id] of this.entityByKey) {
      if (key.endsWith(`:${n}`)) return id;
    }
    for (const e of this.entities.values()) {
      if (normalizeName(e.name) === n) return e.id;
    }
    return undefined;
  }

  addRelation(input: {
    type: RelationType;
    fromName: string;
    toName: string;
    label?: string;
    confidence?: number;
    agentId: string;
    sources?: Array<{
      kind?: string;
      title: string;
      publisher?: string;
      url?: string;
      excerpt?: string;
      confidence?: number;
    }>;
  }): Relation | null {
    const fromId = this.findEntityIdByName(input.fromName);
    const toId = this.findEntityIdByName(input.toName);
    if (!fromId || !toId || fromId === toId) return null;

    const key = `${input.type}:${fromId}:${toId}`;
    if (this.relationKeys.has(key)) return null;
    this.relationKeys.add(key);

    const sources = this.makeSources(input.agentId, input.sources);
    const relation: Relation = {
      id: slugId("rel"),
      type: input.type,
      fromId,
      toId,
      label: input.label || input.type.replace(/_/g, " "),
      confidence: input.confidence ?? 0.6,
      createdAt: Date.now(),
      agentId: input.agentId,
      sources,
    };
    this.relations.set(relation.id, relation);
    this.sourceCount += sources.length;
    this.emitEvent({ type: "relation", relation: { ...relation } });
    this.emitEvent({ type: "stats", stats: this.getStats() });
    this.log(
      "find",
      input.agentId,
      `LINK ${input.fromName} → ${input.toName} (${relation.label})`,
      { relationId: relation.id },
    );
    return relation;
  }

  contextBrief(maxEntities = 40): string {
    const ents = [...this.entities.values()]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, maxEntities)
      .map((e) => {
        const src = e.sourceRecords[0];
        const srcBit = src
          ? ` | src: ${src.publisher}/${src.title}`
          : "";
        return `- [${e.type}] ${e.name}: ${e.summary}${srcBit}`;
      })
      .join("\n");
    return ents || "(map is still empty)";
  }

  knownNames(): string[] {
    return [...this.entities.values()].map((e) => e.name);
  }
}
