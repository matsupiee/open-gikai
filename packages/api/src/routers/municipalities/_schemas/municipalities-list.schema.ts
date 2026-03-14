import { z } from "zod";

export const municipalitiesListSchema = z.object({
  query: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});
