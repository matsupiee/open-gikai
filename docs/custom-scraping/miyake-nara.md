# 三宅町議会（奈良県）カスタムスクレイピング方針

## 概要

- サイト: https://www.town.miyake.lg.jp/site/gikai/list15.html
- 分類: 公式サイト内 PDF 一覧（独立した検索システムなし）
- 文字コード: UTF-8
- 特記: 会議録は PDF 形式のみ。年度別に複数の索引ページに分割されている。

---

## URL 構造

| ページ | URL |
| --- | --- |
| 会議録トップ | `https://www.town.miyake.lg.jp/site/gikai/list15.html` |
| 会議録一覧（平成31年以降） | `https://www.town.miyake.lg.jp/site/gikai/8736.html` |
| 会議録一覧（平成30年以前） | `https://www.town.miyake.lg.jp/site/gikai/1109.html` |
| 式下中学校組合議会の会議録 | `https://www.town.miyake.lg.jp/site/gikai/8725.html` |
| PDF ファイル | `https://www.town.miyake.lg.jp/uploaded/attachment/{ID}.pdf` |

PDF の ID は連番だが欠番あり（1293〜5131 の範囲で分散）。ID からメタ情報は推測できないため、索引ページからリンクを収集する必要がある。

---

## 会議録の提供形式

- **形式**: PDF のみ
- **テキスト検索**: 不可（独立した検索システムなし）
- **ファイルサイズ**: 32KB〜2.4MB

---

## 年度・会議種別の構造

### 平成31年（2019年）以降 — `/site/gikai/8736.html`

| 年度 | 会議数 | 会議種別 |
| --- | --- | --- |
| 令和7年（2025年） | 5件 | 第1回定例会（3月）、第1回臨時会（5月）、第2回定例会（6月）、第3回定例会（9月）、第4回定例会（12月） |
| 令和6年（2024年） | 4件 | 第1回定例会（3月）、第2回定例会（6月）、第3回定例会（9月）、第4回定例会（12月） |
| 令和5年（2023年） | 5件 | 第1回定例会（3月）、第1回臨時議会、第2回定例会（6月）、第3回定例会（9月）、第4回定例会（12月） |
| 令和4年（2022年） | 4件 | 第1〜4回定例会 |
| 令和3年（2021年） | 5件 | 第1回定例会（3月）、第1回臨時会（4月）、第2回定例会（6月）、第3回定例会（9月）、第4回定例会（12月） |
| 令和2年（2020年） | 5件 | 第1回定例会（3月）、第1回臨時会（4月）、第2〜4回定例会 |
| 平成31年（2019年） | 6件 | 第1回臨時会（2月）、第1回定例会（3月）、第2回臨時会（5月）、第2〜4回定例会 |

### 平成30年（2018年）以前 — `/site/gikai/1109.html`

平成20年（2008年）〜平成30年（2018年）の会議録を収録。各年度 4〜8 件（定例会 4 回＋臨時会）。

### 式下中学校組合議会 — `/site/gikai/8725.html`

川西町・三宅町式下中学校組合議会の会議録。令和7年9月定例会の 1 件のみ確認（2026年2月時点）。

---

## PDFリンク一覧（確認済み）

### 令和7年
| 会議 | PDF URL |
| --- | --- |
| 第1回定例会（3月） | `/uploaded/attachment/4716.pdf` |
| 第1回臨時会（5月） | `/uploaded/attachment/4744.pdf` |
| 第2回定例会（6月） | `/uploaded/attachment/4956.pdf` |
| 第3回定例会（9月） | `/uploaded/attachment/4957.pdf` |
| 第4回定例会（12月） | `/uploaded/attachment/5131.pdf` |

### 令和6年
| 会議 | PDF URL |
| --- | --- |
| 第1回定例会（3月） | `/uploaded/attachment/3750.pdf` |
| 第2回定例会（6月） | `/uploaded/attachment/3749.pdf` |
| 第3回定例会（9月） | `/uploaded/attachment/4025.pdf` |
| 第4回定例会（12月） | `/uploaded/attachment/4188.pdf` |

### 令和5年
| 会議 | PDF URL |
| --- | --- |
| 第1回定例会（3月） | `/uploaded/attachment/2880.pdf` |
| 第1回臨時議会 | `/uploaded/attachment/2881.pdf` |
| 第2回定例会（6月） | `/uploaded/attachment/2882.pdf` |
| 第3回定例会（9月） | `/uploaded/attachment/2883.pdf` |
| 第4回定例会（12月） | `/uploaded/attachment/2884.pdf` |

### 令和4年
| 会議 | PDF URL |
| --- | --- |
| 第1回定例会（3月） | `/uploaded/attachment/1350.pdf` |
| 第2回定例会（6月） | `/uploaded/attachment/1351.pdf` |
| 第3回定例会（9月） | `/uploaded/attachment/1352.pdf` |
| 第4回定例会（12月） | `/uploaded/attachment/1353.pdf` |

### 令和3年
| 会議 | PDF URL |
| --- | --- |
| 第1回定例会（3月） | `/uploaded/attachment/1354.pdf` |
| 第1回臨時会（4月） | `/uploaded/attachment/1355.pdf` |
| 第2回定例会（6月） | `/uploaded/attachment/1356.pdf` |
| 第3回定例会（9月） | `/uploaded/attachment/4966.pdf` |
| 第4回定例会（12月） | `/uploaded/attachment/4967.pdf` |

### 令和2年
| 会議 | PDF URL |
| --- | --- |
| 第1回定例会（3月） | `/uploaded/attachment/1357.pdf` |
| 第1回臨時会（4月） | `/uploaded/attachment/1358.pdf` |
| 第2回定例会（6月） | `/uploaded/attachment/1359.pdf` |
| 第3回定例会（9月） | `/uploaded/attachment/1360.pdf` |
| 第4回定例会（12月） | `/uploaded/attachment/1361.pdf` |

### 平成31年
| 会議 | PDF URL |
| --- | --- |
| 第1回臨時会（2月） | `/uploaded/attachment/1362.pdf` |
| 第1回定例会（3月） | `/uploaded/attachment/1363.pdf` |
| 第2回臨時会（5月） | `/uploaded/attachment/1364.pdf` |
| 第2回定例会（6月） | `/uploaded/attachment/1365.pdf` |
| 第3回定例会（9月） | `/uploaded/attachment/1366.pdf` |
| 第4回定例会（12月） | `/uploaded/attachment/1367.pdf` |

### 平成30年
| 会議 | PDF URL |
| --- | --- |
| 第1回定例会（3月） | `/uploaded/attachment/1293.pdf` |
| 第1回臨時会（4月） | `/uploaded/attachment/1294.pdf` |
| 第2回定例会（6月） | `/uploaded/attachment/1295.pdf` |
| 第3回定例会（9月） | `/uploaded/attachment/1296.pdf` |
| 第4回定例会（12月） | `/uploaded/attachment/1297.pdf` |

### 平成29年
| 会議 | PDF URL |
| --- | --- |
| 第1回定例会（3月） | `/uploaded/attachment/1298.pdf` |
| 第1回臨時会（4月） | `/uploaded/attachment/1299.pdf` |
| 第2回定例会（6月） | `/uploaded/attachment/1300.pdf` |
| 第3回定例会（9月） | `/uploaded/attachment/1301.pdf` |
| 第4回定例会（12月） | `/uploaded/attachment/1302.pdf` |

### 平成28年
| 会議 | PDF URL |
| --- | --- |
| 第1回定例会（3月） | `/uploaded/attachment/1303.pdf` |
| 第1回臨時会（4月） | `/uploaded/attachment/1304.pdf` |
| 第2回定例会（6月） | `/uploaded/attachment/1305.pdf` |
| 第3回定例会（9月） | `/uploaded/attachment/1306.pdf` |
| 第4回定例会（12月） | `/uploaded/attachment/1307.pdf` |

### 平成27年
| 会議 | PDF URL |
| --- | --- |
| 第1回定例会（3月） | `/uploaded/attachment/1308.pdf` |
| 第1回臨時会（5月） | `/uploaded/attachment/1309.pdf` |
| 第2回定例会（6月） | `/uploaded/attachment/1310.pdf` |
| 第3回定例会（9月） | `/uploaded/attachment/1311.pdf` |
| 第4回定例会（12月） | `/uploaded/attachment/1312.pdf` |

### 平成26年
| 会議 | PDF URL |
| --- | --- |
| 第1回臨時会（2月） | `/uploaded/attachment/1313.pdf` |
| 第1回定例会（3月） | `/uploaded/attachment/1314.pdf` |
| 第2回臨時会（4月） | `/uploaded/attachment/1315.pdf` |
| 第2回定例会（6月） | `/uploaded/attachment/1316.pdf` |
| 第3回定例会（9月） | `/uploaded/attachment/1317.pdf` |
| 第4回定例会（12月） | `/uploaded/attachment/1318.pdf` |

### 平成25年
| 会議 | PDF URL |
| --- | --- |
| 第1回定例会（3月） | `/uploaded/attachment/1319.pdf` |
| 第1回臨時会（4月） | `/uploaded/attachment/1320.pdf` |
| 第2回定例会（6月） | `/uploaded/attachment/1321.pdf` |
| 第2回臨時会（7月） | `/uploaded/attachment/1322.pdf` |
| 第3回定例会（9月） | `/uploaded/attachment/1323.pdf` |
| 第4回定例会（12月） | `/uploaded/attachment/1324.pdf` |

### 平成24年
| 会議 | PDF URL |
| --- | --- |
| 第1回定例会（3月） | `/uploaded/attachment/1325.pdf` |
| 第1回臨時会（4月） | `/uploaded/attachment/1326.pdf` |
| 第2回定例会（6月） | `/uploaded/attachment/1327.pdf` |
| 第3回定例会（9月） | `/uploaded/attachment/1328.pdf` |
| 第4回定例会（12月） | `/uploaded/attachment/1329.pdf` |

### 平成23年
| 会議 | PDF URL |
| --- | --- |
| 第1回定例会（3月） | `/uploaded/attachment/1330.pdf` |
| 第1回臨時会（5月） | `/uploaded/attachment/1331.pdf` |
| 第2回定例会（6月） | `/uploaded/attachment/1332.pdf` |
| 第3回定例会（9月） | `/uploaded/attachment/1333.pdf` |
| 第4回定例会（12月） | `/uploaded/attachment/1334.pdf` |

### 平成22年
| 会議 | PDF URL |
| --- | --- |
| 第1回定例会（3月） | `/uploaded/attachment/1335.pdf` |
| 第1回臨時会（4月） | `/uploaded/attachment/1336.pdf` |
| 第2回定例会（6月） | `/uploaded/attachment/1337.pdf` |
| 第3回定例会（9月） | `/uploaded/attachment/1338.pdf` |
| 第2回臨時会（11月） | `/uploaded/attachment/1339.pdf` |
| 第4回定例会（12月） | `/uploaded/attachment/1340.pdf` |

### 平成21年
| 会議 | PDF URL |
| --- | --- |
| 第1回定例会（3月） | `/uploaded/attachment/1341.pdf` |
| 第1回臨時会（5月） | `/uploaded/attachment/4610.pdf` |
| 第2回臨時会（5月） | `/uploaded/attachment/1342.pdf` |
| 第2回定例会（6月） | `/uploaded/attachment/1343.pdf` |
| 第3回臨時会（7月） | `/uploaded/attachment/1344.pdf` |
| 第3回定例会（9月） | `/uploaded/attachment/4611.pdf` |
| 第4回臨時会（11月） | `/uploaded/attachment/1345.pdf` |
| 第4回定例会（12月） | `/uploaded/attachment/4612.pdf` |

### 平成20年
| 会議 | PDF URL |
| --- | --- |
| 第1回臨時会（5月） | `/uploaded/attachment/1346.pdf` |
| 第2回定例会（6月） | `/uploaded/attachment/1347.pdf` |
| 第3回定例会（9月） | `/uploaded/attachment/1348.pdf` |
| 第4回定例会（12月） | `/uploaded/attachment/1349.pdf` |

### 式下中学校組合議会
| 会議 | PDF URL |
| --- | --- |
| 令和7年第2回定例会（9月） | `/uploaded/attachment/5128.pdf` |

---

## スクレイピング戦略

### Step 1: 索引ページから PDF リンクを収集

以下の 3 つの索引ページを取得し、`/uploaded/attachment/*.pdf` 形式のリンクを Cheerio で抽出する。

1. `https://www.town.miyake.lg.jp/site/gikai/8736.html`（平成31年以降）
2. `https://www.town.miyake.lg.jp/site/gikai/1109.html`（平成30年以前）
3. `https://www.town.miyake.lg.jp/site/gikai/8725.html`（式下中学校組合議会）

各リンクに付随するテキスト（年度・会議種別・月）をリンク要素の前後のテキストから取得する。

### Step 2: メタ情報の抽出

各 PDF リンク周辺の HTML から以下を抽出する。

```typescript
// 年度の抽出（見出し要素から）
const yearPattern = /(令和|平成)(\d+)年/;

// 会議種別の抽出（リンクテキストまたは隣接テキストから）
// 例: "第1回定例会（3月）", "第1回臨時会（4月）"
const sessionPattern = /第(\d+)回(定例会|臨時会|臨時議会)(?:（(\d+)月）)?/;
```

### Step 3: PDF の取得とテキスト抽出

PDFをダウンロードし、`pdf-parse` 等のライブラリでテキストを抽出する。

- 全文テキストのみが対象（OCR 不要と想定）
- ファイルサイズが大きいもの（2MB 超）はタイムアウト設定を長めにする

---

## 注意事項

- PDF の attachment ID は連番ではなく不規則（1293〜5131 の範囲に散在）。索引ページからのリンク収集が必須。
- 平成21年は同月に複数の臨時会が開催されており、ID の振り方が不連続になっている（例: 4610, 4611, 4612 が 1341〜1345 の間に混在）。
- 索引ページは年度区分ごとに 2 ページに分かれているため、両方を必ずクロールする。
- 式下中学校組合議会は三宅町議会とは別組織（川西町との組合）。収録対象に含めるかどうかは運用方針による。

---

## 推奨アプローチ

1. **索引ページの全量取得**: 3 つの索引ページを取得し、PDF リンクと周辺テキストを一括収集する
2. **差分更新**: 索引ページの最終更新日を確認し、変更があった場合のみ再クロールする
3. **レート制限**: 自治体サイトのため、リクエスト間に 1〜2 秒の待機時間を設ける
4. **PDF ID の管理**: PDF の attachment ID を一意キーとして使い、取得済みかどうかを判定する
