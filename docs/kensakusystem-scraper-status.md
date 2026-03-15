# kensakusystem スクレイパー — 現状整理と今後のアクション

作成日: 2026-03-14

---

## 背景

鈴鹿市（http://www.kensakusystem.jp/suzuka/sapphire.html）のスクレイピングが
当初 0件しか取得できなかった問題を調査・修正している。

---

## 発見された問題と修正状況

### 問題1: Shift-JIS POST body の文字化け ✅ 修正済み

**概要**
`URLSearchParams` は UTF-8 でエンコードするが、kensakusystem の CGI は
Shift-JIS の POST body を期待する。このため treedepth の値が文字化けして、
正しい委員会・年のツリーが開けなかった。

**修正**
`_shared.ts` に `fetchRawBytes` / `fetchRawBytesPost` / `percentEncodeBytes` /
`extractTreedepthRawBytes` を追加。HTMLレスポンスを raw bytes として取得し、
Shift-JIS のまま percent-encode して POST body を構築する。

---

### 問題2: 委員会スキップバグ ✅ 修正済み（今セッション）

**概要**
`fetchFromSapphire` の年ループで、年レベルの POST に直接 `ResultFrame.exe` リンクが
含まれている場合（本会議など）、`continue` で委員会処理をスキップしていた。
鈴鹿市では令和7年の年レベル POST に本会議リンクと委員会 treedepth が混在するため、
委員会議事録が全くスクレイピングされていなかった。

**修正**
`list/scraper.ts` の `if (directResultLinks.length > 0) continue;` を削除。
直接リンクを収集したあとも、委員会 treedepth のループを継続するように変更。

---

### 問題3: FRAMESET の多重ネスト（`GetHTML.exe`）✅ 修正済み（今セッション）

**概要**
`fileName=R070220QUES.html`（質問一覧など `.html` 拡張子の形式）では、
`r_TextFrame.exe` が返す FRAMESET に `GetText3.exe` ではなく `GetHTML.exe` が含まれる。
旧コードは `GetText3.exe` しか処理しなかったため、全件 `null` を返していた。

**実際の FRAMESET ネスト構造:**
```
ResultFrame.exe → FRAMESET
  └─ r_TextFrame.exe → FRAMESET
       ├─ (通常) GetText3.exe → テキスト本文
       └─ (.html形式) GetHTML.exe → HTML本文
```

**修正**
`detail/scraper.ts` の `fetchMeetingContent` に `GetHTML.exe` のパターンを追加。

---

## データ構造（鈴鹿市）

```
sapphire.html
  └─ See.exe (ツリーページ)
       └─ viewtree フォーム POST (各 treedepth)
            ├─ 年レベル (例: 令和7年, 令和8年)
            │    → ResultFrame.exe リンクが直接含まれる（本会議）
            │    → 委員会 treedepth も含まれる（並存）
            └─ 委員会レベル (例: 令和7年 総務委員会)
                 → ResultFrame.exe リンク一覧
```

---

## ファイル名の命名規則

| 形式 | 例 | 内容 | 対応する externalId |
|---|---|---|---|
| `[RHS]YYMMDDXXX` | `R080106B02` | 通常の議事録 | `kensakusystem_suzuka_R080106B02` |
| `[RHS]YYMMDD*.html` | `R070220QUES.html` | 質問一覧 HTML | `kensakusystem_suzuka_R070220QUES.html` |

ERA_BASE: R=2018（令和）, H=1988（平成）, S=1925（昭和）

---

## 現在の取得状況（修正前の最終実行結果）

- kensakusystem:list で検出: **286件**
- kensakusystem:detail で内容取得成功: **2件**（令和8年のみ）
- 原因: 問題2・問題3が未修正だった

---

## 今後のアクション

### アクション1: 修正後の動作確認（最優先）

```bash
# scraper-worker ディレクトリで実行
# 1. DBをリセット
/opt/homebrew/bin/psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "TRUNCATE scraper_jobs CASCADE; TRUNCATE meetings CASCADE;"

# 2. テストジョブ投入
/opt/homebrew/bin/psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "INSERT INTO scraper_jobs (id, municipality_id, year, status) VALUES (gen_random_uuid()::text, 'oonl28dgdhfytpaer39x6cqp', 2025, 'pending');"

# 3. 実行
bun --env-file ../web/.env src/utils/local-runner.ts
```

期待する結果:
- meetings に 200件以上が記録される
- statements にも分割結果が記録される

---

### アクション2: 委員会名の title 設定を改善（任意）

現在、本会議（年レベルから直接取得）の title は `2026-01-06`（日付のみ）になっている。
`extractResultFrameLinks` の `committeeName` が `undefined` のため。

改善案: 年レベルから取得した場合は「本会議」をデフォルト名として使う。

```ts
// list/scraper.ts の extractResultFrameLinks 呼び出し部分
const directResultLinks = extractResultFrameLinks(
  yearHtml,
  absoluteFormAction,
  "本会議" // ← committeeName を追加
);
```

---

### アクション3: 他の kensakusystem 自治体での動作確認（中優先）

修正は鈴鹿市（sapphire.html 形式）を主に想定しているが、
`isCgiType`（Search2.exe）や `isIndexHtmlType`（index.html）の自治体でも
問題なく動作するか確認する。

---

### アクション4: 年フィルタリングの実装（低優先）

現状、`dispatchJob.ts` で kensakusystem に `year` を渡していない。
他のスクレイパー（dbsearch など）と同様に、指定年のデータのみを取得する
フィルタリングを実装する。

---

## 関連ファイル

| ファイル | 役割 |
|---|---|
| `system-types/kensakusystem/_shared.ts` | Shift-JIS バイト操作ユーティリティ |
| `system-types/kensakusystem/list/scraper.ts` | 議事録一覧取得（sapphire/CGI/index形式） |
| `system-types/kensakusystem/list/handler.ts` | list メッセージハンドラ |
| `system-types/kensakusystem/detail/scraper.ts` | 議事録本文取得（FRAMESET追跡） |
| `system-types/kensakusystem/detail/handler.ts` | detail メッセージハンドラ |
| `handlers/dispatch-job.ts` | ジョブ種別判定 → 初回キュー投入 |
