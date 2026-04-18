import { publicProcedure } from "../../index";
import { topicsSearchSchema } from "./_schemas";
import { searchTopics } from "./topics.service";

export const topicsRouter = {
  search: publicProcedure
    .input(topicsSearchSchema)
    .handler(async ({ input, context }) => ({
      rows: await searchTopics(context.db, input),
    })),
};
