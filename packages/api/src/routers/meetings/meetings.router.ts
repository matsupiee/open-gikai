import { publicProcedure } from "../../index";
import {
  meetingsAskSchema,
  meetingsListSchema,
  meetingStatementsSchema,
} from "./_schemas";
import {
  askMeetings,
  getMeetingStatements,
  listMeetings,
} from "./meetings.service";

export const meetingsRouter = {
  list: publicProcedure
    .input(meetingsListSchema)
    .handler(({ input, context }) => listMeetings(context.db, input)),

  statements: publicProcedure
    .input(meetingStatementsSchema)
    .handler(({ input, context }) => getMeetingStatements(context.db, input)),

  ask: publicProcedure
    .input(meetingsAskSchema)
    .handler(({ input, context }) => askMeetings(context.db, input)),
};
