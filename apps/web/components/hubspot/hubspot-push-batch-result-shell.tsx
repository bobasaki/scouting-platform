"use client";

import type {
  HubspotPushBatchDetail,
  HubspotPushBatchRow,
  HubspotPushBatchRowStatus,
  HubspotPushBatchStatus,
} from "@scouting-platform/contracts";
import Link from "next/link";
import React, { useEffect, useState } from "react";

import {
  HubspotPushBatchesApiError,
  fetchHubspotPushBatchDetail,
} from "../../lib/hubspot-push-batches-api";

type HubspotPushBatchResultShellProps = Readonly<{
  batchId: string;
}>;

type HubspotPushBatchResultRequestState = {
  requestState: "loading" | "error" | "notFound" | "ready";
  data: HubspotPushBatchDetail | null;
  error: string | null;
};

type HubspotPushBatchResultShellViewProps = HubspotPushBatchResultShellProps & {
  isRefreshing: boolean;
  onRetry: () => void;
  requestState: HubspotPushBatchResultRequestState;
};

const INITIAL_REQUEST_STATE: HubspotPushBatchResultRequestState = {
  requestState: "loading",
  data: null,
  error: null,
};

const NOT_FOUND_REQUEST_STATE: HubspotPushBatchResultRequestState = {
  requestState: "notFound",
  data: null,
  error: null,
};

const ACTIVE_POLLING_STATUSES = new Set<HubspotPushBatchStatus>(["queued", "running"]);

export const HUBSPOT_PUSH_BATCH_RESULT_POLL_INTERVAL_MS = 3000;

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);

  if (!match) {
    return value;
  }

  return `${match[1]} ${match[2]} UTC`;
}

function toTitleCase(value: string): string {
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

function getRequestedByLabel(batch: Pick<HubspotPushBatchDetail, "requestedBy">): string {
  return batch.requestedBy.name?.trim() || batch.requestedBy.email;
}

function formatNullableCell(value: string | null): string {
  return value?.trim() || "Not provided";
}

function getRowResultCopy(row: HubspotPushBatchRow): string {
  switch (row.status) {
    case "pushed":
      return row.hubspotObjectId
        ? `Pushed to HubSpot as ${row.hubspotObjectId}.`
        : "Pushed to HubSpot.";
    case "failed":
      return row.errorMessage ?? "HubSpot push failed.";
    case "pending":
      return "Waiting for the worker to process this row.";
    default:
      return row.status;
  }
}

function getBatchStatusSummary(batch: HubspotPushBatchDetail): string {
  switch (batch.status) {
    case "queued":
      return "The push is queued. This screen refreshes automatically while the worker picks it up.";
    case "running":
      return "The worker is pushing stored contacts to HubSpot in the background. Keep this screen open while progress refreshes automatically.";
    case "completed":
      return "The push completed and the stored per-row outcomes are ready for review.";
    case "failed":
      return batch.lastError
        ? `The worker failed before finishing the push. ${batch.lastError}`
        : "The worker failed before finishing the push.";
    default:
      return batch.status;
  }
}

function buildHubspotPushWorkspaceHref(batchId: string): string {
  return `/hubspot?batchId=${encodeURIComponent(batchId)}`;
}

export function formatHubspotPushBatchResultStatusLabel(
  status: HubspotPushBatchStatus | HubspotPushBatchRowStatus,
): string {
  return toTitleCase(status);
}

export function shouldPollHubspotPushBatchResult(
  batch: Pick<HubspotPushBatchDetail, "status"> | null,
): boolean {
  if (!batch) {
    return false;
  }

  return ACTIVE_POLLING_STATUSES.has(batch.status);
}

export function getHubspotPushBatchDetailRequestErrorMessage(error: unknown): string {
  if (error instanceof HubspotPushBatchesApiError) {
    if (error.status === 401 || error.status === 403) {
      return "Your session does not allow access to this HubSpot push batch anymore. Sign in again and retry.";
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to load HubSpot push batch details. Please try again.";
}

export function HubspotPushBatchResultShellView({
  batchId,
  isRefreshing,
  onRetry,
  requestState,
}: HubspotPushBatchResultShellViewProps) {
  if (requestState.requestState === "loading" && !requestState.data) {
    return (
      <section className="hubspot-push__feedback hubspot-push__feedback--loading" role="status">
        <p>
          Loading HubSpot push batch <code>{batchId}</code>.
        </p>
      </section>
    );
  }

  if (requestState.requestState === "error" && !requestState.data) {
    return (
      <section className="hubspot-push__feedback hubspot-push__feedback--error" role="alert">
        <p>{requestState.error ?? "Unable to load HubSpot push batch details."}</p>
        <button className="hubspot-push__button" onClick={onRetry} type="button">
          Retry
        </button>
      </section>
    );
  }

  if (requestState.requestState === "notFound") {
    return (
      <section className="hubspot-push__empty-state" role="status">
        <h2>HubSpot push batch not found</h2>
        <p>The requested batch does not exist or is no longer visible to this account.</p>
      </section>
    );
  }

  const batch = requestState.data;

  if (!batch) {
    return (
      <section className="hubspot-push__feedback hubspot-push__feedback--error" role="alert">
        <p>Unable to load HubSpot push batch details.</p>
      </section>
    );
  }

  return (
    <div className="hubspot-push">
      <section className="hubspot-push__panel">
        <header className="hubspot-push__detail-header">
          <div>
            <p className="hubspot-push__eyebrow">Batch result</p>
            <h2>{getRequestedByLabel(batch)}</h2>
            <p className="hubspot-push__panel-copy">{getBatchStatusSummary(batch)}</p>
          </div>
          <span className={`hubspot-push__status hubspot-push__status--${batch.status}`}>
            {formatHubspotPushBatchResultStatusLabel(batch.status)}
          </span>
        </header>

        {isRefreshing ? (
          <p className="hubspot-push__inline-note" role="status">
            Refreshing batch result...
          </p>
        ) : null}

        {requestState.error ? (
          <p className="hubspot-push__history-error" role="alert">
            Last refresh failed: {requestState.error}
          </p>
        ) : null}

        <div className="hubspot-push__callout">
          <h3>Batch summary</h3>
          <p>
            {batch.pushedRowCount} pushed · {batch.failedRowCount} failed · {batch.totalRowCount} total
          </p>
        </div>

        <dl className="hubspot-push__details">
          <div>
            <dt>Requested by</dt>
            <dd>{getRequestedByLabel(batch)}</dd>
          </div>
          <div>
            <dt>Batch ID</dt>
            <dd>
              <code>{batch.id}</code>
            </dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatTimestamp(batch.createdAt)}</dd>
          </div>
          <div>
            <dt>Started</dt>
            <dd>{formatTimestamp(batch.startedAt)}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{formatTimestamp(batch.updatedAt)}</dd>
          </div>
          <div>
            <dt>Completed</dt>
            <dd>{formatTimestamp(batch.completedAt)}</dd>
          </div>
          <div>
            <dt>Last error</dt>
            <dd>{batch.lastError ?? "No batch-level worker error recorded."}</dd>
          </div>
        </dl>

        <details className="hubspot-push__scope-disclosure">
          <summary>View selected channel IDs</summary>
          <ul className="hubspot-push__scope-list">
            {batch.scope.channelIds.map((channelId) => (
              <li key={channelId}>
                <code>{channelId}</code>
              </li>
            ))}
          </ul>
        </details>

        <div className="hubspot-push__detail-actions">
          <Link
            className="hubspot-push__button hubspot-push__button--secondary"
            href={buildHubspotPushWorkspaceHref(batch.id)}
          >
            Open workspace view
          </Link>
          <Link className="hubspot-push__button hubspot-push__button--secondary" href="/catalog">
            Open catalog
          </Link>
        </div>
      </section>

      <section className="hubspot-push__panel">
        <header className="hubspot-push__panel-header">
          <h2>Row outcomes</h2>
          <p>Stored per-row results stay visible here for retry planning and failure review.</p>
        </header>

        {batch.rows.length === 0 ? (
          <div className="hubspot-push__empty-state">
            <h3>No stored rows</h3>
            <p>This batch has no stored row results yet.</p>
          </div>
        ) : (
          <div className="hubspot-push__table-wrap">
            <table className="hubspot-push__table">
              <thead>
                <tr>
                  <th scope="col">Status</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Channel</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {batch.rows.map((row) => (
                  <tr
                    className={
                      row.status === "failed"
                        ? "hubspot-push__table-row hubspot-push__table-row--failed"
                        : "hubspot-push__table-row"
                    }
                    key={row.id}
                  >
                    <td>
                      <span className={`hubspot-push__status hubspot-push__status--${row.status}`}>
                        {formatHubspotPushBatchResultStatusLabel(row.status)}
                      </span>
                    </td>
                    <td>{formatNullableCell(row.contactEmail)}</td>
                    <td>
                      <code>{row.channelId}</code>
                    </td>
                    <td>
                      {getRowResultCopy(row)}
                      {row.status === "pushed" && row.hubspotObjectId ? (
                        <div className="hubspot-push__cell-copy">{row.hubspotObjectId}</div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function HubspotPushBatchResultShell({ batchId }: HubspotPushBatchResultShellProps) {
  const [requestState, setRequestState] =
    useState<HubspotPushBatchResultRequestState>(INITIAL_REQUEST_STATE);
  const [reloadToken, setReloadToken] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();
    const keepCurrentDetailVisible =
      requestState.requestState === "ready" && requestState.data?.id === batchId;

    if (!keepCurrentDetailVisible) {
      setRequestState(INITIAL_REQUEST_STATE);
    } else {
      setIsRefreshing(true);
    }

    void fetchHubspotPushBatchDetail(batchId, abortController.signal)
      .then((detail) => {
        if (abortController.signal.aborted) {
          return;
        }

        setRequestState({
          requestState: "ready",
          data: detail,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) {
          return;
        }

        if (error instanceof HubspotPushBatchesApiError && error.status === 404) {
          setRequestState(NOT_FOUND_REQUEST_STATE);
          return;
        }

        const message = getHubspotPushBatchDetailRequestErrorMessage(error);

        setRequestState((current) => {
          if (current.requestState === "ready" && current.data?.id === batchId) {
            return {
              requestState: "ready",
              data: current.data,
              error: message,
            };
          }

          return {
            requestState: "error",
            data: null,
            error: message,
          };
        });
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setIsRefreshing(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [batchId, reloadToken]);

  useEffect(() => {
    if (
      requestState.requestState !== "ready" ||
      isRefreshing ||
      !shouldPollHubspotPushBatchResult(requestState.data)
    ) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setReloadToken((current) => current + 1);
    }, HUBSPOT_PUSH_BATCH_RESULT_POLL_INTERVAL_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isRefreshing, requestState]);

  function handleRetry() {
    setReloadToken((current) => current + 1);
  }

  return (
    <HubspotPushBatchResultShellView
      batchId={batchId}
      isRefreshing={isRefreshing}
      onRetry={handleRetry}
      requestState={requestState}
    />
  );
}
