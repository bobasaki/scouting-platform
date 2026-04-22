import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStringAsync } from "../../../lib/test-render";

const { getSessionMock, dashboardWorkspaceMock, listRecentRunsMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  dashboardWorkspaceMock: vi.fn(() => "dashboard-workspace"),
  listRecentRunsMock: vi.fn(async () => ({
    items: [],
    filterOptions: {
      campaignManagers: [],
      clients: [],
      markets: [],
    },
  })),
}));

vi.mock("../../../lib/cached-auth", () => ({
  getSession: getSessionMock,
}));

vi.mock("../../../lib/cached-data", () => ({
  getCachedRecentRuns: listRecentRunsMock,
}));

vi.mock("../../../components/dashboard/dashboard-workspace", () => ({
  DashboardWorkspace: dashboardWorkspaceMock,
}));

import DashboardPage from "./page";

describe("dashboard page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({
      user: {
        id: "user-1",
        role: "user",
      },
    });
  });

  it("renders the dashboard workspace", async () => {
    const html = await renderToStringAsync(DashboardPage());

    expect(dashboardWorkspaceMock).toHaveBeenCalledTimes(1);
    const firstCall = dashboardWorkspaceMock.mock.calls[0] as unknown[] | undefined;
    expect(firstCall?.[0]).toMatchObject({
      initialData: {
        items: [],
        filterOptions: {
          campaignManagers: [],
          clients: [],
          markets: [],
        },
      },
      initialFilters: {
        campaignManagerUserId: "",
        client: "",
        market: "",
      },
    });
    expect(html).toContain("dashboard-workspace");
  });
});
