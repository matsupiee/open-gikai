import { publicProcedure } from "../../index";
import {
  topicsCompareSchema,
  topicsSearchSchema,
  topicsTimelineSchema,
} from "./_schemas";
import {
  findMeetingsWithTopics,
  searchTopics,
  timelineTopic,
} from "./topics.service";

export const topicsRouter = {
  search: publicProcedure
    .input(topicsSearchSchema)
    .handler(async ({ input, context }) => ({
      rows: await searchTopics(context.db, input),
    })),
  timeline: publicProcedure
    .input(topicsTimelineSchema)
    .handler(async ({ input, context }) => ({
      entries: await timelineTopic(context.db, input),
    })),
  compare: publicProcedure
    .input(topicsCompareSchema)
    .handler(async ({ input, context }) => ({
      rows: await findMeetingsWithTopics(context.db, input),
    })),
};
