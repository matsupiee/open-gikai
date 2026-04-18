# meeting-summarizer 残タスク

Phase 0 PoC（鹿児島市 2024 年分 129 会議のサマリ生成＋エージェント検索）が完了した時点でのドキュメント。ここから本番運用に向けて詰めるべきタスクを整理する。

## 現状（2026-04 時点）

### 実装済み

- `apps/meeting-summarizer/` — サマリ生成 & エージェント検索の CLI
  - `summarize-one.ts` / `summarize-batch.ts` — Gemini で会議ごとの要約＋議題抽出
  - `ask.ts` — サマリ済みデータに対する質問応答エージェント
- `meetings` テーブル拡張 — `summary`, `topic_digests` (JSONB), `summary_generated_at`, `summary_model`（migration 0006）
- 鹿児島市 (462012) 2024 年分 129 会議のサマリを DB に投入済み（計 1,374 topic 抽出）
- コスト実績: 全 129 会議のサマリ生成で約 $2.4（Gemini 2.5 Flash 使用）

### プロダクト方針

**従来**: キーワードで発言を検索 → 個別発言の羅列
**新方針**: 議題を軸に、過去の議論の流れを時系列で整理して提示

詳細は本 PR 内の会話ログを参照。

---

## 残タスク

優先度順。PoC の知見に基づいて粒度を調整する想定。

### 1. データ拡充（Phase 1）

#### 1.1 鹿児島市 2014〜2023 年分の取り込み

- 現状: ローカル DB には 2024 年分のみ（本番 DB にはより広い期間がある見込み）
- 選択肢:
  - **A.** 本番 DB から `db:import:prd` で鹿児島市分だけ import（最速）
  - **B.** discussnet-ssp アダプターで 2014〜2023 を新規スクレイプ（本番にも無いデータが必要なら）
- import 後、`bun run summarize:batch -- --municipality 462012 --skip-existing` で追加分だけサマリ生成
- 推定コスト: 10 年分で約 $20 前後（2024 年分の実績から外挿）

#### 1.2 他自治体への横展開

- まず知り合いの公務員が所属する自治体を優先
- discussnet-ssp / dbsearch / kensakusystem / gijiroku-com / custom の 5 種類アダプター別に検証が必要
- 委員会の speaker_name が取れていないアダプターがある（鹿児島市は委員会だと "不明" になる）。スクレイパー側で対処するか、digest 生成時に諦めるかを決める

---

### 2. サマリ品質の改善

#### 2.1 Topic の正規化（Phase 1 の目玉）

現状、`meetings.topic_digests` の `topic` 名は各会議ごとに独立した自由文字列。表記ゆれ（「市バス路線再編」「市営バス再編」「バス路線の再編成」）が統合されていないため、横串検索の精度が落ちる。

- 新テーブル `topics` / `meeting_topics` を追加（migration 0007）
  - `topics`: `id`, `municipality_code`, `canonical_name`, `aliases TEXT[]`, `description`
  - `meeting_topics`: `meeting_id`, `topic_id`, `relevance`, `digest`（複合 PK）
- 生成済み topic 文字列を LLM でクラスタリング → canonical_name 決定 → aliases 蓄積
  - 実装: `apps/meeting-summarizer/src/cluster-topics.ts`
  - 使い方: `bun run cluster:topics -- --municipality 462012`（`--dry-run` / `--reset` 対応）
- まずは自治体ごとに独立 topic として扱う（横断は Phase 4 以降）

#### 2.2 議事進行フィルタの精度確認

PoC では「発言取消し」「陳情継続審査」「委員選任同意」を topic 化しないよう prompt で指示済み。129 会議の生成結果をサンプリングして、実際に filter が効いているか確認する。

- 実装: `apps/meeting-summarizer/src/check-filter.ts`
- 使い方: `bun run check:filter -- --municipality 462012`

2026-04 時点の鹿児島市 129 会議での検証結果:

- 対象 topic 総数 **1,374** / フィルタ漏れ疑い **13 件（約 0.9%）**
- 漏れの内訳（パターン別）:
  - `発言取消` 6 件 — すべて議会運営委員会。議員の不穏当発言の取消し手続きが topic 化されている。prompt 側の漏れ
  - `委員会付託` 4 件 — 議会運営委員会の手続き議論が中心。ただし意見書の実質審議を含むものもあり境界的
  - `閉会中継続審査` 1 件 — 「八重山開発に関する閉会中継続審査」。陳情審査に向けた実質議論を含み、prompt の「実質質疑があれば例外」に該当する可能性あり
  - `議長選挙` / `副議長選挙` 2 件（同一 topic の重複ヒット）— YouTube 発言批判の議論で、選挙そのものではなく議員の不適切発言が主題。残して良い
- **方針**: prompt に「議会運営委員会で議員の発言取消し手続きを議論しただけの議題は除外」を追記するか、committee タイプ別に post-filter する。Phase 1 の topic 正規化後であれば「発言取消し」クラスタを丸ごと除外しやすい

#### 2.3 flash-lite で summarize した 12 件の再生成（任意）

精度比較のため Flash に統一したいなら `summary_model = 'gemini-2.5-flash-lite'` の行を再実行。差分は大きくないはずなので優先度低。

---

### 3. エージェント検索の磨き込み

#### 3.1 応答の永続化

`ask.ts` は現状 stdout のみ。プロンプト調整のフィードバックループのため、以下をファイル保存するようにする:

- ユーザー質問
- 各イテレーションのツール呼び出しと結果
- 最終応答
- トークン使用量・コスト

`apps/meeting-summarizer/runs/YYYYMMDD-HHMMSS.md` 形式が妥当。

#### 3.2 ツール拡張

- `get_topic_timeline(topic_id)` — 1 議題の時系列発言を一気に取る（topics 正規化と同時に）
- `fetch_original_excerpt(meeting_id, anchor)` — 原本へのジャンプ（PoC 最初の設計で言及。深掘り用）
- `list_speakers(topic_id)` — 議員の発言傾向を見る補助

#### 3.3 エージェントプロンプトのバリエーション

PoC では「時系列で議論の流れを整理」形式でハードコード。用途別にテンプレート化:

- 議員視点（ある議員が追い続けている議題）
- 政策視点（同一政策の変遷）
- 比較視点（複数議題の関連）

---

### 4. 配信（Phase 3）

#### 4.1 packages/api への移植

CLI で組んだロジックを oRPC プロシージャ化:

- `topics.search(query, municipality_code, dateRange)`
- `topics.timeline(topic_id)`
- `topics.compare(topic_ids)`
- `meetings.ask(question, municipality_code)` — エージェント経由

`packages/api/src/shared/llm.ts` は現在 OpenAI だが、Gemini 用も併存させる or 置換する。

#### 4.2 apps/web の UX 差し替え

- トップ `/` を議題ブラウズに差し替え（現状は `/search` リダイレクト）
- `/topics/:id` — 議題詳細ページ。タイムライン＋関連議題カード
- `/topics/compare?ids=a,b` — 複数議題の関連分析
- 既存 `/search` は残す（慣れたユーザー向け）
- エージェント応答はストリーミング表示（「○○議会を読んでいます…」などの途中経過を出す）

#### 4.3 原本リンクの整備

`meetings.source_url` が埋まっていれば OK。埋まっていない自治体は scraper 側の改修が必要。

---

### 5. 運用・監視

#### 5.1 増分サマリ生成

新しいスクレイピング結果が入ったときに、該当 meeting だけサマリを生成する cron または trigger。

- `summarize-batch.ts` に `--skip-existing` は既にある
- scraper-worker のジョブ完了フックで呼び出すのが素直

#### 5.2 コスト上限ガード

- `summarize-batch.ts` に `--max-cost` オプションを追加して累計コストで自動停止
- 実行前 confirm（`--yes` で skip）

#### 5.3 失敗リトライパターン

- 既にタイムアウト / ECONNRESET / ETIMEDOUT は `retry.ts` でリトライ対象に追加済み
- JSON パース失敗（ごく稀）のリトライは未実装。実運用で観測されたら対応

---

### 6. Phase 4 以降（将来）

- **自治体横断比較**: 同議題を他市はどう議論しているか
- **ウォッチ・通知**: 特定議題に新しい発言が入ったら通知
- **政策立案者向けダッシュボード**: 議員単位の活動分析など
- **統一 topic マスタ**: 自治体別に作った topics を全国マスタに merge

---

## 判断メモ

- **モデル**: Flash > Flash-Lite（品質差あり）。本番は Flash 前提。将来 Sonnet / Claude 検証も検討
- **コスト**: 1 会議あたり ~$0.015〜0.02、1 自治体 10 年で $15〜25 が目安
- **議題粒度**: 「事業単位」でほぼ妥当。細かすぎると topic 数が爆発する
- **speaker**: plenary なら拾える。委員会はアダプター依存

---

## 関連ファイル

- `apps/meeting-summarizer/src/prompt.ts` — サマリ生成プロンプト
- `apps/meeting-summarizer/src/summarize.ts` — サマリ生成コア
- `apps/meeting-summarizer/src/ask.ts` — エージェント検索
- `apps/meeting-summarizer/src/tools.ts` — DB 検索ツール
- `packages/db/src/schema/meetings.ts` — 拡張スキーマ
- `packages/db/src/migrations/0006_serious_reaper.sql` — migration
