/**
 * ScraperAdapter レジストリ。
 *
 * 2フェーズ (list → detail) スクレイパーを system_type 名で引けるようにする。
 * 新しい system_type を追加する場合はここに1行 registerAdapter() を足すだけでよい。
 */

import type { ScraperAdapter } from "@open-gikai/scrapers";

const registry = new Map<string, ScraperAdapter>();

function registerAdapter(adapter: ScraperAdapter): void {
  registry.set(adapter.name, adapter);
}

export function getAdapter(name: string): ScraperAdapter | undefined {
  return registry.get(name);
}

// ─── adapter 登録 ───
import { adapter as dbsearch } from "@open-gikai/scrapers/dbsearch";
import { adapter as kensakusystem } from "@open-gikai/scrapers/kensakusystem";
import { adapter as gijirokuCom } from "@open-gikai/scrapers/gijiroku-com";

registerAdapter(dbsearch);
registerAdapter(kensakusystem);
registerAdapter(gijirokuCom);
