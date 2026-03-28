import { createContext } from "@open-gikai/api/context";
import { appRouter } from "@open-gikai/api/routers/index";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createFileRoute } from "@tanstack/react-router";

import { getAuth, getDb } from "@/lib/server";

// --- Bot detection ---
const BLOCKED_UA_PATTERNS = [
  /python-requests/i,
  /scrapy/i,
  /wget/i,
  /httpx/i,
  /aiohttp/i,
  /node-fetch/i,
  /go-http-client/i,
  /java\//i,
  /libwww-perl/i,
  /GPTBot/i,
  /CCBot/i,
  /Google-Extended/i,
  /anthropic-ai/i,
  /ClaudeBot/i,
  /Bytespider/i,
  /Amazonbot/i,
  /Cohere-ai/i,
];

function isBlockedBot(userAgent: string | null): boolean {
  if (!userAgent) return true;
  return BLOCKED_UA_PATTERNS.some((pattern) => pattern.test(userAgent));
}

// --- Rate limiting (per-isolate in-memory) ---
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  return { allowed: true, retryAfter: 0 };
}

// Periodically clean up expired entries to prevent memory leaks
function cleanupRateLimitMap() {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now >= entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}
setInterval(cleanupRateLimitMap, RATE_LIMIT_WINDOW_MS);

// --- Security headers ---
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

// --- Handlers ---
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

  // Rate limiting by IP
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for") ??
    "unknown";
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": String(rateCheck.retryAfter),
      },
    });
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
