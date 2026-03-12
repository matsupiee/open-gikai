import { assemblyLevelEnum } from "@open-gikai/db/schema";
import { z } from "zod";

export const statementsSearchSchema = z.object({
  q: z.string().optional(),
  kind: z.enum(["question", "answer", "remark", "unknown"]).optional(),
  speakerName: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
  heldOnFrom: z.string().optional(),
  heldOnTo: z.string().optional(),
  prefecture: z.string().optional(),
  municipality: z.string().optional(),
  assemblyLevel: z.enum(assemblyLevelEnum.enumValues).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});
