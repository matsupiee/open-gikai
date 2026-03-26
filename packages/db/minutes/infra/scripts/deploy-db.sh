#!/bin/bash
# =============================================================================
# DB デプロイスクリプト
# =============================================================================
# GCS にアップロード済みの SQLite ファイルを VM にダウンロードし、sqld を再起動する。
# upload-db.sh でアップロードした後にこのスクリプトを実行する。
#
# 使い方:
#   ./deploy-db.sh
#
# 処理の流れ:
#   1. VM に SSH 接続
#   2. sqld サービスを停止（DB ファイルのロックを解放）
#   3. GCS から新しい DB ファイルをダウンロード（上書き）
#   4. sqld サービスを再起動
#   5. ヘルスチェックで正常起動を確認
#
# 前提条件:
#   - gcloud CLI がインストール済みで認証済み
#   - terraform apply が完了済み
#   - upload-db.sh で DB が GCS にアップロード済み

set -euo pipefail

# このスクリプト自身のディレクトリから terraform ディレクトリの相対パスを計算
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TERRAFORM_DIR="${SCRIPT_DIR}/../terraform"

# terraform output から VM 接続情報を取得
# grep -oP が macOS で使えないため、各値を個別に取得する
ZONE=$(cd "${TERRAFORM_DIR}" && terraform output -raw zone)
PROJECT=$(cd "${TERRAFORM_DIR}" && terraform output -raw project)
VM_IP=$(cd "${TERRAFORM_DIR}" && terraform output -raw vm_external_ip)
BUCKET=$(cd "${TERRAFORM_DIR}" && terraform output -raw gcs_bucket_name)

echo "Deploying database to sqld-server..."

# gcloud compute ssh で VM にリモートコマンドを実行
# --command に渡した文字列が VM 上のシェルで実行される
gcloud compute ssh sqld-server \
  --zone="${ZONE}" \
  --project="${PROJECT}" \
  --command="
    sudo systemctl stop sqld                                                    # sqld を停止して DB ファイルのロックを解放
    sudo -u sqld gsutil cp gs://${BUCKET}/minutes.db /var/lib/sqld/data.db      # sqld ユーザーとして GCS から DB をダウンロード
    sudo systemctl start sqld                                                   # sqld を再起動
  "

# sqld の起動を少し待ってからヘルスチェック
echo "Waiting for sqld to start..."
sleep 3

# /health エンドポイントに HTTP リクエストを送って正常起動を確認
# -o /dev/null: レスポンスボディを破棄
# -w "%{http_code}": HTTP ステータスコードだけを出力
HTTP_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "http://${VM_IP}:8080/health" || echo "000")
if [ "${HTTP_STATUS}" = "200" ]; then
  echo "sqld is healthy. Deploy complete."
else
  # ヘルスチェック失敗時はログの確認コマンドを案内
  echo "Warning: Health check returned ${HTTP_STATUS}. Check VM logs with:"
  echo "  gcloud compute ssh sqld-server --zone=${ZONE} --project=${PROJECT} --command='sudo journalctl -u sqld -n 50'"
fi
