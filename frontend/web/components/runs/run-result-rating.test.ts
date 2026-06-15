import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/runs-api", () => ({
  updateRunResultRating: vi.fn(),
}));

import { RunResultRating } from "./run-result-rating";

describe("run result rating", () => {
  it("renders an unrated 1-to-5 slider", () => {
    const html = renderToStaticMarkup(
      createElement(RunResultRating, {
        runId: "53adac17-f39d-4731-a61f-194150fbc431",
        resultId: "24a57b02-3008-4af1-9b3a-340bd0db7d1c",
      }),
    );

    expect(html).toContain("Campaign manager rating");
    expect(html).toContain('type="range"');
    expect(html).toContain('aria-label="Channel rating from 1 to 5"');
    expect(html).toContain('min="1"');
    expect(html).toContain('max="5"');
    expect(html).toContain("Not rated");
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

    expect(html).toContain('value="4"');
    expect(html).toContain("4 / 5");
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
