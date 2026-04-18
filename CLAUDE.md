# open-gikai — エージェント向けリポマップ

このリポジトリは Claude Code / Codex などのコーディングエージェントが自律的に改善サイクルを回せることを目指して設計されている。本ドキュメントはその **harness（制約・フィードバックループ・ドキュメント・境界の集合）** のエントリポイント。

## プロダクト目的

- 地方自治体の議会や政策の進捗状況を可視化する
- 公務員（答弁作成業務など）のソース情報リサーチを支援する
- 議会／政策の研究者が研究目的で使える
- 記者が使える

## エージェント運用方針

- 開発は claudecode が自律的に改善サイクルを回す前提で進める
- 各タスクの動作確認は claudecode 自身で行う（`agent:check` を最低限のゲートとする）
- タスク終わりに詰まったポイントや引き継ぐべき知見は `.claude/skills/` 配下の skill として残す
- ルール（絶対に守る制約）は `.claude/rules/` に置く。skill はレシピ、rule は禁則

## ディレクトリマップ

```
apps/
  web/                    フロントエンド（Cloudflare Workers + Vite + React + TanStack + oRPC client）
  local-bulk-scraper/     NDJSON 吐き出し用 CLI（caffeinate 下で長時間実行）
  meeting-summarizer/     Gemini による議事録サマリ／探索 PoC
packages/
  api/                    apps/web 専用の oRPC プロシージャ（他アプリからは使わない）
  auth/                   better-auth 実装（web から利用）
  config/                 共有 tsconfig（唯一のメタパッケージ）
  db/                     Drizzle スキーマ・マイグレーション・seeds
  notification/           通知系ユーティリティ
  scrapers/               議事録スクレイパー（PDF/HTML パーサを含む）
docs/
  specs/                  設計ドキュメント（現行の仕様）
  plans/                  進行中の実装計画（完了したら specs or decisions へ）
  decisions/              ADR（アーキテクチャ判断の記録）
  custom-scraping/        自治体別スクレイパー調査メモ
.claude/
  rules/                  守る必要のある禁則（必ず読む）
  skills/                 反復タスクの手順書
```

## レイヤー規約（依存方向）

依存は必ず上から下へのみ流す。逆方向・横断は禁止。

```
apps/*  ──→  packages/api  ──→  packages/auth, packages/scrapers, packages/notification
                 │                            │
                 └─────────── packages/db ←───┘
                              │
                              └─→ packages/config（tsconfig のみ）
```

- `apps/*` 同士の依存は禁止
- `packages/*` から `apps/*` への依存は禁止
- `packages/api` は **apps/web 専用**。他の app からは import しない（詳細: `.claude/rules/api-package-rules.md`）

## エージェントの最低限ゲート（agent:check）

変更をコミットする前に以下を通すこと。

```bash
bun run agent:format   # oxfmt --write でフォーマット
bun run agent:check    # oxlint + turbo check-types + turbo test
```

`agent:check` の内訳:
- `oxlint`（静的解析。warning は許容、error は落とす）
- `turbo check-types`（型チェック。各パッケージに `check-types` スクリプトがある場合のみ）
- `turbo test`（Vitest を走らせる）

落ちたら直すまで次に進まない。CI も同じゲートを通る前提。

### 既知の technical debt（`agent:check` 未カバー）

- `apps/web` / `packages/notification` はまだ `check-types` スクリプトを持たない（pre-existing な型エラーがあるため）。直してから `check-types: tsc --noEmit` を追加する
- フォーマットは `oxfmt --check` を CI で強制していない（2000 以上のファイルが未フォーマット）。baseline を整えたら `agent:check` に `oxfmt --check` を戻す
- 詳細は `docs/decisions/0001-harness-baseline.md`

## ローカル DB / 開発サーバー

```bash
bun run db:start     # Supabase 起動
bun run dev:web      # apps/web を Vite で起動
bun run db:studio    # Drizzle Studio
```

DB アクセスが必要な調査は `.claude/skills/db-access` を参照。

## 必読ルール（`.claude/rules/`）

- `worktree-workflow.md` — worktree 時は PR 作成まで自動で行う
- `database-patterns.md` — `id` / `created_at` は手で渡さない、マイグレーションは手書き禁止、固定値カラムは enum
- `api-package-rules.md` — `packages/api` は apps/web 専用
- `test-writing-guidelines.md` — ヘルパー禁止、期待値ベタ書き、id は変数参照

## 変更を始める前に

1. 該当 app / package の `AGENTS.md` を読む（責務・公開API・依存・禁止事項）
2. 関連する `.claude/rules/` を読む
3. 大きめの変更なら `docs/plans/` にプランを置いてから着手する
4. 完了時は `agent:check` → コミット → PR（worktree 時）
