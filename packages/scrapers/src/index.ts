export type { ParsedStatement, MeetingData } from "./utils/types";
export type { ScraperAdapter, ListRecord } from "./adapters/adapter";
export { buildChunksFromStatements } from "./utils/statement-chunking";

// adapter registry: getAdapter で system_type 名から adapter を取得できる
import type { ScraperAdapter } from "./adapters/adapter";
import { adapter as dbsearch } from "./adapters/dbsearch";
import { adapter as discussnetSsp } from "./adapters/discussnet-ssp";
import { adapter as kensakusystem } from "./adapters/kensakusystem";
import { adapter as gijirokuCom } from "./adapters/gijiroku-com";
import { adapter as shinagawaKaigiroku } from "./adapters/custom/131091-shinagawa";
import { adapter as nakanoKugikai } from "./adapters/custom/131148-nakano";

const registry = new Map<string, ScraperAdapter>([
  [dbsearch.name, dbsearch],
  [discussnetSsp.name, discussnetSsp],
  [kensakusystem.name, kensakusystem],
  [gijirokuCom.name, gijirokuCom],
  [shinagawaKaigiroku.name, shinagawaKaigiroku],
  [nakanoKugikai.name, nakanoKugikai],
]);

/**
 * system_type 名から ScraperAdapter を取得する。
 * 新しい adapter を追加する場合はこの registry に登録する。
 */
export function getAdapter(name: string): ScraperAdapter | undefined {
  return registry.get(name);
}
