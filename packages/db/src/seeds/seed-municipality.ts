import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { municipalities } from "../schema/municipalities";

dotenv.config({
  path: "../../apps/web/.env", // packages/dbから見た相対pathを書く
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
    return { code, prefecture, name, baseUrl };
  });
}

// --- シード ---

async function seed() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const csvPath = join(__dirname, "municipalities.csv");
  const municipalityList = parseCsv(csvPath);

  const db = drizzle(DATABASE_URL as string, { casing: "snake_case" });

  console.log(`[seed] ${municipalityList.length} 件の自治体を登録します`);

  let inserted = 0;
  let skipped = 0;

  for (const m of municipalityList) {
    const displayName = m.name || m.prefecture; // 都道府県行は都道府県名を name に
    const result = await db
      .insert(municipalities)
      .values({
        code: m.code,
        name: displayName,
        prefecture: m.prefecture,
        systemType: m.baseUrl.includes("ssp.kaigiroku.net")
          ? "discussnet_ssp"
          : "discussnet",
        baseUrl: m.baseUrl,
        enabled: true,
      })
      .onConflictDoUpdate({
        target: municipalities.code,
        set: {
          name: sql`excluded.name`,
          prefecture: sql`excluded.prefecture`,
          baseUrl: sql`excluded.base_url`,
          enabled: sql`excluded.enabled`,
          systemType: sql`excluded.system_type`,
        },
      })
      .returning({ id: municipalities.id, code: municipalities.code });

    if (result.length > 0) {
      inserted++;
      console.log(`  ✓ ${m.name} (${m.code}) - ${m.prefecture}`);
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
