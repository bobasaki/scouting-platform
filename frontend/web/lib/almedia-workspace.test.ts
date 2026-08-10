import { describe, expect, it } from "vitest";

import {
  ALMEDIA_TABS_IN_ORDER,
  buildAlmediaWorkspaceHref,
  resolveAlmediaTab,
} from "./almedia-workspace";

describe("resolveAlmediaTab", () => {
  it("defaults to insights", () => {
    expect(resolveAlmediaTab(new URLSearchParams())).toBe("insights");
  });

  it("reads a known tab from the query string", () => {
    expect(resolveAlmediaTab(new URLSearchParams("tab=performance"))).toBe(
      "performance",
    );
    expect(resolveAlmediaTab(new URLSearchParams("tab=scorecard"))).toBe("scorecard");
  });

  it("falls back to insights for an unknown tab", () => {
    expect(resolveAlmediaTab(new URLSearchParams("tab=invoices"))).toBe("insights");
  });
});

describe("buildAlmediaWorkspaceHref", () => {
  it("omits the default tab from the URL", () => {
    expect(
      buildAlmediaWorkspaceHref("/almedia", new URLSearchParams("tab=scorecard"), {
        tab: "insights",
      }),
    ).toBe("/almedia");
  });

  it("writes non-default tabs", () => {
    expect(
      buildAlmediaWorkspaceHref("/almedia", new URLSearchParams(), {
        tab: "performance",
      }),
    ).toBe("/almedia?tab=performance");
  });

  it("preserves unrelated query params", () => {
    expect(
      buildAlmediaWorkspaceHref("/almedia", new URLSearchParams("month=2026-07"), {
        tab: "scorecard",
      }),
    ).toBe("/almedia?month=2026-07&tab=scorecard");
  });
});

describe("tab order", () => {
  it("renders Insights, Performance, then Scorecard", () => {
    expect(ALMEDIA_TABS_IN_ORDER).toEqual(["insights", "performance", "scorecard"]);
  });
});
