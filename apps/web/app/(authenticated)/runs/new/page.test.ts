import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createRunShellMock } = vi.hoisted(() => ({
  createRunShellMock: vi.fn(({ showRunsIndexLink }: { showRunsIndexLink?: boolean }) =>
    `create-run-shell:${String(showRunsIndexLink)}`,
  ),
}));

vi.mock("../../../../components/runs/create-run-shell", () => ({
  CreateRunShell: createRunShellMock,
}));

import NewRunPage from "./page";

describe("new run page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the create run shell with a back link enabled", () => {
    const html = renderToStaticMarkup(NewRunPage());

    expect(createRunShellMock.mock.calls[0]?.[0]).toEqual({
      showRunsIndexLink: true,
    });
    expect(html).toContain("<h1>Create Run</h1>");
    expect(html).toContain(
      "Kick off a discovery run and move straight into its live queue-backed detail view.",
    );
    expect(html).toContain("create-run-shell:true");
  });
});
