import { HubspotPushBatchResultShell } from "../../../../components/hubspot/hubspot-push-batch-result-shell";
import { PageSection } from "../../../../components/layout/page-section";

type HubspotBatchResultPageProps = Readonly<{
  params: Promise<{ batchId: string }>;
}>;

export default async function HubspotBatchResultPage({ params }: HubspotBatchResultPageProps) {
  const { batchId } = await params;

  return (
    <PageSection
      title="HubSpot Batch Result"
      description="Review stored row outcomes, visible failures, and worker status for a single HubSpot push batch."
    >
      <HubspotPushBatchResultShell batchId={batchId} />
    </PageSection>
  );
}
