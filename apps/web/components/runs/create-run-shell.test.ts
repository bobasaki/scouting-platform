import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", async () => {
  const react = await vi.importActual<typeof import("react")>("react");

  return {
    default: ({
      href,
      className,
      children,
    }: {
      href: string;
      className?: string;
      children: ReactNode;
    }) => react.createElement("a", { href, className }, children),
  };
});

import { ApiRequestError } from "../../lib/runs-api";
import {
  CreateRunShellView,
  getCreateRunErrorMessage,
  normalizeRunDraft,
} from "./create-run-shell";

function renderView(requestState: Parameters<typeof CreateRunShellView>[0]["requestState"]) {
  return renderToStaticMarkup(
    createElement(CreateRunShellView, {
      draft: {
        name: "Gaming Run",
        query: "gaming creators",
      },
      onNameChange: () => undefined,
      onQueryChange: () => undefined,
      onSubmit: () => undefined,
      requestState,
      showRunsIndexLink: true,
    }),
  );
}

describe("create run shell", () => {
  it("normalizes run draft whitespace", () => {
    expect(
      normalizeRunDraft({
        name: "  Gaming Run  ",
        query: "  gaming creators  ",
      }),
    ).toEqual({
      name: "Gaming Run",
      query: "gaming creators",
    });
  });

  it("maps missing key errors to a clearer UI message", () => {
    expect(
      getCreateRunErrorMessage(
        new ApiRequestError("Assigned YouTube API key is required before creating a run", 400),
      ),
    ).toBe(
      "Your account does not have an assigned YouTube API key yet. Ask an admin to add one before starting a run.",
    );
  });

  it("renders the create form with idle copy and back link", () => {
    const html = renderView({
      status: "idle",
      message:
        "Runs blend matching catalog channels with new YouTube discovery using the API key assigned to your account.",
    });

    expect(html).toContain("Start a scouting run");
    expect(html).toContain("Run name");
    expect(html).toContain("Search query");
    expect(html).toContain("Create run");
    expect(html).toContain('href="/runs"');
  });

  it("renders error feedback when submission fails", () => {
    const html = renderView({
      status: "error",
      message: "Your account does not have an assigned YouTube API key yet.",
    });

    expect(html).toContain("Your account does not have an assigned YouTube API key yet.");
    expect(html).toContain('role="alert"');
  });
});
