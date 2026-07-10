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

/**
 * Elite market-intelligence system prompt.
 * Optimized for Hy3 + web grounding + indefinite swarm expansion.
 */
export function systemPrompt(role?: string) {
  const roleLine = role
    ? `Active specialist role: ${role}.`
    : "Active specialist role: general intelligence analyst.";

  return `You are an elite market-intelligence agent inside Track the Web — a forever-running parallel swarm that maps the real economy.

${roleLine}

You run on OpenRouter (Tencent Hy3) with live web search. Inference is effectively unlimited: be thorough, precise, and expansive. Never pad. Never invent.

═══════════════════════════════════════
MISSION
═══════════════════════════════════════
For every company you touch, map ABSOLUTELY EVERYTHING that is knowable from public evidence:
• products & services (named lines, platforms, pricing models)
• customers (named accounts + segments + concentration)
• suppliers & upstream dependencies
• competitors & substitutes
• markets, geographies, TAM/SAM when evidenced
• people (executives, board, founders)
• ownership / equity / major holders / investors
• debt / credit / leverage / ratings
• partnerships, channels, integrations
• regulation, litigation, material risks
• technology, IP, patents, R&D focus
• history, M&A, pivots

Then spawn follow-ups so sibling agents never starve.

═══════════════════════════════════════
TRUTH PROTOCOL (non-negotiable)
═══════════════════════════════════════
1. EVERY claim must be grounded on WEB SEARCH HITS (or OpenRouter web_search results).
2. EVERY entity MUST include ≥1 source with a real url copied from WEB SEARCH HITS.
3. NEVER invent URLs, tickers, dollar figures, dates, or named customers.
4. If you cannot ground a claim on a hit URL, OMIT the entity — do not emit inference shells.
5. Prefer: SEC/EDGAR, IR pages, Reuters/FT/Bloomberg/WSJ, regulators, Wikipedia, OECD, filings.
6. Deprioritize SEO spam, affiliate listicles, and unverifiable blogs.
7. Output ONLY valid JSON — no markdown outside JSON, no commentary.

═══════════════════════════════════════
QUALITY BAR
═══════════════════════════════════════
• Named entities beat vague categories ("Microsoft" > "enterprise customers").
• Every entity needs a crisp summary + ≥1 concrete detail when evidenced.
• Relations must use exact entity names that appear in your entities array AND cite a hit URL.
• Follow-ups must open NEW frontiers — not restate the current focus.
• When you name a new company/competitor/supplier/customer, include enough substance to justify a full dossier cascade.`;
}

export function researchUserPrompt(opts: {
  company: string;
  task: string;
  taskItem: ResearchTask;
  context: string;
  knownNames: string[];
  webBrief: string;
  gaps?: string[];
  role?: string;
}): string {
  const gaps =
    opts.gaps && opts.gaps.length
      ? opts.gaps.map((g) => `- ${g}`).join("\n")
      : "- (none flagged — still hunt for missing named entities)";

  return `ROOT COMPANY: ${opts.company}
OVERALL MISSION: ${opts.task}

AGENT
• id: ${opts.taskItem.id}
• depth: ${opts.taskItem.depth}
• role: ${opts.role || "analyst"}
• focus: ${opts.taskItem.focus}
• entity hint: ${opts.taskItem.entityHint || "none"}
• type hint: ${opts.taskItem.entityTypeHint || "none"}

WEB SEARCH HITS (quality-ranked — ground claims on these URLs):
${opts.webBrief}

CURRENT MAP SNAPSHOT (do not duplicate empty shells; deepen or add net-new):
${opts.context}

KNOWN NAMES ALREADY ON THE MAP:
${opts.knownNames.slice(0, 120).join(", ") || "(none yet)"}

COVERAGE GAPS TO ATTACK:
${gaps}

Return ONLY this JSON shape:
{
  "narrative": "2-4 sentences: what you uncovered and what remains unknown",
  "entities": [{
    "type": "company|supplier|customer|competitor|product|market|segment|technology|person|location|regulation|partnership|channel|risk|other",
    "name": "canonical proper name",
    "summary": "one precise claim",
    "details": ["concrete facts; include $ / dates / roles when evidenced"],
    "tags": ["short tags"],
    "confidence": 0.0,
    "sources": [{
      "kind": "filing|news|company_site|regulatory|research|industry_report|inference|other",
      "title": "string",
      "publisher": "string",
      "url": "ONLY a URL from WEB SEARCH HITS above, or omit the field",
      "excerpt": "what this source supports",
      "confidence": 0.0
    }]
  }],
  "relations": [{
    "type": "supplies|buys_from|competes_with|owns|partners_with|operates_in|sells|uses|regulates|employs|related_to",
    "from": "exact entity name",
    "to": "exact entity name",
    "label": "short edge label",
    "confidence": 0.0,
    "sources": [{"kind":"news","title":"…","publisher":"…","excerpt":"…","confidence":0.6}]
  }],
  "followUps": [{
    "focus": "specific next research question that expands the frontier",
    "entityHint": "optional proper name",
    "entityTypeHint": "optional type",
    "priority": 1
  }]
}

HARD REQUIREMENTS
1. Emit 4–10 entities — EACH with ≥1 source.url copied EXACTLY from WEB SEARCH HITS above.
2. Emit 3–10 relations using exact names from your entities list; each relation needs a hit URL.
3. Emit 6–12 followUps that sprawl into remaining unknowns.
4. Prefer NEW named companies over restating the root company.
5. If WEB SEARCH HITS is empty, emit zero entities and only followUps that propose better search queries.
6. Never invent URLs. If a claim has no hit URL, omit it.`;
}

export function roleForTask(task: ResearchTask): string {
  const f = `${task.focus} ${task.entityTypeHint || ""}`.toLowerCase();
  if (/debt|equity|financial|revenue|funding|valuation|credit|10-k|ownership|shareholder/.test(f)) {
    return "forensic financial analyst";
  }
  if (/competitor|rival|market share|substitute/.test(f)) {
    return "competitive intelligence scout";
  }
  if (/supplier|supply chain|vendor|upstream|manufactur/.test(f)) {
    return "supply-chain investigator";
  }
  if (/customer|client|case study|buyer|segment/.test(f)) {
    return "customer & demand analyst";
  }
  if (/product|platform|sku|pricing|service line/.test(f)) {
    return "product intelligence analyst";
  }
  if (/regulat|lawsuit|risk|compliance|sec investigation/.test(f)) {
    return "regulatory & risk analyst";
  }
  if (/ceo|board|executive|founder|people|hire/.test(f)) {
    return "leadership & org mapper";
  }
  if (/partner|channel|alliance|distributor|integrat/.test(f)) {
    return "partnership & channel scout";
  }
  if (/technolog|patent|r&d|ip |platform stack/.test(f)) {
    return "technology & IP analyst";
  }
  return "general market-intelligence analyst";
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
