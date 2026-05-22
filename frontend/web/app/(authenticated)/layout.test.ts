import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, getSessionUserAccessMock, prefetchMock, redirectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getSessionUserAccessMock: vi.fn(),
  prefetchMock: vi.fn(),
  redirectMock: vi.fn()
}));

vi.mock("../../auth", () => ({
  auth: authMock
}));

vi.mock("@scouting-platform/core", () => ({
  getSessionUserAccess: getSessionUserAccessMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  usePathname: () => "/dashboard",
  useRouter: () => ({
    prefetch: prefetchMock,
  }),
}));

import AuthenticatedLayout from "./layout";

describe("authenticated app layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserAccessMock.mockImplementation(async ({ userId, role }: { userId: string; role?: "admin" | "user" }) => ({
      id: userId,
      role: role ?? "user",
    }));
  });

  it("redirects unauthenticated users to login", async () => {
    authMock.mockResolvedValueOnce(null);

    const result = await AuthenticatedLayout({ children: "route body" });

    expect(redirectMock).toHaveBeenCalledWith("/login");
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });

  it("redirects sessions without a user object to login", async () => {
    authMock.mockResolvedValueOnce({});

    const result = await AuthenticatedLayout({ children: "route body" });

    expect(redirectMock).toHaveBeenCalledWith("/login");
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });

  it("renders shared shell links for user role", async () => {
    authMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        role: "user"
      }
    });
    getSessionUserAccessMock.mockResolvedValueOnce({ id: "user-1", role: "user" });

    const html = renderToStaticMarkup(await AuthenticatedLayout({ children: "catalog" }));

    expect(redirectMock).not.toHaveBeenCalled();
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/database"');
    expect(html).not.toContain('href="/admin"');
  });

  it("renders admin navigation for admin role", async () => {
    authMock.mockResolvedValueOnce({
      user: {
        id: "admin-1",
        role: "admin"
      }
    });
    getSessionUserAccessMock.mockResolvedValueOnce({ id: "admin-1", role: "admin" });

    const html = renderToStaticMarkup(await AuthenticatedLayout({ children: "admin" }));

    expect(html).toContain('href="/admin"');
  });

  it("falls back to user navigation when session role is unknown", async () => {
    authMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        role: "owner"
      }
    });
    getSessionUserAccessMock.mockResolvedValueOnce({ id: "user-1", role: "user" });

    const html = renderToStaticMarkup(await AuthenticatedLayout({ children: "catalog" }));

    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/database"');
    expect(html).not.toContain('href="/admin"');
  });
});
