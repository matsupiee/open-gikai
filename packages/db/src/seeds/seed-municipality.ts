import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { municipalities } from "../schema/municipalities";
import { system_types, SYSTEM_TYPES_SEED } from "../schema/system-types";
import type { SystemType } from "../schema/system-types";

dotenv.config({
  path: "../../.env.local",
});

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

interface MunicipalityRecord {
  code: string;
  prefecture: string;
  name: string;
  /** 議事録検索URL（municipality-url.csv 由来） */
  baseUrl: string;
  /** 人口（住民基本台帳ベース、null = 未設定） */
  population: number | null;
  /** 人口データの基準年（null = 未設定） */
  populationYear: number | null;
}

function parseCsv(filePath: string): MunicipalityRecord[] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/).slice(1); // ヘッダー行をスキップ

  return lines.flatMap((line) => {
    if (!line.trim()) return [];

    const cols = line.split(",");
    const code = cols[0]?.trim() ?? "";
    const prefecture = cols[1]?.replace(/"/g, "").trim() ?? "";
    const name = cols[2]?.replace(/"/g, "").trim() ?? "";
    const baseUrl = (cols[5]?.replace(/"/g, "").trim() ?? "") || "";
    const populationRaw = cols[6]?.replace(/"/g, "").trim();
    const populationYearRaw = cols[7]?.replace(/"/g, "").trim();
    const population = populationRaw
      ? parseInt(populationRaw, 10) || null
      : null;
    const populationYear = populationYearRaw
      ? parseInt(populationYearRaw, 10) || null
      : null;
    return { code, prefecture, name, baseUrl, population, populationYear };
  });
}

function detectSystemType(baseUrl: string): SystemType | null {
  if (baseUrl.includes("ssp.kaigiroku.net")) return "discussnet_ssp";
  if (baseUrl.includes("dbsr.jp")) return "dbsearch";
  if (baseUrl.includes("kensakusystem.jp")) return "kensakusystem";
  return null;
}

// --- シード ---

async function seed() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const csvPath = join(__dirname, "municipalities.csv");
  const municipalityList = parseCsv(csvPath);

  const db = drizzle(DATABASE_URL as string, { casing: "snake_case" });

  // 1. system_types を先に upsert する
  console.log(
    `[seed] system_types を ${SYSTEM_TYPES_SEED.length} 件 upsert します`,
  );
  await db
    .insert(system_types)
    .values(SYSTEM_TYPES_SEED)
    .onConflictDoUpdate({
      target: system_types.name,
      set: { description: sql`excluded.description` },
    });

  // 2. name → id のマップを構築する
  const systemTypeRows = await db
    .select({ id: system_types.id, name: system_types.name })
    .from(system_types);
  const systemTypeIdByName = new Map(systemTypeRows.map((r) => [r.name, r.id]));

  // 3. municipalities を upsert する
  console.log(`[seed] ${municipalityList.length} 件の自治体を登録します`);

  let inserted = 0;
  let skipped = 0;

  for (const m of municipalityList) {
    const displayName = m.name || m.prefecture; // 都道府県行は都道府県名を name に
    const typeName = detectSystemType(m.baseUrl);
    const systemTypeId = systemTypeIdByName.get(typeName ?? "");

    const result = await db
      .insert(municipalities)
      .values({
        code: m.code,
        name: displayName,
        prefecture: m.prefecture,
        systemTypeId,
        baseUrl: m.baseUrl,
        enabled: true,
        population: m.population,
        populationYear: m.populationYear,
      })
      .onConflictDoUpdate({
        target: municipalities.code,
        set: {
          name: sql`excluded.name`,
          prefecture: sql`excluded.prefecture`,
          baseUrl: sql`excluded.base_url`,
          enabled: sql`excluded.enabled`,
          systemTypeId: sql`excluded.system_type_id`,
          population: sql`excluded.population`,
          populationYear: sql`excluded.population_year`,
        },
      })
      .returning({ id: municipalities.id, code: municipalities.code });

    if (result.length > 0) {
      inserted++;
    } else {
      skipped++;
    }
  }

  console.log(`[seed] 完了: inserted/updated=${inserted}, skipped=${skipped}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed] エラー:", err);
  process.exit(1);
});
