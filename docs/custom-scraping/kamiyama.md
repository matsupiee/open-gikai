# 神山町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.kamiyama.lg.jp/soshiki/gikaijumukyoku/
- 分類: 会議録（本会議・委員会の議事録）の公開なし
- 文字コード: UTF-8
- 特記: 議会事務局ウェブサイトでは「議会だより」PDF と一部の一般質問動画（YouTube）のみ公開。会議録本文は公開されていない。

---

## 調査結果

### 公開コンテンツ

| コンテンツ | URL | 備考 |
| --- | --- | --- |
| 議会事務局トップ | `https://www.town.kamiyama.lg.jp/soshiki/gikaijumukyoku/` | 現行 CMS |
| 議会だより一覧 | `https://www.town.kamiyama.lg.jp/docs/2025111400011/` | 第1号（2009年5月）〜 第67号（2026年2月）の PDF |
| 一般質問動画 | `https://www.town.kamiyama.lg.jp/docs/2025040100297/` | YouTube 配信（令和6年6月定例会、令和4年12月定例会） |
| 議会カテゴリ | `https://www.town.kamiyama.lg.jp/category/bunya/gikai/` | 上記コンテンツへのナビゲーション |

### 議会だより PDF の URL パターン

議会だよりのみ PDF 公開されている。URL パターンは以下の通り:

```
https://www.town.kamiyama.lg.jp/docs/2025111400011/file_contents/{ファイル名}.pdf
```

ファイル名はハッシュ文字列が主であり、規則性はない。

### 会議録（議事録）の公開状況

本会議・委員会の会議録テキストおよびそれに相当する PDF は公開されていない。サイト内検索・Wayback Machine・旧 CMS ディレクトリ（`/office/gikaijumukyoku/`）を調査したが、会議録に相当するコンテンツは発見されなかった。

---

## 議会の基本情報

- 議員定数: 8人
- 定例会: 年4回（3月・6月・9月・12月）
- 問い合わせ: 議会事務局（TEL: 088-676-1511 / gikai@kamiyama.i-tokushima.jp）

---

## スクレイピング方針

**会議録の取得は現時点では不可能。**

会議録本文が公開されていないため、スクレイピング対象データが存在しない。

### 今後の対応

以下のいずれかが確認された場合に再調査する:

1. 議会事務局ウェブサイトに会議録 PDF が掲載された
2. 外部の会議録検索システムが導入された
3. 神山町から会議録の公開方法について公式アナウンスがあった

---

## 注意事項

- 旧 CMS の URL（`https://www.town.kamiyama.lg.jp/office/gikaijumukyoku/`）は現在 404 を返す。旧サイトにも会議録ページは存在しなかった（Wayback Machine で確認済み）。
- 「議会だより」は年4回発行の広報誌であり、会議録本文とは異なる。
- 一般質問の YouTube 動画は「神山町議会の公式記録ではない」と明記されている。
- サイト内検索は JavaScript で動的に処理されるため、静的クロールでは検索結果を取得できない。
