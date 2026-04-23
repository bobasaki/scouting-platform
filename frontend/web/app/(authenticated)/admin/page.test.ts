import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, redirectMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("../../../lib/cached-auth", () => ({
  getSession: getSessionMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("../../../components/admin/admin-workspace", () => ({
  AdminWorkspace: () => "Admin workspace shell",
}));

import AdminPage from "./page";

describe("admin page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated users to login", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    const result = await AdminPage();

    expect(redirectMock).toHaveBeenCalledWith("/login");
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).not.toHaveBeenCalledWith("/forbidden");
    expect(result).toBeNull();
  });

  it("redirects sessions without user to login", async () => {
    getSessionMock.mockResolvedValueOnce({});

    const result = await AdminPage();

    expect(redirectMock).toHaveBeenCalledWith("/login");
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).not.toHaveBeenCalledWith("/forbidden");
    expect(result).toBeNull();
  });

  it("redirects authenticated non-admin users to forbidden", async () => {
    getSessionMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        role: "user",
      },
    });

    const result = await AdminPage();

    expect(redirectMock).toHaveBeenCalledWith("/forbidden");
    expect(result).toBeNull();
  });

  it("redirects users with unknown roles to forbidden", async () => {
    getSessionMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        role: "owner",
      },
    });

    const result = await AdminPage();

    expect(redirectMock).toHaveBeenCalledWith("/forbidden");
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });

  it("renders the admin workspace for admin role", async () => {
    getSessionMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        role: "admin",
      },
    });

    const html = renderToStaticMarkup(await AdminPage());

    expect(redirectMock).not.toHaveBeenCalled();
    expect(html).toContain("Admin");
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain("Admin workspace shell");
  });
});
