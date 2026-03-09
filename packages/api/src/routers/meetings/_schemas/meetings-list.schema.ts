import { z } from "zod";

export const meetingsListSchema = z.object({
  heldOnFrom: z.string().optional(),
  heldOnTo: z.string().optional(),
  meetingType: z.string().optional(),
  assemblyLevel: z.enum(["national", "prefectural", "municipal"]).optional(),
  prefecture: z.string().optional(),
  municipality: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});
