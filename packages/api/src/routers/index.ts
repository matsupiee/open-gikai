/// <reference types="pg" />
import type { RouterClient } from "@orpc/server";

import { statementsRouter } from "./statements/statements.router";
import { scrapersRouter } from "./scrapers/scrapers.router";
import { meetingsRouter } from "./meetings/meetings.router";
import { municipalitiesRouter } from "./municipalities/municipalities.router";

export const appRouter = {
  statements: statementsRouter,
  scrapers: scrapersRouter,
  meetings: meetingsRouter,
  municipalities: municipalitiesRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
