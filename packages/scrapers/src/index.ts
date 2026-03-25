export type { ParsedStatement, MeetingData } from "./utils/types";
export type { ScraperAdapter, ListRecord } from "./adapters/adapter";
export { buildChunksFromStatements } from "./utils/statement-chunking";
export * from "./utils/detect-adapter-key";

// adapter registry: ディレクトリを走査して自動登録する。
// 新しい adapter を追加する場合はこのファイルを編集する必要はなく、
// adapters/ 配下にディレクトリを作成して adapter を export するだけでよい。
import { existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ScraperAdapter } from "./adapters/adapter";

const __dirname = dirname(fileURLToPath(import.meta.url));
const adaptersDir = join(__dirname, "adapters");

let registry: Map<string, ScraperAdapter> | undefined;

/**
 * 指定ディレクトリ直下のサブディレクトリを走査し、
 * `adapter` を named export しているモジュールを registry に登録する。
 * `_` や `.` で始まるディレクトリはスキップする。
 */
async function discoverAdapters(
  dir: string,
  map: Map<string, ScraperAdapter>,
  skip?: Set<string>,
): Promise<void> {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
    if (skip?.has(entry.name)) continue;
    try {
      // Bun でソース (.ts) を直接実行する前提。ビルド後の環境では拡張子解決がランタイム依存になる。
      const mod = await import(join(dir, entry.name));
      if (mod.adapter?.name) {
        map.set(mod.adapter.name, mod.adapter);
      } else {
        console.warn(
          `[scrapers] ${entry.name}: "adapter" named export が見つかりません。スキップします。`,
        );
      }
    } catch (e) {
      console.warn(`[scrapers] ${entry.name} の読み込みに失敗しました。スキップします。`, e);
    }
  }
}

/**
 * アダプター registry を初期化する。
 * アプリケーション起動時に一度だけ呼び出すこと。
 * 複数回呼び出しても冪等（2回目以降は何もしない）。
 * 呼び出さずに getAdapter を使った場合はエラーになる。
 */
export async function initAdapterRegistry(): Promise<void> {
  if (registry) return;
  const map = new Map<string, ScraperAdapter>();
  // adapters/ 直下のサブディレクトリ（汎用アダプター）— "custom" は除外
  await discoverAdapters(adaptersDir, map, new Set(["custom"]));
  // adapters/custom/ 配下のサブディレクトリ（カスタムアダプター）
  await discoverAdapters(join(adaptersDir, "custom"), map);
  registry = map;
}

/**
 * system_type 名または自治体コードから ScraperAdapter を取得する。
 * 新しい adapter を追加する場合は adapters/ 配下にディレクトリを作成し
 * `export const adapter: ScraperAdapter = { ... }` を定義するだけでよい。
 *
 * 事前に initAdapterRegistry() を呼び出しておく必要がある。
 */
export function getAdapter(name: string): ScraperAdapter | undefined {
  if (!registry) {
    throw new Error(
      "adapter registry が未初期化です。先に initAdapterRegistry() を呼び出してください。",
    );
  }
  return registry.get(name);
}
