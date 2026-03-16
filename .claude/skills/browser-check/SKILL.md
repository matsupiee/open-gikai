---
name: browser-check
description: agent-browser を使ってローカル開発サーバーの動作確認を行う手順
version: 1.0.0
---

# Browser Check

agent-browser CLI を使ってローカル開発サーバーの動作確認を行うスキル。

## 前提条件

- `agent-browser` がグローバルインストール済み (`npm install -g agent-browser`)
- ローカル開発サーバーが起動済み（未起動の場合はユーザーに確認する）

## 基本フロー

### 1. 開発サーバーの確認

まずローカルサーバーが起動しているか確認する。起動していない場合はユーザーに起動を促す。

```bash
lsof -i :4030 -t
```

### 2. ページを開いてスナップショットを取得する

`agent-browser` の `snapshot` コマンドでアクセシビリティツリーを取得し、ページの状態を確認する。
**スクリーンショットではなく snapshot を使う**こと。snapshot はテキストベースでトークン効率が良く、要素の ref（`@e1` 等）を使った操作に直結する。

```bash
# ページを開く
agent-browser open http://localhost:4030

# ネットワークリクエスト完了まで待機
agent-browser wait --load networkidle

# アクセシビリティツリーを取得（インタラクティブ要素のみ）
agent-browser snapshot -i
```

### 3. 操作して確認する

snapshot で得た ref（`@e1`, `@e2` 等）を使って要素を操作する。

```bash
# クリック
agent-browser click @e3

# フォーム入力（クリアしてから入力）
agent-browser fill @e5 "test@example.com"

# キー押下
agent-browser press Enter

# ページ遷移後は再度 wait + snapshot
agent-browser wait --load networkidle
agent-browser snapshot -i
```

### 4. テキストやURLの確認

```bash
# 現在のURLを確認
agent-browser get url

# 要素のテキストを取得
agent-browser get text @e1

# ページタイトルを取得
agent-browser get title
```

## 主要ページ一覧

| ページ | URL |
|--------|-----|
| トップ | `http://localhost:4030/` |
| ログイン | `http://localhost:4030/sign-in` |
| サインアップ | `http://localhost:4030/sign-up` |
| 検索 | `http://localhost:4030/search` |
| 会議録一覧 | `http://localhost:4030/meetings` |
| 自治体一覧 | `http://localhost:4030/municipalities` |
| 管理画面 | `http://localhost:4030/admin` |
| スクレイパー管理 | `http://localhost:4030/admin/scrapers` |

## 確認パターン例

### ページ表示の確認

```bash
agent-browser open http://localhost:4030/ && \
agent-browser wait --load networkidle && \
agent-browser snapshot -i
```

期待: ページが正常にレンダリングされ、ナビゲーション要素が表示されること。

### ログインフローの確認

```bash
# ログインページを開く
agent-browser open http://localhost:4030/sign-in && \
agent-browser wait --load networkidle && \
agent-browser snapshot -i

# フォームに入力（ref はsnapshotの結果に合わせて調整）
# agent-browser fill @eXX "user@example.com"
# agent-browser fill @eXX "password123"
# agent-browser click @eXX
# agent-browser wait --load networkidle
# agent-browser get url
```

### ナビゲーションの確認

```bash
agent-browser open http://localhost:4030/ && \
agent-browser wait --load networkidle && \
agent-browser snapshot -i
# snapshot の結果からリンクの ref を確認し、クリックして遷移を確認
# agent-browser click @eXX
# agent-browser wait --load networkidle
# agent-browser get url
```

## 注意事項

- **snapshot を優先する**: スクリーンショットよりも snapshot（アクセシビリティツリー）を使う。テキストベースで解析しやすく、要素の ref を直接操作に使える
- **wait を挟む**: ページ遷移やフォーム送信後は必ず `wait --load networkidle` で待機してから snapshot を取る
- **ref は毎回変わる**: snapshot を取り直すたびに ref（`@e1` 等）は再割り当てされる。操作前に最新の snapshot を確認する
- **ブラウザの終了**: 確認完了後、`agent-browser close` でブラウザを閉じる
