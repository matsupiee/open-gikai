# 下條村議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.vill-shimojo.jp/gyousei/simojomura_songikai/
- 分類: 会議録検索システム未導入（YouTube 議会中継 + 議会だより PDF のみ）
- 文字コード: UTF-8
- 特記: 会議録テキストは公開されていない。議会中継（YouTube 動画）と議会だより（PDF）が主な情報源

---

## サイト構造

| ページ | URL パターン |
| --- | --- |
| 議会トップ | `https://www.vill-shimojo.jp/gyousei/simojomura_songikai/` |
| 議員名簿 | `https://www.vill-shimojo.jp/gyousei/simojomura_songikai/2011-0616-1620-7.html` |
| 議会中継一覧 | `https://www.vill-shimojo.jp/gyousei/simojomura_songikai/gikai_chukei/index.html` |
| 議会中継詳細（年別） | `https://www.vill-shimojo.jp/gyousei/simojomura_songikai/gikai_chukei/{R年号}/{日付ID}.html` |
| 議会だより一覧 | `https://www.vill-shimojo.jp/gyousei/simojomura_songikai/gikaidayori/index.html` |
| 議会だより詳細 | `https://www.vill-shimojo.jp/gyousei/simojomura_songikai/gikaidayori/{日付ID}.html` |
| 議会だより PDF | `https://www.vill-shimojo.jp/gyousei/simojomura_songikai/gikaidayori/files/{ファイル名}.pdf` |

---

## 提供されている情報

### 1. 議会中継（YouTube 動画）

議会中継ページから年度別の詳細ページに遷移すると、各定例会の YouTube 動画リンクが掲載されている。

**確認済みの動画例:**

| 会議名 | 日程 | YouTube URL |
| --- | --- | --- |
| 令和8年第1回定例会 | 2026年3月10日 | `https://www.youtube.com/watch?v=maEboMo1V0M` |
| 令和7年第1回定例会 | 2025年3月11日 | `https://www.youtube.com/watch?v=Ry7ptyExPkc` |
| 令和7年第2回定例会 | 2025年6月6日 | `https://youtu.be/9w8vsNojm34` |
| 令和7年第4回定例会 | 2025年12月9日 | `https://www.youtube.com/watch?v=Lx_13wanKeM` |

- 動画 URL は YouTube（youtube.com / youtu.be）が主だが、一部 Bing 動画経由のリンクも存在
- 年度別ページの URL 構造: `gikai_chukei/{R年号}/{タイムスタンプID}.html`（例: `R7/2025-0526-1946-5.html`, `R8/2026-0313-1755-5.html`）

### 2. 議会だより（PDF）

議会だより一覧ページから各号の詳細ページまたは PDF へのリンクが存在する。

**確認済みの PDF 例:**

| 号数 | 発行日 | PDF パス |
| --- | --- | --- |
| 第12号 | 2022年7月14日 | `files/20220714134025.pdf` |
| 第13号 | 2022年10月13日 | `files/20221019151832.pdf` |
| 第14号 | 2023年1月16日 | `files/20230116173421.pdf` |
| 第15号 | 2023年4月14日 | `files/20230414161954.pdf` |
| 第16号 | 2023年5月31日 | `files/2023-0531-1747.pdf` |
| 第17号 | 2023年7月19日 | `files/2023-0719-0919.pdf` |
| 第18号 | 2023年10月16日 | `files/2023-1016-1726.pdf` |
| 第19号 | 2024年1月15日 | `files/2024-0115-0943.pdf` |
| 第20号 | 2024年4月15日 | `files/2024-0415-1040.pdf` |
| 第23号 | 2025年1月15日 | `files/2025-0115-1743.pdf` |

- 第1号〜第11号は PDF リンクが確認できず（HTML ページまたは画像のみ）
- PDF ファイル名はタイムスタンプベース（命名規則は統一されていない）

---

## スクレイピング戦略

### 会議録テキストについて

下條村は会議録検索システムを導入しておらず、会議録テキスト（HTML）は公開されていない。そのため、一般的な会議録スクレイピング（HTML パース → 発言抽出）は不可能。

### 取得可能なデータ

#### 方針 A: 議会だより PDF からのテキスト抽出

1. 議会だより一覧ページから全 PDF リンクを収集
2. PDF をダウンロードし、OCR またはテキスト抽出を行う
3. 一般質問・議案情報を構造化する

**課題:**
- PDF のレイアウトが号によって異なる可能性がある
- OCR 精度に依存する
- 発言単位の構造化が困難（議会だよりは要約形式）

#### 方針 B: YouTube 動画からの文字起こし

1. 議会中継ページから年度別詳細ページへの全リンクを収集
2. 各詳細ページから YouTube URL を抽出
3. YouTube の自動字幕または文字起こし API を利用してテキスト化する

**課題:**
- 自動字幕の精度に依存する
- 発言者の特定が困難
- YouTube API の利用制限

---

## 注意事項

- 会議録テキストが公開されていないため、他の会議録検索システム導入自治体とは根本的にアプローチが異なる
- 議会だよりは要約であり、会議録の全文ではない
- YouTube 動画の可用性は Google のサービスに依存する
- 自治体サイトへのアクセス時はリクエスト間に適切な待機時間（1〜2 秒）を設ける

---

## 推奨アプローチ

1. **議会だより PDF を優先**: テキスト抽出の精度が比較的高く、安定してデータを取得できる
2. **YouTube 文字起こしは補助的に活用**: 議会だよりに含まれない詳細な発言内容が必要な場合に検討
3. **定期的な新規公開チェック**: 議会だより一覧ページと議会中継ページを定期的に確認し、新しいコンテンツを検出する
4. **将来的な会議録システム導入に備える**: 村の方針変更で会議録検索システムが導入される可能性もあるため、議会トップページの変更を監視する
