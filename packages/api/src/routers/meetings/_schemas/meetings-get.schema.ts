import { z } from "zod";

export const meetingsGetSchema = z.object({
  id: z.string(),
});
