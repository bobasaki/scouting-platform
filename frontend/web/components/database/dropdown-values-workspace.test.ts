import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DropdownValuesWorkspace } from "./dropdown-values-workspace";

describe("dropdown values workspace", () => {
  it("shows hubspot-synced and platform-managed dropdown groups separately", () => {
    const html = renderToStaticMarkup(createElement(DropdownValuesWorkspace, { initialData: [] }));

    expect(html).toContain("Currency");
    expect(html).toContain("Deal Type");
    expect(html).toContain("Activation Type");
    expect(html).toContain("Influencer Type");
    expect(html).toContain("Influencer Vertical");
    expect(html).toContain("Country/Region");
    expect(html).toContain("Language");
    expect(html).not.toContain("Edit values");
    expect(html).not.toContain("Sync HubSpot dropdowns");
    expect(html.match(/Synced from HubSpot/gu)?.length).toBe(7);
  });
});
