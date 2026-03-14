import { z } from "zod";

export const meetingStatementsSchema = z.object({
  meetingId: z.string(),
});
