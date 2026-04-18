# apps/web

## 責務

Cloudflare Workers 上で動く公開 Web アプリ。ユーザーが議会／議員／議題を検索・閲覧する UI と、`@open-gikai/api` 経由で oRPC を叩く SPA を提供する。

- Vite + React 19 + TanStack Router/Query/Start + oRPC client
- 認証は `@open-gikai/auth`（better-auth）
- デプロイ先は Cloudflare Workers（`wrangler.toml`）

## 依存

使ってよい:
- `@open-gikai/api` — oRPC procedures（`orpc.xxx.queryOptions()` 経由）
- `@open-gikai/auth` — better-auth client
- `@open-gikai/db` — schema の型参照のみ（直接 query するな）

使わない:
- 他の `apps/*`（app 間は疎結合）

## 公開入口

- `src/router.tsx` — ルーター設定
- `src/routes/` — TanStack Router のファイルベースルーティング（`routeTree.gen.ts` は自動生成）
- `src/routes/api/rpc/$.ts` — oRPC の HTTP ハンドラ
- `src/middleware/` — SSR / Workers middleware
- `src/lib/`, `src/shared/` — 共有 util と型

## 開発

```bash
bun run dev:web        # Vite dev
bun run --cwd apps/web test
```

UI 変更時は実ブラウザで動作確認する（`.claude/skills/browser-check`）。

## 禁止事項

- `packages/api` を経由せずに DB を直接叩かない
- `routeTree.gen.ts` は手で編集しない（TanStack Router プラグインが自動生成）
- `@open-gikai/auth` 以外の認証ライブラリを追加しない
