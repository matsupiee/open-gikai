import { publicProcedure } from "../../index";
import { statementsSearchSchema, statementsSemanticSearchSchema, statementsAskSchema } from "./_schemas";
import { searchStatements, semanticSearchStatements, askStatements } from "./statements.service";

export const statementsRouter = {
  search: publicProcedure
    .input(statementsSearchSchema)
    .handler(({ input }) => searchStatements(input)),

  semanticSearch: publicProcedure
    .input(statementsSemanticSearchSchema)
    .handler(({ input }) => semanticSearchStatements(input)),

  ask: publicProcedure
    .input(statementsAskSchema)
    .handler(({ input }) => askStatements(input)),
};
