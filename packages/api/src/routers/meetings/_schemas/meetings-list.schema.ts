import { z } from "zod";

export const meetingsListSchema = z.object({
  heldOnFrom: z.string().optional(),
  heldOnTo: z.string().optional(),
  prefecture: z.string().optional(),
  municipality: z.string().optional(),
  limit: z.number().min(1).max(50).default(20),
  cursor: z.string().optional(),
});
