import { describe, expect, it, vi } from "vitest";

const { authMock, getSessionUserAccessMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getSessionUserAccessMock: vi.fn(),
}));

vi.mock("@scouting-platform/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@scouting-platform/core")>();

  return {
    ...actual,
    getSessionUserAccess: getSessionUserAccessMock,
  };
});

vi.mock("../auth", () => ({
  auth: authMock,
}));

import { ServiceError } from "@scouting-platform/core";
import { readJsonRequestBody, requireAdminSession, requireAuthenticatedSession, toRouteErrorResponse } from "./api";

describe("api route error mapping", () => {
  it("returns service errors with original message and status", async () => {
    const response = toRouteErrorResponse(new ServiceError("CHANNEL_NOT_FOUND", 404, "Not found"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Not found",
    });
  });

  it("hides unknown error details behind a generic 500 response", async () => {
    const response = toRouteErrorResponse(new Error("database connection string leaked"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Internal server error",
    });
  });

  it("hides non-Error thrown values behind a generic 500 response", async () => {
    const response = toRouteErrorResponse("unexpected string throw");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Internal server error",
    });
  });
});

describe("api route auth guards", () => {
  it("rejects missing sessions before database access", async () => {
    authMock.mockResolvedValueOnce(null);

    const result = await requireAuthenticatedSession();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
    expect(getSessionUserAccessMock).not.toHaveBeenCalled();
  });

  it("uses current database role instead of stale JWT role", async () => {
    authMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        role: "admin",
        passwordChangedAt: "2026-05-21T10:00:00.000Z",
        sessionIssuedAt: 1_779_357_600,
      },
    });
    getSessionUserAccessMock.mockResolvedValueOnce({
      id: "user-1",
      email: "user-1@example.com",
      role: "user",
    });

    const result = await requireAdminSession();

    expect(getSessionUserAccessMock).toHaveBeenCalledWith({
      userId: "user-1",
      passwordChangedAt: "2026-05-21T10:00:00.000Z",
      sessionIssuedAt: 1_779_357_600,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("allows active database-backed sessions", async () => {
    authMock.mockResolvedValueOnce({
      user: {
        id: "admin-1",
        role: "user",
      },
    });
    getSessionUserAccessMock.mockResolvedValueOnce({
      id: "admin-1",
      email: "admin-1@example.com",
      role: "admin",
    });

    await expect(requireAdminSession()).resolves.toEqual({
      ok: true,
      userId: "admin-1",
    });
  });

  it("returns the database email alongside the role for authenticated sessions", async () => {
    authMock.mockResolvedValueOnce({
      user: {
        id: "user-2",
        role: "user",
      },
    });
    getSessionUserAccessMock.mockResolvedValueOnce({
      id: "user-2",
      email: "user-2@example.com",
      role: "user",
    });

    await expect(requireAuthenticatedSession()).resolves.toEqual({
      ok: true,
      userId: "user-2",
      userEmail: "user-2@example.com",
      role: "user",
    });
  });
});

describe("api route JSON parsing", () => {
  it("returns a 400 response for malformed JSON bodies", async () => {
    const result = await readJsonRequestBody(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        body: "{",
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      await expect(result.response.json()).resolves.toEqual({
        error: "Invalid request payload",
      });
    }
  });
});
