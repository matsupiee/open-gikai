# 太子町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.taishi.osaka.jp/busyo/gikai_jimu/taishichougikai/kaigirokunoetsuran/index.html
- 分類: 町公式サイト上で年度別に PDF を掲載（外部の会議録検索システム未導入）
- 文字コード: UTF-8
- 特記: 会議録はすべて PDF 形式で提供。HTML ベースの会議録検索システムは存在しない

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧トップ | `https://www.town.taishi.osaka.jp/busyo/gikai_jimu/taishichougikai/kaigirokunoetsuran/index.html` |
| 年度別一覧 | `https://www.town.taishi.osaka.jp/busyo/gikai_jimu/taishichougikai/kaigirokunoetsuran/{ページID}.html` |
| 会議録 PDF | `https://www.town.taishi.osaka.jp/material/files/group/6/{ファイル名}.pdf` |

### 年度別一覧ページの ID

| 年度 | ページ ID |
| --- | --- |
| 令和7年 | `6137` |
| 令和6年 | `5733` |
| 令和5年 | `5090` |
| 令和4年 | `4391` |
| 令和3年 | `4097` |
| 令和2年 | `3968` |
| 平成31年・令和元年 | `3964` |

---

## 会議種別

各年度ページは以下の見出し構造で会議録を分類している。

### 本会議（h2）

- 定例会: `令和X年第N回定例会 会議録`
- 臨時会: `令和X年第N回臨時会 会議録`

### 常任委員会（h2 → h3 で各委員会）

- 総務まちづくり常任委員会
- 福祉文教常任委員会
- 予算常任委員会
- 決算常任委員会

---

## PDF ファイル名の命名規則

ファイル名には統一的な規則がなく、年度や時期によって表記揺れがある。

### 本会議

| パターン | 例 |
| --- | --- |
| `R{和暦}dai{回}teireikaigiroku.pdf` | `R6dai1teireikaigiroku.pdf`（令和6年第1回定例会） |
| `R{和暦}dai{回}kaiteireikai.pdf` | `R6dai4kaiteireikai.pdf`（令和6年第4回定例会） |
| `R{和暦}dai{回}kairinjikai.pdf` | `R6dai1kairinjikai.pdf`（令和6年第1回臨時会） |
| `R{和暦}dai{回}rinjikaigiroku.pdf` | `R1dai2rinjikaigiroku.pdf`（令和元年第2回臨時会） |
| `H{和暦}dai{回}teireikaigiroku.pdf` | `H31dai1teireikaigiroku.pdf`（平成31年第1回定例会） |
| `R{和暦YYMM}teireikai.pdf` | `R0709teireikai.pdf`（令和7年第3回定例会） |

### 常任委員会

| パターン | 例 |
| --- | --- |
| `R{YYMMDD}_{略称}.pdf` | `R070604_soumachi.pdf`（令和7年6月4日 総務まちづくり） |
| `R{YYMMDD}{略称}kaigiroku.pdf` | `R060906soumachikaigiroku.pdf`（令和6年9月6日 総務まちづくり） |
| `R{YY}{MMDD}{略称}.pdf` | `R61212soumati.pdf`（令和6年12月12日 総務まちづくり） |

略称の対応:

| 委員会 | 略称パターン |
| --- | --- |
| 総務まちづくり常任委員会 | `soumachi`, `soumati` |
| 福祉文教常任委員会 | `fukubun`, `hukubun` |
| 予算常任委員会 | `yosan` |
| 決算常任委員会 | `kessan` |

---

## HTML 構造

### 年度別一覧ページ

```
h1: 年度名（例: 令和6年）
  h2: 本会議
    ul > li > a[href="//www.town.taishi.osaka.jp/material/files/group/6/{ファイル名}.pdf"]
      リンクテキスト: "令和6年第4回定例会 会議録"
      後続テキスト: "(PDFファイル: 561.7KB)"
  h2: 常任委員会
    h3: 総務まちづくり常任委員会
      ul > li > a[href=...]
        リンクテキスト: "令和6年12月12日 総務まちづくり常任委員会 会議録"
    h3: 福祉文教常任委員会
      ul > li > a[href=...]
    h3: 予算常任委員会
      ul > li > a[href=...]
    h3: 決算常任委員会
      ul > li > a[href=...]
```

### トップページ（年度一覧）

年度別ページへのリンクは `cmsDynExecuteGetPageList` という JavaScript 関数で動的に生成される場合があるため、静的 HTML のみでは年度一覧を取得できない可能性がある。ただし、各年度ページの URL は固定のページ ID を持つため、既知の ID を直接指定してアクセスすることで回避可能。

---

## スクレイピング戦略

### Step 1: 年度別ページから PDF リンクを収集

既知の年度別ページ ID（`6137`, `5733`, `5090`, `4391`, `4097`, `3968`, `3964`）に対して順次アクセスし、PDF リンクとメタ情報を収集する。

**収集方法:**

1. 各年度ページの HTML を取得
2. `h2`（本会議 / 常任委員会）と `h3`（各委員会名）の見出し構造をパースして会議種別を判定
3. `a[href$=".pdf"]` で PDF リンクを抽出
4. リンクテキストから会議名・開催日を抽出

**リンクテキストからのメタ情報抽出:**

```typescript
// 本会議: "令和6年第4回定例会 会議録"
const honkaigiPattern = /^(令和|平成)(\d+)年第(\d+)回(定例会|臨時会)\s*会議録$/;

// 常任委員会: "令和6年12月12日 総務まちづくり常任委員会 会議録"
const iinkaiPattern = /^(令和|平成)(\d+)年(\d+)月(\d+)日\s*(.+常任委員会)\s*会議録$/;
```

### Step 2: PDF のダウンロードとテキスト抽出

- PDF URL は `//www.town.taishi.osaka.jp/material/files/group/6/{ファイル名}.pdf` 形式（プロトコル相対 URL）
- `https:` を付与してダウンロード
- PDF からのテキスト抽出には `pdf-parse` 等のライブラリを使用

### Step 3: テキストのパース

PDF から抽出したテキストの構造は PDF の作成方法に依存するため、実際の PDF を確認して発言者パターン等を特定する必要がある。

一般的な議会会議録 PDF の発言者パターン（要確認）:

```typescript
// 発言者パターン（PDF テキスト抽出後の想定）
const speakerPattern = /^○(.+?)（(.+?)）/;
// 例: ○議長（田中太郎） → role="議長", name="田中太郎"
```

---

## ページネーション

なし。各年度ページで当該年度の全会議録リンクが一覧表示される。

---

## 注意事項

- 会議録はすべて PDF 形式のため、HTML パースではなく PDF テキスト抽出が必要
- PDF ファイル名の命名規則に表記揺れがあり、ファイル名からのメタ情報抽出は不安定。リンクテキストからの抽出を優先する
- 年度別ページの ID は CMS が自動採番しており、新年度のページ ID は事前に予測できない。トップページから動的に取得するか、定期的に確認が必要
- PDF のファイルサイズは 100KB〜700KB 程度
- プロトコル相対 URL（`//www.town.taishi.osaka.jp/...`）で記載されているため、`https:` の付与が必要

---

## 推奨アプローチ

1. **年度ページ ID の管理**: 既知のページ ID をリストとして保持し、新年度追加時に手動で更新する（または トップページをヘッドレスブラウザで取得して動的リンクを解決する）
2. **PDF テキスト抽出**: `pdf-parse` や `pdfjs-dist` を使用して PDF からテキストを抽出
3. **メタ情報はリンクテキストから取得**: PDF ファイル名ではなく、年度ページ上のリンクテキストから会議種別・開催日を抽出する
4. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
5. **差分更新**: 年度ページの PDF リンク数を前回取得時と比較し、増加分のみダウンロードする
