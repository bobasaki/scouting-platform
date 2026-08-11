import { describe, expect, it } from "vitest";

import { campaignBaseKey, normalizeChannelKey } from "./channel-key";

describe("normalizeChannelKey", () => {
  it("uppercases and strips punctuation and diacritics", () => {
    expect(normalizeChannelKey("ASMR Fixy")).toBe("ASMRFIXY");
    expect(normalizeChannelKey("penny.rogers.home")).toBe("PENNYROGERSHOME");
    expect(normalizeChannelKey('Bożena "Bowi" Cisło')).toBe("BOZENABOWICISLO");
  });

  it("transliterates letters that NFKD leaves intact", () => {
    expect(normalizeChannelKey("Søren Ødegård")).toBe("SORENODEGARD");
    expect(normalizeChannelKey("Straße")).toBe("STRASSE");
    expect(normalizeChannelKey("Đorđe")).toBe("DORDE");
  });
});

describe("campaignBaseKey", () => {
  it("strips campaign suffixes", () => {
    expect(campaignBaseKey("ASMRFIXY_YT_R1")).toBe("ASMRFIXY");
    expect(campaignBaseKey("SKOPZZOR_YT_R2")).toBe("SKOPZZOR");
    expect(campaignBaseKey("KUCHENTV_YT_R2_LB")).toBe("KUCHENTV");
    expect(campaignBaseKey("CREATOR_IGS_R3LB")).toBe("CREATOR");
    expect(campaignBaseKey("PLAIN")).toBe("PLAIN");
  });

  it("matches the key a booking channel name normalizes to", () => {
    expect(campaignBaseKey("ASMRFIXY_YT_R1")).toBe(normalizeChannelKey("ASMR Fixy"));
  });
});
