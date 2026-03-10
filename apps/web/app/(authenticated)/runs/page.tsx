import React from "react";

import { PageSection } from "../../../components/layout/page-section";
import { CreateRunShell } from "../../../components/runs/create-run-shell";
import { RecentRunsShell } from "../../../components/runs/recent-runs-shell";

export default function RunsPage() {
  return (
    <PageSection
      title="Runs"
      description="Start a new discovery run against the shared catalog and review your latest run snapshots without leaving the runs surface."
    >
      <div className="runs-page">
        <CreateRunShell />
        <RecentRunsShell />
      </div>
    </PageSection>
  );
}
