import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getTestDb, withRollback, createTestDatabase, runMigrations, closeTestDb } from "@open-gikai/db/test-helpers";
import { municipalities } from "@open-gikai/db/schema";
import { listMunicipalities } from "./municipalities.service";

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

describe("listMunicipalities", () => {
  it("自治体一覧を返す", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values([
        {
          code: "010001",
          name: "札幌市",
          prefecture: "北海道",
        },
        {
          code: "020001",
          name: "青森市",
          prefecture: "青森県",
        },
      ]);

      const result = await listMunicipalities(tx, {}, false);

      expect(result.total).toBe(2);
      expect(result.municipalities).toHaveLength(2);
    });
  });

  it("query でテキスト検索（自治体名）", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values([
        { code: "010001", name: "札幌市", prefecture: "北海道" },
        { code: "131001", name: "千代田区", prefecture: "東京都" },
      ]);

      const result = await listMunicipalities(tx, { query: "札幌" }, false);

      expect(result.total).toBe(1);
      expect(result.municipalities[0]!.name).toBe("札幌市");
    });
  });

  it("query でテキスト検索（都道府県名）", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values([
        { code: "010001", name: "札幌市", prefecture: "北海道" },
        { code: "131001", name: "千代田区", prefecture: "東京都" },
      ]);

      const result = await listMunicipalities(tx, { query: "東京" }, false);

      expect(result.total).toBe(1);
      expect(result.municipalities[0]!.name).toBe("千代田区");
    });
  });

  it("query で複数トークンの AND 検索", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values([
        { code: "010001", name: "札幌市", prefecture: "北海道" },
        { code: "012025", name: "旭川市", prefecture: "北海道" },
        { code: "131001", name: "千代田区", prefecture: "東京都" },
      ]);

      const result = await listMunicipalities(
        tx,
        { query: "北海道 札幌" },
        false,
      );

      expect(result.total).toBe(1);
      expect(result.municipalities[0]!.name).toBe("札幌市");
    });
  });

  it("limit と offset でページネーション", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values([
        { code: "010001", name: "札幌市", prefecture: "北海道" },
        { code: "020001", name: "青森市", prefecture: "青森県" },
        { code: "030001", name: "盛岡市", prefecture: "岩手県" },
      ]);

      const result = await listMunicipalities(
        tx,
        { limit: 2, offset: 1, sortBy: "code" },
        false,
      );

      expect(result.total).toBe(3);
      expect(result.municipalities).toHaveLength(2);
    });
  });

  it("sortBy: code で都道府県→コード順", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values([
        { code: "131001", name: "千代田区", prefecture: "東京都" },
        { code: "010001", name: "札幌市", prefecture: "北海道" },
      ]);

      const result = await listMunicipalities(
        tx,
        { sortBy: "code" },
        false,
      );

      expect(result.municipalities[0]!.code).toBe("010001");
      expect(result.municipalities[1]!.code).toBe("131001");
    });
  });

  it("sortBy: population で人口降順（null は末尾）", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values([
        {
          code: "010001",
          name: "札幌市",
          prefecture: "北海道",
          population: 1_970_000,
        },
        {
          code: "131001",
          name: "千代田区",
          prefecture: "東京都",
          population: 67_000,
        },
        {
          code: "020001",
          name: "青森市",
          prefecture: "青森県",
          population: null,
        },
      ]);

      const result = await listMunicipalities(
        tx,
        { sortBy: "population" },
        false,
      );

      expect(result.municipalities[0]!.name).toBe("札幌市");
      expect(result.municipalities[1]!.name).toBe("千代田区");
      expect(result.municipalities[2]!.name).toBe("青森市");
    });
  });

  it("isAdmin: false のとき baseUrl が null になる", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values({
        code: "010001",
        name: "札幌市",
        prefecture: "北海道",
        baseUrl: "https://example.com/sapporo",
      });

      const result = await listMunicipalities(tx, {}, false);

      expect(result.municipalities[0]!.baseUrl).toBeNull();
    });
  });

  it("isAdmin: true のとき baseUrl がそのまま返る", async () => {
    await withRollback(db, async (tx) => {
      await tx.insert(municipalities).values({
        code: "010001",
        name: "札幌市",
        prefecture: "北海道",
        baseUrl: "https://example.com/sapporo",
      });

      const result = await listMunicipalities(tx, {}, true);

      expect(result.municipalities[0]!.baseUrl).toBe(
        "https://example.com/sapporo",
      );
    });
  });

  it("データが0件のとき空配列と total: 0 を返す", async () => {
    await withRollback(db, async (tx) => {
      const result = await listMunicipalities(tx, {}, false);

      expect(result.municipalities).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
