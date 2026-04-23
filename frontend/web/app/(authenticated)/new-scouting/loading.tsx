import React from "react";
import { PageHeader } from "../../../components/layout/PageHeader";
import {
  Skeleton,
  SkeletonPageBody,
} from "../../../components/ui/skeleton";

export default function NewScoutingLoading() {
  return (
    <section className="page-section">
      <PageHeader
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "New Scouting" },
        ]}
        title="New Scouting"
      />
      <div className="page-container page-section__body">
        <SkeletonPageBody>
          <div style={{ display: "grid", gap: "1.25rem", maxWidth: "36rem" }}>
            <div style={{ display: "grid", gap: "0.4rem" }}>
              <Skeleton height="0.7rem" width="5rem" />
              <Skeleton borderRadius="var(--radius-md)" height="2.5rem" width="100%" />
            </div>
            <div style={{ display: "grid", gap: "0.4rem" }}>
              <Skeleton height="0.7rem" width="7rem" />
              <Skeleton borderRadius="var(--radius-md)" height="2.5rem" width="100%" />
            </div>
            <div style={{ display: "grid", gap: "0.4rem" }}>
              <Skeleton height="0.7rem" width="4rem" />
              <Skeleton borderRadius="var(--radius-md)" height="2.5rem" width="100%" />
            </div>
            <Skeleton borderRadius="var(--radius-md)" height="2.5rem" width="10rem" />
          </div>
        </SkeletonPageBody>
      </div>
    </section>
  );
}
