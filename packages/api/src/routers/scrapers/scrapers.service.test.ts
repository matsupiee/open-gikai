import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { getTestDb, closeTestDb, withRollback } from "@open-gikai/db/test-helpers";
import { system_types, municipalities, scraper_jobs } from "@open-gikai/db/schema";
import {
  createJob,
  listJobs,
  getJob,
  cancelJob,
  deletePendingJobs,
  listMunicipalities,
  createBulkJobs,
} from "./scrapers.service";

let db: ReturnType<typeof getTestDb>;

beforeAll(() => {
  db = getTestDb();
});

afterAll(async () => {
  await closeTestDb(db);
});

/**
 * テスト用シードデータを投入する。
 * system_types → municipalities の順で作成し、テストで使う ID を返す。
 */
async function seedTestData(tx: ReturnType<typeof getTestDb>) {
  const [systemType] = await tx
    .insert(system_types)
    .values({ name: "test_system", description: "テスト用システム" })
    .returning();

  const [municipality] = await tx
    .insert(municipalities)
    .values({
      code: "999999",
      name: "テスト市",
      prefecture: "テスト県",
      systemTypeId: systemType!.id,
      baseUrl: "https://example.com",
      enabled: true,
    })
    .returning();

  const [disabledMunicipality] = await tx
    .insert(municipalities)
    .values({
      code: "888888",
      name: "無効市",
      prefecture: "テスト県",
      systemTypeId: systemType!.id,
      baseUrl: "https://example.com",
      enabled: false,
    })
    .returning();

  return {
    systemType: systemType!,
    municipality: municipality!,
    disabledMunicipality: disabledMunicipality!,
  };
}

describe("createJob", () => {
  test("pending ステータスでジョブが作成される", async () => {
    await withRollback(db, async (tx) => {
      const { municipality } = await seedTestData(tx);

      const job = await createJob(tx, {
        municipalityId: municipality.id,
        year: 2024,
      });

      expect(job.status).toBe("pending");
      expect(job.municipalityId).toBe(municipality.id);
      expect(job.year).toBe(2024);
      expect(job.processedItems).toBe(0);
      expect(job.totalInserted).toBe(0);
      expect(job.totalSkipped).toBe(0);
    });
  });
});

describe("listJobs", () => {
  test("ジョブ一覧がページネーション付きで取得できる", async () => {
    await withRollback(db, async (tx) => {
      const { municipality } = await seedTestData(tx);

      // 3件作成
      for (const year of [2022, 2023, 2024]) {
        await tx.insert(scraper_jobs).values({
          municipalityId: municipality.id,
          status: "pending",
          year,
        });
      }

      const result = await listJobs(tx, { limit: 2, offset: 0 });

      expect(result.jobs).toHaveLength(2);
      expect(result.total).toBe(3);
    });
  });

  test("municipality 名が JOIN される", async () => {
    await withRollback(db, async (tx) => {
      const { municipality } = await seedTestData(tx);

      await tx.insert(scraper_jobs).values({
        municipalityId: municipality.id,
        status: "pending",
        year: 2024,
      });

      const result = await listJobs(tx, { limit: 10, offset: 0 });

      expect(result.jobs[0]!.municipalityName).toBe("テスト市");
      expect(result.jobs[0]!.prefecture).toBe("テスト県");
      expect(result.jobs[0]!.systemTypeDescription).toBe("テスト用システム");
    });
  });
});

describe("getJob", () => {
  test("ジョブが正常に取得できる", async () => {
    await withRollback(db, async (tx) => {
      const { municipality } = await seedTestData(tx);

      const [created] = await tx
        .insert(scraper_jobs)
        .values({
          municipalityId: municipality.id,
          status: "running",
          year: 2024,
        })
        .returning();

      const job = await getJob(tx, { jobId: created!.id });

      expect(job.id).toBe(created!.id);
      expect(job.status).toBe("running");
      expect(job.municipalityName).toBe("テスト市");
    });
  });

  test("存在しない ID で NOT_FOUND エラー", async () => {
    await withRollback(db, async (tx) => {
      await expect(
        getJob(tx, { jobId: "nonexistent" }),
      ).rejects.toThrow("見つかりません");
    });
  });
});

describe("cancelJob", () => {
  test("pending ジョブをキャンセルできる", async () => {
    await withRollback(db, async (tx) => {
      const { municipality } = await seedTestData(tx);

      const [created] = await tx
        .insert(scraper_jobs)
        .values({
          municipalityId: municipality.id,
          status: "pending",
          year: 2024,
        })
        .returning();

      const cancelled = await cancelJob(tx, { jobId: created!.id });

      expect(cancelled.status).toBe("cancelled");
      expect(cancelled.completedAt).not.toBeNull();
    });
  });

  test("running ジョブをキャンセルできる", async () => {
    await withRollback(db, async (tx) => {
      const { municipality } = await seedTestData(tx);

      const [created] = await tx
        .insert(scraper_jobs)
        .values({
          municipalityId: municipality.id,
          status: "running",
          year: 2024,
        })
        .returning();

      const cancelled = await cancelJob(tx, { jobId: created!.id });

      expect(cancelled.status).toBe("cancelled");
    });
  });

  test("completed ジョブはキャンセルできない", async () => {
    await withRollback(db, async (tx) => {
      const { municipality } = await seedTestData(tx);

      const [created] = await tx
        .insert(scraper_jobs)
        .values({
          municipalityId: municipality.id,
          status: "completed",
          year: 2024,
        })
        .returning();

      await expect(
        cancelJob(tx, { jobId: created!.id }),
      ).rejects.toThrow("キャンセルできません");
    });
  });

  test("存在しない ID で NOT_FOUND エラー", async () => {
    await withRollback(db, async (tx) => {
      await expect(
        cancelJob(tx, { jobId: "nonexistent" }),
      ).rejects.toThrow("見つかりません");
    });
  });
});

describe("deletePendingJobs", () => {
  test("pending ジョブのみ削除され件数が返る", async () => {
    await withRollback(db, async (tx) => {
      const { municipality } = await seedTestData(tx);

      // pending x2, running x1
      await tx.insert(scraper_jobs).values([
        { municipalityId: municipality.id, status: "pending", year: 2024 },
        { municipalityId: municipality.id, status: "pending", year: 2023 },
        { municipalityId: municipality.id, status: "running", year: 2022 },
      ]);

      const result = await deletePendingJobs(tx, {});

      expect(result.deletedCount).toBe(2);

      // running は残っている
      const remaining = await listJobs(tx, { limit: 10, offset: 0 });
      expect(remaining.total).toBe(1);
      expect(remaining.jobs[0]!.status).toBe("running");
    });
  });
});

describe("listMunicipalities", () => {
  test("enabled な自治体のみ返却される", async () => {
    await withRollback(db, async (tx) => {
      await seedTestData(tx);

      const result = await listMunicipalities(tx, {});

      // enabled=true のテスト市のみ
      const testMunicipality = result.find((m) => m.code === "999999");
      expect(testMunicipality).toBeDefined();
      expect(testMunicipality!.name).toBe("テスト市");

      // enabled=false の無効市は含まれない
      const disabled = result.find((m) => m.code === "888888");
      expect(disabled).toBeUndefined();
    });
  });
});

describe("createBulkJobs", () => {
  test("enabled な自治体にのみジョブが作成される", async () => {
    await withRollback(db, async (tx) => {
      await seedTestData(tx);

      const result = await createBulkJobs(tx, { year: 2024 });

      // enabled=true かつ baseUrl ありの自治体のみ (テスト市1件)
      expect(result.createdCount).toBe(1);
      expect(result.skippedCount).toBe(0);
    });
  });

  test("既にアクティブジョブがある自治体はスキップされる", async () => {
    await withRollback(db, async (tx) => {
      const { municipality } = await seedTestData(tx);

      // 既存の pending ジョブ
      await tx.insert(scraper_jobs).values({
        municipalityId: municipality.id,
        status: "pending",
        year: 2024,
      });

      const result = await createBulkJobs(tx, { year: 2024 });

      expect(result.createdCount).toBe(0);
      expect(result.skippedCount).toBe(1);
    });
  });
});
