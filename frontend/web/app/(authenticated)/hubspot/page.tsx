import React from "react";

import { HubspotPushManager } from "../../../components/hubspot/hubspot-push-manager";
import { PageHeader } from "../../../components/layout/PageHeader";

export default function HubspotPage() {
  return (
    <section className="page-section">
      <PageHeader crumbs={[{ label: "HubSpot" }]} title="HubSpot" />
      <div className="page-container page-section__body">
        <HubspotPushManager />
      </div>
    </section>
  );
}
