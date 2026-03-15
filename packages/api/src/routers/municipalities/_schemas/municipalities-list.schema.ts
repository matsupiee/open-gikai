import { z } from "zod";

export const municipalitiesListSchema = z.object({
  query: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
  sortBy: z.enum(["code", "population"]).default("code"),
});
