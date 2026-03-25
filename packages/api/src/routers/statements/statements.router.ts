import { publicProcedure } from "../../index";
import {
  statementsSearchSchema,
  statementsSemanticSearchSchema,
  statementsAskSchema,
} from "./_schemas";
import {
  searchStatements,
  semanticSearchStatements,
  askStatements,
} from "./statements.service";

export const statementsRouter = {
  search: publicProcedure
    .input(statementsSearchSchema)
    .handler(({ input, context }) => searchStatements(context.minutesDb, input)),

  semanticSearch: publicProcedure
    .input(statementsSemanticSearchSchema)
    .handler(({ input, context }) =>
      semanticSearchStatements(context.minutesDb, input)
    ),

  ask: publicProcedure
    .input(statementsAskSchema)
    .handler(({ input, context }) => askStatements(context.minutesDb, input)),
};
