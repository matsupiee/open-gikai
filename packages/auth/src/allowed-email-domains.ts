/**
 * 登録を許可するメールドメインのリスト。
 * ワイルドカード ("*.lg.jp") はサブドメインにマッチする。
 */
export const ALLOWED_EMAIL_DOMAINS = [
  "yahoo.co.jp",
  "gmail.com",
  "ezweb.ne.jp",
  "au.com",
  "docomo.ne.jp",
  "i.softbank.jp",
  "softbank.ne.jp",
  "excite.co.jp",
  "googlemail.com",
  "hotmail.co.jp",
  "hotmail.com",
  "icloud.com",
  "live.jp",
  "me.com",
  "mineo.jp",
  "nifty.com",
  "outlook.com",
  "outlook.jp",
  "yahoo.ne.jp",
  "ybb.ne.jp",
  "ymobile.ne.jp",
  "*.lg.jp",
  "*.go.jp",
] as const;

/**
 * メールアドレスのドメインが許可リストに含まれるかを判定する。
 */
export function isAllowedEmailDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;

  return ALLOWED_EMAIL_DOMAINS.some((allowed) => {
    if (allowed.startsWith("*.")) {
      return domain.endsWith(allowed.slice(1));
    }
    return domain === allowed;
  });
}
