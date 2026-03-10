import { PageSection } from "../../../components/layout/page-section";
import { CreateRunShell } from "../../../components/runs/create-run-shell";

export default function RunsPage() {
  return (
    <PageSection
      title="Runs"
      description="Start a new discovery run against the shared catalog and your assigned YouTube API key. Recent-run history remains a separate Week 3 slice."
    >
      <CreateRunShell />
    </PageSection>
  );
}
