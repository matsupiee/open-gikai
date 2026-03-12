import { createFileRoute } from "@tanstack/react-router";

import { getAuth } from "@/lib/server";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => {
        return getAuth().handler(request);
      },
      POST: ({ request }) => {
        return getAuth().handler(request);
      },
    },
  },
});
