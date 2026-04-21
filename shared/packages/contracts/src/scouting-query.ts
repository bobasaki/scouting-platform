export const CATALOG_SCOUTING_QUERY_PREFIX = "Catalog scouting criteria";

export const CATALOG_SCOUTING_FIELDS = [
  { key: "subscribers", label: "Subscribers" },
  { key: "views", label: "Views" },
  { key: "location", label: "Location" },
  { key: "language", label: "Language" },
  { key: "lastPostDaysSince", label: "Last post days since" },
  { key: "category", label: "Category" },
  { key: "niche", label: "Niche" },
] as const;

export type CatalogScoutingCriteriaField = (typeof CATALOG_SCOUTING_FIELDS)[number]["key"];

export type CatalogScoutingCriteria = Record<CatalogScoutingCriteriaField, string>;

export const EMPTY_CATALOG_SCOUTING_CRITERIA: CatalogScoutingCriteria = {
  subscribers: "",
  views: "",
  location: "",
  language: "",
  lastPostDaysSince: "",
  category: "",
  niche: "",
};

const CATALOG_SCOUTING_LABEL_TO_FIELD = new Map(
  CATALOG_SCOUTING_FIELDS.map((field) => [field.label.toLowerCase(), field.key]),
);

export function normalizeCatalogScoutingCriteria(
  criteria: Partial<CatalogScoutingCriteria>,
): CatalogScoutingCriteria {
  return {
    subscribers: criteria.subscribers?.trim() ?? "",
    views: criteria.views?.trim() ?? "",
    location: criteria.location?.trim() ?? "",
    language: criteria.language?.trim() ?? "",
    lastPostDaysSince: criteria.lastPostDaysSince?.trim() ?? "",
    category: criteria.category?.trim() ?? "",
    niche: criteria.niche?.trim() ?? "",
  };
}

export function hasCatalogScoutingCriteria(
  criteria: Partial<CatalogScoutingCriteria>,
): boolean {
  const normalized = normalizeCatalogScoutingCriteria(criteria);

  return Object.values(normalized).some((value) => value.length > 0);
}

export function buildCatalogScoutingQuery(
  criteria: Partial<CatalogScoutingCriteria>,
): string {
  const normalized = normalizeCatalogScoutingCriteria(criteria);
  const segments = CATALOG_SCOUTING_FIELDS.map((field) => {
    const value = normalized[field.key] || "Any";
    return `${field.label}: ${value}`;
  });

  return [CATALOG_SCOUTING_QUERY_PREFIX, ...segments].join(" | ");
}

export function isCatalogScoutingQuery(query: string): boolean {
  return query.trim().startsWith(CATALOG_SCOUTING_QUERY_PREFIX);
}

export function parseCatalogScoutingQuery(
  query: string,
): CatalogScoutingCriteria | null {
  if (!isCatalogScoutingQuery(query)) {
    return null;
  }

  const parsed = { ...EMPTY_CATALOG_SCOUTING_CRITERIA };
  const [, ...segments] = query
    .split("|")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  for (const segment of segments) {
    const separatorIndex = segment.indexOf(":");

    if (separatorIndex < 0) {
      continue;
    }

    const label = segment.slice(0, separatorIndex).trim().toLowerCase();
    const value = segment.slice(separatorIndex + 1).trim();
    const field = CATALOG_SCOUTING_LABEL_TO_FIELD.get(label);

    if (!field) {
      continue;
    }

    parsed[field] = value === "Any" ? "" : value;
  }

  return parsed;
}
