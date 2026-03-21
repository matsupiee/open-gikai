# 朝来市議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.voicetechno.net/MinutesSystem/Asago/
- 分類: VoiceTechno 社製「会議録検索システム」（ASP.NET + DevExpress）
- 文字コード: UTF-8
- 特記: JavaScript ベースの動的データロード（ASP.NET コールバック機構）を使用しており、静的 HTML スクレイピングは困難。ブラウザ自動化ツールが必要。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| トップ（検索フォーム） | `https://www.voicetechno.net/MinutesSystem/Asago/Default.aspx` |
| ヘルプ | `https://www.voicetechno.net/MinutesSystem/Asago/HowtoRead.aspx` |

会議録詳細ページの URL は動的に生成されるため、直接アクセス可能な固定 URL パターンは存在しない。

---

## 検索パラメータ

検索フォームは DevExpress コントロール（ASP.NET）で構成されており、以下のドロップダウンを順次選択する:

| コントロール ID | 役割 | 備考 |
| --- | --- | --- |
| `ASPxComboBYearL` | 年度選択 | 2005年（平成17年）〜2026年（令和8年） |
| `ASPxComboBKind` | 会議種別 | 主に「本会議」 |
| `ASPxComboBKaisuL` | 開催回次 | 前の選択に応じて動的取得 |
| `ASPxComboBNameL` | 会議名 | 前の選択に応じて動的取得 |

各ドロップダウンの選択後、`WebForm_DoCallback()` を通じてサーバーにリクエストが送られ、次のドロップダウンの選択肢が動的に更新される。

---

## システムの特徴

- **動的 UI**: DevExpress コントロールと ASP.NET コールバックにより、選択状態はサーバー側セッションで管理される
- **2 タブ構成**: 「閲覧する」（発言者ナビゲーション）と「検索する」（キーワード検索）
- **RTF ダウンロード**: `[閲覧内容を保存する]`・`[検索結果を保存する]` ボタンで会議録を RTF 形式でダウンロード可能
- **掲載期間**: 2005年（平成17年）〜現在

---

## スクレイピング戦略

### 制限事項

1. **JavaScript 実行必須**: 選択フォームが DevExpress コントロールを使用しており、通常の HTTP リクエストでは操作不可
2. **セッション依存**: 選択状態がサーバー側セッションで管理されるため、直接 URL アクセスが困難
3. **URL パラメータ非公開**: 検索結果や詳細ページへの直接 URL が HTML に露出していない

### 推奨実装（ブラウザ自動化）

```typescript
// Playwright / Puppeteer を使用したスクレイピング例
const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto("https://www.voicetechno.net/MinutesSystem/Asago/");

// 年度選択
await page.selectOption("#ASPxComboBYearL", "2024");

// 会議種別選択（動的ロード待機）
await page.waitForTimeout(1000);
await page.selectOption("#ASPxComboBKind", "本会議");

// 開催回次選択（動的ロード待機）
await page.waitForTimeout(1000);
// ... 以降も同様
```

### RTF ダウンロード戦略（代替案）

ブラウザ自動化でフォームを操作し、`[閲覧内容を保存する]` ボタンをクリックして RTF ファイルをダウンロードする方法も有効。

- RTF ファイルをテキスト抽出ツールで処理（`rtf-parser` 等）
- 会議録 1 件ずつダウンロードする必要があるため、全件取得には年度・回次を順次ループする

---

## 発言者パターン（推定）

VoiceTechno システムの一般的な会議録 HTML 構造から、以下のようなパターンが想定される（実際の会議録ページを確認して更新が必要）:

```typescript
// 発言者の抽出（推定パターン）
const speakerPattern = /^○(.+?)（(.+?)）/;
// 例: ○議長（田中太郎） → role="議長", name="田中太郎"
```

---

## ページネーション

会議録の詳細閲覧画面ではページネーションは存在せず、1 回の会議録が 1 ドキュメントとして提供される。

---

## 注意事項

- DevExpress コントロールのバージョンや設定により、コントロール ID が変更される可能性がある
- サーバー側セッションのタイムアウトに注意が必要（長時間の処理では再ログインが必要になる場合がある）
- 自治体サイトのため、リクエスト間に適切な待機時間（2〜3 秒）を設ける

---

## 推奨アプローチ

1. **Playwright を使用**: Python/TypeScript + Playwright でブラウザを自動操作し、年度・会議種別・回次を順次選択して会議録を取得する
2. **RTF ダウンロードを活用**: 各会議録を RTF 形式でダウンロードし、`rtf-parser` 等でテキスト抽出する
3. **年度ループ**: 2005年〜現在まで年度を順次ループし、各年度の開催回次を収集する
4. **ネットワークトラフィック監視**: DevTools で `WebForm_DoCallback` の通信パターンを解析し、直接 API リクエストが可能かどうかを確認する
5. **レート制限**: 自治体サイトのため、リクエスト間に 2〜3 秒の待機時間を設ける
