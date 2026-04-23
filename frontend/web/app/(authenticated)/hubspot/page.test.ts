import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { hubspotPushManagerMock } = vi.hoisted(() => ({
  hubspotPushManagerMock: vi.fn(() => "hubspot-push-manager"),
}));

vi.mock("../../../components/hubspot/hubspot-push-manager", () => ({
  HubspotPushManager: hubspotPushManagerMock,
}));

import HubspotPage from "./page";

describe("hubspot page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the HubSpot push manager workspace", () => {
    const html = renderToStaticMarkup(HubspotPage());

    expect(html).toContain("HubSpot");
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(hubspotPushManagerMock).toHaveBeenCalledTimes(1);
    expect(html).toContain("hubspot-push-manager");
  });
});
