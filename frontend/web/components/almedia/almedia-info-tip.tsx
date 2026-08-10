"use client";

import React, { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A small "i" affordance that reveals a plain-language explanation of a widget,
 * page, or metric. Built on `<details>` for keyboard and screen-reader support,
 * with outside-click and Escape wired up to close it (which native `<details>`
 * does not do on its own).
 */

type AlmediaInfoTipProps = Readonly<{
  /** What this segment means, in non-technical terms. */
  children: ReactNode;
  /** Accessible label; defaults to a generic "What is this?". */
  label?: string;
  /** Which side the panel opens toward, to avoid clipping at edges. */
  align?: "start" | "end";
}>;

export function AlmediaInfoTip({
  children,
  label = "What is this?",
  align = "end",
}: AlmediaInfoTipProps) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <details
      ref={ref}
      className={`almedia-info-tip almedia-info-tip--${align}`}
      open={open}
      onToggle={(event) => {
        setOpen((event.target as HTMLDetailsElement).open);
      }}
    >
      <summary
        aria-label={label}
        className="almedia-info-tip__trigger"
        title={label}
        onClick={(event) => {
          // Drive open state ourselves so outside-click/Escape stay in sync.
          event.preventDefault();
          setOpen((current) => !current);
        }}
      >
        <span aria-hidden="true">i</span>
      </summary>
      <div className="almedia-info-tip__panel" role="tooltip">
        {children}
      </div>
    </details>
  );
}
