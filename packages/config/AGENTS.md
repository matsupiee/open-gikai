# packages/config

## 責務

ワークスペース共通の `tsconfig` ベースを配布するメタパッケージ。コードはなく、`tsconfig.base.json` のみ。

## 依存

なし（root）。

## 公開入口

- `tsconfig.base.json` — 各パッケージの `tsconfig.json` から `extends` で継承

## 禁止事項

- ランタイムコードを置かない（型もロジックも）
- ここに依存を追加しない（メタのまま保つ）
