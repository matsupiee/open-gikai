import { z } from "zod";

export const scrapersCreateJobSchema = z.object({
  municipalityId: z.string(),
  year: z.number().int().min(2000).max(2100),
});
