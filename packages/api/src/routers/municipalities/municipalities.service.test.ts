import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb } from "@open-gikai/db-minutes/test-helpers";
import { municipalities } from "@open-gikai/db-minutes";
import type { TestDb } from "@open-gikai/db-minutes/test-helpers";
import { listMunicipalities } from "./municipalities.service";

describe("listMunicipalities", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await getTestDb();
  });

  it("enabled な自治体のみ返す", async () => {
    await db.insert(municipalities).values([
      {
        code: "010001",
        name: "札幌市",
        prefecture: "北海道",
        regionSlug: "hokkaido",
        enabled: true,
      },
      {
        code: "020001",
        name: "青森市",
        prefecture: "青森県",
        regionSlug: "tohoku",
        enabled: false,
      },
    ]);

    const result = await listMunicipalities(db, {}, false);

    expect(result.total).toBe(1);
    expect(result.municipalities).toHaveLength(1);
    expect(result.municipalities[0]!.name).toBe("札幌市");
  });

  it("query でテキスト検索（自治体名）", async () => {
    await db.insert(municipalities).values([
      {
        code: "010001",
        name: "札幌市",
        prefecture: "北海道",
        regionSlug: "hokkaido",
        enabled: true,
      },
      {
        code: "131001",
        name: "千代田区",
        prefecture: "東京都",
        regionSlug: "kanto",
        enabled: true,
      },
    ]);

    const result = await listMunicipalities(db, { query: "札幌" }, false);

    expect(result.total).toBe(1);
    expect(result.municipalities[0]!.name).toBe("札幌市");
  });

  it("query でテキスト検索（都道府県名）", async () => {
    await db.insert(municipalities).values([
      {
        code: "010001",
        name: "札幌市",
        prefecture: "北海道",
        regionSlug: "hokkaido",
        enabled: true,
      },
      {
        code: "131001",
        name: "千代田区",
        prefecture: "東京都",
        regionSlug: "kanto",
        enabled: true,
      },
    ]);

    const result = await listMunicipalities(db, { query: "東京" }, false);

    expect(result.total).toBe(1);
    expect(result.municipalities[0]!.name).toBe("千代田区");
  });

  it("query で複数トークンの AND 検索", async () => {
    await db.insert(municipalities).values([
      {
        code: "010001",
        name: "札幌市",
        prefecture: "北海道",
        regionSlug: "hokkaido",
        enabled: true,
      },
      {
        code: "012025",
        name: "旭川市",
        prefecture: "北海道",
        regionSlug: "hokkaido",
        enabled: true,
      },
      {
        code: "131001",
        name: "千代田区",
        prefecture: "東京都",
        regionSlug: "kanto",
        enabled: true,
      },
    ]);

    const result = await listMunicipalities(
      db,
      { query: "北海道 札幌" },
      false,
    );

    expect(result.total).toBe(1);
    expect(result.municipalities[0]!.name).toBe("札幌市");
  });

  it("limit と offset でページネーション", async () => {
    await db.insert(municipalities).values([
      {
        code: "010001",
        name: "札幌市",
        prefecture: "北海道",
        regionSlug: "hokkaido",
        enabled: true,
      },
      {
        code: "020001",
        name: "青森市",
        prefecture: "青森県",
        regionSlug: "tohoku",
        enabled: true,
      },
      {
        code: "030001",
        name: "盛岡市",
        prefecture: "岩手県",
        regionSlug: "tohoku",
        enabled: true,
      },
    ]);

    // sortBy: "code" は prefecture 昇順 → code 昇順
    // 青森県(020001), 岩手県(030001), 北海道(010001) の順
    const result = await listMunicipalities(
      db,
      { limit: 2, offset: 1, sortBy: "code" },
      false,
    );

    expect(result.total).toBe(3);
    expect(result.municipalities).toHaveLength(2);
    expect(result.municipalities[0]!.code).toBe("030001");
    expect(result.municipalities[1]!.code).toBe("020001");
  });

  it("sortBy: code で都道府県→コード順", async () => {
    await db.insert(municipalities).values([
      {
        code: "131001",
        name: "千代田区",
        prefecture: "東京都",
        regionSlug: "kanto",
        enabled: true,
      },
      {
        code: "010001",
        name: "札幌市",
        prefecture: "北海道",
        regionSlug: "hokkaido",
        enabled: true,
      },
    ]);

    const result = await listMunicipalities(
      db,
      { sortBy: "code" },
      false,
    );

    expect(result.municipalities[0]!.code).toBe("010001");
    expect(result.municipalities[1]!.code).toBe("131001");
  });

  it("sortBy: population で人口降順（null は末尾）", async () => {
    await db.insert(municipalities).values([
      {
        code: "010001",
        name: "札幌市",
        prefecture: "北海道",
        regionSlug: "hokkaido",
        enabled: true,
        population: 1_970_000,
      },
      {
        code: "131001",
        name: "千代田区",
        prefecture: "東京都",
        regionSlug: "kanto",
        enabled: true,
        population: 67_000,
      },
      {
        code: "020001",
        name: "青森市",
        prefecture: "青森県",
        regionSlug: "tohoku",
        enabled: true,
        population: null,
      },
    ]);

    const result = await listMunicipalities(
      db,
      { sortBy: "population" },
      false,
    );

    expect(result.municipalities[0]!.name).toBe("札幌市");
    expect(result.municipalities[1]!.name).toBe("千代田区");
    expect(result.municipalities[2]!.name).toBe("青森市");
  });

  it("isAdmin: false のとき baseUrl が null になる", async () => {
    await db.insert(municipalities).values({
      code: "010001",
      name: "札幌市",
      prefecture: "北海道",
      regionSlug: "hokkaido",
      enabled: true,
      baseUrl: "https://example.com/sapporo",
    });

    const result = await listMunicipalities(db, {}, false);

    expect(result.municipalities[0]!.baseUrl).toBeNull();
  });

  it("isAdmin: true のとき baseUrl がそのまま返る", async () => {
    await db.insert(municipalities).values({
      code: "010001",
      name: "札幌市",
      prefecture: "北海道",
      regionSlug: "hokkaido",
      enabled: true,
      baseUrl: "https://example.com/sapporo",
    });

    const result = await listMunicipalities(db, {}, true);

    expect(result.municipalities[0]!.baseUrl).toBe(
      "https://example.com/sapporo",
    );
  });

  it("データが0件のとき空配列と total: 0 を返す", async () => {
    const result = await listMunicipalities(db, {}, false);

    expect(result.municipalities).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
