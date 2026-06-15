"use client";

import { useEffect, useRef, useState } from "react";

import { updateRunResultRating } from "../../lib/runs-api";

const DEFAULT_RATING = 1;
const SAVE_DELAY_MS = 250;

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
  const persistedRatingRef = useRef<number | null>(initialRating);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRating(initialRating);
    persistedRatingRef.current = initialRating;
    setStatus("idle");
    setError(null);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [initialRating]);

  async function saveRating(nextRating: number | null) {
    const previousRating = persistedRatingRef.current;
    setRating(nextRating);
    setStatus("saving");
    setError(null);

    try {
      const result = await updateRunResultRating(runId, resultId, nextRating);
      persistedRatingRef.current = result.rating;
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

  function scheduleRatingSave(nextRating: number) {
    setRating(nextRating);
    setStatus("idle");
    setError(null);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      void saveRating(nextRating);
    }, SAVE_DELAY_MS);
  }

  function clearRating() {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    void saveRating(null);
  }

  return (
    <fieldset className="run-result-rating" disabled={disabled || status === "saving"}>
      <legend>Campaign manager rating</legend>
      <div className="run-result-rating__row">
        <div className="run-result-rating__slider-wrap">
          <input
            aria-label="Channel rating from 1 to 5"
            className="run-result-rating__slider"
            max="5"
            min="1"
            onChange={(event) => scheduleRatingSave(Number(event.currentTarget.value))}
            step="1"
            type="range"
            value={rating ?? DEFAULT_RATING}
          />
          <div aria-hidden="true" className="run-result-rating__scale">
            <span>1</span>
            <span>2</span>
            <span>3</span>
            <span>4</span>
            <span>5</span>
          </div>
        </div>

        <output className="run-result-rating__value">
          {rating === null ? "Not rated" : `${rating} / 5`}
        </output>

        {rating !== null ? (
          <button
            className="run-result-rating__clear"
            onClick={clearRating}
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
