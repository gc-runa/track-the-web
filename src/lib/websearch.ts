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

const HIGH_QUALITY_HOSTS: Array<{
  host: string;
  score: number;
  kind: SearchHit["kind"];
}> = [
  { host: "sec.gov", score: 1.0, kind: "filing" },
  { host: "edgar.sec.gov", score: 1.0, kind: "filing" },
  { host: "reuters.com", score: 0.9, kind: "news" },
  { host: "bloomberg.com", score: 0.9, kind: "news" },
  { host: "ft.com", score: 0.9, kind: "news" },
  { host: "wsj.com", score: 0.88, kind: "news" },
  { host: "nytimes.com", score: 0.85, kind: "news" },
  { host: "economist.com", score: 0.85, kind: "news" },
  { host: "forbes.com", score: 0.75, kind: "news" },
  { host: "wikipedia.org", score: 0.82, kind: "research" },
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
];

const UA =
  "Mozilla/5.0 (compatible; TrackTheWeb/1.0; +https://track-the-web.onrender.com)";

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function scoreSource(
  url: string,
  title = "",
): { quality: number; kind: SearchHit["kind"]; publisher: string } {
  const host = hostOf(url);
  let best = { quality: 0.45, kind: "other" as SearchHit["kind"] };
  for (const row of HIGH_QUALITY_HOSTS) {
    if (host === row.host || host.endsWith(`.${row.host}`) || host.includes(row.host)) {
      if (row.score > best.quality) best = { quality: row.score, kind: row.kind };
    }
  }
  if (
    /investor|ir\./i.test(host) ||
    /investor relations|10-k|10-q|annual report/i.test(title)
  ) {
    best = {
      quality: Math.max(best.quality, 0.9),
      kind: best.kind === "other" ? "company_site" : best.kind,
    };
  }
  return { ...best, publisher: host || "web" };
}

function decodeDuckUrl(raw: string) {
  try {
    const u = new URL(raw, "https://duckduckgo.com");
    const uddg = u.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    return raw.startsWith("http") ? raw : `https:${raw}`;
  } catch {
    return raw;
  }
}

async function searchWikipedia(query: string): Promise<SearchHit[]> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=6&namespace=0&format=json`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return [];
    const data = (await res.json()) as [string, string[], string[], string[]];
    const titles = data[1] || [];
    const links = data[3] || [];

    const hits: SearchHit[] = [];
    await Promise.all(
      titles.map(async (title, i) => {
        const link =
          links[i] ||
          `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
        let snippet = title;
        try {
          const sumRes = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
            { headers: { "User-Agent": UA } },
          );
          if (sumRes.ok) {
            const sum = (await sumRes.json()) as { extract?: string };
            if (sum.extract) snippet = sum.extract.slice(0, 400);
          }
        } catch {
          /* ignore */
        }
        hits.push({
          title,
          url: link,
          snippet,
          publisher: "wikipedia.org",
          quality: 0.82,
          kind: "research",
        });
      }),
    );
    return hits;
  } catch {
    return [];
  }
}

async function searchDuckInstant(query: string): Promise<SearchHit[]> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      Heading?: string;
      Abstract?: string;
      AbstractURL?: string;
      AbstractSource?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string } | { Topics?: Array<{ Text?: string; FirstURL?: string }> }>;
    };
    const hits: SearchHit[] = [];
    if (data.Abstract && data.AbstractURL) {
      const scored = scoreSource(data.AbstractURL, data.Heading || query);
      hits.push({
        title: data.Heading || query,
        url: data.AbstractURL,
        snippet: data.Abstract.slice(0, 400),
        publisher: data.AbstractSource || scored.publisher,
        quality: Math.max(scored.quality, 0.8),
        kind: scored.kind,
      });
    }
    const topics = data.RelatedTopics || [];
    for (const t of topics) {
      if ("FirstURL" in t && t.FirstURL && t.Text) {
        const scored = scoreSource(t.FirstURL, t.Text);
        hits.push({
          title: t.Text.slice(0, 120),
          url: t.FirstURL,
          snippet: t.Text.slice(0, 400),
          publisher: scored.publisher,
          quality: scored.quality,
          kind: scored.kind,
        });
      } else if ("Topics" in t && Array.isArray(t.Topics)) {
        for (const sub of t.Topics.slice(0, 4)) {
          if (!sub.FirstURL || !sub.Text) continue;
          const scored = scoreSource(sub.FirstURL, sub.Text);
          hits.push({
            title: sub.Text.slice(0, 120),
            url: sub.FirstURL,
            snippet: sub.Text.slice(0, 400),
            publisher: scored.publisher,
            quality: scored.quality,
            kind: scored.kind,
          });
        }
      }
    }
    return hits;
  } catch {
    return [];
  }
}

async function searchDuckLite(query: string): Promise<SearchHit[]> {
  try {
    const res = await fetch(
      `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
      { headers: { "User-Agent": UA, Accept: "text/html" } },
    );
    if (!res.ok) return [];
    const html = await res.text();
    const hits: SearchHit[] = [];

    // lite results: <a rel="nofollow" href="...">title</a> near snippets
    const linkRe =
      /<a[^>]+rel="nofollow"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
    let m: RegExpExecArray | null;
    const seen = new Set<string>();
    while ((m = linkRe.exec(html)) && hits.length < 12) {
      const href = decodeDuckUrl(m[1]);
      const title = m[2].replace(/\s+/g, " ").trim();
      if (!href.startsWith("http") || seen.has(href)) continue;
      if (/duckduckgo\.com/i.test(href)) continue;
      seen.add(href);
      const scored = scoreSource(href, title);
      hits.push({
        title,
        url: href,
        snippet: title,
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

async function searchDuckScrape(_query: string): Promise<SearchHit[]> {
  // duck-duck-scrape is frequently rate-limited; keep as no-op fallback.
  return [];
}

/** Free multi-source web search ranked by source quality. */
export async function freeWebSearch(
  query: string,
  limit = 12,
): Promise<SearchHit[]> {
  const [wiki, instant, lite] = await Promise.all([
    searchWikipedia(query),
    searchDuckInstant(query),
    searchDuckLite(query),
  ]);

  // Optional scrape — often rate-limited; never block the swarm on it.
  const scraped = await searchDuckScrape(query);

  const merged = [...wiki, ...instant, ...lite, ...scraped];
  const byUrl = new Map<string, SearchHit>();
  for (const hit of merged) {
    if (!hit.url) continue;
    const prev = byUrl.get(hit.url);
    if (!prev) {
      byUrl.set(hit.url, hit);
      continue;
    }
    byUrl.set(hit.url, {
      ...prev,
      title: hit.title.length > prev.title.length ? hit.title : prev.title,
      snippet:
        hit.snippet.length > prev.snippet.length ? hit.snippet : prev.snippet,
      quality: Math.max(prev.quality, hit.quality),
      kind: hit.quality >= prev.quality ? hit.kind : prev.kind,
      publisher: hit.quality >= prev.quality ? hit.publisher : prev.publisher,
    });
  }

  return [...byUrl.values()]
    .sort((a, b) => b.quality - a.quality)
    .slice(0, limit);
}

export function formatSearchBrief(hits: SearchHit[]): string {
  if (!hits.length) {
    return "(no web hits this turn — mark uncertain claims as inference)";
  }
  return hits
    .map(
      (h, i) =>
        `${i + 1}. [q=${h.quality.toFixed(2)}|${h.kind}] ${h.title}\n   ${h.url}\n   ${h.snippet}\n   publisher=${h.publisher}`,
    )
    .join("\n");
}
