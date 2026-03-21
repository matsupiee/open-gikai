# 阿蘇市議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.city.aso.kumamoto.jp/municipal/city_council/city_council/parliament_proceedings/
- 分類: 市公式サイトによる PDF 直接公開（本会議の会議録のみ）
- 文字コード: UTF-8
- 特記: 会議録は PDF ファイルで提供。HTML 形式の全文テキストは存在しない

---

## URL 構造

### 年度別一覧ページ

| 年度 | URL |
| --- | --- |
| 令和8年（2026年） | `https://www.city.aso.kumamoto.jp/municipal/city_council/city_council/parliament_proceedings/` |
| 令和7年（2025年） | `https://www.city.aso.kumamoto.jp/municipal/city_council/city_council/parliament_proceedings_r7/` |
| 令和6年（2024年） | `https://www.city.aso.kumamoto.jp/municipal/city_council/city_council/parliament_proceedings_r6/` |
| 令和5年（2023年） | `https://www.city.aso.kumamoto.jp/municipal/city_council/city_council/parliament_proceedings_r5/` |
| 令和4年（2022年） | `https://www.city.aso.kumamoto.jp/municipal/city_council/city_council/parliament_proceedings_r4/` |
| 令和3年（2021年） | `https://www.city.aso.kumamoto.jp/municipal/city_council/city_council/parliament_proceedings_r3/` |
| 令和2年（2020年） | `https://www.city.aso.kumamoto.jp/municipal/city_council/city_council/parliament_proceedings_r2/` |
| 令和元年（2019年） | `https://www.city.aso.kumamoto.jp/municipal/city_council/city_council/parliament_proceedings_r1/` |
| 平成30年（2018年） | `https://www.city.aso.kumamoto.jp/municipal/city_council/city_council/parliament_proceedings_h30/` |
| 平成29年（2017年） | `https://www.city.aso.kumamoto.jp/municipal/city_council/city_council/h29_2017/` |
| 平成28年（2016年） | `https://www.city.aso.kumamoto.jp/municipal/city_council/city_council/congress_materials/h28_2016/` |
| 平成27年（2015年） | `https://www.city.aso.kumamoto.jp/municipal/city_council/city_council/congress_materials/h27_2015/` |
| 平成26年（2014年） | `https://www.city.aso.kumamoto.jp/municipal/city_council/city_council/congress_materials/h26_2014/` |

年度別一覧ページにはページネーションなし。各ページに当該年度の全定例会・臨時会の資料リンクが掲載される。

### PDF ファイル URL パターン

PDF は `/files/uploads/{YYYY}/{MM}/{ファイル名}.pdf` の形式でホストされる。

**令和5年以降（新形式）の会議録ファイル名規則:**

| 種別 | ファイル名パターン | 内容 |
| --- | --- | --- |
| 目次 | `R{年号}_vol{回数}_teirei_mokuji.pdf` | 会議録目次 |
| 開会・提案 | `R{年号}_Vol{回数}_teirei_opening.pdf` | 開会・諸般の報告・提案理由の説明 |
| 議案質疑（日付別） | `R{年号}_vol{回数}_teirei_question_{MMDD}.pdf` | 議案質疑（日付ごとに分割） |
| 委員長報告 | `R{年号}_vol{回数}_teirei_question_report.pdf` | 委員長報告・質疑・討論・採決 |
| 一般質問（1日目） | `R{年号}_vol{回数}_teirei_general_question_1st.pdf` | 一般質問1日目 |
| 一般質問（2日目） | `R{年号}_vol{回数}_teirei_general_question_2nd.pdf` | 一般質問2日目 |
| 臨時会議事録 | `r{年号}_vol{回数}_rinji_report_discuss_vote.pdf` | 臨時会の議事録 |

**平成30年（旧形式）の会議録ファイル名規則:**

| 種別 | ファイル名パターン | 例 |
| --- | --- | --- |
| 目次 | `h{年号}{月}_teirei_mokuji.pdf` | `h3009_teirei_mokuji.pdf` |
| 日付別会議録 | `h{年号}{月}_teirei_{MMDD}.pdf` | `h3009_teirei_0831-2.pdf` |
| 臨時会 | `h{年号}{月}_rinji_{MMDD}.pdf` | `h3001_rinji_0202.pdf` |

---

## ページ構造

各年度ページは以下の構造で資料を整理している:

1. **議案一覧** (`giann_*.pdf` または `bill_list_*.pdf`)
2. **一般質問通告書** (`*_question_list.pdf`)（定例会のみ）
3. **審議結果** (`*_deliberation_result.pdf`)
4. **会議録**（複数 PDF に分割）
   - 目次
   - 開会・諸般の報告・提案理由の説明
   - 議案質疑（日付別に 1〜複数 PDF）
   - 委員長報告・質疑・討論・採決
   - 一般質問（日ごとに分割）

会議録 PDF は定例会終了後数ヶ月遅れて公開される傾向がある（例: 令和7年第4回定例会は 2025年6月開催 → 2026年2月に PDF 公開）。

---

## 会議の種別と年間スケジュール

阿蘇市議会は年間 6〜8 回の本会議（定例会＋臨時会）を開催している。

| 回 | 種別 | 開催時期の目安 |
| --- | --- | --- |
| 第1回 | 臨時会 | 1月 |
| 第2回 | 定例会 | 2月〜3月（予算議会） |
| 第3回 | 臨時会 | 4月〜5月 |
| 第4回 | 定例会 | 5月〜6月 |
| 第5回 | 定例会 | 8月〜9月 |
| 第6回 | 定例会 | 11月〜12月 |

※ 臨時会は状況により開催回数・時期が変動する。

---

## スクレイピング戦略

### Step 1: 年度別一覧ページのクロール

各年度の一覧ページにアクセスし、PDF リンクを収集する。

1. 年度 URL 一覧（令和8年〜平成26年）を定義
2. 各年度ページの HTML を取得し、`.pdf` へのリンクを Cheerio で全件抽出
3. リンクテキストと URL のペアを収集

```
対象ページ数: 13ページ（令和8年 〜 平成26年）
ページネーション: なし（1ページに当該年度の全資料）
```

### Step 2: 会議録 PDF の識別とフィルタリング

収集したリンクから会議録 PDF のみを抽出する。

**会議録に該当する PDF の判定条件:**

- リンクテキストに「目次」「開会」「議案質疑」「委員長報告」「一般質問」「議事録」が含まれる
- ファイル名に `_teirei_` または `_rinji_` が含まれ、かつ `giann`（議案一覧）・`question_list`（通告書）・`deliberation_result`（審議結果）でない

**除外対象 PDF（会議録ではない）:**

- 議案一覧: `giann_*.pdf`、`bill_list_*.pdf`
- 一般質問通告書: `*_question_list.pdf`
- 審議結果: `*_deliberation_result.pdf`、`*_eliberation_result.pdf`

### Step 3: PDF のテキスト抽出

会議録 PDF を取得し、PDF パーサー（`pdf-parse` 等）でテキストを抽出する。

**注意事項:**
- PDF は日付ごとに複数ファイルに分割されている（1 定例会で 5〜7 ファイル程度）
- 同一定例会の PDF は `目次` → `開会` → `議案質疑` → `委員長報告` → `一般質問` の順に処理する
- 全 PDF のテキストを結合して 1 定例会の会議録として扱う

---

## 注意事項

- **PDF のみの提供**: 会議録は PDF 形式のみで、HTML 全文テキストは存在しない。テキスト抽出には PDF パーサーが必須
- **会議録の公開遅延**: PDF は本会議終了後数ヶ月後に公開される。最新の定例会は会議録未公開の場合がある
- **ファイル名の不統一**: 年度によってファイル名規則が異なる（令和5年以降は `R{年号}_vol*_teirei_*.pdf`、平成30年は `h30{月}_teirei_*.pdf`）
- **URL パスの不統一**: 平成28〜29年のページは `/congress_materials/` 配下、平成29年は直接 `/h29_2017/` とパスが異なる
- **スキャン PDF の可能性**: 古い年度（平成26〜28年頃）の PDF はスキャン画像の場合があり、テキスト抽出が困難な可能性がある
- **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける

---

## 推奨アプローチ

1. **年度ページを起点としたリンク収集**: PDF の URL を直接推測せず、各年度ページから動的にリンクを収集する
2. **リンクテキストによる分類**: ファイル名だけでなくリンクテキストでドキュメント種別を判定することで、命名規則の揺れに対応する
3. **定例会単位でのグループ化**: ページの見出し構造（`h2`/`h3` 等）を解析し、同一定例会の PDF をグループ化してから処理する
4. **差分更新**: 年度ページごとに収集済み PDF URL をキャッシュし、新規追加分のみを処理する（会議録の遅延公開に対応）
5. **PDF パーサーの選定**: テキストレイヤーあり PDF には `pdf-parse`、スキャン PDF が含まれる場合は OCR ツール（Tesseract 等）を組み合わせる
