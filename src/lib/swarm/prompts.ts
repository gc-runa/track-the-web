import type { EntityType, ResearchTask, SessionState } from "../types";
import { seedTasks as deepSeedTasks } from "./deepdive";

export const ENTITY_TYPES: EntityType[] = [
  "company",
  "supplier",
  "customer",
  "competitor",
  "product",
  "market",
  "segment",
  "technology",
  "person",
  "location",
  "regulation",
  "partnership",
  "channel",
  "risk",
  "other",
];

export function systemPrompt() {
  return `You are a grounded market-intelligence agent inside Track the Web.
You run on OpenRouter using Tencent Hy3 (tencent/hy3:free) with live web search.

Mission: for every company uncovered, map ABSOLUTELY EVERYTHING — products, customers, suppliers, competitors, markets, people, debt, equity, ownership, partnerships, regulation, technology, history — and all relationships. Spawn follow-ups so the parallel swarm never stalls.

Truth protocol:
- Prefer WEB SEARCH HITS provided in the prompt (quality-ranked). Cite real URLs from those hits.
- You may also use OpenRouter web_search when you need fresher evidence.
- Never invent URLs. If evidence is weak, kind="inference" and lower confidence.
- Prefer SEC, IR, Reuters/FT/Bloomberg/WSJ, regulators, Wikipedia over SEO spam.
- Output ONLY valid JSON.`;
}

export function researchUserPrompt(opts: {
  company: string;
  task: string;
  taskItem: ResearchTask;
  context: string;
  knownNames: string[];
  webBrief: string;
}): string {
  return `Root company: ${opts.company}
Overall mission: ${opts.task}

Agent id: ${opts.taskItem.id}
Depth: ${opts.taskItem.depth}
Focus: ${opts.taskItem.focus}
Entity hint: ${opts.taskItem.entityHint || "none"}
Type hint: ${opts.taskItem.entityTypeHint || "none"}

WEB SEARCH HITS (quality-ranked — ground claims on these):
${opts.webBrief}

Current map snapshot:
${opts.context}

Known names (deepen; avoid exact duplicate shells):
${opts.knownNames.slice(0, 100).join(", ") || "(none)"}

Return JSON:
{
  "narrative": "what you uncovered",
  "entities": [{
    "type": "company|supplier|customer|competitor|product|market|segment|technology|person|location|regulation|partnership|channel|risk|other",
    "name": "string",
    "summary": "claim",
    "details": ["facts including financials when relevant"],
    "tags": ["tags"],
    "confidence": 0.0-1.0,
    "sources": [{
      "kind": "filing|news|company_site|regulatory|research|industry_report|inference|other",
      "title": "string",
      "publisher": "string",
      "url": "ONLY a URL from WEB SEARCH HITS above, or omit",
      "excerpt": "what it supports",
      "confidence": 0.0-1.0
    }]
  }],
  "relations": [{
    "type": "supplies|buys_from|competes_with|owns|partners_with|operates_in|sells|uses|regulates|employs|related_to",
    "from": "name",
    "to": "name",
    "label": "string",
    "confidence": 0.0-1.0,
    "sources": [{"kind":"news","title":"…","publisher":"…","excerpt":"…","confidence":0.6}]
  }],
  "followUps": [{
    "focus": "next research question",
    "entityHint": "optional",
    "entityTypeHint": "optional",
    "priority": 1-10
  }]
}

Requirements:
- 4-10 entities with sources grounded on web hits when possible.
- 3-12 relations.
- 6-12 followUps that sprawl the swarm into every remaining unknown.
- When you name a new company/competitor/supplier/customer, include enough detail to justify a full dossier.`;
}

export function seedTasks(company: string, task: string) {
  return deepSeedTasks(company, task);
}

export function emptyClientState(
  company: string,
  task: string,
): Omit<SessionState, "id"> & { id?: string } {
  return {
    company,
    task,
    entities: [],
    relations: [],
    logs: [],
    tasks: [],
    stats: {
      spawned: 0,
      completed: 0,
      failed: 0,
      running: 0,
      queued: 0,
      entities: 0,
      relations: 0,
      sources: 0,
      startedAt: Date.now(),
      elapsedMs: 0,
      minRuntimeMs: 3_600_000,
      forever: true,
      status: "idle",
      agentsPerMin: 0,
      findsPerMin: 0,
    },
  };
}
