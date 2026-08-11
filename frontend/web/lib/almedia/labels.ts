import type { BookingStatus } from "@scouting-platform/contracts";

/**
 * Display labels shared across the Almedia tabs. Platform names follow each
 * brand's own capitalisation (YouTube, TikTok, Instagram…); month labels always
 * show the full year so "Jul 2026" can never be misread as a day.
 */

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  twitch: "Twitch",
  snapchat: "Snapchat",
  twitter: "Twitter",
  x: "X",
  kick: "Kick",
  reddit: "Reddit",
  telegram: "Telegram",
  discord: "Discord",
};

export const BOOKING_STATUS_LABELS = {
  pipeline: "Pipeline",
  booked: "Booked",
  published: "Published",
  longterm: "Longterm",
  dropped: "Dropped",
} as const satisfies Record<BookingStatus, string>;

export function platformLabel(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const known = PLATFORM_LABELS[value.trim().toLowerCase()];

  if (known) {
    return known;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** "2026-07" → "Jul 2026" (full year, so it never reads as a calendar day). */
export function monthLabel(month: string): string {
  const parsed = new Date(`${month}-01T00:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    return month;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

export function bookingStatusLabel(status: BookingStatus | null): string {
  return status === null ? "—" : BOOKING_STATUS_LABELS[status];
}
