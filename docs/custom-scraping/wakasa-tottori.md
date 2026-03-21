# 若桜町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.wakasa.tottori.jp/soshikikarasagasu/gikaijimukyoku/1/1/524.html
- 分類: PDF 形式で公開（対応済みシステムには該当しない）
- 文字コード: UTF-8（HTML ページ）
- 特記: 会議録は全て PDF ファイルで提供。1 つの HTML ページに全会議録へのリンクが集約されている

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（単一ページ） | `https://www.town.wakasa.tottori.jp/soshikikarasagasu/gikaijimukyoku/1/1/524.html` |
| 会議録 PDF | `https://www.town.wakasa.tottori.jp/material/files/group/2/{ファイル名}.pdf` |

- 検索ページやページネーションは存在しない
- 全ての会議録 PDF へのリンクが 1 つの HTML ページにまとまっている
- PDF ファイル名は日付ベース（例: `20251223008.pdf`、`20240612.pdf`）だが、命名規則に厳密な法則性はない

---

## ページ構造

### 会議録一覧ページ

HTML 構造:

```html
<div class="free-layout-area">
  <div>
    <h2><span class="bg"><span class="bg2"><span class="bg3">令和7年12月定例会</span></span></span></h2>
    <p class="file-link-item"><a class="pdf" href="//www.town.wakasa.tottori.jp/material/files/group/2/20251223008.pdf">12月2日 (PDFファイル: 554.2KB)</a></p>
    <p class="file-link-item"><a class="pdf" href="//www.town.wakasa.tottori.jp/material/files/group/2/20251223002.pdf">12月3日 (PDFファイル: 580.8KB)</a></p>
    <p class="file-link-item"><a class="pdf" href="//www.town.wakasa.tottori.jp/material/files/group/2/20251223003.pdf">12月4日 (PDFファイル: 427.9KB)</a></p>

    <h2><span class="bg"><span class="bg2"><span class="bg3">令和7年10月臨時会</span></span></span></h2>
    <p class="file-link-item"><a class="pdf" href="...">10月23日 (PDFファイル: 479.7KB)</a></p>
    ...
  </div>
</div>
```

- 会議種別ごとに `<h2>` 見出しで区切られている
- 各 PDF リンクは `<p class="file-link-item">` 内の `<a class="pdf">` タグ
- リンクテキストは `{月}月{日}日 (PDFファイル: {サイズ})` 形式
- href はプロトコル相対 URL（`//www.town.wakasa.tottori.jp/...`）

### 会議の種類

- **定例会**: 3月、6月、9月、12月（各回 3〜4 日間）
- **臨時会**: 不定期（単日が多い）

### 収録範囲

平成30年7月臨時会 〜 現在（約 130 件の PDF）

---

## PDF の構造

### ページ構成

1. **表紙**（1 ページ目）: 招集日、会議名、会議録タイトル、議会事務局名
2. **職員・議案一覧**（2 ページ目）: 事務局職員、提出議案の一覧と議決結果
3. **出席者情報**（3 ページ目）: 応招議員、出席議員、欠席議員、説明出席者
4. **会議本文**（4 ページ目〜）: 発言録

### 表紙の構造

```
令和７年１２月２日招集
令和７年
第８回若桜町議会定例会会議録
（令和７年１２月２日）
若桜町議会事務局
```

### 出席者情報

```
１番 谷 口 貴       ６番 山 本 晴 隆
２番 森 田 二 郎     ７番 中 尾 理 明
...
```

- 議員は番号付きで 2 列レイアウト
- 説明出席者は役職 + 氏名

### 発言者パターン

```
議長（川上守）
町長（上川元張）
```

- `{役職}（{氏名}）` の形式
- 役職には「議長」「町長」「副町長」「教育長」や課長名など
- 議員番号の表記はなし（役職のみ）
- 発言者行の後に発言内容が続く
- `○` 記号は使用されない（中野区とは異なる）

### その他の記述パターン

```
（異議なし）
（質疑なし）
```

- 括弧付きで議場の状況を表記

---

## スクレイピング戦略

### Step 1: PDF リンクの収集

会議録一覧ページ（`524.html`）から全 PDF リンクとメタ情報を抽出する。

**収集方法:**

1. `https://www.town.wakasa.tottori.jp/soshikikarasagasu/gikaijimukyoku/1/1/524.html` を取得
2. `<h2>` タグから会議名（例: `令和7年12月定例会`）を抽出
3. 各 `<h2>` の後に続く `<p class="file-link-item">` から PDF URL と開催日を抽出
4. 会議名と開催日を紐付けて保存

**抽出用セレクタ:**

```typescript
// 会議名の抽出
const sessionHeaders = doc.querySelectorAll(".free-layout-area h2");

// PDF リンクの抽出
const pdfLinks = doc.querySelectorAll('.file-link-item a.pdf');
```

**リンクテキストからの日付抽出:**

```typescript
// "12月2日 (PDFファイル: 554.2KB)" → month=12, day=2
const datePattern = /(\d+)月(\d+)日/;
```

### Step 2: PDF のダウンロードとテキスト抽出

各 PDF をダウンロードし、テキストを抽出する。

- PDF はテキスト埋め込み型（スキャン画像ではない）のため、`pdfplumber` 等でテキスト抽出が可能
- 1 PDF あたり 5〜10 ページ程度

### Step 3: 会議録のパース

#### メタ情報の抽出

表紙ページから以下を抽出:

```typescript
// 会議名と日付
const titlePattern = /第(\d+)回若桜町議会(定例会|臨時会)会議録/;
const datePattern = /（(令和|平成)(\d+)年(\d+)月(\d+)日）/;
```

#### 発言者と発言内容の抽出

```typescript
// 発言者の抽出
const speakerPattern = /^(.+?)（(.+?)）$/m;
// 例: "議長（川上守）" → role="議長", name="川上守"
// 例: "町長（上川元張）" → role="町長", name="上川元張"
```

- PDF のテキスト抽出では改行位置が不定のため、段落の結合処理が必要
- 発言者行は行頭に出現し、直後の行から発言内容が始まる

---

## 注意事項

- PDF ファイル名に一貫した命名規則がないため、URL の推測ではなく HTML ページからのリンク抽出が必須
- PDF は 2 段組レイアウトのため、`pdfplumber` でのテキスト抽出時にカラム順序が崩れる可能性がある。レイアウト解析の設定が必要
- 全角数字が多用されている（日付、議員番号、金額など）
- ページネーションなし。全リンクが 1 ページに集約されている

---

## 推奨アプローチ

1. **HTML ページから全量取得**: 単一ページに全リンクが集約されているため、1 回のリクエストで全 PDF URL を収集可能
2. **PDF テキスト抽出**: `pdfplumber` を使用し、2 段組レイアウトに対応したテキスト抽出を行う
3. **レート制限**: 自治体サイトのため、PDF ダウンロード間に適切な待機時間（1〜2 秒）を設ける
4. **差分更新**: HTML ページの `更新日` を監視し、新しい PDF が追加された場合のみ差分取得する。既知の PDF URL リストと比較して未取得分のみダウンロードする
