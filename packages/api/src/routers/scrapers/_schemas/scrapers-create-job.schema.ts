import { z } from "zod";

const ndlConfig = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  limit: z.number().int().positive().optional(),
});

const kagoshimaConfig = z.object({
  year: z.number().int().min(2000).max(2100).optional(),
  limit: z.number().int().positive().optional(),
});

const localTarget = z.object({
  prefecture: z.string(),
  municipality: z.string(),
  assemblyLevel: z.enum(["prefectural", "municipal"]),
  baseUrl: z.string().url(),
  listSelector: z.string(),
  contentSelector: z.string(),
  dateSelector: z.string(),
  titleSelector: z.string().optional(),
});

const localConfig = z.object({
  targets: z.array(localTarget).min(1),
  limit: z.number().int().positive().optional(),
});

export const scrapersCreateJobSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("ndl"), config: ndlConfig }),
  z.object({ source: z.literal("kagoshima"), config: kagoshimaConfig }),
  z.object({ source: z.literal("local"), config: localConfig }),
]);
