import type { Booking } from "@scouting-platform/contracts";
import { bookingInputSchema } from "@scouting-platform/contracts";
import { describe, expect, it } from "vitest";

import { toBookingInput, toFormValues } from "./almedia-booking-form";

/**
 * The form holds every value as a string so a half-typed budget is not rejected
 * mid-keystroke; this covers the one-shot conversion back to the wire payload,
 * including that the payload still satisfies the contract the route parses.
 */

const BOOKING: Booking = {
  id: "8f4b1b0e-4d3a-4d5e-9a6f-6e2c1a9b7d31",
  channelName: "ASMR Fixy",
  channelKey: "ASMRFIXY",
  channelUrl: null,
  country: "PL",
  cm: "Lucija P",
  platform: "youtube",
  vertical: "Gaming",
  category: "integration",
  status: "published",
  activation: null,
  numActivations: 2,
  contractSigned: true,
  contractUrl: null,
  publishedAt: "2026-07-13",
  intBudget: 12_000,
  extBudget: 15_000,
  currency: "EUR",
  month: "2026-07",
  note: null,
  videoUrl: null,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-02T00:00:00.000Z",
};

describe("almedia booking form conversion", () => {
  it("round-trips an existing booking through the form and back", () => {
    const result = toBookingInput(toFormValues(BOOKING));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.input).toMatchObject({
      channelName: "ASMR Fixy",
      channelKey: "ASMRFIXY",
      cm: "Lucija P",
      status: "published",
      numActivations: 2,
      contractSigned: true,
      intBudget: 12_000,
      extBudget: 15_000,
      month: "2026-07",
      publishedAt: "2026-07-13",
    });

    // The route parses this exact payload, so it must survive the contract.
    expect(() => bookingInputSchema.parse(result.input)).not.toThrow();
  });

  it("starts blank for a new booking and still produces a valid payload", () => {
    const values = toFormValues(null);

    expect(values.status).toBe("pipeline");
    expect(values.currency).toBe("EUR");

    const result = toBookingInput({ ...values, channelName: "Diabeuu" });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(bookingInputSchema.parse(result.input)).toMatchObject({
        channelName: "Diabeuu",
        channelKey: null,
        month: null,
        intBudget: null,
      });
    }
  });

  it("reports the first bad field instead of a payload", () => {
    const values = toFormValues(null);

    expect(toBookingInput({ ...values, channelName: "  " })).toEqual({
      ok: false,
      error: { field: "channelName", message: "Channel name is required." },
    });

    expect(
      toBookingInput({ ...values, channelName: "Diabeuu", intBudget: "-5" }),
    ).toMatchObject({ ok: false, error: { field: "intBudget" } });

    expect(
      toBookingInput({ ...values, channelName: "Diabeuu", numActivations: "1.5" }),
    ).toMatchObject({ ok: false, error: { field: "numActivations" } });

    expect(
      toBookingInput({ ...values, channelName: "Diabeuu", month: "2026-7" }),
    ).toMatchObject({ ok: false, error: { field: "month" } });
  });
});
