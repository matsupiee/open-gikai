import { createMiddleware } from "@tanstack/react-start";

import { getAuth } from "@/lib/server";

export const authMiddleware = createMiddleware().server(async ({ next, request }) => {
  const session = await getAuth().api.getSession({
    headers: request.headers,
  });
  return next({
    context: { session },
  });
});
