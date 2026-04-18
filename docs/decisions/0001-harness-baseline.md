# 0001. Harness の baseline と既知の technical debt

- Status: Accepted
- Date: 2026-04-18
- Deciders: claudecode

## Context

OpenAI の "Harness engineering" に倣って、エージェントが自律的に動けるようリポジトリの harness（制約・フィードバックループ・ドキュメント・境界）を整備した。このとき、既存コードに pre-existing な問題がいくつかあり、**harness の整備 PR ではそれらを直さない** 判断をした。本 ADR はその debt を明示する。

## Decision

以下を現時点の baseline として受け入れ、`agent:check` は **今通るものだけ** をゲートに含める:

1. **`agent:check` は `oxfmt --check` を含めない**
   - 既存 2037 ファイルが未フォーマット。baseline を整えるには別 PR で `oxfmt --write` 一斉適用が必要
   - 今の gate は: `oxlint && turbo check-types --filter='*' && turbo test --filter='*' --concurrency=1`
   - フォーマットは `bun run agent:format` に分離

2. **`packages/scrapers` は `check-types` を持たない**
   - 既存の型エラーが 15 件（未使用 import、`Record<string, unknown>` の不正キャスト、`unpdf` の型定義不整合など）
   - 手動チェック用に `type-check: tsc --noEmit` は残す
   - 型エラーを全て潰したら `check-types` にリネームして gate に組み込む

3. **`apps/web` も `check-types` を持たない**
   - `src/routes/admin/_layout/index.tsx` に oRPC の型が合わない箇所が複数
   - `src/routes/search/_utils/helpers.test.ts` で `react-dom/server` の型 import が壊れている
   - 修正したら `check-types: tsc --noEmit` を追加して gate に入れる

4. **`packages/notification` も `check-types` を持たない**
   - `src/slack.test.ts` が `vitest` を import しているが、`devDependencies` に `vitest` が無い
   - `vitest` を devDependency に加えれば通るが、該当パッケージで本当に必要かは要検討
   - 決着したら `check-types: tsc --noEmit` を追加

5. **`turbo test` は `--concurrency=1` で直列実行する**
   - 並列実行すると vitest が使う esbuild サービスが衝突し `The service was stopped` で落ちる
   - 直列で 16 秒程度。許容範囲
   - 並列を復活させるには workspace ルートで vitest projects にまとめる案がある（別途検討）

## Consequences

良い面:
- baseline が嘘をつかない（`agent:check` は本当に通るものしか含まない）
- debt が明示されているので、後続タスクで段階的に潰せる
- エージェントは `agent:check` の結果を信頼して次のアクションを決められる

悪い面:
- `check-types` が 3 パッケージで無効なので、そこに入り込む型リグレッションは CI では捕まらない
- フォーマットが事実上オプショナル。レビュアが気にする必要がある

## Alternatives considered

- **全部直してから harness を入れる**: PR が巨大化して harness 自体の議論が埋もれる。却下
- **`oxfmt --write` を `agent:check` の中で走らせる**: mutation が発生するので「チェック」の意味が崩れる。また他のスクリプトに副作用を持ち込む。却下
- **スクレイパーの型エラーを一括で抑制（`@ts-expect-error` / tsconfig 緩和）**: 負債を隠すだけでエージェントが気づけない。却下
