# 大木町議会 カスタムスクレイピング方針

## 概要

- サイト: https://smart.discussvision.net/smart/tenant/ooki/WebView/rd/schedule.html
- 分類: DiscussVision（smart.discussvision.net）による議会発言録・映像配信システム
- 文字コード: UTF-8
- 特記: DiscussVision は株式会社ディスカッションが提供する SaaS 型の議会映像配信・発言録閲覧システム。会議データは JavaScript で動的に読み込まれるため、静的 HTML スクレイピングでは会議一覧・発言録を取得できない

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 日程一覧（発言録） | `https://smart.discussvision.net/smart/tenant/ooki/WebView/rd/schedule.html` |
| 会議名一覧（振り分けページ） | `https://smart.discussvision.net/smart/tenant/ooki/WebView/rd/council.html` |
| 会議名一覧（映像あり） | `https://smart.discussvision.net/smart/tenant/ooki/WebView/rd/council_1.html` |
| 会議名一覧（会議録） | `https://smart.discussvision.net/smart/tenant/ooki/WebView/rd/council_2.html` |
| 発言一覧 | `https://smart.discussvision.net/smart/tenant/ooki/WebView/rd/schedule.html` |

### テナント識別子

URL 中の `ooki` が大木町のテナント識別子。他自治体は異なる識別子を持つ。

---

## システムの仕組み

DiscussVision `/rd/` パスは発言録（Record/Document）閲覧機能を提供する。

1. `council.html` がエントリーポイントで、`COUNCIL` 変数の値に応じて `council_1.html`（映像付き）または `council_2.html`（発言録）へリダイレクトする
2. 各 `council_*.html` は会議一覧をキーワード検索・年別絞り込み機能付きで表示する
3. 会議一覧のデータは JavaScript によって動的に読み込まれる（テンプレート HTML + 動的データ注入）
4. 個別会議の発言一覧は `schedule.html` で表示され、発言者・発言内容が一覧できる

---

## スクレイピング戦略

DiscussVision のコンテンツは JavaScript で動的に生成されるため、通常の HTTP リクエストでは会議一覧・発言録本文を取得できない。以下のいずれかのアプローチが必要。

### アプローチ A: ヘッドレスブラウザ（Playwright / Puppeteer）

1. `council_2.html` を Playwright で開き、JavaScriptの実行完了を待機
2. レンダリング後の DOM から会議名・開催日のリストを抽出
3. 各会議リンクをクリックして `schedule.html` の発言一覧を取得
4. 発言者・発言内容をパース

```typescript
// 例: Playwright での会議一覧取得
const page = await browser.newPage();
await page.goto('https://smart.discussvision.net/smart/tenant/ooki/WebView/rd/council_2.html');
await page.waitForSelector('.council-list'); // 実際のセレクタは要確認
const councils = await page.$$eval('.council-item', items =>
  items.map(item => ({
    name: item.querySelector('.council-name')?.textContent,
    url: item.querySelector('a')?.href,
  }))
);
```

### アプローチ B: DiscussVision API の解析

DiscussVision は内部的に REST API または JSON エンドポイントを使用して会議データを取得していると考えられる。ブラウザの開発者ツール（Network タブ）で実際のリクエストを観察し、API エンドポイントを特定することで直接データ取得が可能になる。

**調査手順:**
1. ブラウザで `council_2.html` を開く
2. DevTools の Network タブで XHR/Fetch リクエストを監視
3. 会議一覧データを返すエンドポイント URL を特定
4. パラメータ（年度、テナント ID 等）を解析してプログラムから呼び出す

---

## 注意事項

- DiscussVision は SaaS 型サービスのため、システム仕様がバージョンアップで変更される可能性がある
- `council_1.html` は映像配信（ライブ中継含む）、`council_2.html` は発言録（テキスト）を提供する可能性が高い
- テキスト形式の発言録が提供される場合、HTML 上で発言者ごとに構造化されたデータとして取得できる可能性がある
- 映像のみで発言録テキストが提供されない場合は、このシステムからのテキスト収集は困難

---

## 推奨アプローチ

1. **まず API 調査を優先**: ブラウザの DevTools で実際のネットワークリクエストを確認し、JSON API エンドポイントが存在するかを確認する
2. **API があれば直接利用**: JSON API 経由で会議一覧・発言録を取得する（ヘッドレスブラウザ不要）
3. **API がなければ Playwright**: JavaScript レンダリングが必要なため Playwright でスクレイピング
4. **テナント ID の活用**: 他の DiscussVision テナントと同一の API 構造を持つ可能性が高いため、他自治体の調査結果を流用できる
5. **レート制限**: SaaS サービスのため、過度なリクエストは IP ブロックのリスクがある。リクエスト間隔は 2〜3 秒以上を推奨
