import { describe, expect, it } from "vitest";

import { mapYoutubeLanguageToHubspot } from "./language-mapping";

describe("mapYoutubeLanguageToHubspot", () => {
  it("maps common BCP-47 codes", () => {
    expect(mapYoutubeLanguageToHubspot("en")).toBe("English (US)");
    expect(mapYoutubeLanguageToHubspot("de")).toBe("German");
    expect(mapYoutubeLanguageToHubspot("hr")).toBe("Croatian");
    expect(mapYoutubeLanguageToHubspot("ja")).toBe("Japanese");
  });

  it("maps regional variants", () => {
    expect(mapYoutubeLanguageToHubspot("en-GB")).toBe("English (UK)");
    expect(mapYoutubeLanguageToHubspot("zh-TW")).toBe("Chinese");
    expect(mapYoutubeLanguageToHubspot("pt-BR")).toBe("Portuguese");
  });

  it("is case insensitive", () => {
    expect(mapYoutubeLanguageToHubspot("EN")).toBe("English (US)");
    expect(mapYoutubeLanguageToHubspot("En")).toBe("English (US)");
    expect(mapYoutubeLanguageToHubspot("en")).toBe("English (US)");
  });

  it("returns empty for null, undefined, and empty strings", () => {
    expect(mapYoutubeLanguageToHubspot(null)).toBe("");
    expect(mapYoutubeLanguageToHubspot(undefined)).toBe("");
    expect(mapYoutubeLanguageToHubspot("")).toBe("");
  });

  it("returns empty for unknown codes", () => {
    expect(mapYoutubeLanguageToHubspot("xx")).toBe("");
    expect(mapYoutubeLanguageToHubspot("klingon")).toBe("");
  });

  it("falls back to the base code", () => {
    expect(mapYoutubeLanguageToHubspot("fr-CA")).toBe("French");
  });
});
