import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  usePathnameMock,
  useRouterMock,
  useSearchParamsMock,
  replaceMock,
} = vi.hoisted(() => ({
  usePathnameMock: vi.fn(),
  useRouterMock: vi.fn(),
  useSearchParamsMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock("next/dynamic", () => {
  let dynamicImportIndex = 0;

  return {
    default: vi.fn(() => {
      const label = dynamicImportIndex === 0 ? "csv-import-manager" : "admin-users-manager";
      dynamicImportIndex += 1;

      return () => label;
    }),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
  useRouter: useRouterMock,
  useSearchParams: useSearchParamsMock,
}));

import { AdminWorkspace } from "./admin-workspace";

describe("admin workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePathnameMock.mockReturnValue("/admin");
    useRouterMock.mockReturnValue({
      replace: replaceMock,
    });
  });

  it("defaults to the csv imports tab", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams(""));

    const html = renderToStaticMarkup(createElement(AdminWorkspace));

    expect(html).toContain("CSV Imports");
    expect(html).toContain("Users");
    expect(html).toContain("csv-import-manager");
    expect(html).not.toContain("Approvals");
    expect(html).not.toContain("Exports");
    expect(html).not.toContain("HubSpot");
  });

  it("renders the users manager when the users tab is active", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("tab=users"));

    const html = renderToStaticMarkup(createElement(AdminWorkspace));

    expect(html).toContain("admin-users-manager");
    expect(html).not.toContain("csv-import-manager");
  });

  it.each(["approvals", "exports", "hubspot"])(
    "falls back to imports for old %s tab URLs",
    (tab) => {
      useSearchParamsMock.mockReturnValue(new URLSearchParams(`tab=${tab}`));

      const html = renderToStaticMarkup(createElement(AdminWorkspace));

      expect(html).toContain("csv-import-manager");
      expect(html).not.toContain("admin-users-manager");
      expect(html).not.toContain("Approvals");
      expect(html).not.toContain("Exports");
      expect(html).not.toContain("HubSpot");
    },
  );
});
