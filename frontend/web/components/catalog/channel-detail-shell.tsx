"use client";

import type {
  ChannelDetail,
  ChannelEnrichmentDetail,
  ChannelEnrichmentStatus,
} from "@scouting-platform/contracts";
import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";

import {
  ApiRequestError,
  fetchChannelDetail,
  requestChannelEnrichment,
} from "../../lib/channels-api";

type ChannelDetailShellProps = Readonly<{
  channelId: string;
  canManageManualEdits?: boolean;
  initialData?: ChannelDetail | null;
}>;

type ChannelDetailRequestState =
  | {
      status: "loading";
      data: null;
      error: null;
    }
  | {
      status: "error";
      data: null;
      error: string;
    }
  | {
      status: "notFound";
      data: null;
      error: null;
    }
  | {
      status: "ready";
      data: ChannelDetail;
      error: null;
    };

type ChannelRequestActionState = {
  type: "idle" | "submitting" | "success" | "error";
  message: string;
};

type ChannelEnrichmentActionState = ChannelRequestActionState;

type ChannelDetailShellViewProps = {
  channelId: string;
  requestState: ChannelDetailRequestState;
  enrichmentActionState: ChannelEnrichmentActionState;
  onRetry: () => void;
  onRequestEnrichment: () => void | Promise<void>;
};

type StatusPopoverTagProps = Readonly<{
  title: string;
  summary: string;
  statusClassName: string;
  body: string;
  actionLabel: string;
  actionBusyLabel?: string;
  disabled: boolean;
  actionState: ChannelRequestActionState;
  onAction: () => void;
}>;

const INITIAL_REQUEST_STATE: ChannelDetailRequestState = {
  status: "loading",
  data: null,
  error: null,
};

const NOT_FOUND_REQUEST_STATE: ChannelDetailRequestState = {
  status: "notFound",
  data: null,
  error: null,
};

const IDLE_REQUEST_ACTION_STATE: ChannelRequestActionState = {
  type: "idle",
  message: "",
};

const IDLE_ENRICHMENT_ACTION_STATE: ChannelEnrichmentActionState = IDLE_REQUEST_ACTION_STATE;

const EMPTY_VALUE = "Not available";

export const ENRICHMENT_STATUS_POLL_INTERVAL_MS = 3000;

function formatIsoTimestamp(value: string | null): string {
  if (!value) {
    return EMPTY_VALUE;
  }

  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);

  if (!match) {
    return value;
  }

  return `${match[1]} ${match[2]} UTC`;
}

function titleCase(value: string): string {
  return value
    .split("_")
    .map((segment) => {
      if (!segment) {
        return segment;
      }

      return `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`;
    })
    .join(" ");
}

function getEnrichmentStatusLabel(status: ChannelEnrichmentStatus): string {
  if (status === "completed") {
    return "Ready";
  }

  return titleCase(status);
}

function getChannelHandle(channel: Pick<ChannelDetail, "handle">): string {
  return channel.handle?.trim() || "No public handle";
}

function getChannelDescription(channel: Pick<ChannelDetail, "description">): string {
  return channel.description?.trim() || "No channel description has been captured yet.";
}

function getIdentityFallback(title: string): string {
  return title.trim().charAt(0).toUpperCase() || "?";
}

function formatMetric(value: string | null | undefined): string {
  if (!value) {
    return EMPTY_VALUE;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue)) {
    return value;
  }

  return new Intl.NumberFormat("en-US").format(parsedValue);
}

function formatEngagementRate(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return EMPTY_VALUE;
  }

  const normalized = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  return `${normalized.replace(/\.0$/, "")}%`;
}

function formatConfidence(value: number | null): string {
  if (value === null) {
    return EMPTY_VALUE;
  }

  return formatEngagementRate(value * 100);
}

function resolveYoutubeUrl(channel: Pick<ChannelDetail, "youtubeUrl" | "youtubeChannelId">): string {
  const explicitUrl = channel.youtubeUrl?.trim();

  if (explicitUrl) {
    return explicitUrl;
  }

  return `https://www.youtube.com/channel/${channel.youtubeChannelId}`;
}

function resolveSocialMediaUrl(
  channel: Pick<ChannelDetail, "socialMediaLink" | "youtubeUrl" | "youtubeChannelId">,
): string {
  const explicitSocialMediaUrl = channel.socialMediaLink?.trim();

  if (explicitSocialMediaUrl) {
    return explicitSocialMediaUrl;
  }

  return resolveYoutubeUrl(channel);
}

function formatPlatforms(platforms: readonly string[] | null | undefined): string {
  if (!platforms || platforms.length === 0) {
    return EMPTY_VALUE;
  }

  return platforms.join(", ");
}

function hasVisibleEnrichmentResult(
  enrichment: Pick<
    ChannelEnrichmentDetail,
    "summary" | "topics" | "brandFitNotes" | "confidence" | "structuredProfile"
  >,
): boolean {
  return (
    (enrichment.summary?.trim().length ?? 0) > 0 ||
    (enrichment.topics?.length ?? 0) > 0 ||
    (enrichment.brandFitNotes?.trim().length ?? 0) > 0 ||
    enrichment.confidence !== null ||
    enrichment.structuredProfile !== null
  );
}

export function shouldPollEnrichmentStatus(status: ChannelEnrichmentStatus): boolean {
  return status === "queued" || status === "running";
}

function shouldPollChannelDetailStatus(channel: Pick<ChannelDetail, "enrichment">): boolean {
  return shouldPollEnrichmentStatus(channel.enrichment.status);
}

export function getEnrichmentActionLabel(status: ChannelEnrichmentStatus): string {
  if (status === "missing") {
    return "Enrich now";
  }

  if (status === "failed") {
    return "Retry enrichment";
  }

  if (status === "queued") {
    return "Enrichment queued";
  }

  if (status === "running") {
    return "Enrichment running";
  }

  return "Refresh enrichment";
}

export function getEnrichmentStatusMessage(
  enrichment: Pick<
    ChannelEnrichmentDetail,
    "status" | "lastError" | "summary" | "topics" | "brandFitNotes" | "confidence" | "structuredProfile"
  >,
): string {
  const hasRetainedResult = hasVisibleEnrichmentResult(enrichment);

  if (enrichment.status === "missing") {
    return "No enrichment has been requested yet. Queue one when you want a generated summary and profile classification details.";
  }

  if (enrichment.status === "queued") {
    return hasRetainedResult
      ? "Enrichment is queued. This page refreshes automatically while waiting, and the previous result stays visible below until the refresh finishes."
      : "Enrichment is queued. This page refreshes automatically while waiting.";
  }

  if (enrichment.status === "running") {
    return hasRetainedResult
      ? "Enrichment is running in the background. This page refreshes automatically while processing continues, and the previous result stays visible below until the new result is stored."
      : "Enrichment is running in the background. This page refreshes automatically while processing continues.";
  }

  if (enrichment.status === "failed") {
    if (enrichment.lastError) {
      return hasRetainedResult
        ? `Last enrichment attempt failed: ${enrichment.lastError}. The last successful enrichment stays visible below while you decide whether to retry.`
        : `Last enrichment attempt failed: ${enrichment.lastError}`;
    }

    return hasRetainedResult
      ? "The last enrichment attempt failed before the worker could complete it. The last successful enrichment stays visible below while you decide whether to retry."
      : "The last enrichment attempt failed before the worker could complete it.";
  }

  if (enrichment.status === "stale") {
    return hasRetainedResult
      ? "This enrichment is stale because the channel changed or the freshness window expired. The last successful result stays visible below until you refresh it."
      : "This enrichment is stale because the channel changed or the freshness window expired. Refresh it to queue a new run.";
  }

  return hasRetainedResult
    ? "Enrichment is ready. The latest stored result is visible below."
    : "Enrichment is ready. Refresh it when the channel changes or you need a newer result.";
}

function getChannelDetailRequestErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401 || error.status === 403) {
      return "Your session does not allow access to this channel anymore. Sign in again and retry.";
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to load channel details. Please try again.";
}

function getEnrichmentRequestErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401 || error.status === 403) {
      return "Your session does not allow enrichment requests anymore. Sign in again and retry.";
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to request channel enrichment. Please try again.";
}

function getEnrichmentRequestSuccessMessage(
  status: ChannelEnrichmentStatus,
  hasRetainedResult: boolean,
): string {
  if (status === "running") {
    return hasRetainedResult
      ? "Enrichment is already running. This page refreshes automatically while the worker finishes, and the current result stays visible below."
      : "Enrichment is already running. This page refreshes automatically while the worker finishes.";
  }

  if (status === "completed") {
    return hasRetainedResult
      ? "Enrichment is already ready. The current stored result remains visible below."
      : "Enrichment is already ready.";
  }

  return hasRetainedResult
    ? "Enrichment request recorded. This page refreshes automatically while the worker runs, and the current result stays visible below until the refresh completes."
    : "Enrichment request recorded. This page refreshes automatically while the worker runs.";
}

function renderEnrichmentTopics(topics: readonly string[] | null): React.JSX.Element {
  if (!topics?.length) {
    return <p className="channel-detail-shell__body-copy">No enrichment topics are available yet.</p>;
  }

  return (
    <ul className="channel-detail-shell__tag-list">
      {topics.map((topic) => (
        <li key={topic}>{topic}</li>
      ))}
    </ul>
  );
}

export function mergeChannelEnrichment(
  channel: ChannelDetail,
  enrichment: ChannelEnrichmentDetail,
): ChannelDetail {
  return {
    ...channel,
    enrichment: {
      ...enrichment,
      summary: enrichment.summary ?? channel.enrichment.summary,
      topics: enrichment.topics ?? channel.enrichment.topics,
      brandFitNotes: enrichment.brandFitNotes ?? channel.enrichment.brandFitNotes,
      confidence: enrichment.confidence ?? channel.enrichment.confidence,
      structuredProfile: enrichment.structuredProfile ?? channel.enrichment.structuredProfile,
    },
  };
}

function StatusPopoverTag({
  title,
  summary,
  statusClassName,
  body,
  actionLabel,
  actionBusyLabel = "Requesting...",
  disabled,
  actionState,
  onAction,
}: StatusPopoverTagProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function isOutsidePopover(target: EventTarget | null): boolean {
      return target instanceof Node && !rootRef.current?.contains(target);
    }

    function handlePointerDown(event: MouseEvent | PointerEvent | TouchEvent): void {
      if (isOutsidePopover(event.target)) {
        setIsOpen(false);
      }
    }

    function handleFocusIn(event: FocusEvent): void {
      if (isOutsidePopover(event.target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (!isOpen) {
      return;
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div className="channel-detail-shell__status-popover" ref={rootRef}>
      <button
        aria-expanded={isOpen}
        className={statusClassName}
        onClick={() => {
          setIsOpen((current) => !current);
        }}
        type="button"
      >
        {summary}
      </button>

      {isOpen ? (
        <div className="channel-detail-shell__status-popover-panel">
          <h3 className="channel-detail-shell__subheading">{title}</h3>
          <p className="channel-detail-shell__body-copy">{body}</p>
          <button
            className="channel-detail-shell__button channel-detail-shell__button--tag"
            disabled={disabled}
            onClick={() => {
              onAction();
              setIsOpen(false);
            }}
            type="button"
          >
            {actionState.type === "submitting" ? actionBusyLabel : actionLabel}
          </button>
          {actionState.message ? (
            <p
              className={`channel-detail-shell__action-status channel-detail-shell__action-status--${actionState.type} channel-detail-shell__action-status--inline`}
              role={actionState.type === "error" ? "alert" : "status"}
            >
              {actionState.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function renderReadyState(
  channel: ChannelDetail,
  options: {
    enrichmentActionState: ChannelEnrichmentActionState;
    onRequestEnrichment: () => void | Promise<void>;
  },
) {
  const enrichmentActionStatus = options.enrichmentActionState;
  const isEnrichmentBusy =
    options.enrichmentActionState.type === "submitting" ||
    shouldPollEnrichmentStatus(channel.enrichment.status);
  const youtubeUrl = resolveYoutubeUrl(channel);
  const socialMediaUrl = resolveSocialMediaUrl(channel);

  return (
    <>
      <section aria-labelledby="channel-detail-shell-heading" className="channel-detail-shell__hero">
        <div className="channel-detail-shell__identity">
          {channel.thumbnailUrl ? (
            <Image
              alt={`${channel.title} thumbnail`}
              className="channel-detail-shell__thumbnail"
              height={96}
              src={channel.thumbnailUrl}
              width={96}
            />
          ) : (
            <div
              aria-hidden="true"
              className="channel-detail-shell__thumbnail channel-detail-shell__thumbnail--fallback"
            >
              {getIdentityFallback(channel.title)}
            </div>
          )}

          <div className="channel-detail-shell__identity-copy">
            <p className="channel-detail-shell__eyebrow">Catalog influencer profile</p>
            <h2 id="channel-detail-shell-heading">{channel.title}</h2>
            <p className="channel-detail-shell__handle">{getChannelHandle(channel)}</p>
            <p className="channel-detail-shell__description">{getChannelDescription(channel)}</p>
            <div className="channel-detail-shell__hero-controls">
              <div className="channel-detail-shell__status-row">
                <StatusPopoverTag
                  actionLabel={getEnrichmentActionLabel(channel.enrichment.status)}
                  actionState={enrichmentActionStatus}
                  body={getEnrichmentStatusMessage(channel.enrichment)}
                  disabled={isEnrichmentBusy}
                  onAction={() => {
                    void options.onRequestEnrichment();
                  }}
                  statusClassName={`channel-detail-shell__status channel-detail-shell__status--${channel.enrichment.status}`}
                  summary={`Enrichment: ${getEnrichmentStatusLabel(channel.enrichment.status)}`}
                  title="Enrichment"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="channel-detail-shell__hero-side">
          <dl className="channel-detail-shell__route-meta">
            <div>
              <dt>Catalog record ID</dt>
              <dd>
                <code>{channel.id}</code>
              </dd>
            </div>
            <div>
              <dt>YouTube channel ID</dt>
              <dd>
                <code>{channel.youtubeChannelId}</code>
              </dd>
            </div>
          </dl>

          <dl className="channel-detail-shell__details channel-detail-shell__details--compact">
            <div>
              <dt>Created</dt>
              <dd>{formatIsoTimestamp(channel.createdAt)}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{formatIsoTimestamp(channel.updatedAt)}</dd>
            </div>
            <div>
              <dt>Enrichment confidence</dt>
              <dd>{formatConfidence(channel.enrichment.confidence)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="channel-detail-shell-profile-heading" className="channel-detail-shell__panel">
        <header>
          <h2 id="channel-detail-shell-profile-heading">Creator profile</h2>
          <p>
            Catalog facts and metrics for this influencer profile are shown in one place, together
            with the current enrichment status.
          </p>
        </header>

        <div className="channel-detail-shell__profile-grid">
          <div className="channel-detail-shell__profile-block">
            <h3 className="channel-detail-shell__subheading">Catalog facts</h3>
            <dl className="channel-detail-shell__details">
              <div>
                <dt>Channel name/title</dt>
                <dd>{channel.title}</dd>
              </div>
              <div>
                <dt>YouTube channel ID</dt>
                <dd>
                  <code>{channel.youtubeChannelId}</code>
                </dd>
              </div>
              <div>
                <dt>YouTube handle</dt>
                <dd>{getChannelHandle(channel)}</dd>
              </div>
              <div>
                <dt>YouTube URL</dt>
                <dd>
                  <a className="catalog-table__link" href={youtubeUrl} rel="noreferrer" target="_blank">
                    {youtubeUrl}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Social media URL</dt>
                <dd>
                  <a
                    className="catalog-table__link"
                    href={socialMediaUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {socialMediaUrl}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Platforms</dt>
                <dd>{formatPlatforms(channel.platforms)}</dd>
              </div>
              <div>
                <dt>Country/Region</dt>
                <dd>{channel.countryRegion ?? EMPTY_VALUE}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{channel.email ?? EMPTY_VALUE}</dd>
              </div>
              <div>
                <dt>Influencer type</dt>
                <dd>{channel.influencerType ?? EMPTY_VALUE}</dd>
              </div>
              <div>
                <dt>Influencer vertical</dt>
                <dd>{channel.influencerVertical ?? EMPTY_VALUE}</dd>
              </div>
              <div>
                <dt>Content language</dt>
                <dd>{channel.contentLanguage ?? EMPTY_VALUE}</dd>
              </div>
              <div>
                <dt>Thumbnail</dt>
                <dd>
                  {channel.thumbnailUrl ? (
                    <a
                      className="catalog-table__link"
                      href={channel.thumbnailUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open thumbnail
                    </a>
                  ) : (
                    EMPTY_VALUE
                  )}
                </dd>
              </div>
              <div>
                <dt>Description</dt>
                <dd>{getChannelDescription(channel)}</dd>
              </div>
            </dl>
          </div>

          <div className="channel-detail-shell__profile-block">
            <h3 className="channel-detail-shell__subheading">Performance metrics</h3>
            <dl className="channel-detail-shell__details">
              <div>
                <dt>YouTube Followers</dt>
                <dd>{formatMetric(channel.youtubeFollowers)}</dd>
              </div>
              <div>
                <dt>YouTube Engagement Rate</dt>
                <dd>{formatEngagementRate(channel.youtubeEngagementRate)}</dd>
              </div>
              <div>
                <dt>YouTube Video Median Views</dt>
                <dd>{formatMetric(channel.youtubeVideoMedianViews)}</dd>
              </div>
              <div>
                <dt>YouTube Shorts Median Views</dt>
                <dd>{formatMetric(channel.youtubeShortsMedianViews)}</dd>
              </div>
            </dl>
          </div>

          <div className="channel-detail-shell__profile-block">
            <h3 className="channel-detail-shell__subheading">Enrichment summary</h3>
            <dl className="channel-detail-shell__details">
              <div>
                <dt>Status</dt>
                <dd>{getEnrichmentStatusLabel(channel.enrichment.status)}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{formatIsoTimestamp(channel.enrichment.updatedAt)}</dd>
              </div>
              <div>
                <dt>Completed</dt>
                <dd>{formatIsoTimestamp(channel.enrichment.completedAt)}</dd>
              </div>
              {channel.enrichment.lastError ? (
                <div>
                  <dt>Last error</dt>
                  <dd>{channel.enrichment.lastError}</dd>
                </div>
              ) : null}
            </dl>

            <div className="channel-detail-shell__stack">
              <div>
                <h4 className="channel-detail-shell__subheading">Summary</h4>
                <p className="channel-detail-shell__body-copy">
                  {channel.enrichment.summary ?? "No enrichment summary is available yet."}
                </p>
              </div>
              <div>
                <h4 className="channel-detail-shell__subheading">Topics</h4>
                {renderEnrichmentTopics(channel.enrichment.topics)}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export function ChannelDetailShellView({
  channelId,
  enrichmentActionState,
  onRequestEnrichment,
  onRetry,
  requestState,
}: ChannelDetailShellViewProps) {
  return (
    <div className="channel-detail-shell">
      {requestState.status === "loading" ? (
        <p className="channel-detail-shell__feedback channel-detail-shell__feedback--loading">
          Loading channel details...
        </p>
      ) : null}

      {requestState.status === "error" ? (
        <div className="channel-detail-shell__feedback channel-detail-shell__feedback--error" role="alert">
          <p>{requestState.error}</p>
          <button className="channel-detail-shell__button" onClick={onRetry} type="button">
            Retry
          </button>
        </div>
      ) : null}

      {requestState.status === "notFound" ? (
        <section className="channel-detail-shell__empty-state">
          <h2>Channel not found</h2>
          <p>
            We could not find a catalog record for <code>{channelId}</code>.
          </p>
        </section>
      ) : null}

      {requestState.status === "ready"
        ? renderReadyState(requestState.data, {
            enrichmentActionState,
            onRequestEnrichment,
          })
        : null}
    </div>
  );
}

export function ChannelDetailShell({
  channelId,
  initialData,
}: ChannelDetailShellProps) {
  const [requestState, setRequestState] = useState<ChannelDetailRequestState>(
    initialData
      ? {
          status: "ready",
          data: initialData,
          error: null,
        }
      : initialData === null
        ? NOT_FOUND_REQUEST_STATE
        : INITIAL_REQUEST_STATE,
  );
  const [reloadToken, setReloadToken] = useState(0);
  const reloadOriginChannelIdRef = useRef<string | null>(null);
  const [enrichmentActionState, setEnrichmentActionState] = useState<ChannelEnrichmentActionState>(
    IDLE_ENRICHMENT_ACTION_STATE,
  );

  useEffect(() => {
    let didCancel = false;
    const abortController = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const canReuseInitialData = reloadToken === 0 && !!initialData;

    async function loadChannel(polling = false) {
      const isBackgroundRefresh =
        polling || (reloadToken > 0 && reloadOriginChannelIdRef.current === channelId);

      if (!isBackgroundRefresh && !canReuseInitialData) {
        setRequestState(INITIAL_REQUEST_STATE);
      }

      try {
        const channel =
          canReuseInitialData && !polling
            ? initialData
            : await fetchChannelDetail(channelId, abortController.signal);

        if (didCancel) {
          return;
        }

        if (!channel) {
          setRequestState(NOT_FOUND_REQUEST_STATE);
          return;
        }

        setRequestState({
          status: "ready",
          data: channel,
          error: null,
        });

        if (shouldPollChannelDetailStatus(channel)) {
          timeoutId = setTimeout(() => {
            void loadChannel(true);
          }, ENRICHMENT_STATUS_POLL_INTERVAL_MS);
        }
      } catch (error: unknown) {
        if (didCancel || (error instanceof Error && error.name === "AbortError")) {
          return;
        }

        if (error instanceof ApiRequestError && error.status === 404) {
          setRequestState(NOT_FOUND_REQUEST_STATE);
          return;
        }

        if (isBackgroundRefresh) {
          return;
        }

        setRequestState({
          status: "error",
          data: null,
          error: getChannelDetailRequestErrorMessage(error),
        });
      }
    }

    void loadChannel();

    return () => {
      didCancel = true;
      abortController.abort();

      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [channelId, initialData, reloadToken]);

  useEffect(() => {
    setEnrichmentActionState(IDLE_ENRICHMENT_ACTION_STATE);
  }, [channelId]);

  async function handleRequestEnrichment(): Promise<void> {
    if (requestState.status !== "ready") {
      return;
    }

    if (shouldPollEnrichmentStatus(requestState.data.enrichment.status)) {
      return;
    }

    const hadVisibleEnrichment = hasVisibleEnrichmentResult(requestState.data.enrichment);

    setEnrichmentActionState({
      type: "submitting",
      message: "",
    });

    try {
      const response = await requestChannelEnrichment(channelId);

      setRequestState((current) => {
        if (current.status !== "ready") {
          return current;
        }

        return {
          status: "ready",
          data: mergeChannelEnrichment(current.data, response.enrichment),
          error: null,
        };
      });
      setEnrichmentActionState({
        type: "success",
        message: getEnrichmentRequestSuccessMessage(
          response.enrichment.status,
          hadVisibleEnrichment || hasVisibleEnrichmentResult(response.enrichment),
        ),
      });
      reloadOriginChannelIdRef.current = channelId;
      setReloadToken((currentValue) => currentValue + 1);
    } catch (error) {
      setEnrichmentActionState({
        type: "error",
        message: getEnrichmentRequestErrorMessage(error),
      });
    }
  }

  return (
    <ChannelDetailShellView
      channelId={channelId}
      enrichmentActionState={enrichmentActionState}
      onRequestEnrichment={handleRequestEnrichment}
      onRetry={() => {
        reloadOriginChannelIdRef.current = channelId;
        setReloadToken((currentValue) => currentValue + 1);
      }}
      requestState={requestState}
    />
  );
}
