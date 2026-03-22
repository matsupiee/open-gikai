/**
 * ScraperAdapter レジストリ。
 *
 * packages/scrapers 側で adapter の登録・管理を行い、ここでは re-export のみ。
 * 新しい adapter を追加する場合は packages/scrapers/src/adapters/ 配下に
 * ディレクトリを作成して adapter を export するだけでよい。
 */
export { getAdapter, initAdapterRegistry } from "@open-gikai/scrapers";
