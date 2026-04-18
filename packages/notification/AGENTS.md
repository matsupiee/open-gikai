# packages/notification

## 責務

通知用ユーティリティ。現在は Slack webhook 送信のみ。将来的に他チャネル（メール・Discord 等）が増えたらここに置く。

## 依存

なし（標準ライブラリのみ）。

## 公開入口

- `src/index.ts` — 再エクスポート
- `src/slack.ts` — Slack webhook 送信関数

## 開発

```bash
bun run --cwd packages/notification test
```

## 禁止事項

- 認証情報（webhook URL）をソースに書かない
- 上位レイヤー（`apps/*`, `packages/api`）に依存しない
