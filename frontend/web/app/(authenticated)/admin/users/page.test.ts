import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, redirectMock, pushMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  redirectMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("../../../../lib/cached-auth", () => ({
  getSession: getSessionMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  useRouter: () => ({
    push: pushMock,
  }),
}));

import AdminUsersPage from "./page";

describe("admin users page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated users to login", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    const result = await AdminUsersPage();

    expect(redirectMock).toHaveBeenCalledWith("/login");
    expect(result).toBeNull();
  });

  it("redirects sessions without user to login", async () => {
    getSessionMock.mockResolvedValueOnce({});

    const result = await AdminUsersPage();

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

    const result = await AdminUsersPage();

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

    const result = await AdminUsersPage();

    expect(redirectMock).toHaveBeenCalledWith("/forbidden");
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });

  it("renders placeholder for admin role", async () => {
    getSessionMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        role: "admin",
      },
    });

    const html = renderToStaticMarkup(await AdminUsersPage());

    expect(redirectMock).not.toHaveBeenCalled();
    expect(html).toContain("Users");
    expect(html).toContain('href="/admin"');
    expect(html).toContain("Add User");
    expect(html).toContain("Loading users...");
  });
});
