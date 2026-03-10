import type { RouterClient } from "@orpc/server";

import { protectedProcedure } from "../index";
import { statementsRouter } from "./statements/statements.router";

export const appRouter = {
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session?.user,
    };
  }),
  statements: statementsRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
