import { z } from "zod";

export const topicsCompareSchema = z.object({
  topics: z.array(z.string().min(1)).min(2).max(5),
  municipalityCode: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});
