# apps/meeting-summarizer

## 責務

Google Gemini (`@google/genai`) を使って議事録のサマリ生成・議題ベース探索を行う PoC。バッチ / 単発 / インタラクティブ問い合わせの 3 モードを持つ。

## 依存

使ってよい:

- `@open-gikai/db` — meetings テーブルへの読み書き（statements テーブルは参照しない）
- `@google/genai` — LLM 呼び出し
- `drizzle-orm`

発言本文は DB ではなくローカルの NDJSON (`data/minutes/{year}/{municipalityCode}/statements.ndjson`) から読み込む。`src/read-statements-ndjson.ts` のヘルパー経由で取得する。

使わない:

- `@open-gikai/api`（apps/web 専用）
- 他の `apps/*`

## 公開入口

- `src/summarize-one.ts` — 単発サマリ (`summarize:one`)
- `src/summarize-batch.ts` — バッチサマリ (`summarize:batch`)
- `src/ask.ts` — エージェント検索 PoC (`ask`)
- `src/summarize.ts`, `src/prompt.ts`, `src/tools.ts`, `src/retry.ts` — 共有モジュール

## 開発

```bash
bun run --cwd apps/meeting-summarizer test
bun run --cwd apps/meeting-summarizer summarize:one -- --meeting-id ...
```

## 禁止事項

- Gemini API キーをコミットしない（`.env.local` から読む）
- プロンプトをあちこちに散らさない（`src/prompt.ts` に集約）
- サマリ仕様の変更時は `docs/specs/` か `docs/plans/` に設計を置いてから着手する
