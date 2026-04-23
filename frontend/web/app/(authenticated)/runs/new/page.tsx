import { PageHeader } from "../../../../components/layout/PageHeader";
import { NewScoutingWorkspace } from "../../../../components/scouting/new-scouting-workspace";

export default function NewRunPage() {
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
        <NewScoutingWorkspace showLegacyNotice />
      </div>
    </section>
  );
}
