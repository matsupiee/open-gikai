export type { ParsedStatement, MeetingData } from "./utils/types";
export type { ScraperAdapter, ListRecord } from "./adapters/adapter";
export { buildChunksFromStatements } from "./utils/statement-chunking";

// adapter registry: ディレクトリを走査して自動登録する。
// 新しい adapter を追加する場合はこのファイルを編集する必要はなく、
// adapters/ 配下にディレクトリを作成して adapter を export するだけでよい。
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ScraperAdapter } from "./adapters/adapter";

const __dirname = dirname(fileURLToPath(import.meta.url));
const adaptersDir = join(__dirname, "adapters");

const registry = new Map<string, ScraperAdapter>();

// adapters/ 直下のサブディレクトリ（汎用アダプター）を走査
for (const entry of readdirSync(adaptersDir, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === "custom") continue;
  const mod = await import(join(adaptersDir, entry.name, "index.ts"));
  const adapter: ScraperAdapter = mod.adapter;
  registry.set(adapter.name, adapter);
}

// adapters/custom/ 配下のサブディレクトリ（カスタムアダプター）を走査
const customDir = join(adaptersDir, "custom");
for (const entry of readdirSync(customDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const mod = await import(join(customDir, entry.name, "index.ts"));
  const adapter: ScraperAdapter = mod.adapter;
  registry.set(adapter.name, adapter);
}

/**
 * system_type 名または自治体コードから ScraperAdapter を取得する。
 * 新しい adapter を追加する場合は adapters/ 配下にディレクトリを作成し
 * `export const adapter: ScraperAdapter = { ... }` を定義するだけでよい。
 */
export function getAdapter(name: string): ScraperAdapter | undefined {
  return registry.get(name);
}
