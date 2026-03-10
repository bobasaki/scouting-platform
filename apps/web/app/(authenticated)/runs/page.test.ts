import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createRunShellMock, recentRunsShellMock } = vi.hoisted(() => ({
  createRunShellMock: vi.fn(() => "create-run-shell"),
  recentRunsShellMock: vi.fn(() => "recent-runs-shell"),
}));

vi.mock("../../../components/runs/create-run-shell", () => ({
  CreateRunShell: createRunShellMock,
}));

vi.mock("../../../components/runs/recent-runs-shell", () => ({
  RecentRunsShell: recentRunsShellMock,
}));

import RunsPage from "./page";

describe("runs page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the create and recent runs shells without fetching in the page", () => {
    const html = renderToStaticMarkup(RunsPage());

    expect(html).toContain("Runs");
    expect(html).toContain(
      "Start a new discovery run against the shared catalog and review your latest run snapshots without leaving the runs surface.",
    );
    expect(createRunShellMock).toHaveBeenCalledTimes(1);
    expect(recentRunsShellMock).toHaveBeenCalledTimes(1);
    expect(html).toContain("create-run-shell");
    expect(html).toContain("recent-runs-shell");
  });
});
