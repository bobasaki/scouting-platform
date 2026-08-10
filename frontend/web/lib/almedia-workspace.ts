const ALMEDIA_TABS = ["insights", "performance", "scorecard"] as const;

export type AlmediaTab = (typeof ALMEDIA_TABS)[number];

export const ALMEDIA_TAB_LABELS = {
  insights: "Insights",
  performance: "Performance",
  scorecard: "Scorecard",
} as const satisfies Record<AlmediaTab, string>;

function isAlmediaTab(value: string | null): value is AlmediaTab {
  return ALMEDIA_TABS.some((tab) => tab === value);
}

export function resolveAlmediaTab(
  searchParams: Pick<URLSearchParams, "get">,
): AlmediaTab {
  const requestedTab = searchParams.get("tab");

  return isAlmediaTab(requestedTab) ? requestedTab : "insights";
}

export function buildAlmediaWorkspaceHref(
  pathname: string,
  searchParams: Pick<URLSearchParams, "entries">,
  next: Readonly<{ tab: AlmediaTab }>,
): string {
  const params = new URLSearchParams(Array.from(searchParams.entries()));

  // Insights is the default, so it stays out of the URL.
  if (next.tab === "insights") {
    params.delete("tab");
  } else {
    params.set("tab", next.tab);
  }

  const query = params.toString();

  return query ? `${pathname}?${query}` : pathname;
}

export const ALMEDIA_TABS_IN_ORDER: readonly AlmediaTab[] = ALMEDIA_TABS;
