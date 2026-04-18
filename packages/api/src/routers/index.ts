/// <reference types="pg" />
import type { RouterClient } from "@orpc/server";

import { statementsRouter } from "./statements/statements.router";
import { meetingsRouter } from "./meetings/meetings.router";
import { municipalitiesRouter } from "./municipalities/municipalities.router";
import { topicsRouter } from "./topics/topics.router";

export const appRouter = {
  statements: statementsRouter,
  meetings: meetingsRouter,
  municipalities: municipalitiesRouter,
  topics: topicsRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
