import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ClientsWorkspace } from "./clients-workspace";

describe("ClientsWorkspace", () => {
  it("renders HubSpot sync metadata", () => {
    const html = renderToStaticMarkup(
      createElement(ClientsWorkspace, {
        initialData: {
          items: [
            {
              id: "33333333-3333-4333-8333-333333333333",
              name: "Local Client",
              domain: "local.example",
              countryRegion: "Croatia",
              city: "Zagreb",
              isActive: true,
              hubspotObjectId: null,
              hubspotObjectType: null,
              hubspotArchived: false,
              hubspotSyncedAt: null,
              createdAt: "2026-04-22T09:00:00.000Z",
              updatedAt: "2026-04-22T10:00:00.000Z",
            },
            {
              id: "22222222-2222-4222-8222-222222222222",
              name: "Active Client",
              domain: "active.example",
              countryRegion: "Croatia",
              city: "Zagreb",
              isActive: true,
              hubspotObjectId: "102",
              hubspotObjectType: "2-CLIENT",
              hubspotArchived: false,
              hubspotSyncedAt: "2026-04-22T10:00:00.000Z",
              createdAt: "2026-04-22T09:00:00.000Z",
              updatedAt: "2026-04-22T10:00:00.000Z",
            },
            {
              id: "11111111-1111-4111-8111-111111111111",
              name: "Archived Client",
              domain: "client.example",
              countryRegion: "Croatia",
              city: "Zagreb",
              isActive: false,
              hubspotObjectId: "101",
              hubspotObjectType: "2-CLIENT",
              hubspotArchived: true,
              hubspotSyncedAt: "2026-04-22T10:00:00.000Z",
              createdAt: "2026-04-22T09:00:00.000Z",
              updatedAt: "2026-04-22T10:00:00.000Z",
            },
          ],
          permissions: {
            canCreate: true,
            role: "admin",
            userType: "admin",
          },
        },
      }),
    );

    expect(html).toContain("HubSpot");
    expect(html).toContain("Local Client");
    expect(html).toContain(">Delete</button>");
    expect(html).toContain("Active Client");
    expect(html).not.toContain("Archived Client");
    expect(html).toContain("Archived");
    expect(html).toContain("Synced");
  });
});
