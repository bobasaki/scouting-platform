import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/runs-api", () => ({
  updateRunResultRating: vi.fn(),
}));

import { RunResultRating } from "./run-result-rating";

describe("run result rating", () => {
  it("renders an unrated five-star control", () => {
    const html = renderToStaticMarkup(
      createElement(RunResultRating, {
        runId: "53adac17-f39d-4731-a61f-194150fbc431",
        resultId: "24a57b02-3008-4af1-9b3a-340bd0db7d1c",
      }),
    );

    expect(html).toContain("Campaign manager rating");
    expect(html.match(/Rate \d out of 5/g)).toHaveLength(5);
    expect(html).toContain("Not rated yet.");
  });

  it("renders the persisted rating and clear action", () => {
    const html = renderToStaticMarkup(
      createElement(RunResultRating, {
        runId: "53adac17-f39d-4731-a61f-194150fbc431",
        resultId: "24a57b02-3008-4af1-9b3a-340bd0db7d1c",
        initialRating: 4,
      }),
    );

    expect(html.match(/run-result-rating__star--filled/g)).toHaveLength(4);
    expect(html).toContain("4 out of 5.");
    expect(html).toContain("Clear");
  });

  it("disables ratings until the run snapshot completes", () => {
    const html = renderToStaticMarkup(
      createElement(RunResultRating, {
        runId: "53adac17-f39d-4731-a61f-194150fbc431",
        resultId: "24a57b02-3008-4af1-9b3a-340bd0db7d1c",
        disabled: true,
      }),
    );

    expect(html).toContain("Available when the run completes.");
    expect(html).toContain("disabled");
  });
});
