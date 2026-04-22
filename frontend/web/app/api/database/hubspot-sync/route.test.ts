import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createHubspotObjectSyncRunMock,
  listHubspotObjectSyncRunsMock,
  requireAdminSessionMock,
  toRouteErrorResponseMock,
} = vi.hoisted(() => ({
  createHubspotObjectSyncRunMock: vi.fn(),
  listHubspotObjectSyncRunsMock: vi.fn(),
  requireAdminSessionMock: vi.fn(),
  toRouteErrorResponseMock: vi.fn((error: unknown) =>
    Response.json({ error: error instanceof Error ? error.message : "error" }, { status: 500 }),
  ),
}));

vi.mock("@scouting-platform/core", () => ({
  createHubspotObjectSyncRun: createHubspotObjectSyncRunMock,
  listHubspotObjectSyncRuns: listHubspotObjectSyncRunsMock,
}));

vi.mock("../../../../lib/api", () => ({
  requireAdminSession: requireAdminSessionMock,
  toRouteErrorResponse: toRouteErrorResponseMock,
}));

import { GET, POST } from "./route";

const run = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "queued",
  objectTypes: ["clients", "campaigns"],
  clientUpsertCount: 0,
  campaignUpsertCount: 0,
  deactivatedCount: 0,
  startedAt: null,
  completedAt: null,
  lastError: null,
  createdAt: "2026-04-22T08:00:00.000Z",
  updatedAt: "2026-04-22T08:00:00.000Z",
};

describe("database hubspot sync route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      ok: true,
      userId: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("lists sync runs for admins", async () => {
    listHubspotObjectSyncRunsMock.mockResolvedValue({
      items: [run],
      latest: run,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [run],
      latest: run,
    });
    expect(listHubspotObjectSyncRunsMock).toHaveBeenCalledWith({
      requestedByUserId: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("creates sync runs for admins", async () => {
    createHubspotObjectSyncRunMock.mockResolvedValue(run);

    const response = await POST();

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ run });
    expect(createHubspotObjectSyncRunMock).toHaveBeenCalledWith({
      requestedByUserId: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("rejects unauthenticated requests", async () => {
    const authResponse = Response.json({ error: "Unauthorized" }, { status: 401 });
    requireAdminSessionMock.mockResolvedValue({
      ok: false,
      response: authResponse,
    });

    await expect(GET()).resolves.toBe(authResponse);
    await expect(POST()).resolves.toBe(authResponse);
  });
});
