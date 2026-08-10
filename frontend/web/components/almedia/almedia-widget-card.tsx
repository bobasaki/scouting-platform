import React, { type ReactNode } from "react";

import { AlmediaInfoTip } from "./almedia-info-tip";

/**
 * A card on the Almedia widget grid. The source dashboard made these draggable
 * with react-grid-layout; Phase 1 uses a fixed CSS grid, so there is no drag
 * handle and no persisted layout.
 */

type AlmediaWidgetCardProps = Readonly<{
  title: string;
  eyebrow?: string;
  /** Plain-language explanation of what this widget shows. */
  info?: ReactNode;
  headerExtra?: ReactNode;
  /** Spans two grid columns when the content needs the room. */
  wide?: boolean;
  children: ReactNode;
}>;

export function AlmediaWidgetCard({
  title,
  eyebrow,
  info,
  headerExtra,
  wide = false,
  children,
}: AlmediaWidgetCardProps) {
  return (
    <section
      aria-label={title}
      className={wide ? "almedia-widget almedia-widget--wide" : "almedia-widget"}
    >
      <header className="almedia-widget__header">
        <div className="almedia-widget__title">
          {eyebrow ? <p className="almedia-eyebrow">{eyebrow}</p> : null}
          <h3>{title}</h3>
        </div>
        {info ? (
          <div className="almedia-widget__header-extra">
            <AlmediaInfoTip label={`What "${title}" shows`}>{info}</AlmediaInfoTip>
          </div>
        ) : null}
        {headerExtra ? (
          <div className="almedia-widget__header-extra">{headerExtra}</div>
        ) : null}
      </header>
      <div className="almedia-widget__body">{children}</div>
    </section>
  );
}
