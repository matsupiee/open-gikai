import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ORPCError } from "@orpc/server";

import {
  getTestDb,
  withRollback,
  createTestDatabase,
  runMigrations,
  closeTestDb,
} from "@open-gikai/db/test-helpers";
import { guest_ask_usage } from "@open-gikai/db/schema";

import { enforceGuestAskRateLimit } from "./guest-ask-rate-limit";

type TestDb = ReturnType<typeof getTestDb>;

let db: TestDb;

beforeAll(async () => {
  await createTestDatabase();
  db = getTestDb();
  await runMigrations(db);
});

afterAll(async () => {
  await closeTestDb(db);
});

describe("enforceGuestAskRateLimit", () => {
  it("上限未満は通り、使用履歴を insert する", async () => {
    await withRollback(db, async (tx) => {
      const result = await enforceGuestAskRateLimit(tx, "1.2.3.4", {
        windowMs: 24 * 60 * 60 * 1000,
        max: 5,
      });

      expect(result.remaining).toBe(4);
      const rows = await tx.select().from(guest_ask_usage);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.ip).toBe("1.2.3.4");
    });
  });

  it("ウィンドウ内で max 件を超えると TOO_MANY_REQUESTS を投げる", async () => {
    await withRollback(db, async (tx) => {
      const now = new Date("2026-04-20T00:00:00Z");
      for (let i = 0; i < 5; i++) {
        await enforceGuestAskRateLimit(
          tx,
          "5.6.7.8",
          { windowMs: 24 * 60 * 60 * 1000, max: 5 },
          new Date(now.getTime() + i),
        );
      }

      try {
        await enforceGuestAskRateLimit(
          tx,
          "5.6.7.8",
          { windowMs: 24 * 60 * 60 * 1000, max: 5 },
          new Date(now.getTime() + 1000),
        );
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ORPCError);
        expect((err as ORPCError<string, unknown>).code).toBe("TOO_MANY_REQUESTS");
      }
    });
  });

  it("異なる IP は独立してカウントされる", async () => {
    await withRollback(db, async (tx) => {
      for (let i = 0; i < 5; i++) {
        await enforceGuestAskRateLimit(tx, "10.0.0.1", {
          windowMs: 24 * 60 * 60 * 1000,
          max: 5,
        });
      }

      const result = await enforceGuestAskRateLimit(tx, "10.0.0.2", {
        windowMs: 24 * 60 * 60 * 1000,
        max: 5,
      });

      expect(result.remaining).toBe(4);
    });
  });

  it("ウィンドウ外の古い履歴はカウントから除外される", async () => {
    await withRollback(db, async (tx) => {
      const long_ago = new Date("2026-04-01T00:00:00Z");
      const now = new Date("2026-04-20T00:00:00Z");
      const windowMs = 24 * 60 * 60 * 1000;

      // ウィンドウ外 5 件
      for (let i = 0; i < 5; i++) {
        await tx.insert(guest_ask_usage).values({
          ip: "20.0.0.1",
          createdAt: new Date(long_ago.getTime() + i),
        });
      }

      const result = await enforceGuestAskRateLimit(tx, "20.0.0.1", { windowMs, max: 5 }, now);

      expect(result.remaining).toBe(4);
    });
  });
});
