import { publicProcedure } from "../../index";
import { statementsSearchSchema, statementsSemanticSearchSchema } from "./_schemas";
import { searchStatements, semanticSearchStatements } from "./statements.service";

export const statementsRouter = {
  search: publicProcedure
    .input(statementsSearchSchema)
    .handler(({ input }) => searchStatements(input)),

  semanticSearch: publicProcedure
    .input(statementsSemanticSearchSchema)
    .handler(({ input }) => semanticSearchStatements(input)),
};
