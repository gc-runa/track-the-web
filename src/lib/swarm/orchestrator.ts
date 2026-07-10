import { chatCompletion, parseAgentFinding } from "../openrouter";
import {
  getRunner,
  KnowledgeSession,
  registerRunner,
  registerSession,
} from "../knowledge/store";
import { researchUserPrompt, seedTasks, systemPrompt } from "./prompts";

const DEFAULT_CONCURRENCY = 12;
const MAX_QUEUE = 100_000;
const MAX_DEPTH = 32;
const FOLLOWUPS_PER_AGENT = 10;

function concurrency() {
  const n = Number(process.env.SWARM_MAX_CONCURRENT || DEFAULT_CONCURRENCY);
  return Number.isFinite(n) && n > 0 ? Math.min(64, Math.floor(n)) : DEFAULT_CONCURRENCY;
}

function minRuntimeMs() {
  const n = Number(process.env.SWARM_MIN_RUNTIME_MS || 3_600_000);
  return Number.isFinite(n) && n > 0 ? n : 3_600_000;
}

export function startSwarm(company: string, task: string) {
  const session = new KnowledgeSession({
    company,
    task,
    minRuntimeMs: minRuntimeMs(),
  });
  registerSession(session);

  let stopping = false;
  let active = 0;
  const maxConcurrent = concurrency();

  session.setStatus("running");
  session.log(
    "system",
    "orchestrator",
    `TERMINAL ONLINE · ${company} · Hy3 collective · concurrency ${maxConcurrent} · forever mode`,
    {
      maxConcurrent,
      model: process.env.OPENROUTER_MODEL || "tencent/hy3:free",
    },
  );

  for (const seed of seedTasks(company, task)) {
    session.enqueueTask({
      focus: seed.focus,
      entityHint: seed.entityHint,
      entityTypeHint: seed.entityTypeHint,
      priority: seed.priority,
      depth: 0,
    });
  }

  const pump = () => {
    if (stopping) return;
    while (active < maxConcurrent) {
      const [next] = session.nextQueued(1);
      if (!next) break;
      active += 1;
      void runAgent(session, next.id)
        .catch((err) => {
          session.markTaskFailed(
            next.id,
            err instanceof Error ? err.message : String(err),
          );
        })
        .finally(() => {
          active -= 1;
          maybeReplenish(session);
          pump();
        });
    }
  };

  const heartbeat = setInterval(() => {
    session.emit("event", { type: "heartbeat", ts: Date.now() });
    session.emit("event", { type: "stats", stats: session.getStats() });
    maybeReplenish(session);
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

function maybeReplenish(session: KnowledgeSession) {
  if (session.getStats().status !== "running") return;
  const stats = session.getStats();
  const queuedAndRunning = stats.queued + stats.running;
  if (queuedAndRunning > 0) return;

  const ents = session.snapshot().entities.slice(0, 16);
  if (ents.length === 0) {
    session.enqueueTask({
      focus: `Restart broad ecosystem scan for ${session.company}: suppliers, customers, competitors, products, markets. Require sources.`,
      priority: 8,
      depth: 0,
    });
    return;
  }

  for (const e of ents.slice(0, 8)) {
    session.enqueueTask({
      focus: `Deepen ${e.name} (${e.type}): verify claims, add sources, map adjacent entities.`,
      entityHint: e.name,
      entityTypeHint: e.type,
      priority: 7,
      depth: 1,
    });
  }
}

async function runAgent(session: KnowledgeSession, taskId: string) {
  const task = session.snapshot().tasks.find((t) => t.id === taskId);
  if (!task) return;

  session.markTaskRunning(taskId);
  session.setPhase(
    taskId,
    "briefing",
    `Mission: ${task.focus.slice(0, 120)}`,
  );

  session.setPhase(
    taskId,
    "calling_hy3",
    "Calling tencent/hy3:free via OpenRouter…",
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
          context: session.contextBrief(50),
          knownNames: session.knownNames(),
        }),
      },
    ],
    temperature: 0.4,
    maxTokens: 8192,
    reasoningEffort: task.depth === 0 ? "low" : "none",
  });

  session.setPhase(taskId, "parsing", "Parsing grounded JSON payload…");
  const finding = parseAgentFinding(content);
  session.updateTask(taskId, {
    lastNarrative: finding.narrative,
    activity: finding.narrative.slice(0, 180),
  });
  session.log("info", taskId, finding.narrative);

  session.setPhase(
    taskId,
    "writing_map",
    `Writing ${finding.entities.length} entities + ${finding.relations.length} links into repository…`,
  );

  let finds = 0;
  for (const ent of finding.entities) {
    if (!ent?.name || !ent?.type) continue;
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

  session.setPhase(taskId, "spawning", "Forking child agents into the swarm…");

  const stats = session.getStats();
  let spawnCount = 0;
  const canSpawnMore = stats.queued < MAX_QUEUE;
  if (canSpawnMore) {
    const followUps = finding.followUps
      .filter((f) => f?.focus)
      .slice(0, FOLLOWUPS_PER_AGENT);

    for (const f of followUps) {
      const nextDepth = task.depth + 1;
      session.enqueueTask({
        focus: f.focus,
        parentId: taskId,
        depth: nextDepth > MAX_DEPTH ? Math.max(0, MAX_DEPTH - 2) : nextDepth,
        entityHint: f.entityHint,
        entityTypeHint: f.entityTypeHint,
        priority: f.priority ?? Math.max(1, 8 - Math.min(nextDepth, 7)),
      });
      spawnCount += 1;
    }

    if (finding.entities.length > 0 && stats.queued < MAX_QUEUE / 2) {
      for (const ent of finding.entities.slice(0, 4)) {
        session.enqueueTask({
          focus: `Expand ${ent.name}: suppliers, customers, competitors, products, markets — with sources.`,
          parentId: taskId,
          depth: task.depth + 1,
          entityHint: ent.name,
          entityTypeHint: ent.type,
          priority: 6,
        });
        spawnCount += 1;
      }
    }
  }

  session.updateTask(taskId, { spawnCount, findsCount: finds });
  session.markTaskDone(taskId);
  session.log(
    "system",
    taskId,
    `DONE · +${finds} entities · +${finding.relations.length} links · +${spawnCount} child agents`,
  );
}

export function stopSwarm(sessionId: string) {
  const runner = getRunner(sessionId);
  runner?.stop();
}
