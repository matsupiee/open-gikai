import { z } from "zod";

export const scrapersGetJobSchema = z.object({
  jobId: z.string(),
});
