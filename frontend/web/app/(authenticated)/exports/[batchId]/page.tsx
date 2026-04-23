import { CsvExportBatchResultShell } from "../../../../components/exports/csv-export-batch-result-shell";
import { PageHeader } from "../../../../components/layout/PageHeader";

type ExportBatchResultPageProps = Readonly<{
  params: Promise<{ batchId: string }>;
}>;

export default async function ExportBatchResultPage({ params }: ExportBatchResultPageProps) {
  const { batchId } = await params;

  return (
    <section className="page-section">
      <PageHeader
        crumbs={[
          { label: "Exports", href: "/exports" },
          { label: "Export Batch Result" },
        ]}
        title="Export Batch Result"
      />
      <div className="page-container page-section__body">
        <CsvExportBatchResultShell batchId={batchId} />
      </div>
    </section>
  );
}
