import { z } from "zod";

export const meetingsAskSchema = z.object({
  question: z.string().min(1),
  municipalityCode: z.string().optional(),
  model: z.string().default("gemini-2.5-flash-lite"),
});
