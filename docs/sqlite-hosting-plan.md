# SQLite ホスティング計画

## 背景

- PostgreSQL (Turso) で運用中の議事録検索データベースが 200GB 超に達し、料金が問題になっている
- 検索は読み取り専用のため、SQLite ファイルをローカルで生成して配信する方式に移行する
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

- [ ] GCE VM のプロビジョニング（インスタンス作成、ファイアウォール設定）
- [ ] sqld のインストールとセットアップスクリプト作成
- [ ] SQLite ファイルの GCS アップロード / VM ダウンロードスクリプト作成
- [ ] sqld の systemd サービス化（自動起動・再起動）
- [ ] 認証トークンの設定
- [ ] HTTPS 対応（Caddy or nginx リバースプロキシ、またはロードバランサー）
- [ ] apps/web の環境変数更新（`LIBSQL_URL`, `LIBSQL_AUTH_TOKEN`）
- [ ] 動作検証（検索クエリの応答速度、メモリ使用量）
- [ ] SQLite ファイル更新の自動化（CI/CD or cron）
