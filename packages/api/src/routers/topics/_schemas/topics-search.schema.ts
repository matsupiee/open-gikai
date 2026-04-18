import { z } from "zod";

export const topicsSearchSchema = z.object({
  query: z.string().min(1),
  municipalityCode: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(30),
});
