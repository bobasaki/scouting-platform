import type { RunRequestStatus } from "@scouting-platform/contracts";

type RunFailureInfo = {
  lastError: string | null;
};

export const RUN_STATUS_POLL_INTERVAL_MS = 3000;

export function shouldPollRunStatus(status: RunRequestStatus): boolean {
  return status === "queued" || status === "running";
}

export function formatRunStatusLabel(status: RunRequestStatus): string {
  if (status === "queued") {
    return "Queued";
  }

  if (status === "running") {
    return "Running";
  }

  if (status === "completed") {
    return "Completed";
  }

  return "Failed";
}

export function formatRunTimestamp(value: string | null): string {
  if (!value) {
    return "Not recorded";
  }

  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);

  if (!match) {
    return value;
  }

  return `${match[1]} ${match[2]} UTC`;
}

export function formatRunResultCount(resultCount: number): string {
  if (resultCount === 1) {
    return "1 result";
  }

  return `${resultCount} results`;
}

export function getRunFailureMessage(run: RunFailureInfo): string {
  if (!run.lastError) {
    return "The run failed before the worker could finish processing it.";
  }

  if (run.lastError.includes("quota exceeded")) {
    return "YouTube API quota was exhausted before discovery completed. Retry later or ask an admin to rotate the assigned key.";
  }

  if (run.lastError.includes("YouTube API key")) {
    return "This account needs an assigned YouTube API key before the worker can run discovery.";
  }

  return run.lastError;
}
