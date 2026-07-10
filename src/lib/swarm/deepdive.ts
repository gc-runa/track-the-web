import type { EntityType } from "../types";

export type DeepDiveSeed = {
  focus: string;
  entityHint?: string;
  entityTypeHint?: EntityType;
  priority: number;
  searchQuery?: string;
  role?: string;
};

/** Full forensic dossier for any company-like entity — one agent per facet. */
export function companyDeepDiveSeeds(name: string): DeepDiveSeed[] {
  const n = name.trim();
  return [
    {
      focus: `COMPANY DOSSIER · ${n}: founding year, HQ, legal entity, leadership, business model, scale (employees/revenue if public), ownership form (public/private).`,
      entityHint: n,
      entityTypeHint: "company",
      priority: 10,
      searchQuery: `${n} company overview headquarters CEO founded`,
      role: "general market-intelligence analyst",
    },
    {
      focus: `PRODUCTS & SERVICES of ${n}: every major product line, platform, SKU family, and pricing/monetization model with named offerings.`,
      entityHint: n,
      entityTypeHint: "product",
      priority: 9,
      searchQuery: `${n} products services platform portfolio`,
      role: "product intelligence analyst",
    },
    {
      focus: `NAMED CUSTOMERS of ${n}: specific customer companies, case studies, logo lists, segment mix, and any revenue concentration signals.`,
      entityHint: n,
      entityTypeHint: "customer",
      priority: 10,
      searchQuery: `${n} customers clients case study "works with"`,
      role: "customer & demand analyst",
    },
    {
      focus: `SUPPLIERS & UPSTREAM of ${n}: named vendors, critical component/service dependencies, contract manufacturers, cloud providers.`,
      entityHint: n,
      entityTypeHint: "supplier",
      priority: 9,
      searchQuery: `${n} suppliers vendors "supply chain" manufacturer`,
      role: "supply-chain investigator",
    },
    {
      focus: `COMPETITORS of ${n}: direct rivals, substitutes, adjacent platforms, and any market-share or positioning claims with sources.`,
      entityHint: n,
      entityTypeHint: "competitor",
      priority: 10,
      searchQuery: `${n} competitors rivals "vs" market share`,
      role: "competitive intelligence scout",
    },
    {
      focus: `MARKETS & GEOGRAPHY of ${n}: end markets, verticals, regions, and any TAM/SAM/SOM figures that appear in filings or reputable research.`,
      entityHint: n,
      entityTypeHint: "market",
      priority: 8,
      searchQuery: `${n} market share geography "revenue by" segment`,
      role: "general market-intelligence analyst",
    },
    {
      focus: `FINANCIALS of ${n}: revenue, growth, margins, cash, guidance — cite 10-K/10-Q/IR or credible press only.`,
      entityHint: n,
      entityTypeHint: "company",
      priority: 10,
      searchQuery: `${n} revenue "annual report" 10-K earnings`,
      role: "forensic financial analyst",
    },
    {
      focus: `EQUITY & OWNERSHIP of ${n}: major shareholders, institutional holders, investors, founders' stakes, public float.`,
      entityHint: n,
      entityTypeHint: "company",
      priority: 9,
      searchQuery: `${n} shareholders investors ownership "institutional"`,
      role: "forensic financial analyst",
    },
    {
      focus: `DEBT & LIABILITIES of ${n}: bonds, loans, leverage ratios, credit ratings, material covenants or refinancing risk.`,
      entityHint: n,
      entityTypeHint: "risk",
      priority: 8,
      searchQuery: `${n} debt bonds "credit rating" liabilities leverage`,
      role: "forensic financial analyst",
    },
    {
      focus: `PEOPLE of ${n}: CEO, CFO, key executives, board members, founders — roles and notable prior affiliations.`,
      entityHint: n,
      entityTypeHint: "person",
      priority: 8,
      searchQuery: `${n} CEO CFO "board of directors" executives leadership`,
      role: "leadership & org mapper",
    },
    {
      focus: `PARTNERSHIPS & CHANNELS of ${n}: alliances, distributors, resellers, cloud marketplace listings, strategic integrations.`,
      entityHint: n,
      entityTypeHint: "partnership",
      priority: 7,
      searchQuery: `${n} partnership alliance channel distributor integration`,
      role: "partnership & channel scout",
    },
    {
      focus: `REGULATION & RISK of ${n}: lawsuits, regulators, investigations, sanctions, material ESG or compliance controversies.`,
      entityHint: n,
      entityTypeHint: "regulation",
      priority: 7,
      searchQuery: `${n} lawsuit regulation SEC investigation fine risk`,
      role: "regulatory & risk analyst",
    },
    {
      focus: `TECHNOLOGY & IP of ${n}: core platforms, patents, proprietary tech, R&D focus areas.`,
      entityHint: n,
      entityTypeHint: "technology",
      priority: 7,
      searchQuery: `${n} technology platform patents "R&D" intellectual property`,
      role: "technology & IP analyst",
    },
    {
      focus: `HISTORY & M&A of ${n}: founding story, major acquisitions, divestitures, pivots, crises.`,
      entityHint: n,
      entityTypeHint: "company",
      priority: 7,
      searchQuery: `${n} history acquisition "acquired" timeline founded merger`,
      role: "general market-intelligence analyst",
    },
  ];
}

export function seedTasks(company: string, task: string): DeepDiveSeed[] {
  return [
    ...companyDeepDiveSeeds(company),
    {
      focus: `MISSION LOCK · Execute with citations: ${task}. Prioritize named entities and relationship edges that advance this mission.`,
      entityHint: company,
      entityTypeHint: "company",
      priority: 10,
      searchQuery: `${company} ${task}`.slice(0, 160),
      role: "general market-intelligence analyst",
    },
    {
      focus: `ECOSYSTEM SWEEP · ${company}: list every named company that appears as customer, supplier, competitor, partner, or investor in reputable sources.`,
      entityHint: company,
      entityTypeHint: "company",
      priority: 9,
      searchQuery: `${company} ecosystem partners customers suppliers competitors`,
      role: "competitive intelligence scout",
    },
  ];
}

export function shouldDeepDiveType(type: EntityType) {
  return (
    type === "company" ||
    type === "competitor" ||
    type === "supplier" ||
    type === "customer"
  );
}

/** Coverage facets used by the orchestrator gap detector. */
export const COVERAGE_FACETS: Array<{
  key: string;
  types: EntityType[];
  label: string;
}> = [
  { key: "customers", types: ["customer"], label: "named customers" },
  { key: "suppliers", types: ["supplier"], label: "named suppliers" },
  { key: "competitors", types: ["competitor"], label: "named competitors" },
  { key: "products", types: ["product"], label: "products/services" },
  { key: "people", types: ["person"], label: "executives/board" },
  { key: "markets", types: ["market", "segment"], label: "markets/segments" },
  {
    key: "partnerships",
    types: ["partnership", "channel"],
    label: "partnerships/channels",
  },
  {
    key: "risks",
    types: ["regulation", "risk"],
    label: "regulation/risk",
  },
  {
    key: "tech",
    types: ["technology"],
    label: "technology/IP",
  },
];
