export type EntityType =
  | "company"
  | "supplier"
  | "customer"
  | "competitor"
  | "product"
  | "market"
  | "segment"
  | "technology"
  | "person"
  | "location"
  | "regulation"
  | "partnership"
  | "channel"
  | "risk"
  | "other";

export type RelationType =
  | "supplies"
  | "buys_from"
  | "competes_with"
  | "owns"
  | "partners_with"
  | "operates_in"
  | "sells"
  | "uses"
  | "regulates"
  | "employs"
  | "related_to";

export type SourceKind =
  | "filing"
  | "news"
  | "company_site"
  | "regulatory"
  | "research"
  | "industry_report"
  | "inference"
  | "other";

/** Ground-truth citation attached to every claim/entity. */
export interface Source {
  id: string;
  kind: SourceKind;
  title: string;
  /** Publisher / origin label shown in the terminal */
  publisher: string;
  /** Optional URL when known; never invent URLs */
  url?: string;
  /** Short excerpt or why this source supports the claim */
  excerpt: string;
  confidence: number;
  observedAt: number;
  agentId: string;
}

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  summary: string;
  details: string[];
  tags: string[];
  confidence: number;
  /** Legacy string labels retained for compatibility */
  sources: string[];
  /** Structured grounded source records — always preferred in UI */
  sourceRecords: Source[];
  createdAt: number;
  updatedAt: number;
  agentId: string;
}

export interface Relation {
  id: string;
  type: RelationType;
  fromId: string;
  toId: string;
  label: string;
  confidence: number;
  createdAt: number;
  agentId: string;
  sources: Source[];
}

export type AgentPhase =
  | "queued"
  | "briefing"
  | "searching_web"
  | "calling_hy3"
  | "parsing"
  | "writing_map"
  | "spawning"
  | "done"
  | "failed";

export interface ResearchTask {
  id: string;
  parentId?: string;
  depth: number;
  focus: string;
  entityHint?: string;
  entityTypeHint?: EntityType;
  priority: number;
  status: "queued" | "running" | "done" | "failed";
  phase: AgentPhase;
  /** Human-readable live status line for the Bloomberg board */
  activity: string;
  /** Latest model narrative / partial result */
  lastNarrative?: string;
  /** Entities written this run */
  findsCount: number;
  /** Child agents spawned this run */
  spawnCount: number;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
}

export interface LogEntry {
  id: string;
  ts: number;
  level: "info" | "spawn" | "find" | "error" | "warn" | "system" | "source";
  agentId: string;
  parentId?: string;
  message: string;
  meta?: Record<string, unknown>;
}

export interface SwarmStats {
  spawned: number;
  completed: number;
  failed: number;
  running: number;
  queued: number;
  entities: number;
  relations: number;
  sources: number;
  startedAt: number;
  elapsedMs: number;
  minRuntimeMs: number;
  forever: boolean;
  status: "idle" | "running" | "stopping" | "stopped";
  agentsPerMin: number;
  findsPerMin: number;
}

export interface SessionState {
  id: string;
  company: string;
  task: string;
  entities: Entity[];
  relations: Relation[];
  logs: LogEntry[];
  tasks: ResearchTask[];
  stats: SwarmStats;
}

export interface AgentFinding {
  entities: Array<{
    type: EntityType;
    name: string;
    summary: string;
    details?: string[];
    tags?: string[];
    confidence?: number;
    sources?: Array<{
      kind?: SourceKind | string;
      title: string;
      publisher?: string;
      url?: string;
      excerpt?: string;
      confidence?: number;
    }>;
  }>;
  relations: Array<{
    type: RelationType;
    from: string;
    to: string;
    label?: string;
    confidence?: number;
    sources?: Array<{
      kind?: SourceKind | string;
      title: string;
      publisher?: string;
      url?: string;
      excerpt?: string;
      confidence?: number;
    }>;
  }>;
  followUps: Array<{
    focus: string;
    entityHint?: string;
    entityTypeHint?: EntityType;
    priority?: number;
  }>;
  narrative: string;
}

export type SwarmEvent =
  | { type: "session"; session: SessionState }
  | { type: "log"; log: LogEntry }
  | { type: "entity"; entity: Entity }
  | { type: "relation"; relation: Relation }
  | { type: "task"; task: ResearchTask }
  | { type: "stats"; stats: SwarmStats }
  | { type: "heartbeat"; ts: number };
