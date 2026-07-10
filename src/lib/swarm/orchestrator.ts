import { chatCompletion, parseAgentFinding, HY3_MODEL } from "../openrouter";
import {
  getRunner,
  getSession,
  KnowledgeSession,
  registerRunner,
  registerSession,
} from "../knowledge/store";
import {
  researchUserPrompt,
  roleForTask,
  seedTasks,
  systemPrompt,
} from "./prompts";
import {
  COVERAGE_FACETS,
  companyDeepDiveSeeds,
  shouldDeepDiveType,
} from "./deepdive";
import { formatSearchBrief, freeWebSearch, scoreSource } from "../websearch";
import type { EntityType, ResearchTask } from "../types";

/** Parallel OpenRouter Hy3 workers. Queue can grow without bound (capped). */
const DEFAULT_CONCURRENCY = 1000;
const MAX_CONCURRENCY_CAP = 1000;
const MAX_QUEUE = 5_000_000;
const MAX_DEPTH = 128;
const FOLLOWUPS_PER_AGENT = 20;

function concurrency() {
  const n = Number(process.env.SWARM_MAX_CONCURRENT || DEFAULT_CONCURRENCY);
  return Number.isFinite(n) && n > 0
    ? Math.min(MAX_CONCURRENCY_CAP, Math.floor(n))
    : DEFAULT_CONCURRENCY;
}

function minRuntimeMs() {
  const n = Number(process.env.SWARM_MIN_RUNTIME_MS || 3_600_000);
  return Number.isFinite(n) && n > 0 ? n : 3_600_000;
}

function normKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function detectGaps(session: KnowledgeSession): string[] {
  const ents = session.snapshot().entities;
  const gaps: string[] = [];
  for (const facet of COVERAGE_FACETS) {
    const count = ents.filter((e) => facet.types.includes(e.type)).length;
    if (count < 2) {
      gaps.push(`Need more ${facet.label} (have ${count})`);
    }
  }
  const companyLike = ents.filter((e) => shouldDeepDiveType(e.type));
  if (companyLike.length < 3) {
    gaps.push("Need more named companies in the ecosystem graph");
  }
  const weak = ents.filter((e) => (e.confidence ?? 0) < 0.5).slice(0, 5);
  for (const e of weak) {
    gaps.push(`Strengthen evidence for ${e.name} (${e.type})`);
  }
  return gaps.slice(0, 10);
}

function buildQueries(session: KnowledgeSession, task: ResearchTask): string[] {
  const hint = task.entityHint || session.company;
  const curated = task.searchQuery?.trim();
  const queries = [
    curated ||
      (task.entityHint
        ? `${task.entityHint} ${task.focus}`.slice(0, 140)
        : task.focus.slice(0, 140)),
    `${hint} customers suppliers competitors partners`,
    `${hint} revenue debt equity ownership filing 10-K`,
    `${hint} CEO board executives headquarters`,
  ];
  return [...new Set(queries.map((q) => q.slice(0, 160)))].slice(0, 4);
}

export function startSwarm(company: string, task: string) {
  const session = new KnowledgeSession({
    company,
    task,
    minRuntimeMs: minRuntimeMs(),
  });
  registerSession(session);

  const deepDivied = new Set<string>();
  let stopping = false;
  let active = 0;
  const maxConcurrent = concurrency();
  const model = process.env.OPENROUTER_MODEL || HY3_MODEL;

  session.setStatus("running");
  session.log(
    "system",
    "orchestrator",
    `OPEN SWARM · model=${model} · web+Hy3 · parallel=${maxConcurrent} · queueCap=${MAX_QUEUE} · no-login`,
    { maxConcurrent, model, provider: "openrouter.ai" },
  );

  deepDivied.add(normKey(company));
  for (const seed of seedTasks(company, task)) {
    session.enqueueTask({
      focus: seed.focus,
      entityHint: seed.entityHint,
      entityTypeHint: seed.entityTypeHint,
      priority: seed.priority,
      searchQuery: seed.searchQuery,
      depth: 0,
    });
  }

  const spawnCompanyDossier = (
    name: string,
    parentId: string,
    depth: number,
    force = false,
  ) => {
    const key = normKey(name);
    if (!key) return 0;
    if (!force && deepDivied.has(key)) return 0;
    if (session.getStats().queued >= MAX_QUEUE - 100) return 0;
    deepDivied.add(key);
    let n = 0;
    for (const seed of companyDeepDiveSeeds(name)) {
      session.enqueueTask({
        focus: seed.focus,
        parentId,
        depth: depth + 1,
        entityHint: seed.entityHint,
        entityTypeHint: seed.entityTypeHint,
        priority: force ? Math.min(10, seed.priority + 1) : seed.priority,
        searchQuery: seed.searchQuery,
      });
      n += 1;
    }
    session.log(
      "spawn",
      parentId,
      `DOSSIER · ${name} · +${n} specialist Hy3 agents${force ? " · forced" : ""}`,
      { company: name },
    );
    return n;
  };

  const pump = () => {
    if (stopping) return;
    while (active < maxConcurrent) {
      const [next] = session.nextQueued(1);
      if (!next) break;
      active += 1;
      void runAgent(session, next.id, spawnCompanyDossier)
        .catch((err) => {
          session.markTaskFailed(
            next.id,
            err instanceof Error ? err.message : String(err),
          );
        })
        .finally(() => {
          active -= 1;
          maybeReplenish(session, deepDivied, spawnCompanyDossier);
          pump();
        });
    }
  };

  const heartbeat = setInterval(() => {
    session.emit("event", { type: "heartbeat", ts: Date.now() });
    session.emit("event", { type: "stats", stats: session.getStats() });
    maybeReplenish(session, deepDivied, spawnCompanyDossier);
    pump();
  }, 2000);

  const runner = {
    stop: () => {
      stopping = true;
      clearInterval(heartbeat);
      session.setStatus("stopped");
      session.log("system", "orchestrator", "Open swarm halted.");
    },
    deepDive: (name: string) =>
      spawnCompanyDossier(name, "ui-deepdive", 1, true),
  };

  registerRunner(session.id, runner);
  pump();
  return session;
}

export function deepDiveEntity(sessionId: string, name: string) {
  const runner = getRunner(sessionId);
  if (!runner?.deepDive) {
    throw new Error("Live swarm not available for deep dive");
  }
  const spawned = runner.deepDive(name);
  const session = getSession(sessionId);
  session?.log(
    "spawn",
    "ui-deepdive",
    `CLICK DEEP DIVE · ${name} · +${spawned} specialist agents`,
    { company: name, spawned },
  );
  return { spawned, name };
}

function maybeReplenish(
  session: KnowledgeSession,
  deepDivied: Set<string>,
  spawnCompanyDossier: (name: string, parentId: string, depth: number) => number,
) {
  if (session.getStats().status !== "running") return;
  const stats = session.getStats();
  if (stats.queued + stats.running > Math.max(12, concurrency() / 2)) return;

  const ents = session.snapshot().entities;
  const companies = ents.filter((e) => shouldDeepDiveType(e.type));
  let spawned = 0;
  for (const e of companies) {
    if (!deepDivied.has(normKey(e.name))) {
      spawned += spawnCompanyDossier(e.name, "orchestrator", 1);
    }
  }
  if (spawned > 0) return;

  // Gap-driven replenishment — attack missing coverage facets
  const gaps = detectGaps(session);
  const root = session.company;
  for (const facet of COVERAGE_FACETS) {
    const count = ents.filter((e) => facet.types.includes(e.type)).length;
    if (count >= 3) continue;
    const typeHint = facet.types[0] as EntityType;
    session.enqueueTask({
      focus: `GAP FILL · ${root}: discover more ${facet.label}. Prefer named entities with citations.`,
      entityHint: root,
      entityTypeHint: typeHint,
      priority: 8,
      depth: 1,
      searchQuery: `${root} ${facet.label}`,
    });
    spawned += 1;
  }
  if (spawned > 0) {
    session.log(
      "spawn",
      "orchestrator",
      `GAP FILL · ${spawned} agents · ${gaps.slice(0, 3).join("; ") || "coverage"}`,
    );
    return;
  }

  // Forever loop: re-scan freshest entities with new web evidence
  for (const e of ents.slice(0, 24)) {
    session.enqueueTask({
      focus: `RE-SCAN · ${e.name} (${e.type}): fresh web evidence, new relationships, financials, and named neighbors.`,
      entityHint: e.name,
      entityTypeHint: e.type,
      priority: 5,
      depth: 1,
      searchQuery: `${e.name} ${e.type} news filing`,
    });
  }
}

async function runAgent(
  session: KnowledgeSession,
  taskId: string,
  spawnCompanyDossier: (name: string, parentId: string, depth: number) => number,
) {
  const task = session.snapshot().tasks.find((t) => t.id === taskId);
  if (!task) return;

  const role = roleForTask(task);
  session.markTaskRunning(taskId);
  session.setPhase(taskId, "briefing", `${role} · ${task.focus.slice(0, 100)}`);

  const queries = buildQueries(session, task);

  session.setPhase(
    taskId,
    "searching_web",
    `Free web + OpenRouter web_search · ${queries[0].slice(0, 60)}…`,
  );
  session.log("info", taskId, `WEB · ${role} · queries ×${queries.length}`);

  const hitSets = await Promise.all(
    queries.map((q) => freeWebSearch(q, 8).catch(() => [])),
  );
  const hits = [...hitSets.flat()]
    .sort((a, b) => b.quality - a.quality)
    .filter((h, i, arr) => arr.findIndex((x) => x.url === h.url) === i)
    .slice(0, 18);

  const webBrief = formatSearchBrief(hits);
  session.log(
    "source",
    taskId,
    `WEB · ${hits.length} hits · top=${hits[0]?.publisher ?? "none"}`,
    { hitCount: hits.length },
  );

  session.setPhase(
    taskId,
    "calling_hy3",
    `OpenRouter · ${process.env.OPENROUTER_MODEL || HY3_MODEL} · ${role}`,
  );

  const gaps = detectGaps(session);
  const content = await chatCompletion({
    messages: [
      { role: "system", content: systemPrompt(role) },
      {
        role: "user",
        content: researchUserPrompt({
          company: session.company,
          task: session.task,
          taskItem: task,
          context: session.contextBrief(80),
          knownNames: session.knownNames(),
          webBrief,
          gaps,
          role,
        }),
      },
    ],
    temperature: 0.28,
    maxTokens: 12288,
    reasoningEffort: "none",
    enableWebSearch: true,
  });

  session.setPhase(taskId, "parsing", "Parsing grounded JSON…");
  const finding = parseAgentFinding(content);

  const hitByUrl = new Map(hits.map((h) => [h.url, h]));
  for (const ent of finding.entities) {
    if (!ent.sources) continue;
    ent.sources = ent.sources.map((s) => {
      if (s.url && hitByUrl.has(s.url)) {
        const hit = hitByUrl.get(s.url)!;
        return {
          ...s,
          kind: hit.kind,
          publisher: s.publisher || hit.publisher,
          title: s.title || hit.title,
          confidence: Math.max(s.confidence ?? 0.5, hit.quality),
        };
      }
      if (s.url) {
        const scored = scoreSource(s.url, s.title);
        return {
          ...s,
          kind: s.kind || scored.kind,
          publisher: s.publisher || scored.publisher,
          confidence: Math.max(s.confidence ?? 0.4, scored.quality * 0.9),
        };
      }
      return s;
    });
  }

  session.updateTask(taskId, {
    lastNarrative: finding.narrative,
    activity: finding.narrative.slice(0, 180),
  });
  session.log("info", taskId, finding.narrative);

  session.setPhase(
    taskId,
    "writing_map",
    `Persisting ${finding.entities.length} entities to forever repo…`,
  );

  let finds = 0;
  const newCompanies: string[] = [];
  for (const ent of finding.entities) {
    if (!ent?.name || !ent?.type) continue;
    const before = session.findEntityIdByName(ent.name);
    session.upsertEntity({
      type: ent.type,
      name: ent.name,
      summary: ent.summary || `${ent.type} related to ${session.company}`,
      details: ent.details,
      tags: ent.tags,
      confidence: ent.confidence,
      sources: ent.sources,
      agentId: taskId,
    });
    finds += 1;
    if (!before && shouldDeepDiveType(ent.type)) newCompanies.push(ent.name);
    session.updateTask(taskId, {
      findsCount: finds,
      activity: `Mapped ${ent.type}: ${ent.name}`,
    });
  }

  for (const rel of finding.relations) {
    if (!rel?.from || !rel?.to || !rel?.type) continue;
    session.addRelation({
      type: rel.type,
      fromName: rel.from,
      toName: rel.to,
      label: rel.label,
      confidence: rel.confidence,
      sources: rel.sources,
      agentId: taskId,
    });
  }

  session.setPhase(taskId, "spawning", "Forking specialist children…");

  let spawnCount = 0;
  for (const name of newCompanies) {
    spawnCount += spawnCompanyDossier(name, taskId, task.depth);
  }

  if (session.getStats().queued < MAX_QUEUE) {
    for (const f of finding.followUps
      .filter((x) => x?.focus)
      .slice(0, FOLLOWUPS_PER_AGENT)) {
      const nextDepth = task.depth + 1;
      const hint = f.entityHint || task.entityHint;
      session.enqueueTask({
        focus: f.focus,
        parentId: taskId,
        depth: nextDepth > MAX_DEPTH ? Math.max(0, MAX_DEPTH - 8) : nextDepth,
        entityHint: f.entityHint,
        entityTypeHint: f.entityTypeHint,
        priority: f.priority ?? Math.max(1, 9 - Math.min(nextDepth, 8)),
        searchQuery: hint
          ? `${hint} ${f.focus}`.slice(0, 140)
          : f.focus.slice(0, 140),
      });
      spawnCount += 1;
    }

    for (const ent of finding.entities.slice(0, 8)) {
      if (!shouldDeepDiveType(ent.type) && ent.type !== "product") continue;
      session.enqueueTask({
        focus: `EXPAND · ${ent.name}: customers, suppliers, competitors, products, debt/equity — named entities only.`,
        parentId: taskId,
        depth: task.depth + 1,
        entityHint: ent.name,
        entityTypeHint: ent.type,
        priority: 6,
        searchQuery: `${ent.name} customers suppliers competitors`,
      });
      spawnCount += 1;
    }
  }

  session.updateTask(taskId, { spawnCount, findsCount: finds });
  session.markTaskDone(taskId);
  session.log(
    "system",
    taskId,
    `DONE · ${role} · +${finds} ents · +${finding.relations.length} links · +${spawnCount} agents · web=${hits.length}`,
  );
}

export function stopSwarm(sessionId: string) {
  const runner = getRunner(sessionId);
  runner?.stop();
}
