import { z } from "zod";

export const scrapersReprocessStatementsSchema = z.object({
  municipalityId: z.string(),
});
