import { HubspotPushBatchResultShell } from "../../../../components/hubspot/hubspot-push-batch-result-shell";
import { PageHeader } from "../../../../components/layout/PageHeader";

type HubspotBatchResultPageProps = Readonly<{
  params: Promise<{ batchId: string }>;
}>;

export default async function HubspotBatchResultPage({ params }: HubspotBatchResultPageProps) {
  const { batchId } = await params;

  return (
    <section className="page-section">
      <PageHeader
        crumbs={[
          { label: "HubSpot", href: "/hubspot" },
          { label: "Batch Result" },
        ]}
        title="Batch Result"
      />
      <div className="page-container page-section__body">
        <HubspotPushBatchResultShell batchId={batchId} />
      </div>
    </section>
  );
}
