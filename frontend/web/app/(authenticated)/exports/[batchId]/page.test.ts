import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { csvExportBatchResultShellMock } = vi.hoisted(() => ({
  csvExportBatchResultShellMock: vi.fn(({ batchId }: { batchId: string }) => `csv-export-batch-result-shell:${batchId}`),
}));

vi.mock("../../../../components/exports/csv-export-batch-result-shell", () => ({
  CsvExportBatchResultShell: csvExportBatchResultShellMock,
}));

import ExportBatchResultPage from "./page";

describe("export batch result page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the export batch result shell from route params without fetching in the page", async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);

    const html = renderToStaticMarkup(
      await ExportBatchResultPage({
        params: Promise.resolve({ batchId: "batch-123" }),
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(csvExportBatchResultShellMock.mock.calls[0]?.[0]).toEqual({
      batchId: "batch-123",
    });
    expect(html).toContain("<h1 class=\"page-header__title\">Export Batch Result</h1>");
    expect(html).toContain('href="/exports"');
    expect(html).toContain("csv-export-batch-result-shell:batch-123");
  });
});
