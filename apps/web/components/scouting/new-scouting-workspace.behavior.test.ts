import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createRunMock, pushMock, useRouterMock, useStateMock } = vi.hoisted(() => ({
  createRunMock: vi.fn(),
  pushMock: vi.fn(),
  useRouterMock: vi.fn(),
  useStateMock: vi.fn(),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useState: useStateMock,
    useEffect: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
}));

vi.mock("../../lib/runs-api", () => ({
  createRun: createRunMock,
}));

import { NewScoutingWorkspace } from "./new-scouting-workspace";

type NewScoutingWorkspaceElement = ReactElement<{
  onFieldChange: <Field extends string>(field: Field, value: string) => void;
  onSubmit: (event: { preventDefault: () => void }) => Promise<void>;
}>;

const DEFAULT_TEST_DRAFT = {
  name: "Gaming run",
  prompt: "gaming creators",
  target: "20",
  client: "Sony",
  market: "DACH",
  campaignManagerUserId: "cm-user-id",
  briefLink: "",
  campaignName: "Spring 2026",
  month: "march" as const,
  year: "2026",
  dealOwner: "Alice",
  dealName: "Sony DACH Q2",
  pipeline: "Pipeline A",
  dealStage: "Proposal",
  currency: "EUR",
  dealType: "Fixed Fee",
  activationType: "Story",
};

const IDLE_MESSAGE =
  "This workspace now stores the live campaign metadata required for Dashboard filtering and HubSpot import readiness.";

function renderWorkspace(options?: {
  draft?: typeof DEFAULT_TEST_DRAFT;
  requestState?: {
    status: "idle" | "submitting" | "error";
    message: string;
  };
}) {
  const setDraft = vi.fn();
  const setRequestState = vi.fn();
  const setCampaignManagersState = vi.fn();

  useStateMock.mockReset();
  useRouterMock.mockReturnValue({
    push: pushMock,
  });
  useStateMock
    .mockReturnValueOnce([options?.draft ?? DEFAULT_TEST_DRAFT, setDraft])
    .mockReturnValueOnce([
      options?.requestState ?? {
        status: "idle",
        message: IDLE_MESSAGE,
      },
      setRequestState,
    ])
    .mockReturnValueOnce([{ status: "loading", items: [], error: null }, setCampaignManagersState]);

  const element = NewScoutingWorkspace({}) as NewScoutingWorkspaceElement;

  return {
    element,
    setDraft,
    setRequestState,
  };
}

describe("new scouting workspace behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits the run with all metadata fields and navigates into database runs", async () => {
    createRunMock.mockResolvedValue({
      runId: "53adac17-f39d-4731-a61f-194150fbc431",
      status: "queued",
    });

    const { element, setRequestState } = renderWorkspace({
      draft: {
        ...DEFAULT_TEST_DRAFT,
        name: "  Spring gaming outreach  ",
        prompt: "  gaming creators for DACH  ",
        target: " 25 ",
      },
    });

    await element.props.onSubmit({
      preventDefault: vi.fn(),
    });
    await Promise.resolve();

    expect(createRunMock).toHaveBeenCalledWith({
      name: "Spring gaming outreach",
      query: "gaming creators for DACH",
      target: 25,
      metadata: {
        client: "Sony",
        market: "DACH",
        campaignManagerUserId: "cm-user-id",
        briefLink: undefined,
        campaignName: "Spring 2026",
        month: "march",
        year: 2026,
        dealOwner: "Alice",
        dealName: "Sony DACH Q2",
        pipeline: "Pipeline A",
        dealStage: "Proposal",
        currency: "EUR",
        dealType: "Fixed Fee",
        activationType: "Story",
      },
    });
    expect(setRequestState).toHaveBeenCalledWith({
      status: "submitting",
      message: "Creating the scouting run and opening it inside Database.",
    });
    expect(pushMock).toHaveBeenCalledWith(
      "/database?tab=runs&runId=53adac17-f39d-4731-a61f-194150fbc431",
    );
  });

  it("clears error state when the prompt changes", () => {
    const { element, setDraft, setRequestState } = renderWorkspace({
      requestState: {
        status: "error",
        message: "Influencer List, target, and prompt are required.",
      },
    });

    element.props.onFieldChange("prompt", "updated prompt");

    expect(setRequestState).toHaveBeenCalledWith({
      status: "idle",
      message: IDLE_MESSAGE,
    });
    const updateDraft = setDraft.mock.calls[0]?.[0] as
      | ((draft: { name: string; prompt: string; target: string }) => {
          name: string;
          prompt: string;
          target: string;
        })
      | undefined;

    expect(updateDraft?.({ name: "Gaming run", prompt: "gaming creators", target: "20" })).toEqual({
      name: "Gaming run",
      prompt: "updated prompt",
      target: "20",
    });
  });

  it("clears error state when the run name changes", () => {
    const { element, setDraft, setRequestState } = renderWorkspace({
      requestState: {
        status: "error",
        message: "Influencer List, target, and prompt are required.",
      },
    });

    element.props.onFieldChange("name", "Updated run");

    expect(setRequestState).toHaveBeenCalledWith({
      status: "idle",
      message: IDLE_MESSAGE,
    });
    const updateDraft = setDraft.mock.calls[0]?.[0] as
      | ((draft: { name: string; prompt: string; target: string }) => {
          name: string;
          prompt: string;
          target: string;
        })
      | undefined;

    expect(updateDraft?.({ name: "Gaming run", prompt: "gaming creators", target: "20" })).toEqual({
      name: "Updated run",
      prompt: "gaming creators",
      target: "20",
    });
  });

  it("clears error state when the target changes", () => {
    const { element, setDraft, setRequestState } = renderWorkspace({
      requestState: {
        status: "error",
        message: "Influencer List, target, and prompt are required.",
      },
    });

    element.props.onFieldChange("target", "35");

    expect(setRequestState).toHaveBeenCalledWith({
      status: "idle",
      message: IDLE_MESSAGE,
    });
    const updateDraft = setDraft.mock.calls[0]?.[0] as
      | ((draft: { name: string; prompt: string; target: string }) => {
          name: string;
          prompt: string;
          target: string;
        })
      | undefined;

    expect(updateDraft?.({ name: "Gaming run", prompt: "gaming creators", target: "20" })).toEqual({
      name: "Gaming run",
      prompt: "gaming creators",
      target: "35",
    });
  });
});
