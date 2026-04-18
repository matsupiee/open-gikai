# packages/scrapers

## 責務

地方自治体議事録のスクレイパー本体。各自治体向けアダプター・共通ユーティリティ（PDF パース、HTML パース、URL 正規化等）を提供する。

## 依存

使ってよい:
- `unpdf` — PDF テキスト抽出
- 標準 `fetch` + HTML パーサ

使わない:
- `@open-gikai/db`（スクレイパーは DB を知らない。呼び出し側で変換する）
- `apps/*`

## 公開入口

- `src/index.ts` — アダプター一覧・ファクトリ
- `src/adapters/` — 自治体別 or パターン別アダプター
- `src/utils/` — 共有ユーティリティ
- `src/custom-scraping-docs.test.ts` — `docs/custom-scraping` との整合性テスト

## 関連 skill

- `.claude/skills/create-custom-adapter` — 自治体アダプターの新規作成
- `.claude/skills/batch-create-adapters` — 10件並列で一括作成
- `.claude/skills/test-common-adapter` — 汎用アダプターのパターン別テスト
- `.claude/skills/investigate-municipalities` — 未着手自治体の並列調査

## 開発

```bash
bun run --cwd packages/scrapers test
```

## 禁止事項

- DB スキーマ（`packages/db`）に依存しない
- アダプターに ad-hoc な HTTP クライアントを書かない（`src/utils/` の共通フェッチャを使う）
