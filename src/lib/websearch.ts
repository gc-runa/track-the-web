export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
  publisher: string;
  quality: number;
  kind:
    | "filing"
    | "news"
    | "company_site"
    | "regulatory"
    | "research"
    | "industry_report"
    | "other";
};

const HIGH_QUALITY_HOSTS: Array<{ host: string; score: number; kind: SearchHit["kind"] }> = [
  { host: "sec.gov", score: 1.0, kind: "filing" },
  { host: "edgar.sec.gov", score: 1.0, kind: "filing" },
  { host: "investor.", score: 0.92, kind: "company_site" },
  { host: "reuters.com", score: 0.9, kind: "news" },
  { host: "bloomberg.com", score: 0.9, kind: "news" },
  { host: "ft.com", score: 0.9, kind: "news" },
  { host: "wsj.com", score: 0.88, kind: "news" },
  { host: "nytimes.com", score: 0.85, kind: "news" },
  { host: "economist.com", score: 0.85, kind: "news" },
  { host: "forbes.com", score: 0.75, kind: "news" },
  { host: "wikipedia.org", score: 0.8, kind: "research" },
  { host: "crunchbase.com", score: 0.78, kind: "research" },
  { host: "pitchbook.com", score: 0.78, kind: "research" },
  { host: "statista.com", score: 0.76, kind: "industry_report" },
  { host: "oecd.org", score: 0.88, kind: "regulatory" },
  { host: "worldbank.org", score: 0.86, kind: "regulatory" },
  { host: "federalreserve.gov", score: 0.95, kind: "regulatory" },
  { host: "europa.eu", score: 0.9, kind: "regulatory" },
  { host: "gov.uk", score: 0.9, kind: "regulatory" },
  { host: "nature.com", score: 0.88, kind: "research" },
  { host: "ssrn.com", score: 0.84, kind: "research" },
  { host: "harvard.edu", score: 0.82, kind: "research" },
  { host: "mit.edu", score: 0.82, kind: "research" },
];

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function scoreSource(url: string, title = ""): {
  quality: number;
  kind: SearchHit["kind"];
  publisher: string;
} {
  const host = hostOf(url);
  let best = { quality: 0.45, kind: "other" as SearchHit["kind"] };
  for (const row of HIGH_QUALITY_HOSTS) {
    if (host.includes(row.host.replace(/\.$/, "")) || host.endsWith(row.host)) {
      if (row.score > best.quality) best = { quality: row.score, kind: row.kind };
    }
  }
  // Company IR / about pages
  if (/investor|ir\.|about\./i.test(host) || /investor relations|10-k|10-q|annual report/i.test(title)) {
    best = {
      quality: Math.max(best.quality, 0.9),
      kind: best.kind === "other" ? "company_site" : best.kind,
    };
  }
  return { ...best, publisher: host || "web" };
}

function publisherFromUrl(url: string) {
  return hostOf(url) || "web";
}

async function searchDuckDuckGo(query: string, limit: number): Promise<SearchHit[]> {
  try {
    const { search, SafeSearchType } = await import("duck-duck-scrape");
    const res = await search(query, { safeSearch: SafeSearchType.MODERATE });
    if (!res || res.noResults || !Array.isArray(res.results)) return [];
    return res.results.slice(0, limit).map((r) => {
      const scored = scoreSource(r.url, r.title);
      return {
        title: r.title,
        url: r.url,
        snippet: (r.description || "").slice(0, 400),
        publisher: scored.publisher,
        quality: scored.quality,
        kind: scored.kind,
      };
    });
  } catch {
    return [];
  }
}

async function searchWikipedia(query: string): Promise<SearchHit[]> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=5&namespace=0&format=json`;
    const res = await fetch(url, {
      headers: { "User-Agent": "TrackTheWeb/1.0 (research-swarm; contact@localhost)" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as [string, string[], string[], string[]];
    const titles = data[1] || [];
    const descs = data[2] || [];
    const links = data[3] || [];
    return titles.map((title, i) => {
      const link = links[i] || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`;
      const scored = scoreSource(link, title);
      return {
        title,
        url: link,
        snippet: descs[i] || title,
        publisher: "wikipedia.org",
        quality: scored.quality,
        kind: "research" as const,
      };
    });
  } catch {
    return [];
  }
}

async function searchDuckInstant(query: string): Promise<SearchHit[]> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "TrackTheWeb/1.0" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      Heading?: string;
      Abstract?: string;
      AbstractURL?: string;
      AbstractSource?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
    };
    const hits: SearchHit[] = [];
    if (data.Abstract && data.AbstractURL) {
      const scored = scoreSource(data.AbstractURL, data.Heading || query);
      hits.push({
        title: data.Heading || query,
        url: data.AbstractURL,
        snippet: data.Abstract.slice(0, 400),
        publisher: data.AbstractSource || publisherFromUrl(data.AbstractURL),
        quality: scored.quality,
        kind: scored.kind,
      });
    }
    for (const t of data.RelatedTopics || []) {
      if (!t.FirstURL || !t.Text) continue;
      const scored = scoreSource(t.FirstURL, t.Text);
      hits.push({
        title: t.Text.slice(0, 120),
        url: t.FirstURL,
        snippet: t.Text.slice(0, 400),
        publisher: scored.publisher,
        quality: scored.quality,
        kind: scored.kind,
      });
    }
    return hits;
  } catch {
    return [];
  }
}

/** Free multi-source web search ranked by source quality. */
export async function freeWebSearch(query: string, limit = 12): Promise<SearchHit[]> {
  const [ddg, wiki, instant] = await Promise.all([
    searchDuckDuckGo(query, limit),
    searchWikipedia(query),
    searchDuckInstant(query),
  ]);

  const merged = [...ddg, ...wiki, ...instant];
  const byUrl = new Map<string, SearchHit>();
  for (const hit of merged) {
    if (!hit.url) continue;
    const prev = byUrl.get(hit.url);
    if (!prev || hit.quality > prev.quality) byUrl.set(hit.url, hit);
  }

  return [...byUrl.values()]
    .sort((a, b) => b.quality - a.quality)
    .slice(0, limit);
}

export function formatSearchBrief(hits: SearchHit[]): string {
  if (!hits.length) return "(no web hits — rely on careful inference and flag uncertainty)";
  return hits
    .map(
      (h, i) =>
        `${i + 1}. [q=${h.quality.toFixed(2)}|${h.kind}] ${h.title}\n   ${h.url}\n   ${h.snippet}\n   publisher=${h.publisher}`,
    )
    .join("\n");
}
