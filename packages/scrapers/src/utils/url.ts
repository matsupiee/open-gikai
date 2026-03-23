/**
 * URL 関連のユーティリティ関数
 */

/**
 * URL からホスト名を抽出し、externalId のプレフィックスとして使う。
 *
 * 例:
 *   "https://foo.dbsr.jp/index.php/12345" → "foo.dbsr.jp"
 *   "http://tsukuba.gijiroku.com/voices/g08v_search.asp" → "tsukuba.gijiroku.com"
 *
 * @param urls - ホスト名を抽出する URL（先に渡されたものが優先される）
 * @returns ホスト名。すべて無効な場合は "unknown"
 */
export function extractHostPrefix(...urls: (string | undefined)[]): string {
  for (const url of urls) {
    if (!url) continue;
    try {
      return new URL(url).hostname;
    } catch {
      continue;
    }
  }
  return "unknown";
}
