import { z } from "zod";

export const scrapersProgressByMunicipalitySchema = z.object({
  prefecture: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});
