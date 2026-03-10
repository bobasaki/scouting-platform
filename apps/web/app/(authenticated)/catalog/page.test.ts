import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../components/catalog/catalog-table-shell", () => ({
  CatalogTableShell: () => "catalog-table-shell",
}));

import CatalogPage from "./page";

describe("catalog page", () => {
  it("renders the catalog table shell", () => {
    const html = renderToStaticMarkup(CatalogPage());

    expect(html).toContain("Catalog");
    expect(html).toContain(
      "Browse the shared creator catalog, search across channel identity fields, and filter by enrichment or advanced report status.",
    );
    expect(html).toContain("catalog-table-shell");
    expect(html).not.toContain("Filters land in Week 2.");
  });
});
