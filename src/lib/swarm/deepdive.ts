import type { EntityType } from "../types";

export type DeepDiveSeed = {
  focus: string;
  entityHint?: string;
  entityTypeHint?: EntityType;
  priority: number;
  searchQuery?: string;
};

/** Full forensic dossier for any company-like entity. */
export function companyDeepDiveSeeds(name: string): DeepDiveSeed[] {
  const n = name.trim();
  return [
    {
      focus: `COMPANY DOSSIER · ${n}: founding, HQ, leadership, business model, scale, ownership.`,
      entityHint: n,
      entityTypeHint: "company",
      priority: 10,
      searchQuery: `${n} company overview headquarters CEO`,
    },
    {
      focus: `PRODUCTS & SERVICES of ${n}: every major product line, SKU family, platform, pricing model.`,
      entityHint: n,
      entityTypeHint: "product",
      priority: 9,
      searchQuery: `${n} products services platform`,
    },
    {
      focus: `CUSTOMERS of ${n}: named customers, segments, case studies, revenue concentration.`,
      entityHint: n,
      entityTypeHint: "customer",
      priority: 9,
      searchQuery: `${n} customers case study clients`,
    },
    {
      focus: `SUPPLIERS & UPSTREAM of ${n}: vendors, critical dependencies, manufacturing partners.`,
      entityHint: n,
      entityTypeHint: "supplier",
      priority: 9,
      searchQuery: `${n} suppliers vendors supply chain`,
    },
    {
      focus: `COMPETITORS of ${n}: direct rivals, substitutes, market share claims.`,
      entityHint: n,
      entityTypeHint: "competitor",
      priority: 9,
      searchQuery: `${n} competitors market share vs`,
    },
    {
      focus: `MARKETS & GEOGRAPHY of ${n}: segments, regions, TAM/SAM if available.`,
      entityHint: n,
      entityTypeHint: "market",
      priority: 8,
      searchQuery: `${n} market share geography revenue by region`,
    },
    {
      focus: `FINANCIALS of ${n}: revenue, debt, equity, cash, funding rounds, valuation, credit.`,
      entityHint: n,
      entityTypeHint: "company",
      priority: 10,
      searchQuery: `${n} revenue debt equity funding 10-K annual report`,
    },
    {
      focus: `EQUITY & OWNERSHIP of ${n}: shareholders, investors, public float, major holders.`,
      entityHint: n,
      entityTypeHint: "company",
      priority: 8,
      searchQuery: `${n} shareholders investors ownership equity`,
    },
    {
      focus: `DEBT & LIABILITIES of ${n}: bonds, loans, leverage, credit ratings, covenants.`,
      entityHint: n,
      entityTypeHint: "risk",
      priority: 8,
      searchQuery: `${n} debt bonds credit rating liabilities`,
    },
    {
      focus: `PEOPLE of ${n}: executives, board, key hires, founders.`,
      entityHint: n,
      entityTypeHint: "person",
      priority: 7,
      searchQuery: `${n} CEO CFO board of directors executives`,
    },
    {
      focus: `PARTNERSHIPS & CHANNELS of ${n}: alliances, distributors, integrations.`,
      entityHint: n,
      entityTypeHint: "partnership",
      priority: 7,
      searchQuery: `${n} partnership alliance channel distributor`,
    },
    {
      focus: `REGULATION & RISK of ${n}: lawsuits, regulators, compliance, ESG controversies.`,
      entityHint: n,
      entityTypeHint: "regulation",
      priority: 7,
      searchQuery: `${n} lawsuit regulation SEC investigation risk`,
    },
    {
      focus: `TECHNOLOGY STACK of ${n}: platforms, IP, patents, R&D focus.`,
      entityHint: n,
      entityTypeHint: "technology",
      priority: 6,
      searchQuery: `${n} technology platform patents R&D`,
    },
    {
      focus: `BACKGROUND & HISTORY of ${n}: timeline, M&A, pivots, crises.`,
      entityHint: n,
      entityTypeHint: "company",
      priority: 7,
      searchQuery: `${n} history acquisition timeline founded`,
    },
  ];
}

export function seedTasks(company: string, task: string): DeepDiveSeed[] {
  return [
    ...companyDeepDiveSeeds(company),
    {
      focus: `Mission-aligned deep dive with citations: ${task}`,
      entityHint: company,
      entityTypeHint: "company",
      priority: 10,
      searchQuery: `${company} ${task}`,
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
