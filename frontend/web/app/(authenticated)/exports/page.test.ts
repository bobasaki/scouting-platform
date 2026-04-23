import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { csvExportManagerMock } = vi.hoisted(() => ({
  csvExportManagerMock: vi.fn(() => "csv-export-manager"),
}));

vi.mock("../../../components/exports/csv-export-manager", () => ({
  CsvExportManager: csvExportManagerMock,
}));

import ExportsPage from "./page";

describe("exports page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the export manager workspace", () => {
    const html = renderToStaticMarkup(ExportsPage());

    expect(html).toContain("Exports");
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(csvExportManagerMock).toHaveBeenCalledTimes(1);
    expect(html).toContain("csv-export-manager");
  });
});
