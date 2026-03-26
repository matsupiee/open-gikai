const SHARED_SERVICE_DOMAINS = new Set([
  "dbsr.jp",
  "kaigiroku.net",
  "kensakusystem.jp",
  "gijiroku.com",
]);

/**
 * ホスト名からグループ化キーを抽出する。
 *
 * dbsr.jp のように複数の自治体がサブドメイン違いで同一サーバーを共有している
 * SaaS 型システムでは、フルホスト名ではなくサービスドメイン単位でグループ化する。
 * これにより同一サーバーへの過負荷を防ぐ。
 */
export function extractGroupKey(hostname: string): string {
  const parts = hostname.split(".");
  if (parts.length <= 2) return hostname;
  const last2 = parts.slice(-2).join(".");
  if (SHARED_SERVICE_DOMAINS.has(last2)) return last2;
  return hostname;
}
