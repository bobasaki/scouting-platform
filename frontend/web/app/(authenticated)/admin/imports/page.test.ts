import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, redirectMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("../../../../lib/cached-auth", () => ({
  getSession: getSessionMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import AdminImportsPage from "./page";

describe("admin imports page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated users to login", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    const result = await AdminImportsPage();

    expect(redirectMock).toHaveBeenCalledWith("/login");
    expect(result).toBeNull();
  });

  it("redirects sessions without user to login", async () => {
    getSessionMock.mockResolvedValueOnce({});

    const result = await AdminImportsPage();

    expect(redirectMock).toHaveBeenCalledWith("/login");
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });

  it("redirects authenticated non-admin users to forbidden", async () => {
    getSessionMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        role: "user",
      },
    });

    const result = await AdminImportsPage();

    expect(redirectMock).toHaveBeenCalledWith("/forbidden");
    expect(result).toBeNull();
  });

  it("redirects unknown roles to forbidden", async () => {
    getSessionMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        role: "owner",
      },
    });

    const result = await AdminImportsPage();

    expect(redirectMock).toHaveBeenCalledWith("/forbidden");
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });

  it("renders csv imports page for admin role", async () => {
    getSessionMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        role: "admin",
      },
    });

    const html = renderToStaticMarkup(await AdminImportsPage());

    expect(redirectMock).not.toHaveBeenCalled();
    expect(html).toContain("CSV Imports");
    expect(html).toContain('href="/admin"');
    expect(html).toContain("Upload CSV");
    expect(html).toContain("Loading CSV import batches...");
  });
});
