import { randomUUID } from "crypto";
import { z } from "zod";
import { isScraperQueueMode } from "../lib/scraper-execution";
import { enqueueScrapeJob } from "./scraper/job-queue";

export const queueProbeAdminSchema = z.object({
  probeId: z.string().trim().optional(),
});

function queuedResponse(jobId: number, message: string) {
  return {
    success: true as const,
    queued: true as const,
    jobId,
    message,
  };
}

export async function runQueueProbeForAdmin(input: {
  userId: number;
  probeId?: string;
}) {
  if (!isScraperQueueMode()) {
    return {
      success: false as const,
      error:
        "Queue probes require SCRAPER_EXECUTION_MODE=queue so a worker can process the probe job.",
    };
  }

  const probeId = input.probeId?.trim() || randomUUID();
  const job = await enqueueScrapeJob({
    type: "queue_probe",
    payload: { probeId },
    requestedByUserId: input.userId,
  });

  return queuedResponse(
    job.id,
    `Queue probe ${probeId} was queued for the background worker.`,
  );
}
