import type { AgentFinding } from "../types";
import type { SearchHit } from "../websearch";
import { scoreSource } from "../websearch";

function isHttpUrl(url?: string) {
  return Boolean(url && /^https?:\/\//i.test(url.trim()));
}

function mentions(hay: string, name: string) {
  const n = name.trim().toLowerCase();
  if (n.length < 2) return false;
  const h = hay.toLowerCase();
  if (h.includes(n)) return true;
  const token = n.split(/\s+/)[0];
  return token.length >= 4 && h.includes(token);
}

/**
 * Force every entity/relation onto real web hits.
 * Drops ungrounded entities. Auto-attaches best matching hits when the model omits URLs.
 */
export function groundFindingOnWeb(
  finding: AgentFinding,
  hits: SearchHit[],
): AgentFinding {
  const hitByUrl = new Map(hits.map((h) => [h.url, h]));
  const allowed = new Set(hits.map((h) => h.url));

  const groundedEntities = finding.entities
    .map((ent) => {
      if (!ent?.name) return null;

      let sources = (ent.sources || []).map((s) => {
        const url = isHttpUrl(s.url) ? s.url!.trim() : undefined;
        if (url && hitByUrl.has(url)) {
          const hit = hitByUrl.get(url)!;
          return {
            ...s,
            url,
            kind: hit.kind,
            publisher: s.publisher || hit.publisher,
            title: s.title || hit.title,
            excerpt: s.excerpt || hit.snippet,
            confidence: Math.max(s.confidence ?? 0.55, hit.quality),
          };
        }
        if (url && allowed.has(url)) {
          return { ...s, url };
        }
        if (url) {
          // Allow high-quality URLs the model found via OpenRouter web_search
          const scored = scoreSource(url, s.title);
          if (scored.quality >= 0.7) {
            return {
              ...s,
              url,
              kind: s.kind || scored.kind,
              publisher: s.publisher || scored.publisher,
              confidence: Math.max(s.confidence ?? 0.5, scored.quality * 0.95),
            };
          }
          // Drop invented / low-quality URLs
          return { ...s, url: undefined, kind: "inference" as const, confidence: 0.3 };
        }
        return s;
      });

      const hasGroundedUrl = sources.some((s) => isHttpUrl(s.url));
      if (!hasGroundedUrl && hits.length) {
        const matches = hits
          .filter(
            (h) =>
              mentions(`${h.title} ${h.snippet}`, ent.name) ||
              mentions(h.title, ent.name),
          )
          .slice(0, 2);
        const attach = matches.length ? matches : hits.slice(0, 1);
        sources = [
          ...attach.map((h) => ({
            kind: h.kind,
            title: h.title,
            publisher: h.publisher,
            url: h.url,
            excerpt: h.snippet.slice(0, 280),
            confidence: h.quality,
          })),
          ...sources.filter((s) => s.kind !== "inference"),
        ];
      }

      const grounded = sources.filter((s) => isHttpUrl(s.url));
      if (!grounded.length) return null; // never persist ungrounded claims

      const best = Math.max(...grounded.map((s) => s.confidence ?? 0.5));
      return {
        ...ent,
        sources: grounded.slice(0, 6),
        confidence: Math.min(ent.confidence ?? best, best),
        tags: [...(ent.tags || []), "web-grounded"].slice(0, 24),
      };
    })
    .filter(Boolean) as AgentFinding["entities"];

  const names = new Set(groundedEntities.map((e) => e.name.toLowerCase()));

  const groundedRelations = finding.relations
    .map((rel) => {
      if (!rel?.from || !rel?.to) return null;
      if (!names.has(rel.from.toLowerCase()) || !names.has(rel.to.toLowerCase())) {
        return null;
      }
      let sources = rel.sources || [];
      const hasUrl = sources.some((s) => isHttpUrl(s.url));
      if (!hasUrl && hits.length) {
        const hit =
          hits.find((h) =>
            mentions(`${h.title} ${h.snippet}`, `${rel.from} ${rel.to}`),
          ) || hits[0];
        sources = [
          {
            kind: hit.kind,
            title: hit.title,
            publisher: hit.publisher,
            url: hit.url,
            excerpt: hit.snippet.slice(0, 280),
            confidence: hit.quality * 0.9,
          },
        ];
      }
      const grounded = sources.filter((s) => isHttpUrl(s.url));
      if (!grounded.length) return null;
      return { ...rel, sources: grounded.slice(0, 4) };
    })
    .filter(Boolean) as AgentFinding["relations"];

  return {
    ...finding,
    entities: groundedEntities,
    relations: groundedRelations,
    narrative:
      groundedEntities.length === 0
        ? `${finding.narrative} (no web-grounded entities this turn — queued more search).`
        : finding.narrative,
  };
}
