import { PageSection } from "../../../../components/layout/page-section";
import { CreateRunShell } from "../../../../components/runs/create-run-shell";

export default function NewRunPage() {
  return (
    <PageSection
      title="Create Run"
      description="Kick off a discovery run and move straight into its live queue-backed detail view."
    >
      <CreateRunShell showRunsIndexLink />
    </PageSection>
  );
}
