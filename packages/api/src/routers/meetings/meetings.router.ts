import { publicProcedure } from "../../index";
import { meetingsGetSchema, meetingsListSchema, meetingsProcessSchema } from "./_schemas";
import { getMeeting, listMeetings, triggerProcessMeeting } from "./meetings.service";

export const meetingsRouter = {
  list: publicProcedure
    .input(meetingsListSchema)
    .handler(({ input }) => listMeetings(input)),

  get: publicProcedure
    .input(meetingsGetSchema)
    .handler(({ input }) => getMeeting(input.id)),

  process: publicProcedure
    .input(meetingsProcessSchema)
    .handler(({ input }) => triggerProcessMeeting(input.id)),
};
