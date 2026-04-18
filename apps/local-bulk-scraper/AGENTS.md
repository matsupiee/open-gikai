# apps/local-bulk-scraper

## 責務

自治体議事録を一括スクレイピングして NDJSON に吐き出す CLI。長時間実行前提で `caffeinate` 下で走らせる。生成した NDJSON は別経路で DB に投入する。

## 依存

使ってよい:
- `@open-gikai/scrapers` — 各自治体アダプター
- `drizzle-orm` — 型定義参照用（直接 DB には書かない）

使わない:
- `@open-gikai/api`（apps/web 専用）
- `@open-gikai/db`（Drizzle 型参照以外で使わない。書き込みは別パイプライン）
- 他の `apps/*`

## 公開入口

- `src/scrape-to-ndjson.ts` — `bun run scrape:ndjson` のエントリ
- `src/utils/` — NDJSON 書き出し・リトライ等のユーティリティ

## 開発

```bash
bun run --cwd apps/local-bulk-scraper test
bun run scrape:ndjson   # 本番スクレイピング（長時間）
```

デバッグは `.claude/skills/debug-bulk-scraper`、結果分析は `.claude/skills/duckdb-analytics`。

## 禁止事項

- DB に直接 insert しない（NDJSON に書き出して別経路で投入）
- caffeinate なしで長時間実行しない
- アダプターのロジックをここに置かない（`packages/scrapers` 側に置く）
