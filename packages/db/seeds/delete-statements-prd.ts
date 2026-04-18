/**
 * 本番 DB の statements テーブルを全削除するスクリプト。
 *
 * 使い方:
 *   DATABASE_URL_FOR_PRD_IMPORT="postgresql://..." bun run db:delete-statements:prd
 *   # 確認プロンプトをスキップする場合:
 *   DATABASE_URL_FOR_PRD_IMPORT="postgresql://..." bun run db:delete-statements:prd --yes
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import dotenv from "dotenv";
import { sql } from "drizzle-orm";
import { createDb } from "../src/index";
import { statements } from "../src/schema/statements";

const seedsDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(seedsDir, "../../..");

dotenv.config({ path: resolve(root, ".env.local"), override: true });

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(`${message} [yes/no]: `);
    return answer.trim().toLowerCase() === "yes";
  } finally {
    rl.close();
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL_FOR_PRD_IMPORT;
  if (!databaseUrl) {
    console.error("[delete-statements:prd] DATABASE_URL_FOR_PRD_IMPORT が設定されていません");
    process.exit(1);
  }

  const skipConfirm = process.argv.slice(2).includes("--yes");

  const db = createDb(databaseUrl);

  const beforeRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(statements);
  const count = beforeRows[0]!.count;

  console.log(`[delete-statements:prd] 現在の statements レコード数: ${count}`);

  if (count === 0) {
    console.log("[delete-statements:prd] 削除対象がありません");
    process.exit(0);
  }

  if (!skipConfirm) {
    const ok = await confirm(
      `本番 DB の statements テーブルから ${count} 件を全削除します。続行しますか？`,
    );
    if (!ok) {
      console.log("[delete-statements:prd] キャンセルしました");
      process.exit(0);
    }
  }

  console.log("[delete-statements:prd] TRUNCATE 実行中...");
  await db.execute(sql`TRUNCATE TABLE ${statements} RESTART IDENTITY`);

  const afterRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(statements);

  console.log(`[delete-statements:prd] 完了! 削除後のレコード数: ${afterRows[0]!.count}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[delete-statements:prd] Fatal error:", err);
  process.exit(1);
});
