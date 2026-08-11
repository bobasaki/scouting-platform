"use client";

import type { AlmediaDeal } from "@scouting-platform/contracts";
import React, { useMemo } from "react";

import {
  bookingSuggestions,
  type SuggestionKind,
} from "../../../lib/almedia/suggestions";

/**
 * Booking suggestions — concrete, data-grounded actions for CLs and CMs, read
 * straight off the matured returns in view. Rule-based, no model in the loop;
 * the AI brief that expanded these lives in Phase 2 alongside the analyst chat.
 */

const KIND_LABELS = {
  "book-more": "Book more",
  "creator-profile": "Creator profile",
  rebook: "Rebook",
  platform: "Platform",
  size: "Deal size",
  reduce: "Reduce",
} as const satisfies Record<SuggestionKind, string>;

const KIND_TONES = {
  "book-more": "good",
  "creator-profile": "good",
  rebook: "good",
  platform: "neutral",
  size: "neutral",
  reduce: "bad",
} as const satisfies Record<SuggestionKind, string>;

export function SuggestionsWidget({
  deals,
}: Readonly<{ deals: readonly AlmediaDeal[] }>) {
  const suggestions = useMemo(() => bookingSuggestions(deals), [deals]);

  if (suggestions.length === 0) {
    return (
      <p className="almedia-widget__empty">
        Not enough matured returns yet to suggest bookings. Suggestions appear once
        campaigns pass 14 days and returns settle.
      </p>
    );
  }

  return (
    <>
      <ul className="almedia-suggestions">
        {suggestions.map((item) => (
          <li
            className={`almedia-suggestion almedia-suggestion--${KIND_TONES[item.kind]}`}
            key={item.id}
          >
            <p className="almedia-suggestion__head">
              <span
                className={`almedia-suggestion__tag almedia-tone--${KIND_TONES[item.kind]}`}
              >
                {KIND_LABELS[item.kind]}
              </span>
              <strong>{item.headline}</strong>
            </p>
            <p className="almedia-suggestion__detail">{item.detail}</p>
            <span className="almedia-suggestion__metric">{item.metric}</span>
          </li>
        ))}
      </ul>
      <p className="almedia-widget__footnote">
        Based only on matured returns (14+ days since publish) in the current view.
      </p>
    </>
  );
}
