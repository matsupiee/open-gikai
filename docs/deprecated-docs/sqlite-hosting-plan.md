# SQLite ホスティング計画

## 背景

- 議事録検索データベースが 200GB 超に達し、ストレージ料金が問題になる
- 検索は読み取り専用のため、SQLite ファイルをローカルで生成して配信する
- 既に libSQL (`@libsql/client`) ベースの検索実装は完了済み

## アーキテクチャ

```
[ローカル] SQLite ファイル生成 → GCS にアップロード
                                      ↓
[GCE VM] GCS からダウンロード → sqld (read-only) で配信
                                      ↑
                              libsql:// プロトコル
                                      ↑
[Vercel 等] apps/web サーバーサイド (@libsql/client)
```

### 各コンポーネントの役割

| コンポーネント | 役割 |
|---------------|------|
| ローカル | SQLite ファイルの生成・更新 |
| GCS | SQLite ファイルの保管・転送 |
| GCE VM + sqld | SQLite ファイルを libSQL プロトコルで配信 (read-only) |
| apps/web | `LIBSQL_URL` を VM に向けて検索クエリを実行 |

## GCE VM 構成

- **インスタンスタイプ**: e2-medium (2 vCPU / 4GB RAM) から開始、必要に応じてスケールアップ
- **ディスク**: pd-ssd 300GB（SQLite ファイル 200GB+ + 余裕）
- **OS**: Debian or Ubuntu
- **予算**: Google Cloud クレジット残高 約3万円

### 月額コスト見積もり（us-central1）

| リソース | スペック | 月額（税抜） |
|---------|---------|------------|
| e2-medium | 2 vCPU / 4GB RAM | 約 $25 (≈ ¥3,750) |
| pd-ssd 300GB | 永続 SSD ディスク | 約 $51 (≈ ¥7,650) |
| 外向きネットワーク | 〜100GB/月と仮定 | 約 $8 (≈ ¥1,200) |
| 静的 IP | 使用中は無料 | $0 |
| **合計** | | **約 $84 (≈ ¥12,600/月)** |

※ クレジット3万円で約2〜3ヶ月運用可能。リージョンやディスクタイプで変動あり。

### sqld 起動設定

```bash
sqld --db-path /data/minutes.db --http-listen-addr 0.0.0.0:8080 --read-only
```

- `--read-only`: 書き込みを禁止
- 認証は `LIBSQL_AUTH_TOKEN` 環境変数で制御

## SQLite ファイルの更新フロー

1. ローカルで新しい SQLite ファイルを生成
2. GCS にアップロード (`gsutil cp minutes.db gs://bucket/minutes.db`)
3. VM 上で GCS からダウンロード
4. sqld を再起動してファイルを切り替え

## apps/web 側の変更

- `LIBSQL_URL` を VM のアドレスに変更するのみ
- `LIBSQL_AUTH_TOKEN` を VM の sqld に合わせて設定
- コードの変更は不要

## TODO

### インフラ構築（Terraform で管理）

- [ ] Terraform で GCE VM をプロビジョニング（インスタンス、ディスク、ファイアウォール、静的 IP）
- [ ] Terraform で GCS バケット作成（SQLite ファイル保管用）
- [ ] Terraform で HTTPS ロードバランサー設定（またはマネージド SSL 証明書）

### アプリケーション設定

- [ ] sqld のインストールとセットアップスクリプト作成
- [ ] sqld の systemd サービス化（自動起動・再起動）
- [ ] 認証トークンの設定
- [ ] SQLite ファイルの GCS アップロード / VM ダウンロードスクリプト作成
- [ ] apps/web の環境変数更新（`LIBSQL_URL`, `LIBSQL_AUTH_TOKEN`）

### 検証・運用

- [ ] 動作検証（検索クエリの応答速度、メモリ使用量）
- [ ] SQLite ファイル更新の自動化（CI/CD or cron）


※ 結局、Supabaseの方がコスパいいと言う判断になりました。
- Teamプラン：$25
- ストレージ：200Gb * $0.125/Gb = $25