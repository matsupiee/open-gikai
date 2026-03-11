import { z } from "zod";

export const scrapersCancelJobSchema = z.object({
  jobId: z.string(),
});
