/**
 * ScraperAdapter レジストリ。
 *
 * packages/scrapers 側で adapter の登録・管理を行い、ここでは re-export のみ。
 * 新しい adapter を追加する場合は packages/scrapers/src/index.ts の registry に登録する。
 */
export { getAdapter } from "@open-gikai/scrapers";
