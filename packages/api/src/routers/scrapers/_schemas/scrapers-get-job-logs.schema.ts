import { z } from "zod";

export const scrapersGetJobLogsSchema = z.object({
  jobId: z.string(),
  limit: z.number().int().min(1).max(500).default(200),
  offset: z.number().int().min(0).default(0),
});
