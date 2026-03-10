import { PageSection } from "../../../../components/layout/page-section";
import { RunDetailShell } from "../../../../components/runs/run-detail-shell";

type RunDetailPageProps = Readonly<{
  params: Promise<{ runId: string }>;
}>;

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { runId } = await params;

  return (
    <PageSection
      title="Run Detail"
      description="Track discovery status, inspect stored snapshot results, and surface queue failures without leaving the runs surface."
    >
      <RunDetailShell runId={runId} />
    </PageSection>
  );
}
