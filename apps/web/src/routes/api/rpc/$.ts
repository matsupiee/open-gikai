import { createContext } from "@open-gikai/api/context";
import { appRouter } from "@open-gikai/api/routers/index";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createFileRoute } from "@tanstack/react-router";

import { getAuth, getDb } from "@/lib/server";

import { isBlockedBot } from "./_utils/block-bot";

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow");
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

async function handle({ request }: { request: Request }) {
  // Bot UA check
  const userAgent = request.headers.get("user-agent");
  if (isBlockedBot(userAgent)) {
    return new Response("Forbidden", { status: 403 });
  }

  const context = await createContext({
    req: request,
    auth: getAuth(),
    db: getDb(),
  });
  const rpcResult = await rpcHandler.handle(request, {
    prefix: "/api/rpc",
    context,
  });
  if (rpcResult.response) return withSecurityHeaders(rpcResult.response);

  const apiResult = await apiHandler.handle(request, {
    prefix: "/api/rpc/api-reference",
    context,
  });
  if (apiResult.response) return withSecurityHeaders(apiResult.response);

  return new Response("Not found", { status: 404 });
}

export const Route = createFileRoute("/api/rpc/$")({
  server: {
    handlers: {
      HEAD: handle,
      GET: handle,
      POST: handle,
      PUT: handle,
      PATCH: handle,
      DELETE: handle,
    },
  },
});
