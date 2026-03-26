import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { runDetailShellMock } = vi.hoisted(() => ({
  runDetailShellMock: vi.fn(({ runId }: { runId: string }) => `run-detail-shell:${runId}`),
}));

vi.mock("../../../../components/runs/run-detail-shell", () => ({
  RunDetailShell: runDetailShellMock,
}));

import RunDetailPage from "./page";

describe("run detail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the run detail shell from route params without fetching in the page", async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);

    const html = renderToStaticMarkup(
      await RunDetailPage({
        params: Promise.resolve({ runId: "run-123" }),
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(runDetailShellMock.mock.calls[0]?.[0]).toEqual({
      runId: "run-123",
    });
    expect(html).toContain("<h1>Run Detail</h1>");
    expect(html).toContain(
      "Track discovery status, inspect stored snapshot results, and surface queue failures without leaving the runs surface.",
    );
    expect(html).toContain("run-detail-shell:run-123");
  });
});
