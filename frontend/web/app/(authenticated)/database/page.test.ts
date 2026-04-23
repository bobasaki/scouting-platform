import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStringAsync } from "../../../lib/test-render";

const {
  getSessionMock,
  databaseAdminWorkspaceMock,
  getCachedCampaignsMock,
  getCachedClientsMock,
  getCachedDropdownValuesMock,
  getCachedHubspotObjectSyncRunsMock,
} =
  vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  databaseAdminWorkspaceMock: vi.fn(() => "database-admin-workspace"),
  getCachedCampaignsMock: vi.fn(async () => ({
    items: [],
    filterOptions: { clients: [], markets: [] },
    permissions: { canCreate: true, role: "user", userType: "campaign_manager" as const },
  })),
  getCachedClientsMock: vi.fn(async () => ({
    items: [],
    permissions: { canCreate: true },
  })),
  getCachedDropdownValuesMock: vi.fn(async () => ({
    items: [],
  })),
  getCachedHubspotObjectSyncRunsMock: vi.fn(async () => ({
    items: [],
    latest: null,
  })),
}));

vi.mock("../../../lib/cached-auth", () => ({
  getSession: getSessionMock,
}));

vi.mock("../../../components/database/database-admin-workspace", () => ({
  DatabaseAdminWorkspace: databaseAdminWorkspaceMock,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("../../../lib/cached-data", () => ({
  getCachedCampaigns: getCachedCampaignsMock,
  getCachedClients: getCachedClientsMock,
  getCachedDropdownValues: getCachedDropdownValuesMock,
  getCachedHubspotObjectSyncRuns: getCachedHubspotObjectSyncRunsMock,
}));

import DatabasePage from "./page";

describe("database page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({
      user: {
        id: "user-1",
        role: "admin",
      },
    });
  });

  it("renders the database workspace for authenticated users", async () => {
    const html = await renderToStringAsync(DatabasePage());

    expect(databaseAdminWorkspaceMock).toHaveBeenCalledTimes(1);
    expect(html).toContain("Database");
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain("database-admin-workspace");
  });

  it("renders the database workspace when HubSpot sync run metadata is unavailable", async () => {
    getCachedHubspotObjectSyncRunsMock.mockRejectedValueOnce(
      Object.assign(new Error("Prisma client is stale"), {
        code: "HUBSPOT_OBJECT_SYNC_MODEL_UNAVAILABLE",
      }),
    );

    await renderToStringAsync(DatabasePage());

    expect(databaseAdminWorkspaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hubspotSyncRuns: {
          items: [],
          latest: null,
        },
      }),
      undefined,
    );
  });
});
