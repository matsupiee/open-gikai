import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { sql } from "drizzle-orm";
import { municipalities } from "../schema/municipalities";
import type { SystemType } from "../schema/municipalities";
import { createDb } from "../index";

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
  // 自ホスト版 DiscussNet（/tenant/{slug}/ パスパターン）
  if (/\/tenant\/[^/]+\//.test(baseUrl)) return "discussnet_ssp";
  if (baseUrl.includes("dbsr.jp")) return "dbsearch";
  if (baseUrl.includes("kensakusystem.jp") && !baseUrl.includes("-vod/")) return "kensakusystem";
  if (baseUrl.includes("gijiroku.com")) return "gijiroku_com";
  // 自前ホスティングの VOICES インスタンス（茅ヶ崎・春日部等）も同じ voiweb.exe CGI
  if (/\/VOICES\//i.test(baseUrl)) return "gijiroku_com";
  // voiweb.exe ベースの検索ページ（大田区等、/voices/ パスを持たない自前ホスト）
  if (/g0[78]v_search\.asp/i.test(baseUrl)) return "gijiroku_com";
  return null;
}

// --- シード ---

async function seed() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const csvPath = join(__dirname, "municipalities.csv");
  const municipalityList = parseCsv(csvPath);

  const db = createDb();

  try {
    console.log(`[seed] ${municipalityList.length} 件の自治体を登録します`);

    let inserted = 0;
    const BATCH_SIZE = 100;

    const values = municipalityList.map((m) => {
      const displayName = m.name || m.prefecture; // 都道府県行は都道府県名を name に
      const systemType = detectSystemType(m.baseUrl);

      return {
        code: m.code,
        name: displayName,
        prefecture: m.prefecture,
        systemType,
        baseUrl: m.baseUrl,
        enabled: true,
        population: m.population,
        populationYear: m.populationYear,
      };
    });

    for (let i = 0; i < values.length; i += BATCH_SIZE) {
      const batch = values.slice(i, i + BATCH_SIZE);
      const result = await db
        .insert(municipalities)
        .values(batch)
        .onConflictDoUpdate({
          target: municipalities.code,
          set: {
            name: sql`excluded.name`,
            prefecture: sql`excluded.prefecture`,
            baseUrl: sql`excluded.base_url`,
            systemType: sql`excluded.system_type`,
            population: sql`excluded.population`,
            populationYear: sql`excluded.population_year`,
          },
        })
        .returning({ id: municipalities.id, code: municipalities.code });

      inserted += result.length;
    }

    console.log(`[seed] 完了: inserted/updated=${inserted}`);
  } finally {
    // Explicitly close the database connection
    db.$client.close();
  }
}

seed().catch((err) => {
  console.error("[seed] エラー:", err);
  process.exit(1);
});
