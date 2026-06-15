"use client";

import { useEffect, useState } from "react";

import { updateRunResultRating } from "../../lib/runs-api";

const RATINGS = [1, 2, 3, 4, 5] as const;

type RunResultRatingProps = Readonly<{
  runId: string;
  resultId: string;
  initialRating?: number | null;
  disabled?: boolean;
}>;

export function RunResultRating({
  disabled = false,
  initialRating = null,
  resultId,
  runId,
}: RunResultRatingProps) {
  const [rating, setRating] = useState<number | null>(initialRating);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRating(initialRating);
    setStatus("idle");
    setError(null);
  }, [initialRating]);

  async function saveRating(nextRating: number | null) {
    const previousRating = rating;
    setRating(nextRating);
    setStatus("saving");
    setError(null);

    try {
      const result = await updateRunResultRating(runId, resultId, nextRating);
      setRating(result.rating);
      setStatus("saved");
    } catch (saveError) {
      setRating(previousRating);
      setStatus("error");
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save the channel rating. Please try again.",
      );
    }
  }

  return (
    <fieldset className="run-result-rating" disabled={disabled || status === "saving"}>
      <legend>Campaign manager rating</legend>
      <div className="run-result-rating__row">
        <div aria-label="Channel rating" className="run-result-rating__stars" role="group">
          {RATINGS.map((value) => {
            const isFilled = rating !== null && value <= rating;

            return (
              <button
                aria-label={`Rate ${value} out of 5`}
                aria-pressed={rating === value}
                className={`run-result-rating__star${isFilled ? " run-result-rating__star--filled" : ""}`}
                key={value}
                onClick={() => void saveRating(value)}
                title={`${value} out of 5`}
                type="button"
              >
                <span aria-hidden="true">{isFilled ? "★" : "☆"}</span>
              </button>
            );
          })}
        </div>

        {rating !== null ? (
          <button
            className="run-result-rating__clear"
            onClick={() => void saveRating(null)}
            type="button"
          >
            Clear
          </button>
        ) : null}
      </div>

      <p aria-live="polite" className={`run-result-rating__status run-result-rating__status--${status}`}>
        {status === "saving"
          ? "Saving rating..."
          : disabled
            ? "Available when the run completes."
            : status === "saved"
              ? rating === null
                ? "Rating cleared."
                : `Saved ${rating} out of 5.`
              : status === "error"
                ? error
                : rating === null
                  ? "Not rated yet."
                  : `${rating} out of 5.`}
      </p>
    </fieldset>
  );
}
