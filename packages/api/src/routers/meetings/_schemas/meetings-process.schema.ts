import { z } from "zod";

export const meetingsProcessSchema = z.object({
  id: z.string(),
});
