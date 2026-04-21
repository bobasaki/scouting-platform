"use client";

import {
  buildCatalogScoutingQuery,
  EMPTY_CATALOG_SCOUTING_CRITERIA,
  hasCatalogScoutingCriteria,
  type CampaignManagerOption,
  type CampaignSummary,
  type CatalogScoutingCriteria,
} from "@scouting-platform/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { startTransition, useState } from "react";

import { createRun } from "../../lib/runs-api";
import { getCreateRunErrorMessage, normalizeRunTarget } from "../runs/create-run-shell";
import { SearchableSelect, type SearchableSelectOption } from "../ui/searchable-select";

type NewScoutingWorkspaceProps = Readonly<{
  initialCampaigns?: CampaignSummary[] | undefined;
  initialCampaignManagers?: CampaignManagerOption[] | undefined;
  showLegacyNotice?: boolean;
}>;

type NewScoutingDraft = {
  name: string;
  target: string;
  campaignId: string;
  campaignManagerUserId: string;
} & CatalogScoutingCriteria;

type NewScoutingRequestState = {
  status: "idle" | "submitting" | "error";
  message: string;
};

const DEFAULT_REQUEST_STATE: NewScoutingRequestState = {
  status: "idle",
  message: "Pick an active campaign and add at least one catalog criterion to build this scouting list.",
};

export function NewScoutingWorkspace({
  initialCampaigns = [],
  initialCampaignManagers = [],
  showLegacyNotice = false,
}: NewScoutingWorkspaceProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<NewScoutingDraft>({
    name: "",
    target: "",
    campaignId: "",
    campaignManagerUserId: "",
    ...EMPTY_CATALOG_SCOUTING_CRITERIA,
  });
  const [requestState, setRequestState] = useState<NewScoutingRequestState>(DEFAULT_REQUEST_STATE);
  const isBusy = requestState.status === "submitting";
  const campaignOptions: SearchableSelectOption[] = [
    {
      value: "",
      label: initialCampaigns.length === 0 ? "No active campaigns available" : "Select campaign",
      disabled: initialCampaigns.length === 0,
    },
    ...initialCampaigns.map((campaign) => ({
      value: campaign.id,
      label: `${campaign.name} · ${campaign.client.name} · ${campaign.market.name}`,
      keywords: [campaign.name, campaign.client.name, campaign.market.name],
    })),
  ];
  const campaignManagerOptions: SearchableSelectOption[] = [
    {
      value: "",
      label: initialCampaignManagers.length === 0 ? "No campaign managers available" : "Select campaign manager",
      disabled: initialCampaignManagers.length === 0,
    },
    ...initialCampaignManagers.map((campaignManager) => ({
      value: campaignManager.id,
      label: campaignManager.name?.trim() || campaignManager.email,
      keywords: [campaignManager.email],
    })),
  ];

  function updateDraftField<Key extends keyof NewScoutingDraft>(field: Key, value: NewScoutingDraft[Key]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestState({
      status: "submitting",
      message: "Creating the scouting run.",
    });

    try {
      const normalizedName = draft.name.trim();
      const normalizedTarget = normalizeRunTarget(draft.target);
      const hasCriteria = hasCatalogScoutingCriteria(draft);

      if (!normalizedName || !hasCriteria || normalizedTarget === null) {
        throw new Error("Influencer List, target, and at least one catalog criterion are required.");
      }

      if (!draft.campaignId) {
        throw new Error("Campaign is required.");
      }

      if (!draft.campaignManagerUserId) {
        throw new Error("Campaign Manager is required.");
      }

      const response = await createRun({
        name: normalizedName,
        query: buildCatalogScoutingQuery(draft),
        target: normalizedTarget,
        metadata: {
          campaignId: draft.campaignId,
          campaignManagerUserId: draft.campaignManagerUserId,
        },
      });

      startTransition(() => {
        router.push(`/runs/${encodeURIComponent(response.runId)}`);
      });
    } catch (error) {
      setRequestState({
        status: "error",
        message: getCreateRunErrorMessage(error),
      });
    }
  }

  return (
    <div className="new-scouting">
      {showLegacyNotice ? (
        <section className="workspace-callout">
          <h3>Legacy route</h3>
          <p>This page remains available as a shortcut to the campaign-based scouting flow.</p>
        </section>
      ) : null}

      <form className="new-scouting__panel" onSubmit={handleSubmit}>
        <div className="new-scouting__grid new-scouting__grid--two">
          <label className="new-scouting__field">
            <span>Influencer List</span>
            <input
              autoComplete="off"
              disabled={isBusy}
              maxLength={200}
              onChange={(event) => updateDraftField("name", event.currentTarget.value)}
              placeholder="Spring gaming outreach"
              required
              value={draft.name}
            />
          </label>

          <label className="new-scouting__field">
            <span>Campaign</span>
            <SearchableSelect
              ariaLabel="Campaign"
              disabled={isBusy || initialCampaigns.length === 0}
              onChange={(campaignId) => updateDraftField("campaignId", campaignId)}
              options={campaignOptions}
              placeholder={initialCampaigns.length === 0 ? "No active campaigns available" : "Select campaign"}
              searchPlaceholder="Search campaigns..."
              value={draft.campaignId}
            />
          </label>
        </div>

        <div className="new-scouting__grid new-scouting__grid--two">
          <label className="new-scouting__field">
            <span>Campaign Manager</span>
            <SearchableSelect
              ariaLabel="Campaign Manager"
              disabled={isBusy || initialCampaignManagers.length === 0}
              onChange={(campaignManagerUserId) => updateDraftField("campaignManagerUserId", campaignManagerUserId)}
              options={campaignManagerOptions}
              placeholder={initialCampaignManagers.length === 0 ? "No campaign managers available" : "Select campaign manager"}
              searchPlaceholder="Search campaign managers..."
              value={draft.campaignManagerUserId}
            />
          </label>

          <label className="new-scouting__field">
            <span>Target</span>
            <input
              disabled={isBusy}
              inputMode="numeric"
              min={1}
              onChange={(event) => updateDraftField("target", event.currentTarget.value)}
              placeholder="25"
              required
              step={1}
              type="number"
              value={draft.target}
            />
            <small>Number of creators needed for this scouting list.</small>
          </label>
        </div>

        <div className="new-scouting__grid new-scouting__grid--two">
          <label className="new-scouting__field">
            <span>Subscribers</span>
            <input
              autoComplete="off"
              disabled={isBusy}
              maxLength={50}
              onChange={(event) => updateDraftField("subscribers", event.currentTarget.value)}
              placeholder="100K+"
              value={draft.subscribers}
            />
          </label>

          <label className="new-scouting__field">
            <span>Views</span>
            <input
              autoComplete="off"
              disabled={isBusy}
              maxLength={50}
              onChange={(event) => updateDraftField("views", event.currentTarget.value)}
              placeholder="25K-250K"
              value={draft.views}
            />
          </label>
        </div>

        <div className="new-scouting__grid new-scouting__grid--two">
          <label className="new-scouting__field">
            <span>Location</span>
            <input
              autoComplete="off"
              disabled={isBusy}
              maxLength={50}
              onChange={(event) => updateDraftField("location", event.currentTarget.value)}
              placeholder="Germany"
              value={draft.location}
            />
          </label>

          <label className="new-scouting__field">
            <span>Language</span>
            <input
              autoComplete="off"
              disabled={isBusy}
              maxLength={50}
              onChange={(event) => updateDraftField("language", event.currentTarget.value)}
              placeholder="German"
              value={draft.language}
            />
          </label>
        </div>

        <div className="new-scouting__grid new-scouting__grid--two">
          <label className="new-scouting__field">
            <span>Last post day since</span>
            <input
              autoComplete="off"
              disabled={isBusy}
              inputMode="numeric"
              maxLength={10}
              onChange={(event) => updateDraftField("lastPostDaysSince", event.currentTarget.value)}
              placeholder="30"
              value={draft.lastPostDaysSince}
            />
            <small>Use days, for example `30` to keep channels active within the last month.</small>
          </label>

          <label className="new-scouting__field">
            <span>Category</span>
            <input
              autoComplete="off"
              disabled={isBusy}
              maxLength={50}
              onChange={(event) => updateDraftField("category", event.currentTarget.value)}
              placeholder="Gaming"
              value={draft.category}
            />
          </label>
        </div>

        <label className="new-scouting__field">
          <span>Niche</span>
          <input
            autoComplete="off"
            disabled={isBusy}
            maxLength={50}
            onChange={(event) => updateDraftField("niche", event.currentTarget.value)}
            placeholder="Strategy"
            value={draft.niche}
          />
        </label>

        <p
          className={`new-scouting__status new-scouting__status--${requestState.status}`}
          role={requestState.status === "error" ? "alert" : "status"}
        >
          {requestState.message}
        </p>

        <div className="new-scouting__actions">
          <button
            disabled={isBusy || initialCampaigns.length === 0 || initialCampaignManagers.length === 0}
            type="submit"
          >
            {isBusy ? "Starting scouting..." : "Start scouting"}
          </button>

          <Link className="new-scouting__secondary-link" href="/database?tab=campaigns">
            Open campaigns
          </Link>
        </div>
      </form>
    </div>
  );
}

export function NewScoutingWorkspaceView(props: NewScoutingWorkspaceProps) {
  return <NewScoutingWorkspace {...props} />;
}
