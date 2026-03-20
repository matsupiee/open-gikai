# 江差町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.hokkaido-esashi.jp/gikai/gikai.html
- 分類: 自治体公式サイト上で PDF ファイルとして会議録を公開（検索システムなし）
- 文字コード: Shift_JIS（`<meta http-equiv="Content-Type" content="text/html; charset=Shift_JIS">`）
- 特記: JustSystems Homepage Builder で作成された静的 HTML サイト。YouTube での議会配信あり。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 議会トップ | `https://www.hokkaido-esashi.jp/gikai/gikai.html` |
| 本会議記録一覧（年度別インデックス） | `https://www.hokkaido-esashi.jp/gikai/h24-honkaigi/honkaigi.html` |
| 各回の会議詳細（PDF リンク集） | `https://www.hokkaido-esashi.jp/gikai/h24-honkaigi/{年度ディレクトリ}/{ファイル名}.html` |
| 会議録 PDF | `https://www.hokkaido-esashi.jp/gikai/h24-honkaigi/{年度ディレクトリ}/kaigiroku/{会議日ディレクトリ}/{ファイル名}.pdf` |

---

## サイト階層構造

```
gikai/
├── gikai.html                          # 議会トップページ
└── h24-honkaigi/
    ├── honkaigi.html                   # 本会議記録一覧（全年度のインデックス）
    ├── honkaigiR8/                     # 令和8年
    │   ├── honkaigiR8-03-1.html        # 第1回定例会
    │   ├── honkaigiR8-02.html          # 第1回臨時会
    │   ├── kaigiroku/
    │   │   └── 250305teireikai/        # 会議録PDFディレクトリ
    │   │       ├── 20250305teirei-total.pdf  # 日ごとの全体版
    │   │       ├── 20250305teirei01.pdf      # 個別番号
    │   │       └── ...
    │   └── gian-siryou/                # 議案・資料PDFディレクトリ
    ├── honkaigiR7/                     # 令和7年
    ├── honkaigiR6/                     # 令和6年
    ├── ...
    ├── honkaigi31/                     # 平成31年（令和元年）
    ├── honkaigi30/                     # 平成30年
    ├── ...
    └── honkaigi24/                     # 平成24年（最古）
```

---

## 年度ディレクトリの命名規則

| 年度 | ディレクトリ名 | 備考 |
| --- | --- | --- |
| 令和2年〜令和8年 | `honkaigiR2` 〜 `honkaigiR8` | `R` + 令和の年数 |
| 平成24年〜平成31年 | `honkaigi24` 〜 `honkaigi31` | 平成の年数そのまま |

---

## 会議詳細ページのファイル名パターン

| パターン | 例 | 意味 |
| --- | --- | --- |
| `{年度dir}-{月}-{連番}.html` | `honkaigiR8-03-1.html` | 令和8年3月の第1回（定例会） |
| `{年度dir}-{月}.html` | `honkaigiR7-01.html` | 令和7年1月（臨時会） |
| `{年度dir}-{月}.{枝番}.html` | `honkaigiR4-3.1.html` | 令和4年3月の第1定例会 |

※ 命名規則は年度によって若干揺れがある。

---

## 会議録 PDF の URL パターン

### 新しい年度（令和5年〜）

```
kaigiroku/{YYMMDD}{会議種別}/YYYYMMDD{会議種別}{番号}.pdf
```

例:
- `kaigiroku/250305teireikai/20250305teirei-total.pdf` （全体版）
- `kaigiroku/250305teireikai/20250305teirei01.pdf` （個別 01）
- `kaigiroku/240306teireikai/20240306teirei-total.pdf`

### 古い年度（平成24年〜）

```
kaigiroku/{YYMMDD}{会議種別}/{連番}.pdf
```

例:
- `kaigiroku/120312teirei/1.pdf`
- `kaigiroku/120312teirei/2.pdf`

### 会議種別の識別子

| 識別子 | 会議種別 |
| --- | --- |
| `teireikai` / `teirei` | 定例会 |
| `rinnji` | 臨時会 |

---

## 会議の種類と収録範囲

### 定例会

年4回（3月・6月・9月・12月）開催。複数日にわたる場合あり。

### 臨時会

不定期開催。年に数回〜十数回。

### 収録期間

平成24年（2012年）〜現在（令和8年）。

---

## HTML 構造

### 本会議記録一覧ページ (`honkaigi.html`)

- 各年度の会議がリンクリストとして列挙
- リンクテキストに会議の種別（定例会/臨時会）と開催日が含まれる
- 例: `第１回　定　例　会　（　３月１０日〜１１日）`

### 会議詳細ページ（各回の HTML）

- テーブルレイアウトで構成
- 議案資料 PDF（`gian-siryou/` 配下）と会議録 PDF（`kaigiroku/` 配下）のリンクが混在
- 会議録 PDF は「会議録」セクションにまとめられている
- 各 PDF リンクに番号ラベル（`01`, `02`, ... または `第1号`, `第2号`）が付与

---

## ページネーション

なし。全会議が一覧ページに静的に列挙されている。

---

## スクレイピング戦略

### Step 1: 会議一覧の取得

本会議記録一覧ページ `h24-honkaigi/honkaigi.html` から全会議の詳細ページ URL を収集する。

- 全リンクを抽出し、`.html` で終わるリンクをフィルタ
- リンクテキストから会議種別（定例会/臨時会）と開催日をパース
- Shift_JIS でデコードする必要あり

**収集方法:**

1. `https://www.hokkaido-esashi.jp/gikai/h24-honkaigi/honkaigi.html` を取得
2. `<a href="...">` から各会議の詳細ページ URL を抽出
3. リンクテキストを正規表現でパースして日付・会議種別を取得

```typescript
// リンクテキストから情報を抽出
const meetingPattern = /第[０-９\d]+回\s*[　\s]*(定\s*例\s*会|臨\s*時\s*会)\s*[（(]\s*([０-９\d]+)月([０-９\d]+)日/;
```

### Step 2: 各会議の PDF リンク収集

各会議詳細ページから会議録 PDF の URL を収集する。

- `kaigiroku/` を含むリンクのみを抽出（`gian-siryou/` 等を除外）
- 相対パスを絶対 URL に変換
- `-total.pdf` が全体版、番号付きが個別分割版

**収集方法:**

1. 各詳細ページを Shift_JIS でデコードして取得
2. `href` 属性から `kaigiroku/` を含む PDF リンクを抽出
3. ベース URL と結合して絶対 URL を生成

```typescript
// 会議録PDFのフィルタリング
const kaigirokuLinks = allLinks.filter(href => href.includes("kaigiroku/") && href.endsWith(".pdf"));
```

### Step 3: PDF のダウンロードとテキスト抽出

PDF をダウンロードし、テキストを抽出する。

- PDF は議事録のテキストを含む
- `pdf-parse` 等のライブラリでテキスト抽出
- 全体版（`-total.pdf`）がある場合はそちらを優先

### Step 4: テキストのパース

抽出したテキストから発言者・発言内容を構造化する。

- PDF のテキスト構造は実際のファイルを確認して決定する必要あり
- 一般的な議事録の発言者パターン（`○議長（氏名）`等）を想定

---

## 注意事項

- 文字コードが Shift_JIS のため、HTTP レスポンスのデコードに注意が必要
- HTML は JustSystems Homepage Builder で生成されており、構造が統一的でない箇所がある
- 年度によって PDF のファイル名規則が異なる（新旧2パターン）
- 議案資料 PDF（`gian-siryou/`）と会議録 PDF（`kaigiroku/`）を明確に区別する必要がある
- PDF 内のテキスト構造は実際のファイルを取得して確認が必要（OCR が必要な画像 PDF の可能性もある）

---

## 推奨アプローチ

1. **一覧ページから全量取得**: `honkaigi.html` の静的リンクから全会議を一括収集（ページネーションなし）
2. **会議録 PDF のみ抽出**: `kaigiroku/` パスでフィルタし、議案資料と区別する
3. **全体版 PDF を優先**: `-total.pdf` がある場合はそちらを使い、分割版の結合処理を回避
4. **Shift_JIS 対応**: `iconv-lite` 等で Shift_JIS → UTF-8 変換を行う
5. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
6. **PDF テキスト抽出の事前検証**: 実際の PDF を数件ダウンロードし、テキスト抽出可能か（画像 PDF でないか）を確認してからパーサーを実装する
