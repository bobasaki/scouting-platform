"use client";

import {
  ALMEDIA_CURRENCY,
  type Booking,
  type BookingInput,
  type BookingStatus,
} from "@scouting-platform/contracts";
import React, { useState } from "react";

/**
 * Create/edit form for a booking. Bookings are the internal half of every deal
 * and are typed by hand, so the form mirrors the tracker's own columns rather
 * than inventing a shorter shape. Values are held as strings and converted once
 * on submit, which keeps a half-typed budget from being rejected mid-keystroke.
 */

const STATUS_OPTIONS: ReadonlyArray<{ value: BookingStatus; label: string }> = [
  { value: "pipeline", label: "Pipeline" },
  { value: "booked", label: "Booked" },
  { value: "published", label: "Published" },
  { value: "longterm", label: "Long-term" },
  { value: "dropped", label: "Dropped" },
];

type BookingFormValues = {
  channelName: string;
  channelKey: string;
  channelUrl: string;
  country: string;
  cm: string;
  platform: string;
  vertical: string;
  category: string;
  status: BookingStatus;
  activation: string;
  numActivations: string;
  contractSigned: boolean;
  contractUrl: string;
  publishedAt: string;
  intBudget: string;
  extBudget: string;
  currency: string;
  month: string;
  note: string;
  videoUrl: string;
};

const EMPTY_VALUES: BookingFormValues = {
  channelName: "",
  channelKey: "",
  channelUrl: "",
  country: "",
  cm: "",
  platform: "",
  vertical: "",
  category: "",
  status: "pipeline",
  activation: "",
  numActivations: "",
  contractSigned: false,
  contractUrl: "",
  publishedAt: "",
  intBudget: "",
  extBudget: "",
  currency: ALMEDIA_CURRENCY,
  month: "",
  note: "",
  videoUrl: "",
};

function text(value: string | null): string {
  return value ?? "";
}

function numberText(value: number | null): string {
  return value === null ? "" : String(value);
}

export function toFormValues(booking: Booking | null): BookingFormValues {
  if (!booking) {
    return EMPTY_VALUES;
  }

  return {
    channelName: booking.channelName,
    channelKey: booking.channelKey,
    channelUrl: text(booking.channelUrl),
    country: text(booking.country),
    cm: text(booking.cm),
    platform: text(booking.platform),
    vertical: text(booking.vertical),
    category: text(booking.category),
    status: booking.status,
    activation: text(booking.activation),
    numActivations: numberText(booking.numActivations),
    contractSigned: booking.contractSigned,
    contractUrl: text(booking.contractUrl),
    publishedAt: text(booking.publishedAt),
    intBudget: numberText(booking.intBudget),
    extBudget: numberText(booking.extBudget),
    currency: booking.currency,
    month: text(booking.month),
    note: text(booking.note),
    videoUrl: text(booking.videoUrl),
  };
}

function parseAmount(value: string): number | null | undefined {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export type BookingFormError = Readonly<{ field: string; message: string }>;

/**
 * Convert the form to the wire payload. Returns the first validation problem
 * instead of a payload so the caller can focus the offending control.
 */
export function toBookingInput(
  values: BookingFormValues,
): { ok: true; input: BookingInput } | { ok: false; error: BookingFormError } {
  if (values.channelName.trim().length === 0) {
    return {
      ok: false,
      error: { field: "channelName", message: "Channel name is required." },
    };
  }

  const intBudget = parseAmount(values.intBudget);
  const extBudget = parseAmount(values.extBudget);
  const numActivations = parseAmount(values.numActivations);

  if (intBudget === undefined || extBudget === undefined) {
    return {
      ok: false,
      error: { field: "intBudget", message: "Budgets must be positive numbers." },
    };
  }

  if (numActivations === undefined || (numActivations !== null && !Number.isInteger(numActivations))) {
    return {
      ok: false,
      error: {
        field: "numActivations",
        message: "Activations must be a whole number.",
      },
    };
  }

  if (values.month.trim().length > 0 && !/^\d{4}-\d{2}$/u.test(values.month.trim())) {
    return { ok: false, error: { field: "month", message: "Month must be YYYY-MM." } };
  }

  return {
    ok: true,
    input: {
      channelName: values.channelName.trim(),
      channelKey: values.channelKey,
      channelUrl: values.channelUrl,
      country: values.country,
      cm: values.cm,
      platform: values.platform,
      vertical: values.vertical,
      category: values.category,
      status: values.status,
      activation: values.activation,
      numActivations,
      contractSigned: values.contractSigned,
      contractUrl: values.contractUrl,
      publishedAt: values.publishedAt,
      intBudget,
      extBudget,
      currency: values.currency.trim().length === 0 ? ALMEDIA_CURRENCY : values.currency,
      month: values.month,
      note: values.note,
      videoUrl: values.videoUrl,
    },
  };
}

type AlmediaBookingFormProps = Readonly<{
  booking: Booking | null;
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (input: BookingInput) => void;
}>;

export function AlmediaBookingForm({
  booking,
  isSaving,
  onCancel,
  onSubmit,
}: AlmediaBookingFormProps) {
  const [values, setValues] = useState<BookingFormValues>(() => toFormValues(booking));
  const [error, setError] = useState<BookingFormError | null>(null);

  function update<Key extends keyof BookingFormValues>(
    key: Key,
    value: BookingFormValues[Key],
  ): void {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const result = toBookingInput(values);

    if (!result.ok) {
      setError(result.error);

      return;
    }

    setError(null);
    onSubmit(result.input);
  }

  return (
    <form className="almedia-booking-form" noValidate onSubmit={handleSubmit}>
      <div className="almedia-booking-form__heading">
        <div>
          <p className="almedia-eyebrow">{booking ? "Edit booking" : "New booking"}</p>
          <h3>{booking ? booking.channelName : "Add a creator to the tracker"}</h3>
        </div>
        <p className="almedia-booking-form__hint">
          The join key is derived from the channel name. Override it only when the
          Almedia campaign name differs.
        </p>
      </div>

      <div className="almedia-booking-form__grid">
        <label className="almedia-field almedia-field--wide">
          <span>Channel name *</span>
          <input
            autoComplete="off"
            name="channelName"
            onChange={(event) => {
              update("channelName", event.target.value);
            }}
            required
            value={values.channelName}
          />
        </label>

        <label className="almedia-field">
          <span>Join key</span>
          <input
            autoComplete="off"
            name="channelKey"
            onChange={(event) => {
              update("channelKey", event.target.value);
            }}
            placeholder="auto"
            value={values.channelKey}
          />
        </label>

        <label className="almedia-field">
          <span>Status</span>
          <select
            name="status"
            onChange={(event) => {
              update("status", event.target.value as BookingStatus);
            }}
            value={values.status}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="almedia-field">
          <span>CM</span>
          <input
            autoComplete="off"
            name="cm"
            onChange={(event) => {
              update("cm", event.target.value);
            }}
            value={values.cm}
          />
        </label>

        <label className="almedia-field">
          <span>Market</span>
          <input
            autoComplete="off"
            name="country"
            onChange={(event) => {
              update("country", event.target.value);
            }}
            placeholder="DE"
            value={values.country}
          />
        </label>

        <label className="almedia-field">
          <span>Platform</span>
          <input
            autoComplete="off"
            name="platform"
            onChange={(event) => {
              update("platform", event.target.value);
            }}
            placeholder="youtube"
            value={values.platform}
          />
        </label>

        <label className="almedia-field">
          <span>Vertical</span>
          <input
            autoComplete="off"
            name="vertical"
            onChange={(event) => {
              update("vertical", event.target.value);
            }}
            value={values.vertical}
          />
        </label>

        <label className="almedia-field">
          <span>Category</span>
          <input
            autoComplete="off"
            name="category"
            onChange={(event) => {
              update("category", event.target.value);
            }}
            placeholder="integration"
            value={values.category}
          />
        </label>

        <label className="almedia-field">
          <span>Month</span>
          <input
            autoComplete="off"
            name="month"
            onChange={(event) => {
              update("month", event.target.value);
            }}
            placeholder="2026-09"
            value={values.month}
          />
        </label>

        <label className="almedia-field">
          <span>Published</span>
          <input
            name="publishedAt"
            onChange={(event) => {
              update("publishedAt", event.target.value);
            }}
            type="date"
            value={values.publishedAt}
          />
        </label>

        <label className="almedia-field">
          <span>Internal budget</span>
          <input
            inputMode="decimal"
            name="intBudget"
            onChange={(event) => {
              update("intBudget", event.target.value);
            }}
            value={values.intBudget}
          />
        </label>

        <label className="almedia-field">
          <span>External budget</span>
          <input
            inputMode="decimal"
            name="extBudget"
            onChange={(event) => {
              update("extBudget", event.target.value);
            }}
            value={values.extBudget}
          />
        </label>

        <label className="almedia-field">
          <span>Currency</span>
          <input
            autoComplete="off"
            maxLength={3}
            name="currency"
            onChange={(event) => {
              update("currency", event.target.value);
            }}
            value={values.currency}
          />
        </label>

        <label className="almedia-field">
          <span>Activation</span>
          <input
            autoComplete="off"
            name="activation"
            onChange={(event) => {
              update("activation", event.target.value);
            }}
            value={values.activation}
          />
        </label>

        <label className="almedia-field">
          <span>Activations</span>
          <input
            inputMode="numeric"
            name="numActivations"
            onChange={(event) => {
              update("numActivations", event.target.value);
            }}
            value={values.numActivations}
          />
        </label>

        <label className="almedia-field almedia-field--wide">
          <span>Channel URL</span>
          <input
            autoComplete="off"
            name="channelUrl"
            onChange={(event) => {
              update("channelUrl", event.target.value);
            }}
            value={values.channelUrl}
          />
        </label>

        <label className="almedia-field almedia-field--wide">
          <span>Video URL</span>
          <input
            autoComplete="off"
            name="videoUrl"
            onChange={(event) => {
              update("videoUrl", event.target.value);
            }}
            value={values.videoUrl}
          />
        </label>

        <label className="almedia-field almedia-field--wide">
          <span>Contract URL</span>
          <input
            autoComplete="off"
            name="contractUrl"
            onChange={(event) => {
              update("contractUrl", event.target.value);
            }}
            value={values.contractUrl}
          />
        </label>

        <label className="almedia-field almedia-field--checkbox">
          <input
            checked={values.contractSigned}
            name="contractSigned"
            onChange={(event) => {
              update("contractSigned", event.target.checked);
            }}
            type="checkbox"
          />
          <span>Contract signed</span>
        </label>

        <label className="almedia-field almedia-field--full">
          <span>Note</span>
          <textarea
            name="note"
            onChange={(event) => {
              update("note", event.target.value);
            }}
            rows={3}
            value={values.note}
          />
        </label>
      </div>

      {error ? (
        <p className="almedia-booking-form__error" role="alert">
          {error.message}
        </p>
      ) : null}

      <div className="almedia-booking-form__actions">
        <button
          className="workspace-button workspace-button--secondary"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button className="workspace-button" disabled={isSaving} type="submit">
          {isSaving ? "Saving…" : booking ? "Save changes" : "Create booking"}
        </button>
      </div>
    </form>
  );
}
