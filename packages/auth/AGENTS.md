# packages/auth

## 責務

`better-auth` をラップしたアプリ共通の認証モジュール。メール認証（`resend`）とセッション管理を提供し、許可メールドメインの制約もここに持つ。

## 依存

使ってよい:
- `@open-gikai/db` — auth 用テーブル（`packages/db/src/schema/auth.ts`）
- `better-auth`, `resend`, `zod`

使わない:
- `@open-gikai/api`（逆方向依存になる）
- `apps/*`

## 公開入口

- `src/index.ts` — `auth` インスタンスと型
- `src/allowed-email-domains.ts` — 許可ドメインの定義

## 禁止事項

- 認証ライブラリを増やさない（better-auth 一本）
- セッション/ユーザーの型を別の場所で再定義しない
- API キー・シークレットをソースに書かない（`.env.local` から読む）
