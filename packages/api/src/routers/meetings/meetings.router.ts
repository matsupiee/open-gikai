import { publicProcedure } from "../../index";
import { meetingsListSchema, meetingStatementsSchema } from "./_schemas";
import { listMeetings, getMeetingStatements } from "./meetings.service";

export const meetingsRouter = {
  list: publicProcedure
    .input(meetingsListSchema)
    .handler(({ input, context }) => listMeetings(context.minutesDb, input)),

  statements: publicProcedure
    .input(meetingStatementsSchema)
    .handler(({ input, context }) => getMeetingStatements(context.minutesDb, input)),
};
