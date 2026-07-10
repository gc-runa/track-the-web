import { chatCompletion, parseAgentFinding } from "../openrouter";
import {
  getRunner,
  KnowledgeSession,
  registerRunner,
  registerSession,
} from "../knowledge/store";
import { researchUserPrompt, seedTasks, systemPrompt } from "./prompts";
import {
  companyDeepDiveSeeds,
  shouldDeepDiveType,
} from "./deepdive";
import { formatSearchBrief, freeWebSearch } from "../websearch";
import { scoreSource } from "../websearch";

const DEFAULT_CONCURRENCY = 10;
const MAX_QUEUE = 1_000_000;
const MAX_DEPTH = 64;
const FOLLOWUPS_PER_AGENT = 12;

function concurrency() {
  const n = Number(process.env.SWARM_MAX_CONCURRENT || DEFAULT_CONCURRENCY);
  return Number.isFinite(n) && n > 0 ? Math.min(48, Math.floor(n)) : DEFAULT_CONCURRENCY;
}

function minRuntimeMs() {
  const n = Number(process.env.SWARM_MIN_RUNTIME_MS || 3_600_000);
  return Number.isFinite(n) && n > 0 ? n : 3_600_000;
}

function normKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
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

  session.setStatus("running");
  session.log(
    "system",
    "orchestrator",
    `WORLD REPO ONLINE · ${company} · Hy3 + free web search · concurrency ${maxConcurrent} · forever sprawl`,
    {
      maxConcurrent,
      model: process.env.OPENROUTER_MODEL || "tencent/hy3:free",
      maxQueue: MAX_QUEUE,
    },
  );

  // Root company gets the full forensic dossier immediately.
  deepDivied.add(normKey(company));
  for (const seed of seedTasks(company, task)) {
    session.enqueueTask({
      focus: seed.focus,
      entityHint: seed.entityHint,
      entityTypeHint: seed.entityTypeHint,
      priority: seed.priority,
      depth: 0,
    });
  }

  const spawnCompanyDossier = (
    name: string,
    parentId: string,
    depth: number,
  ) => {
    const key = normKey(name);
    if (!key || deepDivied.has(key)) return 0;
    if (session.getStats().queued >= MAX_QUEUE - 50) return 0;
    deepDivied.add(key);
    let n = 0;
    for (const seed of companyDeepDiveSeeds(name)) {
      session.enqueueTask({
        focus: seed.focus,
        parentId,
        depth: depth + 1,
        entityHint: seed.entityHint,
        entityTypeHint: seed.entityTypeHint,
        priority: seed.priority,
      });
      n += 1;
    }
    session.log(
      "spawn",
      parentId,
      `DOSSIER cascade · ${name} · +${n} forensic agents`,
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
  }, 3000);

  const runner = {
    stop: () => {
      stopping = true;
      clearInterval(heartbeat);
      session.setStatus("stopped");
      session.log("system", "orchestrator", "TERMINAL HALTED by operator.");
    },
  };

  registerRunner(session.id, runner);
  pump();
  return session;
}

function maybeReplenish(
  session: KnowledgeSession,
  deepDivied: Set<string>,
  spawnCompanyDossier: (name: string, parentId: string, depth: number) => number,
) {
  if (session.getStats().status !== "running") return;
  const stats = session.getStats();
  if (stats.queued + stats.running > 0) return;

  const ents = session.snapshot().entities;
  const companies = ents.filter((e) => shouldDeepDiveType(e.type));
  let spawned = 0;
  for (const e of companies) {
    if (!deepDivied.has(normKey(e.name))) {
      spawned += spawnCompanyDossier(e.name, "orchestrator", 1);
    }
  }
  if (spawned > 0) return;

  for (const e of ents.slice(0, 12)) {
    session.enqueueTask({
      focus: `Re-verify and expand ${e.name} (${e.type}) with fresh web evidence: relationships, financials, adjacent entities.`,
      entityHint: e.name,
      entityTypeHint: e.type,
      priority: 6,
      depth: 1,
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

  session.markTaskRunning(taskId);
  session.setPhase(taskId, "briefing", `Mission: ${task.focus.slice(0, 120)}`);

  const searchQ =
    task.entityHint
      ? `${task.entityHint} ${task.focus}`.slice(0, 160)
      : task.focus.slice(0, 160);

  session.setPhase(taskId, "searching_web", `Free web search: ${searchQ.slice(0, 80)}…`);
  session.log("info", taskId, `WEB SEARCH · ${searchQ}`);

  const hits = await freeWebSearch(searchQ, 12);
  const webBrief = formatSearchBrief(hits);
  session.log(
    "source",
    taskId,
    `WEB · ${hits.length} hits · top q=${hits[0]?.quality?.toFixed(2) ?? "n/a"} · ${hits[0]?.publisher ?? "none"}`,
    { hitCount: hits.length, top: hits.slice(0, 3).map((h) => h.url) },
  );

  session.setPhase(
    taskId,
    "calling_hy3",
    "Calling tencent/hy3:free with grounded web evidence…",
  );

  const content = await chatCompletion({
    messages: [
      { role: "system", content: systemPrompt() },
      {
        role: "user",
        content: researchUserPrompt({
          company: session.company,
          task: session.task,
          taskItem: task,
          context: session.contextBrief(60),
          knownNames: session.knownNames(),
          webBrief,
        }),
      },
    ],
    temperature: 0.35,
    maxTokens: 8192,
    reasoningEffort: task.depth === 0 ? "low" : "none",
  });

  session.setPhase(taskId, "parsing", "Parsing grounded JSON payload…");
  const finding = parseAgentFinding(content);

  // Upgrade source quality using known hit URLs
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
    `Writing ${finding.entities.length} entities into forever repository…`,
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
    if (!before && shouldDeepDiveType(ent.type)) {
      newCompanies.push(ent.name);
    }
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

  session.setPhase(taskId, "spawning", "Forking dossier cascades + child agents…");

  const stats = session.getStats();
  let spawnCount = 0;

  for (const name of newCompanies) {
    spawnCount += spawnCompanyDossier(name, taskId, task.depth);
  }

  if (stats.queued < MAX_QUEUE) {
    for (const f of finding.followUps.filter((x) => x?.focus).slice(0, FOLLOWUPS_PER_AGENT)) {
      const nextDepth = task.depth + 1;
      session.enqueueTask({
        focus: f.focus,
        parentId: taskId,
        depth: nextDepth > MAX_DEPTH ? Math.max(0, MAX_DEPTH - 4) : nextDepth,
        entityHint: f.entityHint,
        entityTypeHint: f.entityTypeHint,
        priority: f.priority ?? Math.max(1, 9 - Math.min(nextDepth, 8)),
      });
      spawnCount += 1;
    }

    for (const ent of finding.entities.slice(0, 5)) {
      session.enqueueTask({
        focus: `Expand relationships around ${ent.name}: customers, suppliers, competitors, products, debt/equity links.`,
        parentId: taskId,
        depth: task.depth + 1,
        entityHint: ent.name,
        entityTypeHint: ent.type,
        priority: 6,
      });
      spawnCount += 1;
    }
  }

  session.updateTask(taskId, { spawnCount, findsCount: finds });
  session.markTaskDone(taskId);
  session.log(
    "system",
    taskId,
    `DONE · +${finds} ents · +${finding.relations.length} links · +${spawnCount} agents · web=${hits.length}`,
  );
}

export function stopSwarm(sessionId: string) {
  const runner = getRunner(sessionId);
  runner?.stop();
}
