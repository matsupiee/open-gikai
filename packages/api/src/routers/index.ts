/// <reference types="pg" />
import type { RouterClient } from "@orpc/server";

import { statementsRouter } from "./statements/statements.router";
import { scrapersRouter } from "./scrapers/scrapers.router";

export const appRouter = {
  statements: statementsRouter,
  scrapers: scrapersRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
