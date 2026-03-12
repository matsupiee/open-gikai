# packages/api のルール

## apps/web 専用パッケージ (CRITICAL)

`packages/api` は **apps/web から呼ばれる oRPC プロシージャのみ** を実装する場所です。

```
✅ CORRECT: apps/web/src が orpc.xxx.queryOptions() などで呼ぶプロシージャ
❌ WRONG:   apps/web から呼ばれていないプロシージャ
❌ WRONG:   scraper-worker や他のアプリ専用のロジック
```

## 追加・削除のガイドライン

- 新しいプロシージャを追加する前に、apps/web から実際に呼ばれることを確認する
- apps/web から削除されたエンドポイントは packages/api からも同時に削除する
- scraper-worker や将来の別アプリ専用のロジックは、そのアプリ内か専用パッケージに置く

## 参照

- oRPC のセットアップ: `apps/web/src/utils/orpc.ts`
- HTTP ハンドラ: `apps/web/src/routes/api/rpc/$.ts`
