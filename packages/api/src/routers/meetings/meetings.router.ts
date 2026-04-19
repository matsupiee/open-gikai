import { eventIterator, ORPCError } from "@orpc/server";
import { z } from "zod";

import type { Context } from "../../context";
import { publicProcedure } from "../../index";
import { enforceGuestAskRateLimit } from "../../shared/guest-ask-rate-limit";
import { checkRateLimit } from "../../shared/rate-limit";
import { meetingsAskSchema, meetingsListSchema } from "./_schemas";
import {
  askMeetings,
  askMeetingsStream,
  listMeetings,
  type AskMeetingsStreamEvent,
} from "./meetings.service";

const USER_ASK_RATE_LIMIT = { windowMs: 10 * 60 * 1000, max: 5 } as const;
const GUEST_ASK_RATE_LIMIT = { windowMs: 24 * 60 * 60 * 1000, max: 5 } as const;

async function enforceAskRateLimit(context: Context): Promise<void> {
  if (context.session?.user) {
    checkRateLimit(`meetings.ask:${context.session.user.id}`, USER_ASK_RATE_LIMIT);
    return;
  }
  if (!context.ip) {
    throw new ORPCError("TOO_MANY_REQUESTS", {
      message: "送信元 IP を特定できないため、サインインしてから再試行してください。",
    });
  }
  await enforceGuestAskRateLimit(context.db, context.ip, GUEST_ASK_RATE_LIMIT);
}

export const meetingsRouter = {
  list: publicProcedure
    .input(meetingsListSchema)
    .handler(({ input, context }) => listMeetings(context.db, input)),

  ask: publicProcedure.input(meetingsAskSchema).handler(async ({ input, context }) => {
    await enforceAskRateLimit(context);
    return askMeetings(context.db, input);
  }),

  askStream: publicProcedure
    .input(meetingsAskSchema)
    .output(eventIterator(z.custom<AskMeetingsStreamEvent>()))
    .handler(async function* ({ input, context }) {
      await enforceAskRateLimit(context);
      yield* askMeetingsStream(context.db, input);
    }),
};
