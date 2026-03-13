import { z } from "zod";

export const statementsSemanticSearchSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().min(1).max(20).default(5),
  filters: z
    .object({
      prefecture: z.string().optional(),
      municipality: z.string().optional(),
      heldOnFrom: z.string().optional(),
      heldOnTo: z.string().optional(),
    })
    .optional(),
});
