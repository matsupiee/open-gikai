import { eventIterator } from "@orpc/server";
import { z } from "zod";

import { protectedProcedure, publicProcedure } from "../../index";
import { checkRateLimit } from "../../shared/rate-limit";
import { meetingsAskSchema, meetingsListSchema } from "./_schemas";
import {
  askMeetings,
  askMeetingsStream,
  listMeetings,
  type AskMeetingsStreamEvent,
} from "./meetings.service";

const ASK_RATE_LIMIT = { windowMs: 10 * 60 * 1000, max: 5 } as const;

function enforceAskRateLimit(userId: string): void {
  checkRateLimit(`meetings.ask:${userId}`, ASK_RATE_LIMIT);
}

export const meetingsRouter = {
  list: publicProcedure
    .input(meetingsListSchema)
    .handler(({ input, context }) => listMeetings(context.db, input)),

  ask: protectedProcedure.input(meetingsAskSchema).handler(({ input, context }) => {
    enforceAskRateLimit(context.session.user.id);
    return askMeetings(context.db, input);
  }),

  askStream: protectedProcedure
    .input(meetingsAskSchema)
    .output(eventIterator(z.custom<AskMeetingsStreamEvent>()))
    .handler(async function* ({ input, context }) {
      enforceAskRateLimit(context.session.user.id);
      yield* askMeetingsStream(context.db, input);
    }),
};
