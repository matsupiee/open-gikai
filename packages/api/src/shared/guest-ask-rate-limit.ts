import { and, eq, gt } from "drizzle-orm";
import { ORPCError } from "@orpc/server";

import type { Db } from "@open-gikai/db";
import { guest_ask_usage } from "@open-gikai/db/schema";

import type { RateLimitOptions } from "./rate-limit";

/**
 * 未ログインユーザーの meetings.ask 呼び出しを IP 単位で rolling window 制限する。
 *
 * `guest_ask_usage` テーブルに永続化するので、Worker の isolate 間や再起動をまたいで
 * カウントが共有される。上限超過時は `ORPCError("TOO_MANY_REQUESTS")` を投げる。
 */
export async function enforceGuestAskRateLimit(
  db: Db,
  ip: string,
  options: RateLimitOptions,
  now: Date = new Date(),
): Promise<{ remaining: number; resetAt: number }> {
  const { windowMs, max } = options;
  if (max <= 0) {
    throw new ORPCError("TOO_MANY_REQUESTS", {
      message: "Rate limit is disabled",
    });
  }

  const windowStart = new Date(now.getTime() - windowMs);

  const recentRows = await db
    .select({ createdAt: guest_ask_usage.createdAt })
    .from(guest_ask_usage)
    .where(and(eq(guest_ask_usage.ip, ip), gt(guest_ask_usage.createdAt, windowStart)))
    .orderBy(guest_ask_usage.createdAt);

  if (recentRows.length >= max) {
    const oldest = recentRows[0]!.createdAt;
    const retryAfterMs = Math.max(0, oldest.getTime() + windowMs - now.getTime());
    const seconds = Math.ceil(retryAfterMs / 1000);
    throw new ORPCError("TOO_MANY_REQUESTS", {
      message: `ゲストの検索上限（${max} 回 / ${Math.round(windowMs / 3600000)} 時間）に達しました。約 ${seconds} 秒後に再試行するか、サインインしてください。`,
      data: {
        retryAfterMs,
        limit: max,
        windowMs,
      },
    });
  }

  await db.insert(guest_ask_usage).values({ ip });

  return {
    remaining: max - recentRows.length - 1,
    resetAt: (recentRows[0]?.createdAt.getTime() ?? now.getTime()) + windowMs,
  };
}
