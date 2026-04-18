import { z } from "zod";

export const topicsTimelineSchema = z.object({
  topic: z.string().min(1),
  municipalityCode: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(100),
});
