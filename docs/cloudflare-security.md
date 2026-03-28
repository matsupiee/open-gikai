# Cloudflare セキュリティ推奨設定

open-gikai のスクレイピング防止のため、Cloudflare ダッシュボードで以下を設定する。

## 1. Bot Fight Mode（無料）

**設定場所**: Security > Bots > Bot Fight Mode

- **有効化する** — 自動ボットトラフィックに対してチャレンジを表示
- Free プランでも利用可能

## 2. Security Level

**設定場所**: Security > Settings > Security Level

- **Medium** 以上に設定
- 疑わしい IP からのリクエストにチャレンジを表示

## 3. Rate Limiting ルール（Free プランで 1 ルール利用可能）

**設定場所**: Security > WAF > Rate limiting rules

推奨ルール:

| 項目 | 設定値 |
|------|--------|
| Rule name | API Rate Limit |
| URI Path | starts with `/api/rpc` |
| Period | 1 minute |
| Requests per period | 60 |
| Mitigation | Block (duration: 1 minute) |
| Counting expression | IP |

## 4. WAF カスタムルール（追加保護）

**設定場所**: Security > WAF > Custom rules

UA が空のリクエストをブロック:

| 項目 | 設定値 |
|------|--------|
| Field | User Agent |
| Operator | is empty |
| Action | Block |

## 5. Browser Integrity Check

**設定場所**: Security > Settings

- **有効化する** — 一般的なボットの HTTP ヘッダーを検査
