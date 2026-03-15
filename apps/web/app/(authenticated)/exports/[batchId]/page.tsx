import { CsvExportBatchResultShell } from "../../../../components/exports/csv-export-batch-result-shell";
import { PageSection } from "../../../../components/layout/page-section";

type ExportBatchResultPageProps = Readonly<{
  params: Promise<{ batchId: string }>;
}>;

export default async function ExportBatchResultPage({ params }: ExportBatchResultPageProps) {
  const { batchId } = await params;

  return (
    <PageSection
      title="Export Batch Result"
      description="Review stored scope, worker status, and download readiness for a single CSV export batch."
    >
      <CsvExportBatchResultShell batchId={batchId} />
    </PageSection>
  );
}
