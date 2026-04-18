import { ORPCError } from "@orpc/server";

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

type Bucket = Map<string, number[]>;

/**
 * プロセス内メモリに保持するレート制限用バケット。
 *
 * キー構成は呼び出し側責務（`${name}:${userId}` のように衝突を避ける）。
 * プロセス再起動でリセットされる単純実装で、分散環境での厳密な制限には対応しない。
 */
const globalBucket: Bucket = new Map();

/**
 * `key` が直近 `windowMs` 以内に `max` 回を超えていないか確認する。
 *
 * 超えていれば `ORPCError("TOO_MANY_REQUESTS")` を throw する。
 * 超えていなければ現時刻を記録し、残り回数情報を返す。
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions,
  bucket: Bucket = globalBucket,
  now: number = Date.now(),
): { remaining: number; resetAt: number } {
  const { windowMs, max } = options;
  if (max <= 0) {
    throw new ORPCError("TOO_MANY_REQUESTS", {
      message: "Rate limit is disabled",
    });
  }

  const windowStart = now - windowMs;
  const prev = bucket.get(key) ?? [];
  // 古いタイムスタンプを捨てる
  const recent = prev.filter((t) => t > windowStart);

  if (recent.length >= max) {
    // 最も古い記録がウィンドウから外れる時刻までリクエストできない
    const oldest = recent[0]!;
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    const seconds = Math.ceil(retryAfterMs / 1000);
    throw new ORPCError("TOO_MANY_REQUESTS", {
      message: `レート上限に達しました。約 ${seconds} 秒後に再試行してください。`,
      data: {
        retryAfterMs,
        limit: max,
        windowMs,
      },
    });
  }

  recent.push(now);
  bucket.set(key, recent);

  return {
    remaining: max - recent.length,
    resetAt: recent[0]! + windowMs,
  };
}

/**
 * テスト用: グローバルバケットをクリアする。
 */
export function __resetRateLimitForTests(): void {
  globalBucket.clear();
}
