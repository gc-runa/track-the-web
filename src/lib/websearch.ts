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
  { host: "cnbc.com", score: 0.84, kind: "news" },
  { host: "forbes.com", score: 0.75, kind: "news" },
  { host: "marketwatch.com", score: 0.8, kind: "news" },
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
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

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
    if (
      host === row.host ||
      host.endsWith(`.${row.host}`) ||
      host.includes(row.host)
    ) {
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

function stripHtml(s: string) {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(
  url: string,
  init: RequestInit = {},
  timeoutMs = 4500,
): Promise<{ ok: boolean; status: number; text: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        ...(init.headers || {}),
      },
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch {
    return { ok: false, status: 0, text: "" };
  } finally {
    clearTimeout(t);
  }
}

function decodeBingRedirect(href: string): string | null {
  try {
    const u = new URL(href.replace(/&amp;/g, "&"));
    const raw = u.searchParams.get("u");
    if (raw?.startsWith("a1")) {
      return Buffer.from(raw.slice(2), "base64").toString("utf8");
    }
    if (href.startsWith("http") && !/bing\.com/i.test(href)) return href;
  } catch {
    /* ignore */
  }
  return null;
}

/** Wikipedia opensearch + page summaries */
async function searchWikipediaOpen(query: string): Promise<SearchHit[]> {
  const res = await fetchText(
    `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=6&namespace=0&format=json`,
  );
  if (!res.ok) return [];
  try {
    const data = JSON.parse(res.text) as [string, string[], string[], string[]];
    const titles = data[1] || [];
    const links = data[3] || [];
    const hits: SearchHit[] = [];
    await Promise.all(
      titles.slice(0, 5).map(async (title, i) => {
        const link =
          links[i] ||
          `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
        let snippet = title;
        const sum = await fetchText(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
          {},
          3000,
        );
        if (sum.ok) {
          try {
            const j = JSON.parse(sum.text) as { extract?: string };
            if (j.extract) snippet = j.extract.slice(0, 400);
          } catch {
            /* ignore */
          }
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

/** Wikipedia full-text search with snippets (more recall). */
async function searchWikipediaQuery(query: string): Promise<SearchHit[]> {
  const res = await fetchText(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=8&utf8=&format=json`,
  );
  if (!res.ok) return [];
  try {
    const data = JSON.parse(res.text) as {
      query?: { search?: Array<{ title: string; snippet: string }> };
    };
    return (data.query?.search || []).map((row) => ({
      title: row.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(row.title.replace(/ /g, "_"))}`,
      snippet: stripHtml(row.snippet).slice(0, 400),
      publisher: "wikipedia.org",
      quality: 0.8,
      kind: "research" as const,
    }));
  } catch {
    return [];
  }
}

/** Bing HTML scrape — works when DuckDuckGo is blocked/timing out. */
async function searchBing(query: string): Promise<SearchHit[]> {
  const res = await fetchText(
    `https://www.bing.com/search?q=${encodeURIComponent(query)}&cc=us&setlang=en-US&ensearch=1`,
    { headers: { Accept: "text/html" } },
    5000,
  );
  if (!res.ok || !res.text) return [];
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  const blocks = res.text.match(/<li class="b_algo"[\s\S]*?<\/li>/g) || [];
  for (const block of blocks) {
    if (hits.length >= 12) break;
    const a = block.match(
      /<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
    );
    if (!a) continue;
    const title = stripHtml(a[2]);
    const decoded = decodeBingRedirect(a[1]);
    if (!decoded || !/^https?:\/\//i.test(decoded)) continue;
    const cleanUrl = decoded
      .replace(/([?&])msockid=[^&]+/g, "")
      .replace(/[?&]$/, "");
    if (
      seen.has(cleanUrl) ||
      /bing\.com|microsoft\.com\/en-us\/bing/i.test(cleanUrl)
    )
      continue;
    seen.add(cleanUrl);
    const snipMatch =
      block.match(/<p class="b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
      block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const snippet = stripHtml(snipMatch?.[1] || title).slice(0, 400);
    const scored = scoreSource(cleanUrl, title);
    hits.push({
      title: title.slice(0, 160),
      url: cleanUrl,
      snippet,
      publisher: scored.publisher,
      quality: scored.quality,
      kind: scored.kind,
    });
  }
  return hits;
}

/** Public SearXNG JSON instances (best-effort free meta-search). */
async function searchSearx(query: string): Promise<SearchHit[]> {
  const endpoints = [
    `https://searx.be/search?q=${encodeURIComponent(query)}&format=json&language=en`,
    `https://search.sapti.me/search?q=${encodeURIComponent(query)}&format=json&language=en`,
  ];
  for (const endpoint of endpoints) {
    const res = await fetchText(endpoint, { headers: { Accept: "application/json" } }, 4000);
    if (!res.ok) continue;
    try {
      const data = JSON.parse(res.text) as {
        results?: Array<{ title?: string; url?: string; content?: string }>;
      };
      const hits: SearchHit[] = [];
      for (const row of data.results || []) {
        if (!row.url || !row.title || !/^https?:\/\//i.test(row.url)) continue;
        if (/searx|duckduckgo\.com\/y\.js/i.test(row.url)) continue;
        const scored = scoreSource(row.url, row.title);
        hits.push({
          title: row.title.slice(0, 160),
          url: row.url,
          snippet: (row.content || row.title).slice(0, 400),
          publisher: scored.publisher,
          quality: Math.max(scored.quality, 0.55),
          kind: scored.kind,
        });
        if (hits.length >= 10) break;
      }
      if (hits.length) return hits;
    } catch {
      /* try next */
    }
  }
  return [];
}

/** Short-timeout DDG instant — often dead from cloud IPs; never block the swarm. */
async function searchDuckInstant(query: string): Promise<SearchHit[]> {
  const res = await fetchText(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
    {},
    2500,
  );
  if (!res.ok) return [];
  try {
    const data = JSON.parse(res.text) as {
      Heading?: string;
      Abstract?: string;
      AbstractURL?: string;
      AbstractSource?: string;
      RelatedTopics?: Array<
        | { Text?: string; FirstURL?: string }
        | { Topics?: Array<{ Text?: string; FirstURL?: string }> }
      >;
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
    for (const t of data.RelatedTopics || []) {
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

function mergeHits(groups: SearchHit[][]): SearchHit[] {
  const byUrl = new Map<string, SearchHit>();
  for (const hit of groups.flat()) {
    if (!hit.url || !/^https?:\/\//i.test(hit.url)) continue;
    const key = hit.url.replace(/\/$/, "").toLowerCase();
    const prev = byUrl.get(key);
    if (!prev) {
      byUrl.set(key, hit);
      continue;
    }
    byUrl.set(key, {
      ...prev,
      title: hit.title.length > prev.title.length ? hit.title : prev.title,
      snippet:
        hit.snippet.length > prev.snippet.length ? hit.snippet : prev.snippet,
      quality: Math.max(prev.quality, hit.quality),
      kind: hit.quality >= prev.quality ? hit.kind : prev.kind,
      publisher: hit.quality >= prev.quality ? hit.publisher : prev.publisher,
    });
  }
  return [...byUrl.values()].sort((a, b) => b.quality - a.quality);
}

/** Free multi-source web search ranked by source quality. */
export async function freeWebSearch(
  query: string,
  limit = 12,
): Promise<SearchHit[]> {
  const q = query.trim().slice(0, 180);
  if (!q) return [];

  // Run reliable sources in parallel; never let one hung provider stall the swarm.
  const settled = await Promise.allSettled([
    searchBing(q),
    searchWikipediaOpen(q),
    searchWikipediaQuery(q),
    searchSearx(q),
    searchDuckInstant(q),
  ]);

  const groups = settled.map((r) =>
    r.status === "fulfilled" ? r.value : [],
  );

  return mergeHits(groups).slice(0, limit);
}

export function formatSearchBrief(hits: SearchHit[]): string {
  if (!hits.length) {
    return "(NO WEB HITS — emit zero entities; only followUps with better search queries)";
  }
  return hits
    .map(
      (h, i) =>
        `${i + 1}. [q=${h.quality.toFixed(2)}|${h.kind}] ${h.title}\n   ${h.url}\n   ${h.snippet}\n   publisher=${h.publisher}`,
    )
    .join("\n");
}
