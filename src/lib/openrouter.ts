import type { AgentFinding, EntityType, RelationType, SourceKind } from "./types";
import { normalizeSourceKind } from "./knowledge/store";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export const HY3_MODEL = "tencent/hy3:free";

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: string,
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function modelSlug() {
  return process.env.OPENROUTER_MODEL || HY3_MODEL;
}

function webSearchEnabled() {
  const v = (process.env.OPENROUTER_WEB_SEARCH || "true").toLowerCase();
  return v !== "0" && v !== "false" && v !== "off";
}

/** High-quality domains preferred when OpenRouter executes web_search. */
const QUALITY_DOMAINS = [
  "sec.gov",
  "reuters.com",
  "bloomberg.com",
  "ft.com",
  "wsj.com",
  "nytimes.com",
  "economist.com",
  "wikipedia.org",
  "crunchbase.com",
  "forbes.com",
  "nature.com",
  "oecd.org",
  "europa.eu",
  "gov.uk",
];

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

async function openRouterRequest(body: Record<string, unknown>) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new OpenRouterError("OPENROUTER_API_KEY is missing");

  const maxAttempts = 8;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Track the Web",
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429 || res.status >= 500) {
      const errBody = await res.text().catch(() => "");
      if (attempt === maxAttempts) {
        throw new OpenRouterError(
          `OpenRouter failed after retries (${res.status})`,
          res.status,
          errBody,
        );
      }
      await sleep(Math.min(60_000, 1200 * 2 ** (attempt - 1)));
      continue;
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new OpenRouterError(
        `OpenRouter error ${res.status}`,
        res.status,
        errBody,
      );
    }

    return (await res.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: ChatMessage["tool_calls"];
        };
        finish_reason?: string;
      }>;
    };
  }

  throw new OpenRouterError("Unreachable");
}

/**
 * Call Hy3 on OpenRouter. Optionally attaches openrouter:web_search so the
 * model can pull live web evidence during the turn. Free DuckDuckGo/Wikipedia
 * hits should still be injected into the user prompt by the orchestrator.
 */
export async function chatCompletion(params: {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: "none" | "low" | "medium" | "high";
  enableWebSearch?: boolean;
}): Promise<string> {
  const effort = params.reasoningEffort ?? "none";
  const useWeb = params.enableWebSearch ?? webSearchEnabled();

  const messages: ChatMessage[] = params.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const baseBody: Record<string, unknown> = {
    model: modelSlug(),
    messages,
    temperature: params.temperature ?? 0.35,
    max_tokens: params.maxTokens ?? 8192,
  };

  if (effort !== "none") {
    baseBody.reasoning = { effort };
  }

  if (useWeb) {
    baseBody.tools = [
      {
        type: "openrouter:web_search",
        parameters: {
          max_results: process.env.RENDER ? 5 : 8,
          max_total_results: process.env.RENDER ? 10 : 16,
          search_context_size: process.env.RENDER ? "low" : "medium",
          allowed_domains: QUALITY_DOMAINS,
        },
      },
    ];
    // Encourage the model to search when evidence is thin
    baseBody.tool_choice = "auto";
  }

  try {
    // Server tools are executed by OpenRouter; one round-trip usually returns final content.
    const data = await openRouterRequest(baseBody);
    const message = data.choices?.[0]?.message;
    const content = message?.content?.trim();
    if (content) return content;

    // If the model returned tool_calls without server-side resolution, retry without tools.
    if (message?.tool_calls?.length) {
      return chatCompletion({ ...params, enableWebSearch: false });
    }
  } catch (err) {
    // Tool/web path failed — fall back to plain Hy3 (still OpenRouter).
    if (useWeb) {
      return chatCompletion({ ...params, enableWebSearch: false });
    }
    throw err;
  }

  // Empty content — retry once without reasoning/tools
  if (useWeb || effort !== "none") {
    return chatCompletion({
      ...params,
      enableWebSearch: false,
      reasoningEffort: "none",
    });
  }

  throw new OpenRouterError("Empty Hy3 response from OpenRouter");
}

export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || text.trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model output");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

const ENTITY_TYPES = new Set<string>([
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
]);

const RELATION_TYPES = new Set<string>([
  "supplies",
  "buys_from",
  "competes_with",
  "owns",
  "partners_with",
  "operates_in",
  "sells",
  "uses",
  "regulates",
  "employs",
  "related_to",
]);

function normEntityType(raw: unknown): EntityType {
  const t = String(raw || "other")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  return (ENTITY_TYPES.has(t) ? t : "other") as EntityType;
}

function normRelationType(raw: unknown): RelationType {
  const t = String(raw || "related_to")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  return (RELATION_TYPES.has(t) ? t : "related_to") as RelationType;
}

function normalizeSourceList(
  raw: unknown,
): AgentFinding["entities"][number]["sources"] {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw
    .map((item) => {
      if (typeof item === "string") {
        return {
          kind: "other" as SourceKind,
          title: item,
          publisher: "unspecified",
          excerpt: item,
          confidence: 0.4,
        };
      }
      if (item && typeof item === "object" && "title" in item) {
        const s = item as {
          kind?: string;
          title: string;
          publisher?: string;
          url?: string;
          excerpt?: string;
          confidence?: number;
        };
        return {
          kind: normalizeSourceKind(s.kind),
          title: String(s.title),
          publisher: s.publisher,
          url: s.url,
          excerpt: s.excerpt,
          confidence: s.confidence,
        };
      }
      return null;
    })
    .filter(Boolean) as AgentFinding["entities"][number]["sources"];
}

export function parseAgentFinding(text: string): AgentFinding {
  const raw = extractJsonObject(text) as Partial<AgentFinding> & {
    entities?: Array<Record<string, unknown>>;
    relations?: Array<Record<string, unknown>>;
  };
  const entities = Array.isArray(raw.entities) ? raw.entities : [];
  const relations = Array.isArray(raw.relations) ? raw.relations : [];
  const followUps = Array.isArray(raw.followUps) ? raw.followUps : [];

  return {
    entities: entities
      .filter((e) => e && typeof e.name === "string")
      .map((e) => ({
        type: normEntityType(e.type),
        name: String(e.name).trim(),
        summary: String(e.summary || "").trim(),
        details: Array.isArray(e.details) ? e.details.map(String) : undefined,
        tags: Array.isArray(e.tags) ? e.tags.map(String) : undefined,
        confidence:
          typeof e.confidence === "number" ? e.confidence : undefined,
        sources: normalizeSourceList(e.sources),
      })),
    relations: relations
      .filter((r) => r && r.from && r.to)
      .map((r) => ({
        type: normRelationType(r.type),
        from: String(r.from).trim(),
        to: String(r.to).trim(),
        label: typeof r.label === "string" ? r.label : undefined,
        confidence:
          typeof r.confidence === "number" ? r.confidence : undefined,
        sources: normalizeSourceList(r.sources),
      })),
    followUps: followUps
      .filter((f) => f && f.focus)
      .map((f) => ({
        ...f,
        focus: String(f.focus).trim(),
        entityTypeHint: f.entityTypeHint
          ? normEntityType(f.entityTypeHint)
          : undefined,
      })),
    narrative:
      typeof raw.narrative === "string"
        ? raw.narrative
        : "Research step completed.",
  };
}
