import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createRunShellMock } = vi.hoisted(() => ({
  createRunShellMock: vi.fn(({ showLegacyNotice }: { showLegacyNotice?: boolean }) =>
    `new-scouting-workspace:${String(showLegacyNotice)}`,
  ),
}));

vi.mock("../../../../components/scouting/new-scouting-workspace", () => ({
  NewScoutingWorkspace: createRunShellMock,
}));

import NewRunPage from "./page";

describe("new run page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the legacy new scouting shortcut", () => {
    const html = renderToStaticMarkup(NewRunPage());

    expect(createRunShellMock.mock.calls[0]?.[0]).toEqual({
      showLegacyNotice: true,
    });
    expect(html).toContain("New Scouting");
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain("new-scouting-workspace:true");
  });
});
