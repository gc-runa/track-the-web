import type { EntityType, ResearchTask, SessionState } from "../types";

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
  return `You are a grounded market-intelligence agent inside Track the Web — a self-building world information repository.

Mission: expand a living digital map of suppliers, customers, competitors, products, markets, people, technologies, channels, regulations, partnerships, and risks.

Truth protocol (non-negotiable):
- Every entity MUST include structured sources.
- Never invent URLs. Only include a URL if you are certain it is real.
- If evidence is weak, set confidence low and kind="inference", and say what is missing in the excerpt.
- Prefer filings, regulatory docs, company sites, reputable news, and industry reports over vague "common knowledge".
- Flag uncertainty explicitly rather than fabricating.

Swarm protocol:
- Always spawn follow-up research leads so the collective never stalls.
- Prefer named entities over vague categories.
- Output ONLY valid JSON matching the schema.`;
}

export function researchUserPrompt(opts: {
  company: string;
  task: string;
  taskItem: ResearchTask;
  context: string;
  knownNames: string[];
}): string {
  return `Target company: ${opts.company}
Overall mission: ${opts.task}

Your agent id: ${opts.taskItem.id}
Depth: ${opts.taskItem.depth}
Focus for THIS agent: ${opts.taskItem.focus}
Entity hint: ${opts.taskItem.entityHint || "none"}
Type hint: ${opts.taskItem.entityTypeHint || "none"}

Current map snapshot (partial):
${opts.context}

Already known entity names (avoid exact duplicates; deepen instead):
${opts.knownNames.slice(0, 80).join(", ") || "(none yet)"}

Return JSON with this exact shape:
{
  "narrative": "1-3 sentences on what you uncovered this step",
  "entities": [
    {
      "type": "company|supplier|customer|competitor|product|market|segment|technology|person|location|regulation|partnership|channel|risk|other",
      "name": "string",
      "summary": "one sentence claim",
      "details": ["bullet facts"],
      "tags": ["short tags"],
      "confidence": 0.0-1.0,
      "sources": [
        {
          "kind": "filing|news|company_site|regulatory|research|industry_report|inference|other",
          "title": "document or article title",
          "publisher": "SEC|Reuters|company IR|…",
          "url": "optional real https URL only — omit if unsure",
          "excerpt": "what this source supports",
          "confidence": 0.0-1.0
        }
      ]
    }
  ],
  "relations": [
    {
      "type": "supplies|buys_from|competes_with|owns|partners_with|operates_in|sells|uses|regulates|employs|related_to",
      "from": "entity name",
      "to": "entity name",
      "label": "short label",
      "confidence": 0.0-1.0,
      "sources": [
        {
          "kind": "news|filing|inference|…",
          "title": "string",
          "publisher": "string",
          "excerpt": "why this link is asserted",
          "confidence": 0.0-1.0
        }
      ]
    }
  ],
  "followUps": [
    {
      "focus": "specific next research question",
      "entityHint": "optional entity name",
      "entityTypeHint": "optional type",
      "priority": 1-10
    }
  ]
}

Requirements:
- Add 3-8 entities with AT LEAST one source each.
- Add 2-10 relations with sources when possible.
- Add 4-10 followUps branching the swarm.
- Prefer net-new named entities.
- Keep names short and canonical.`;
}

export function seedTasks(company: string, task: string) {
  return [
    {
      focus: `Establish the core profile of ${company}: what they sell, business model, geography, and scale. Cite sources.`,
      entityHint: company,
      entityTypeHint: "company" as EntityType,
      priority: 10,
    },
    {
      focus: `Map direct competitors of ${company} with source-backed differentiation claims.`,
      entityTypeHint: "competitor" as EntityType,
      priority: 9,
    },
    {
      focus: `Identify major customers and customer segments for ${company} with evidence.`,
      entityTypeHint: "customer" as EntityType,
      priority: 9,
    },
    {
      focus: `Identify key suppliers and upstream dependencies for ${company} with evidence.`,
      entityTypeHint: "supplier" as EntityType,
      priority: 9,
    },
    {
      focus: `Catalog products/service lines of ${company} with source grounding.`,
      entityTypeHint: "product" as EntityType,
      priority: 8,
    },
    {
      focus: `Describe markets and geographies where ${company} competes, with sources.`,
      entityTypeHint: "market" as EntityType,
      priority: 8,
    },
    {
      focus: `Mission-aligned deep dive with citations: ${task}`,
      priority: 10,
    },
  ];
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
