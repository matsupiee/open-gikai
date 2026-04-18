# docs/decisions — ADR（Architecture Decision Records）

**アーキテクチャや方針の判断** を記録する場所。なぜその選択をしたか・代替案は何だったかを残し、将来のエージェント／人間が再発明するのを防ぐ。

## いつ書くか

- 依存方向・レイヤー規約を変えるとき
- 複数の選択肢から1つを選ぶとき（DB、LLM、デプロイ先、ライブラリ）
- 後から「なぜこうなっているのか」と聞かれそうな判断をしたとき
- 既知の technical debt を残すと判断したとき

## ファイル名

`NNNN-短い題名.md`（連番）。番号は既存の最大値+1。**番号は再利用しない**（欠番 OK、リネーム禁止）。

## テンプレ

```markdown
# NNNN. <タイトル>

- Status: Proposed | Accepted | Deprecated | Superseded by NNNN
- Date: YYYY-MM-DD
- Deciders: <人名 or エージェント名>

## Context
なぜこの判断が必要になったか。前提・制約・関係者。

## Decision
何を選んだか。一文で。

## Consequences
この判断によって何が変わるか。良い面・悪い面の両方を正直に。

## Alternatives considered
検討した他の選択肢と、なぜ選ばなかったか。
```

## Status 運用

- **Proposed**: 提案中。実装前
- **Accepted**: 採用。現行
- **Deprecated**: 非推奨。後続の ADR で置き換わっている可能性あり
- **Superseded by NNNN**: より新しい判断に上書きされた

ADR は **上書きではなく追記**。古い判断も歴史として残す。
