import React from "react";

import { HubspotPushManager } from "../../../components/hubspot/hubspot-push-manager";
import { PageSection } from "../../../components/layout/page-section";

export default function HubspotPage() {
  return (
    <PageSection
      title="HubSpot"
      description="Review legacy import-ready CSV batches, inspect missing-field failures, and keep older HubSpot push history readable while Google Sheets remains the primary handoff path."
    >
      <HubspotPushManager />
    </PageSection>
  );
}
