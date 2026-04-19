/// <reference types="pg" />
import type { RouterClient } from "@orpc/server";

import { meetingsRouter } from "./meetings/meetings.router";
import { municipalitiesRouter } from "./municipalities/municipalities.router";
import { topicsRouter } from "./topics/topics.router";

export const appRouter = {
  meetings: meetingsRouter,
  municipalities: municipalitiesRouter,
  topics: topicsRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
