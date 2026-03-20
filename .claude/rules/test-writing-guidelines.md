# テストコードの書き方ガイドライン

## ヘルパー関数を避ける (CRITICAL)

テストデータの準備処理（Arrange）でヘルパー関数を使わない。各テストケース内でデータをインラインに作成し、「何が設定されたか」「何が渡されたか」を一目で分かるようにする。

```typescript
// ❌ ヘルパー関数の使用
const { municipality } = await seedTestData(tx);
await service.method(municipality.id); // 結局どのような値が渡されているのか不明

// ✅ 各テスト内でインラインに作成
const [municipality] = await tx
  .insert(municipalities)
  .values({
    code: "999999",
    name: "テスト市",
    prefecture: "テスト県",
    enabled: true,
  })
  .returning();
await service.method(municipality!.id);
```

## 期待値はベタ書きする (CRITICAL)

### 計算結果・意味のある文字列は直接記述

変数化せず、expect に直接リテラルを書く。変数定義と expect の距離が離れると可読性が落ちる。

```typescript
// ❌ 不要な変数化
const expectedStatus = "pending";
// ... 20行後 ...
expect(job.status).toBe(expectedStatus);

// ✅ ベタ書き
expect(job.status).toBe("pending");
expect(result.deletedCount).toBe(2);
```

### 意味のない文字列（id など）は生成・取得した変数を使う

固定文字列の id をベタ書きすると他テストとの衝突リスクがあり、「この値自体に意味があるのか？」と混乱を招く。

```typescript
// ❌ id をベタ書き
const job = await getJob(tx, { jobId: "abc123" });

// ✅ 生成された値を変数で参照
const [created] = await tx.insert(scraper_jobs).values({ ... }).returning();
const job = await getJob(tx, { jobId: created!.id });
```
