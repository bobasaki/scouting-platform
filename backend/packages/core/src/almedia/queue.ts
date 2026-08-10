import type { JobPayloadByName } from "@scouting-platform/contracts";

import { enqueueJob } from "../queue";

export async function enqueueAlmediaCampaignsSyncJob(
  payload: JobPayloadByName["almedia.campaigns.sync"],
): Promise<void> {
  await enqueueJob("almedia.campaigns.sync", payload);
}
