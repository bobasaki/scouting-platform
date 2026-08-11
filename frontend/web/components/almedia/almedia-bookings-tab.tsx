"use client";

import type {
  AlmediaDeal,
  Booking,
  BookingInput,
  BookingStatus,
} from "@scouting-platform/contracts";
import Link from "next/link";
import React, { useMemo, useState } from "react";

import {
  createAlmediaBooking,
  deleteAlmediaBooking,
  updateAlmediaBooking,
} from "../../lib/almedia-api";
import { formatEurCompact } from "../../lib/almedia/format";
import { monthLabel } from "../../lib/almedia/labels";
import { DataTable } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { AlmediaBookingForm } from "./almedia-booking-form";
import { AlmediaInfoTip } from "./almedia-info-tip";

/**
 * Bookings tab — the only place bookings are created. Everything else in the
 * workspace reads them: a deal is a booking joined to its Almedia campaigns, so
 * an empty tracker means an empty Insights tab no matter how healthy the feed
 * is. Writes go straight to Postgres and the caller reloads the derived views.
 */

const STATUS_LABELS = {
  pipeline: "Pipeline",
  booked: "Booked",
  published: "Published",
  longterm: "Long-term",
  dropped: "Dropped",
} as const satisfies Record<BookingStatus, string>;

const STATUS_FILTERS: ReadonlyArray<BookingStatus> = [
  "pipeline",
  "booked",
  "published",
  "longterm",
  "dropped",
];

type EditorState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; booking: Booking };

function formatBudget(value: number | null, currency: string): string {
  if (value === null) {
    return "—";
  }

  return currency === "EUR"
    ? formatEurCompact(value)
    : `${value.toLocaleString("en-GB")} ${currency}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function AlmediaBookingsTab({
  deals = [],
  bookings,
  onMutated,
}: Readonly<{
  deals?: readonly AlmediaDeal[];
  bookings: readonly Booking[];
  onMutated: () => void;
}>) {
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const monthOptions = useMemo(
    () =>
      [
        ...new Set(
          bookings
            .map((booking) => booking.month)
            .filter((month): month is string => month !== null),
        ),
      ].sort((left, right) => right.localeCompare(left)),
    [bookings],
  );

  const visibleBookings = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return bookings.filter((booking) => {
      if (statusFilter !== "all" && booking.status !== statusFilter) {
        return false;
      }

      if (monthFilter !== "all" && booking.month !== monthFilter) {
        return false;
      }

      if (needle.length === 0) {
        return true;
      }

      return (
        booking.channelName.toLowerCase().includes(needle) ||
        booking.channelKey.toLowerCase().includes(needle) ||
        (booking.cm ?? "").toLowerCase().includes(needle)
      );
    });
  }, [bookings, search, statusFilter, monthFilter]);
  const catalogChannelIdByChannelKey = useMemo(
    () =>
      new Map(
        deals.flatMap((deal) =>
          deal.catalogChannelId
            ? [[deal.channelKey, deal.catalogChannelId] as const]
            : [],
        ),
      ),
    [deals],
  );

  function handleSubmit(input: BookingInput): void {
    if (editor.mode === "closed") {
      return;
    }

    const editedBooking = editor.mode === "edit" ? editor.booking : null;

    setIsSaving(true);
    setMutationError(null);

    const request = editedBooking
      ? updateAlmediaBooking(editedBooking.id, input)
      : createAlmediaBooking(input);

    void request
      .then(() => {
        setEditor({ mode: "closed" });
        onMutated();
      })
      .catch((error: unknown) => {
        setMutationError(getErrorMessage(error, "Unable to save the booking."));
      })
      .finally(() => {
        setIsSaving(false);
      });
  }

  function handleDelete(bookingId: string): void {
    if (pendingDeleteId !== bookingId) {
      setPendingDeleteId(bookingId);

      return;
    }

    setPendingDeleteId(null);
    setMutationError(null);

    void deleteAlmediaBooking(bookingId)
      .then(() => {
        onMutated();
      })
      .catch((error: unknown) => {
        setMutationError(getErrorMessage(error, "Unable to delete the booking."));
      });
  }

  return (
    <div className="almedia-bookings">
      <div className="almedia-section-heading">
        <h2>What have we booked?</h2>
        <AlmediaInfoTip align="start" label="What the Bookings tab shows">
          <p>
            <strong>The internal tracker.</strong> Every deal in this workspace starts
            as a booking here; the Almedia feed only supplies the performance half.
          </p>
          <ul>
            <li>
              <span className="almedia-info-tip__term">Join key</span>: how a booking
              finds its campaigns. Derived from the channel name unless overridden.
            </li>
            <li>
              <span className="almedia-info-tip__term">Committed</span> statuses are
              booked, published, and long-term — those are what the Scorecard counts.
            </li>
          </ul>
        </AlmediaInfoTip>
      </div>

      <div className="almedia-bookings__toolbar">
        <label className="almedia-field">
          <span>Search</span>
          <input
            autoComplete="off"
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Channel, key, or CM"
            type="search"
            value={search}
          />
        </label>

        <label className="almedia-field">
          <span>Status</span>
          <select
            onChange={(event) => {
              setStatusFilter(event.target.value as BookingStatus | "all");
            }}
            value={statusFilter}
          >
            <option value="all">All statuses</option>
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>

        <label className="almedia-field">
          <span>Month</span>
          <select
            onChange={(event) => {
              setMonthFilter(event.target.value);
            }}
            value={monthFilter}
          >
            <option value="all">All months</option>
            {monthOptions.map((month) => (
              <option key={month} value={month}>
                {monthLabel(month)}
              </option>
            ))}
          </select>
        </label>

        <p className="almedia-bookings__count">
          {visibleBookings.length} of {bookings.length}
        </p>

        <button
          className="workspace-button"
          disabled={editor.mode === "create"}
          onClick={() => {
            setEditor({ mode: "create" });
            setMutationError(null);
          }}
          type="button"
        >
          New booking
        </button>
      </div>

      {mutationError ? (
        <p className="almedia-sync-warning" role="alert">
          {mutationError}
        </p>
      ) : null}

      {editor.mode === "closed" ? null : (
        <AlmediaBookingForm
          booking={editor.mode === "edit" ? editor.booking : null}
          isSaving={isSaving}
          key={editor.mode === "edit" ? editor.booking.id : "create"}
          onCancel={() => {
            setEditor({ mode: "closed" });
            setMutationError(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {bookings.length === 0 ? (
        <EmptyState
          description="Nothing is booked yet. Add the first creator and the Insights and Scorecard tabs start filling in as the Almedia feed matches it."
          title="No bookings yet"
        />
      ) : visibleBookings.length === 0 ? (
        <EmptyState
          description="No bookings match the current filters."
          title="Nothing to show"
        />
      ) : (
        <DataTable caption="Booked creators, newest month first">
          <thead>
            <tr>
              <th scope="col">Channel</th>
              <th scope="col">CM</th>
              <th scope="col">Market</th>
              <th scope="col">Vertical</th>
              <th scope="col">Status</th>
              <th scope="col">Month</th>
              <th className="almedia-numeric" scope="col">
                Internal
              </th>
              <th className="almedia-numeric" scope="col">
                External
              </th>
              <th scope="col">Contract</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleBookings.map((booking) => {
              const catalogChannelId = catalogChannelIdByChannelKey.get(
                booking.channelKey,
              );

              return (
                <tr key={booking.id}>
                  <td>
                    <span className="almedia-bookings__channel">
                      {catalogChannelId ? (
                        <Link
                          className="almedia-link"
                          href={`/catalog/${catalogChannelId}`}
                        >
                          {booking.channelName}
                        </Link>
                      ) : (
                        booking.channelName
                      )}
                    </span>
                    <span className="almedia-subnote">{booking.channelKey}</span>
                  </td>
                  <td>{booking.cm ?? "—"}</td>
                  <td>{booking.country ?? "—"}</td>
                  <td>{booking.vertical ?? "—"}</td>
                  <td>
                    <span
                      className={`almedia-booking-status almedia-booking-status--${booking.status}`}
                    >
                      {STATUS_LABELS[booking.status]}
                    </span>
                  </td>
                  <td>{booking.month ? monthLabel(booking.month) : "—"}</td>
                  <td className="almedia-numeric">
                    {formatBudget(booking.intBudget, booking.currency)}
                  </td>
                  <td className="almedia-numeric almedia-numeric--emphasis">
                    {formatBudget(booking.extBudget, booking.currency)}
                  </td>
                  <td>{booking.contractSigned ? "Signed" : "—"}</td>
                  <td>
                    <div className="almedia-bookings__row-actions">
                      <button
                        className="workspace-button workspace-button--small workspace-button--secondary"
                        onClick={() => {
                          setEditor({ mode: "edit", booking });
                          setPendingDeleteId(null);
                          setMutationError(null);
                        }}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className={
                          pendingDeleteId === booking.id
                            ? "workspace-button workspace-button--small almedia-booking-delete almedia-booking-delete--armed"
                            : "workspace-button workspace-button--small workspace-button--secondary almedia-booking-delete"
                        }
                        onClick={() => {
                          handleDelete(booking.id);
                        }}
                        type="button"
                      >
                        {pendingDeleteId === booking.id ? "Confirm" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}
