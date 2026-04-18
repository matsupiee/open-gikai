# packages/api

## 責務

`apps/web` 専用の oRPC プロシージャ集。Web クライアントが `orpc.xxx.queryOptions()` / `mutationOptions()` で呼ぶエンドポイントを実装する。

**これは apps/web の延長であり、他 app から使う共有ライブラリではない。** 詳細: `.claude/rules/api-package-rules.md`。

## 依存

使ってよい:
- `@open-gikai/auth` — 認証 context
- `@open-gikai/db` — Drizzle クエリ
- `@orpc/server`, `@orpc/zod`, `zod`
- `openai`（LLM 呼び出し用）

使わない:
- `apps/*`（双方向依存禁止）

## 公開入口

- `src/index.ts` — ルータ集約
- `src/routers/` — 機能ごとの oRPC プロシージャ
- `src/context.ts` — oRPC context（認証・DB 注入）
- `src/shared/` — 共有 util・型

## 開発

```bash
bun run --cwd packages/api test
```

## 追加・削除ガイドライン

- 新プロシージャは追加前に `apps/web` から実際に呼ばれるか確認
- `apps/web` から消えたエンドポイントは同時にここからも消す
- `scraper-worker` など他アプリ専用のロジックは、そのアプリ内または専用パッケージへ

## 禁止事項

- 他の `apps/*` からインポートされる設計にしない
- 認証ロジックを直接書かず `@open-gikai/auth` 経由で使う
- SQL を直書きせず Drizzle を使う
