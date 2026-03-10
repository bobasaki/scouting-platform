import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createRunShellMock } = vi.hoisted(() => ({
  createRunShellMock: vi.fn(() => "create-run-shell"),
}));

vi.mock("../../../components/runs/create-run-shell", () => ({
  CreateRunShell: createRunShellMock,
}));

import RunsPage from "./page";

describe("runs page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the create run shell without fetching in the page", () => {
    const html = renderToStaticMarkup(RunsPage());

    expect(html).toContain("Runs");
    expect(html).toContain(
      "Start a new discovery run against the shared catalog and your assigned YouTube API key. Recent-run history remains a separate Week 3 slice.",
    );
    expect(createRunShellMock).toHaveBeenCalledTimes(1);
    expect(html).toContain("create-run-shell");
  });
});
