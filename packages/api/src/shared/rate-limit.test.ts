import { describe, expect, it } from "vitest";
import { ORPCError } from "@orpc/server";

import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  it("上限未満のリクエストは通る", () => {
    const bucket = new Map<string, number[]>();
    const now = 1_700_000_000_000;

    const result = checkRateLimit(
      "ask:user-a",
      { windowMs: 10 * 60 * 1000, max: 5 },
      bucket,
      now,
    );

    expect(result.remaining).toBe(4);
    expect(bucket.get("ask:user-a")).toHaveLength(1);
  });

  it("上限ちょうどまでは通り、超えた瞬間に TOO_MANY_REQUESTS を投げる", () => {
    const bucket = new Map<string, number[]>();
    const base = 1_700_000_000_000;

    for (let i = 0; i < 5; i++) {
      checkRateLimit(
        "ask:user-a",
        { windowMs: 10 * 60 * 1000, max: 5 },
        bucket,
        base + i,
      );
    }

    expect(() =>
      checkRateLimit(
        "ask:user-a",
        { windowMs: 10 * 60 * 1000, max: 5 },
        bucket,
        base + 10,
      ),
    ).toThrow(ORPCError);

    try {
      checkRateLimit(
        "ask:user-a",
        { windowMs: 10 * 60 * 1000, max: 5 },
        bucket,
        base + 10,
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ORPCError);
      expect((err as ORPCError<string, unknown>).code).toBe("TOO_MANY_REQUESTS");
    }
  });

  it("ウィンドウ外の古いタイムスタンプは捨てられ再度通る", () => {
    const bucket = new Map<string, number[]>();
    const base = 1_700_000_000_000;
    const windowMs = 10 * 60 * 1000;

    // 5 回分を同じ時刻で記録（全て同じウィンドウ内）
    for (let i = 0; i < 5; i++) {
      checkRateLimit(
        "ask:user-a",
        { windowMs, max: 5 },
        bucket,
        base,
      );
    }

    // windowMs を完全に超えた時刻なら、古い 5 件はすべて捨てられ再度通る
    const result = checkRateLimit(
      "ask:user-a",
      { windowMs, max: 5 },
      bucket,
      base + windowMs + 1,
    );

    expect(result.remaining).toBe(4);
    expect(bucket.get("ask:user-a")).toHaveLength(1);
  });

  it("キーが異なれば独立してカウントされる", () => {
    const bucket = new Map<string, number[]>();
    const now = 1_700_000_000_000;

    for (let i = 0; i < 5; i++) {
      checkRateLimit(
        "ask:user-a",
        { windowMs: 10 * 60 * 1000, max: 5 },
        bucket,
        now + i,
      );
    }

    const result = checkRateLimit(
      "ask:user-b",
      { windowMs: 10 * 60 * 1000, max: 5 },
      bucket,
      now + 100,
    );

    expect(result.remaining).toBe(4);
    expect(bucket.get("ask:user-a")).toHaveLength(5);
    expect(bucket.get("ask:user-b")).toHaveLength(1);
  });

  it("TOO_MANY_REQUESTS のエラーに retryAfterMs が含まれる", () => {
    const bucket = new Map<string, number[]>();
    const base = 1_700_000_000_000;
    const windowMs = 10 * 60 * 1000;

    for (let i = 0; i < 5; i++) {
      checkRateLimit("ask:user-a", { windowMs, max: 5 }, bucket, base + i);
    }

    try {
      checkRateLimit("ask:user-a", { windowMs, max: 5 }, bucket, base + 1000);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ORPCError);
      const data = (err as ORPCError<string, { retryAfterMs: number; limit: number; windowMs: number }>).data;
      expect(data.limit).toBe(5);
      expect(data.windowMs).toBe(10 * 60 * 1000);
      // base + 0 のタイムスタンプが windowMs + 0 でウィンドウから外れるので、
      // base + 1000 時点で retryAfterMs は windowMs - 1000 になる
      expect(data.retryAfterMs).toBe(windowMs - 1000);
    }
  });

  it("max が 0 以下なら常に TOO_MANY_REQUESTS", () => {
    const bucket = new Map<string, number[]>();

    expect(() =>
      checkRateLimit("ask:user-a", { windowMs: 10_000, max: 0 }, bucket),
    ).toThrow(ORPCError);
  });
});
